/**
 * mascus 线索解析 / 采集单测（2026-11）
 *
 * 分两块：
 *   A. `src/lib/mascus-leads/parse.ts` 的纯函数（解析 + 集计判定）—— 零依赖，直接跑；
 *   B. `src/lib/mascus-leads/ingest.ts` 的采集编排 —— mock 掉 `@/lib/db`（避免 DATABASE_URL 依赖）
 *      与全局 `fetch`（避免真实网络），只验证预算闸 / 死段告警 / 幂等 upsert 计数。
 *
 * 核心回归点：
 *   1. 价格 0 的条目**必须保留**：实测 price 比例按品类差异极大 —— tractors 27/40、
 *      agricultural-harvesters 24/40、hay-and-forage-machines 仅 1/40（无价率 97.5%），
 *      三段加权约 57% 有价。hay 段整段都带卖家电话，按价格过滤会把最核心的品类整段丢掉。
 *   2. `sellerPhone` / `companyName` / `locationCity` 原样透传；
 *   3. 相对 `assetUrl` 补成 mascus 绝对 URL；
 *   4. 无时区 `createDate` 按 UTC 解析（避免部署机时区导致 8 小时漂移）；
 *   5. 空字符串归一化为 null；
 *   6. 无 `__NEXT_DATA__` / JSON 损坏时降级为空结果且不抛异常；
 *   7. 扫描段里**不得再出现** `soil-preparation`（实测已指错品类、0 条，2026-11 废弃）；
 *   8. 整段 0 条必须能被识别出来（死段告警的唯一防线）；
 *   9. 总预算耗尽时置 `budgetExhausted` 且不抛错。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MASCUS_ORIGIN,
  MASCUS_SCAN_SEGMENTS,
  buildMascusSearchUrl,
  dedupeByProductId,
  findEmptySegments,
  parseMascusNextData,
} from "@/lib/mascus-leads/parse";
import type { SegmentScanStat } from "@/lib/mascus-leads/parse";

/** db mock：ingest 只用到 mascusListing.findMany / upsert */
const dbMock = vi.hoisted(() => ({
  findMany: vi.fn(async (_args?: unknown) => [] as { productId: string }[]),
  upsert: vi.fn(async (_args?: unknown) => ({}) as unknown),
}));

vi.mock("@/lib/db", () => ({
  prisma: { mascusListing: dbMock },
}));

// 必须在 vi.mock 之后 import，才能拿到被 mock 的 prisma
import { ingestMascusLeads } from "@/lib/mascus-leads/ingest";

/** 内联最小 __NEXT_DATA__ fixture：一条「有价格」、一条「价格 0 且电话为空串」 */
const FIXTURE_ITEMS = [
  {
    productId: "{31350D50-BA91-4D58-94A6-50B8D6BB7FD3}",
    brand: "John Deere",
    model: "450M",
    yearOfManufacture: 2018,
    catalogName: "agriculture",
    categoryName: "roundbalers",
    locationCountryCode: "US",
    locationCity: "Mansfield, Ohio",
    priceEURO: 35507,
    priceOriginal: 39900,
    priceOriginalUnit: "USD",
    imageUrl:
      "https://dnge9sb91helb.cloudfront.net/image/product/medium/johndeereus/john-deere-450m,12046686_82881918_90424.jpg",
    assetUrl: "/agriculture/round-balers/john-deere-450m/6g6k3s8f.html",
    companyUrl: "/ag-pro-mansfield-oh/9332a176,1,relevance,searchdealer.html",
    companyCountry: "US",
    companyId: "{9332a176-c1ca-488d-b58f-4d0dcd7bc3ec}",
    companyName: "Ag-Pro - Mansfield, OH",
    createDate: "2026-11-03T00:02:53.857",
    sellerPhone: "+1 419-529-6160",
  },
  {
    productId: "{AABBCCDD-0000-1111-2222-333344445555}",
    brand: "Krone",
    model: "Comprima F 155",
    yearOfManufacture: null,
    catalogName: "agriculture",
    categoryName: "roundbalers",
    locationCountryCode: "DE",
    locationCity: "Vechta",
    priceEURO: 0,
    priceOriginal: 0,
    priceOriginalUnit: "",
    imageUrl: "",
    assetUrl: "/agriculture/round-balers/krone-comprima-f-155/abc123.html",
    companyCountry: "DE",
    companyName: "Landtechnik Vechta GmbH",
    createDate: "2026-11-02T10:00:00",
    sellerPhone: "",
  },
];

/** 把 items 包成 mascus 真实页面结构（`props.pageProps.searchRes.searchData`） */
function buildFixtureHtml(
  items: unknown[],
  totalResults: number = 1234
): string {
  const payload = {
    props: {
      pageProps: {
        searchRes: {
          searchData: { items, totalResults },
        },
      },
    },
  };
  return [
    "<!DOCTYPE html><html><head><title>mascus</title></head><body>",
    '<div id="__next">…</div>',
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`,
    "</body></html>",
  ].join("");
}

/** 造 n 条互不相同的 item（用于验证「满页 40 条」与 totalResults 收敛） */
function makeItems(count: number, startIndex = 0): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => ({
    productId: `{GEN-${startIndex + index}}`,
    brand: "John Deere",
    model: "450M",
    yearOfManufacture: 2018,
    catalogName: "agriculture",
    categoryName: "roundbalers",
    locationCountryCode: "US",
    locationCity: "Mansfield, Ohio",
    priceEURO: 0,
    priceOriginal: 0,
    priceOriginalUnit: "",
    assetUrl: `/agriculture/round-balers/x/${startIndex + index}.html`,
    companyName: "Ag-Pro",
    createDate: "2026-11-03T00:02:53.857",
    sellerPhone: "+1 419-529-6160",
  }));
}

/** fetch 假响应（只实现 fetchHtml 用到的成员） */
interface StubResponse {
  url?: string;
  ok?: boolean;
  status?: number;
  text: string;
}

/**
 * 替换全局 `fetch`（不触网），返回一个「被请求过的 URL 列表」。
 * 默认响应的 `url` 回填请求 URL，以便真实走一遍「跳转落点 host 校验」。
 */
function stubFetch(htmlFor: (url: string) => string): string[] {
  return stubRawFetch((url) => ({ text: htmlFor(url) }));
}

/** 同上，但可自定义响应的 url / ok / status（用于跳转落点异常等场景） */
function stubRawFetch(factory: (url: string) => StubResponse): string[] {
  const urls: string[] = [];
  vi.stubGlobal("fetch", (input: unknown) => {
    const url = String(input);
    urls.push(url);
    const stub = factory(url);
    return Promise.resolve({
      ok: stub.ok ?? true,
      status: stub.status ?? 200,
      url: stub.url ?? url,
      text: () => Promise.resolve(stub.text),
    });
  });
  return urls;
}

describe("MASCUS 常量", () => {
  it("MASCUS_ORIGIN 指向国际站", () => {
    expect(MASCUS_ORIGIN).toBe("https://www.mascus.com");
  });

  it("扫描段恰好 6 段：含 tillage-machines / other-agricultural-machines / sprayers，不含已废弃的 soil-preparation", () => {
    expect(MASCUS_SCAN_SEGMENTS).toHaveLength(6);
    const paths = MASCUS_SCAN_SEGMENTS.map((segment) => segment.path);
    const keys = MASCUS_SCAN_SEGMENTS.map((segment) => segment.key);
    expect(paths).toEqual([
      "/agriculture/tractors",
      "/agriculture/tillage-machines",
      "/agriculture/hay-and-forage-machines",
      "/agriculture/other-agricultural-machines",
      "/agriculture/agricultural-harvesters",
      "/agriculture/sprayers",
    ]);
    // 新增的两个高产段必须在（2026-11 实测 total=166 / total=106）
    expect(keys).toContain("tillage-machines");
    expect(keys).toContain("other-agricultural-machines");
    // B 档 2026-11-06：sprayers 已纳入（trailers 0 目标品牌命中，仍排除）
    expect(keys).toContain("sprayers");
    expect(keys).not.toContain("trailers");
    // 防回退锁：soil-preparation 实测已指向 "Wine Growing Equipment"、0 条；tillage-equipment 是 404
    expect(keys).not.toContain("soil-preparation");
    expect(paths.some((path) => path.includes("soil-preparation"))).toBe(false);
    expect(paths.some((path) => path.includes("tillage-equipment"))).toBe(false);
  });
});

describe("buildMascusSearchUrl", () => {
  it("按 lastcreateddays + page 拼出分页 URL", () => {
    expect(
      buildMascusSearchUrl("/agriculture/hay-and-forage-machines", {
        recentDays: 2,
        page: 1,
      })
    ).toBe("https://www.mascus.com/agriculture/hay-and-forage-machines?lastcreateddays=2&page=1");
  });

  it("省略参数时回落为最近 2 天第 1 页", () => {
    expect(buildMascusSearchUrl("/agriculture/tractors")).toBe(
      "https://www.mascus.com/agriculture/tractors?lastcreateddays=2&page=1"
    );
  });

  it("容忍无前导斜杠 / 尾斜杠 / 附加 query / 绝对 URL 输入", () => {
    expect(buildMascusSearchUrl("agriculture/soil-preparation/", { recentDays: 7, page: 3 })).toBe(
      "https://www.mascus.com/agriculture/soil-preparation?lastcreateddays=7&page=3"
    );
    expect(buildMascusSearchUrl("/agriculture/tractors?q=john+deere", { page: 2 })).toBe(
      "https://www.mascus.com/agriculture/tractors?lastcreateddays=2&page=2"
    );
    expect(
      buildMascusSearchUrl("https://www.mascus.com/agriculture/agricultural-harvesters", {
        recentDays: 1,
        page: 4,
      })
    ).toBe(
      "https://www.mascus.com/agriculture/agricultural-harvesters?lastcreateddays=1&page=4"
    );
  });
});

describe("parseMascusNextData", () => {
  it("价格 0 的条目同样保留（严禁按价格过滤）", () => {
    const { items, totalResults } = parseMascusNextData(buildFixtureHtml(FIXTURE_ITEMS));

    expect(totalResults).toBe(1234);
    expect(items).toHaveLength(2);
    expect(items[0].priceEuro).toBe(35507);
    // 关键断言：价格 0 的条目不能丢
    expect(items[1].priceEuro).toBe(0);
    expect(items[1].productId).toBe("{AABBCCDD-0000-1111-2222-333344445555}");
  });

  it("productId 保留花括号原样，电话 / 公司名 / 城市透传", () => {
    const { items } = parseMascusNextData(buildFixtureHtml(FIXTURE_ITEMS));
    const [first, second] = items;

    expect(first.productId).toBe("{31350D50-BA91-4D58-94A6-50B8D6BB7FD3}");
    expect(first.sellerPhone).toBe("+1 419-529-6160");
    expect(first.companyName).toBe("Ag-Pro - Mansfield, OH");
    expect(first.locationCity).toBe("Mansfield, Ohio");
    expect(first.locationCountry).toBe("US");
    expect(first.companyCountry).toBe("US");
    expect(first.brandName).toBe("John Deere");
    expect(first.modelName).toBe("450M");
    expect(first.year).toBe(2018);
    expect(first.categoryName).toBe("roundbalers");
    expect(first.catalogName).toBe("agriculture");
    expect(first.priceOriginal).toBe(39900);
    expect(first.priceCurrency).toBe("USD");

    expect(second.sellerPhone).toBeNull();
    expect(second.companyName).toBe("Landtechnik Vechta GmbH");
    expect(second.year).toBeNull();
    expect(second.priceCurrency).toBeNull();
  });

  it("相对 assetUrl 补成 mascus 绝对 URL，绝对 imageUrl 原样保留", () => {
    const { items } = parseMascusNextData(buildFixtureHtml(FIXTURE_ITEMS));

    expect(items[0].assetUrl).toBe(
      "https://www.mascus.com/agriculture/round-balers/john-deere-450m/6g6k3s8f.html"
    );
    expect(items[0].imageUrl).toBe(
      "https://dnge9sb91helb.cloudfront.net/image/product/medium/johndeereus/john-deere-450m,12046686_82881918_90424.jpg"
    );
    // 空字符串图片地址归一化为 null（首条有图，第二条 imageUrl: ""）
    expect(items[1].imageUrl).toBeNull();
    expect(items[1].assetUrl).toBe(
      "https://www.mascus.com/agriculture/round-balers/krone-comprima-f-155/abc123.html"
    );
  });

  it("无时区 createDate 按 UTC 解析（不随部署机时区漂移）", () => {
    const { items } = parseMascusNextData(buildFixtureHtml(FIXTURE_ITEMS));

    expect(items[0].listedAt).toBeInstanceOf(Date);
    expect(items[0].listedAt?.toISOString()).toBe("2026-11-03T00:02:53.857Z");
    expect(items[1].listedAt?.toISOString()).toBe("2026-11-02T10:00:00.000Z");
  });

  it("空字符串字段统一转 null（sellerPhone: \"\" → null）", () => {
    const { items } = parseMascusNextData(buildFixtureHtml(FIXTURE_ITEMS));
    expect(items[1].sellerPhone).toBeNull();
    expect(items[1].priceCurrency).toBeNull();
    expect(items[0].sellerPhone).toBe("+1 419-529-6160");
  });

  it("保留原始 item 对象供回溯", () => {
    const { items } = parseMascusNextData(buildFixtureHtml(FIXTURE_ITEMS));
    expect(items[0].raw.companyUrl).toBe(
      "/ag-pro-mansfield-oh/9332a176,1,relevance,searchdealer.html"
    );
    expect(items[0].raw.companyId).toBe("{9332a176-c1ca-488d-b58f-4d0dcd7bc3ec}");
  });

  it("丢弃 productId 为空或缺失的脏条目", () => {
    const dirty = [
      { ...FIXTURE_ITEMS[0] },
      { productId: "   ", sellerPhone: "+49 1" },
      { brand: "Fendt" },
    ];
    const { items } = parseMascusNextData(buildFixtureHtml(dirty, 3));
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe("{31350D50-BA91-4D58-94A6-50B8D6BB7FD3}");
  });

  it("无 __NEXT_DATA__ / 损坏 JSON / 结构缺失一律降级为空结果，不抛异常", () => {
    const cases = [
      "<html><body>no next data here</body></html>",
      '<html><body><script id="__NEXT_DATA__">{broken json</script></body></html>',
      '<html><body><script id="__NEXT_DATA__">{"props":{}}</script></body></html>',
      '<html><body><script id="__NEXT_DATA__">null</script></body></html>',
      "",
    ];
    for (const html of cases) {
      const result = parseMascusNextData(html);
      expect(result.items).toEqual([]);
      expect(result.totalResults).toBe(0);
    }
  });

  it("totalResults 缺失时回落 0，items 仍正常解析", () => {
    const payload = {
      props: { pageProps: { searchRes: { searchData: { items: FIXTURE_ITEMS } } } },
    };
    const html = `<html><body><script id="__NEXT_DATA__">${JSON.stringify(payload)}</script></body></html>`;
    const result = parseMascusNextData(html);
    expect(result.items).toHaveLength(2);
    expect(result.totalResults).toBe(0);
  });
});

describe("dedupeByProductId", () => {
  it("同批次重复 productId 只保留首次出现的一条", () => {
    const rows = [
      { productId: "{A}", scanSegment: "tractors" },
      { productId: "{B}", scanSegment: "tractors" },
      { productId: "{A}", scanSegment: "tillage-machines" },
      { productId: "{C}", scanSegment: "hay-and-forage-machines" },
      { productId: "{B}", scanSegment: "tillage-machines" },
    ];
    const unique = dedupeByProductId(rows);

    expect(unique).toHaveLength(3);
    expect(unique.map((row) => row.productId)).toEqual(["{A}", "{B}", "{C}"]);
    // 保留首次出现的 scanSegment
    expect(unique[0].scanSegment).toBe("tractors");
  });

  it("空数组与单条输入均安全", () => {
    expect(dedupeByProductId([])).toEqual([]);
    expect(dedupeByProductId([{ productId: "{A}" }])).toHaveLength(1);
  });
});

describe("findEmptySegments（死段判定）", () => {
  /** 造一条集计记录 */
  function stat(
    key: string,
    items: number,
    totalResults: number,
    pages = 1,
    failedPages = 0
  ): SegmentScanStat {
    return { key, items, totalResults, pages, failedPages };
  }

  it("0 条且 totalResults=0 判为死段（线上 soil-preparation 失效形态）", () => {
    expect(findEmptySegments([stat("soil-preparation", 0, 0)])).toEqual(["soil-preparation"]);
  });

  it("items 或 totalResults 任一 > 0 都不算死段", () => {
    expect(findEmptySegments([stat("tractors", 40, 163)])).toEqual([]);
    // 有货但本轮没抓到（例如本页解析失败后仍报 total>0）不算死段，避免误报
    expect(findEmptySegments([stat("tractors", 0, 163)])).toEqual([]);
    // 抓到条但页面没报 total（结构变更）也不算死段
    expect(findEmptySegments([stat("tractors", 3, 0)])).toEqual([]);
  });

  it("整段抓取失败（items=0 / total=0 / failedPages=3）同样判为死段", () => {
    expect(findEmptySegments([stat("loaders", 0, 0, 0, 3)])).toEqual(["loaders"]);
  });

  it("混合场景只挑出死段，且保持输入顺序", () => {
    const stats = [
      stat("tractors", 120, 163),
      stat("tillage-machines", 0, 0),
      stat("hay-and-forage-machines", 40, 151),
      stat("loaders", 0, 0),
    ];
    expect(findEmptySegments(stats)).toEqual(["tillage-machines", "loaders"]);
  });

  it("空数组 / 脏 key 均安全", () => {
    expect(findEmptySegments([])).toEqual([]);
    expect(findEmptySegments([stat("", 0, 0)])).toEqual([]);
  });
});

describe("ingestMascusLeads（db 与 fetch 均已 mock，不触网不连库）", () => {
  beforeEach(() => {
    delete process.env.SITE; // 默认 com
    dbMock.findMany.mockReset();
    dbMock.findMany.mockResolvedValue([]);
    dbMock.upsert.mockReset();
    dbMock.upsert.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SITE;
  });

  it("SITE=cn 时抛合规错误，且一个请求都不发", async () => {
    process.env.SITE = "cn";
    const urls = stubFetch(() => buildFixtureHtml([], 0));

    await expect(ingestMascusLeads()).rejects.toThrow(/仅允许在 \.com 侧运行/);
    expect(urls).toHaveLength(0);
    expect(dbMock.upsert).not.toHaveBeenCalled();
  });

  it("总预算耗尽：置 budgetExhausted、立即收工、不误报死段、不抛错", async () => {
    const urls = stubFetch(() => buildFixtureHtml([], 0));

    const result = await ingestMascusLeads({ budgetMs: -1 });

    expect(result.budgetExhausted).toBe(true);
    expect(result.fetchedPages).toBe(0);
    expect(result.failedPages).toBe(0);
    expect(result.items).toBe(0);
    // 一个段都没真正扫过，不该被误判为死段
    expect(result.emptySegments).toEqual([]);
    expect(urls).toHaveLength(0);
    expect(dbMock.upsert).not.toHaveBeenCalled();
  });

  it("6 段全部 0 条时 emptySegments 覆盖全部段，并逐段打告警", async () => {
    const urls = stubFetch(() => buildFixtureHtml([], 0));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await ingestMascusLeads();

      // 每段第 1 页就判定末页（items.length 0 < 40），故只发 6 次请求
      expect(urls).toHaveLength(6);
      expect(result.fetchedPages).toBe(6);
      expect(result.items).toBe(0);
      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.emptySegments).toEqual(MASCUS_SCAN_SEGMENTS.map((segment) => segment.key));
      expect(result.budgetExhausted).toBe(false);
      expect(dbMock.upsert).not.toHaveBeenCalled();

      const warned = warn.mock.calls
        .map((call) => String(call[0]))
        .filter((line) => line.includes("本轮 0 条"));
      expect(warned).toHaveLength(6);
      expect(warned[0]).toContain(`seg=${MASCUS_SCAN_SEGMENTS[0].key}`);
    } finally {
      warn.mockRestore();
    }
  });

  it("满页 40 条且 totalResults=40 时按 totalResults 收敛，每段只抓 1 页", async () => {
    // 每个品类段返回不同的 40 条（按段序错开，避免跨段去重把数量压掉）
    const urls = stubFetch((url) => {
      const segmentIndex = Math.max(
        0,
        MASCUS_SCAN_SEGMENTS.findIndex((segment) => url.includes(segment.path))
      );
      return buildFixtureHtml(makeItems(40, segmentIndex * 1000), 40);
    });

    const result = await ingestMascusLeads();

    // 若没有 totalResults 收敛，每段会打到 maxPages 默认 5 页
    expect(urls).toHaveLength(6);
    expect(result.fetchedPages).toBe(6);
    expect(result.items).toBe(240);
    expect(result.uniqueItems).toBe(240);
    expect(result.emptySegments).toEqual([]);
    expect(dbMock.upsert).toHaveBeenCalledTimes(240);
  });

  it("dryRun 只统计不写库", async () => {
    stubFetch(() => buildFixtureHtml(FIXTURE_ITEMS, 2));

    const result = await ingestMascusLeads({
      segmentPaths: ["/agriculture/tractors"],
      maxPages: 1,
      dryRun: true,
    });

    expect(result.items).toBe(2);
    expect(result.uniqueItems).toBe(2);
    expect(result.inserted).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.bySegment).toEqual({ tractors: 2 });
    expect(dbMock.findMany).toHaveBeenCalledTimes(1);
    expect(dbMock.upsert).not.toHaveBeenCalled();
  });

  it("按 productId 幂等 upsert，新增 / 更新分别计数", async () => {
    stubFetch(() => buildFixtureHtml(FIXTURE_ITEMS, 2));
    dbMock.findMany.mockResolvedValue([
      { productId: "{31350D50-BA91-4D58-94A6-50B8D6BB7FD3}" },
    ]);

    const result = await ingestMascusLeads({
      segmentPaths: ["/agriculture/tractors"],
      maxPages: 1,
    });

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.uniqueItems).toBe(2);
    expect(dbMock.upsert).toHaveBeenCalledTimes(2);

    const firstCall = dbMock.upsert.mock.calls[0][0] as {
      where: { productId: string };
      create: { productId: string; scanSegment: string };
    };
    expect(firstCall.where.productId).toBe("{31350D50-BA91-4D58-94A6-50B8D6BB7FD3}");
    expect(firstCall.create.scanSegment).toBe("tractors");
  });

  it("同一台机跨段重复被抓到时按 productId 去重，只入库一次", async () => {
    stubFetch(() => buildFixtureHtml(FIXTURE_ITEMS, 2));

    const result = await ingestMascusLeads({
      segmentPaths: ["/agriculture/tractors", "/agriculture/tillage-machines"],
      maxPages: 1,
    });

    // 两段各 2 条，但都是同一批 productId
    expect(result.items).toBe(4);
    expect(result.uniqueItems).toBe(2);
    expect(dbMock.upsert).toHaveBeenCalledTimes(2);
    expect(result.bySegment).toEqual({ tractors: 2, "tillage-machines": 2 });
  });

  it("ok 反映真实结果：整段抓取失败时不为 true（避免假绿）", async () => {
    stubRawFetch(() => ({ ok: false, status: 404, text: "" }));

    const result = await ingestMascusLeads({
      segmentPaths: ["/agriculture/tractors"],
      maxPages: 1,
    });

    expect(result.fetchedPages).toBe(0);
    expect(result.failedPages).toBe(1);
    expect(result.ok).toBe(false);
    expect(dbMock.upsert).not.toHaveBeenCalled();
  });

  it("跳转落点被带离 mascus 域 ⇒ 该页计为失败（redirect:follow + host 校验）", async () => {
    stubRawFetch(() => ({
      url: "https://evil.example.com/steal",
      ok: true,
      status: 200,
      text: buildFixtureHtml(FIXTURE_ITEMS, 2),
    }));

    const result = await ingestMascusLeads({
      segmentPaths: ["/agriculture/tractors"],
      maxPages: 1,
    });

    expect(result.fetchedPages).toBe(0);
    expect(result.failedPages).toBe(1);
    expect(result.items).toBe(0);
    expect(dbMock.upsert).not.toHaveBeenCalled();
  });

  it("upsert 单条失败不中断整轮：failedUpserts 计数且 ok=false，后续行继续写", async () => {
    stubFetch(() => buildFixtureHtml(FIXTURE_ITEMS, 2));
    dbMock.upsert.mockRejectedValueOnce(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await ingestMascusLeads({
        segmentPaths: ["/agriculture/tractors"],
        maxPages: 1,
      });

      expect(result.items).toBe(2);
      expect(result.failedUpserts).toBe(1);
      expect(result.ok).toBe(false);
      // 第 2 条仍然继续写（不是整体中断）
      expect(dbMock.upsert).toHaveBeenCalledTimes(2);
      const warned = warn.mock.calls.map((call) => String(call[0]));
      expect(warned.some((line) => line.includes("upsert 失败"))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it("被 maxPages 截断的段进 truncatedSegments（否则永久丢线索且零信号）", async () => {
    // totalResults=400、单页 40 条、maxPages 默认 5 ⇒ 每段只吃下 200 条，必然截断
    stubFetch((url) => {
      const segmentIndex = Math.max(
        0,
        MASCUS_SCAN_SEGMENTS.findIndex((segment) => url.includes(segment.path))
      );
      const pageMatch = url.match(/page=(\d+)/);
      const page = pageMatch ? Number(pageMatch[1]) : 1;
      return buildFixtureHtml(makeItems(40, segmentIndex * 1000 + (page - 1) * 40), 400);
    });

    const result = await ingestMascusLeads();

    expect(result.fetchedPages).toBe(30); // 6 段 × 5 页（maxPages 默认 5）
    expect(result.items).toBe(1200);
    expect(result.truncatedSegments).toEqual(MASCUS_SCAN_SEGMENTS.map((segment) => segment.key));
    expect(result.emptySegments).toEqual([]);
  });

  it("页数上限覆盖实测最大 totalResults（166 ⇒ ceil(166/40)=5 页，不产生截断）", async () => {
    stubFetch((url) => {
      const segmentIndex = Math.max(
        0,
        MASCUS_SCAN_SEGMENTS.findIndex((segment) => url.includes(segment.path))
      );
      const pageMatch = url.match(/page=(\d+)/);
      const page = pageMatch ? Number(pageMatch[1]) : 1;
      return buildFixtureHtml(makeItems(40, segmentIndex * 1000 + (page - 1) * 40), 166);
    });

    const result = await ingestMascusLeads();

    // 5 页 × 40 = 200 ≥ 166，且第 5 页抓完即满足 totalResults 收敛
    expect(result.fetchedPages).toBe(30); // 6 段 × 5 页
    expect(result.truncatedSegments).toEqual([]);
  });

  it("写库前预算耗尽：不写库、保留已抓结果、budgetExhausted=true 且不抛错", async () => {
    stubFetch(() => buildFixtureHtml(FIXTURE_ITEMS, 2));
    // 每调用一次 Date.now 前进 1s：startedAt=0 → 翻页检查=1000 → 写库前检查=2000
    let clock = 0;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      const current = clock;
      clock += 1000;
      return current;
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await ingestMascusLeads({
        segmentPaths: ["/agriculture/tractors"],
        maxPages: 1,
        budgetMs: 1500, // 够翻页（1000 ≤ 1500），不够入库（2000 > 1500）
      });

      expect(result.items).toBe(2);
      expect(result.uniqueItems).toBe(2);
      expect(result.budgetExhausted).toBe(true);
      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(0);
      expect(dbMock.findMany).not.toHaveBeenCalled();
      expect(dbMock.upsert).not.toHaveBeenCalled();
      const warned = warn.mock.calls.map((call) => String(call[0]));
      expect(warned.some((line) => line.includes("跳过入库"))).toBe(true);
    } finally {
      nowSpy.mockRestore();
      warn.mockRestore();
    }
  });
});
