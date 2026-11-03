/**
 * mascus 线索链路 — QA 对抗性补充测试（解析层）
 *
 * 定位：只补 `src/lib/__tests__/mascus-leads.test.ts` 没覆盖的**边界与脆弱面**，
 * 不改动 parse.ts 任何一行。分两类用例：
 *   1. 回归钉（`describe("边界")`）：当前行为正确，钉住防止将来被改坏；
 *   2. characterzation（`describe("已知风险")`）：当前行为不理想但**尚未真实触发**，
 *      用断言把「现状」显式记录，一旦有人改动就会在这里看到提示。
 *
 * 审查结论对应的怀疑点：
 *   - 解析器完全不读 `searchData.errorMessage` / `redirectToCatalog`，
 *     所以「段失效」与「近期无新挂牌」在返回值上不可区分（见"段失效不可区分"用例）；
 *   - `totalResults` 被解析出来但 ingest 丢弃（这里只钉住 parser 侧行为）；
 *   - 结构一变（items 移层）→ 静默 0 条，不抛异常。
 */
import { describe, it, expect } from "vitest";
import {
  MASCUS_ORIGIN,
  MASCUS_PAGE_SIZE,
  buildMascusSearchUrl,
  dedupeByProductId,
  parseMascusNextData,
} from "@/lib/mascus-leads/parse";

/** 构造一条最小 item（字段名对齐真实 mascus item） */
function item(productId: string, extra: Record<string, unknown> = {}) {
  return {
    productId,
    brand: "John Deere",
    model: "450M",
    yearOfManufacture: 2018,
    catalogName: "agriculture",
    categoryName: "roundbalers",
    locationCountryCode: "US",
    locationCity: "Mansfield, Ohio",
    companyName: "Ag-Pro - Mansfield, OH",
    companyCountry: "US",
    sellerPhone: "+1 419-529-6160",
    priceEURO: 35507,
    priceOriginal: 39900,
    priceOriginalUnit: "USD",
    assetUrl: "/agriculture/round-balers/x.html",
    imageUrl: "",
    createDate: "2026-11-03T00:02:53.857",
    ...extra,
  };
}

/** 把整棵 `searchData` 原样塞进 __NEXT_DATA__，便于构造各种畸形结构 */
function htmlWithSearchData(searchData: unknown, scriptAttrs = ""): string {
  const payload = { props: { pageProps: { searchRes: { searchData } } } };
  return `<html><body><script id="__NEXT_DATA__"${scriptAttrs}>${JSON.stringify(
    payload
  )}</script></body></html>`;
}

function htmlWithItems(items: unknown[], totalResults?: unknown): string {
  return htmlWithSearchData({ items, totalResults });
}

describe("常量与分页契约", () => {
  it("MASCUS_PAGE_SIZE 固定 40：ingest 的「不足一页即末页」判定依赖它", () => {
    // ingest.ts:144 `if (pageItems.length < MASCUS_PAGE_SIZE) break;`
    // 若 mascus 改成每页 20 条，该判定会在第 1 页就 break → 静默少采一半。
    expect(MASCUS_PAGE_SIZE).toBe(40);
  });
});

describe("buildMascusSearchUrl 边界", () => {
  it("page / recentDays 非正数与小数被归一化", () => {
    expect(buildMascusSearchUrl("/agriculture/tractors", { page: 0 })).toContain("page=1");
    expect(buildMascusSearchUrl("/agriculture/tractors", { page: -3 })).toContain("page=1");
    expect(buildMascusSearchUrl("/agriculture/tractors", { page: 1.9 })).toContain("page=1");
    expect(buildMascusSearchUrl("/agriculture/tractors", { recentDays: 0 })).toContain(
      "lastcreateddays=2"
    );
    expect(buildMascusSearchUrl("/agriculture/tractors", { recentDays: 2.9 })).toContain(
      "lastcreateddays=2"
    );
  });

  // 已知风险（**不锁死现状**，故记为 todo 而不是断言）：
  //   parse.ts `Math.max(1, Math.trunc(opts.recentDays ?? 2) || 2)` —— -5 是 truthy，
  //   `-5 || 2` 得 -5，于是 max(1,-5)=1，语义成了「更窄的窗口」而不是「回默认值 2」。
  //   当前无外部入口可传入（route 只透传 dryRun），属待修的小语义瑕疵。
  it.todo("recentDays 为负数时应回落到默认 2（当前实际落到 1，属待修行为）");

  it("品类路径无法把请求带离 mascus 域（path 不做 URL 拼接逃逸）", () => {
    // normalizeSegmentPath 只剥掉 MASCUS_ORIGIN 前缀，其他 origin 会被补成 "/https://…"
    const url = buildMascusSearchUrl("https://evil.example.com/steal");
    expect(url.startsWith(`${MASCUS_ORIGIN}/${"https://evil.example.com/steal"}`)).toBe(true);
    expect(new URL(url).origin).toBe(MASCUS_ORIGIN);
  });

  it("path 中的 hash / 多重 query 被剥离，不会污染 lastcreateddays", () => {
    const url = buildMascusSearchUrl("/agriculture/tractors?lastcreateddays=999#x", { page: 2 });
    expect(url).toBe(`${MASCUS_ORIGIN}/agriculture/tractors?lastcreateddays=2&page=2`);
  });
});

describe("parseMascusNextData 结构与脏数据边界", () => {
  it("items 元素为 null / 数字 / 数组 / 字符串时逐条丢弃且不抛异常", () => {
    const result = parseMascusNextData(
      htmlWithItems([null, 42, ["x"], "hello", item("{OK}")], 5)
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].productId).toBe("{OK}");
  });

  it("productId 为数字时被字符串化（toText 兼容 number）", () => {
    const result = parseMascusNextData(htmlWithItems([{ productId: 12345 }], 1));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].productId).toBe("12345");
  });

  it("totalResults 为字符串/负数/非数字时的归一", () => {
    expect(parseMascusNextData(htmlWithItems([], "163")).totalResults).toBe(163);
    expect(parseMascusNextData(htmlWithItems([], -5)).totalResults).toBe(0);
    expect(parseMascusNextData(htmlWithItems([], "abc")).totalResults).toBe(0);
    expect(parseMascusNextData(htmlWithItems([], 163.9)).totalResults).toBe(163);
  });

  it("items 不是数组（对象）时降级为空结果", () => {
    expect(parseMascusNextData(htmlWithSearchData({ items: { a: 1 } })).items).toEqual([]);
    expect(parseMascusNextData(htmlWithSearchData(null)).items).toEqual([]);
  });

  it("script 标签单引号 / 属性错序也能抓到（正则容忍）", () => {
    const payload = { props: { pageProps: { searchRes: { searchData: { items: [item("{Q}")] } } } } };
    const html = `<html><body><script type="application/json" id='__NEXT_DATA__'>${JSON.stringify(
      payload
    )}</script></body></html>`;
    expect(parseMascusNextData(html).items).toHaveLength(1);
  });

  it("段失效不可区分：errorMessage 非空 + items 为空时，返回值与「真的没有新挂牌」完全一致", () => {
    // 实测 mascus searchData 同时带 errorMessage / redirectToCatalog / redirectToCategory 字段，
    // 而 parse.ts:124-135 只读 items 与 totalResults，完全不看这些信号。
    const withError = parseMascusNextData(
      htmlWithSearchData({ items: [], totalResults: 0, errorMessage: "Category not found" })
    );
    const noNewListing = parseMascusNextData(htmlWithSearchData({ items: [], totalResults: 0 }));

    expect(withError).toEqual(noNewListing);
    expect(withError).toEqual({ items: [], totalResults: 0 });
    // ↑ 结论：上游无法区分「这个品类段挂了」与「今天没有新挂牌」，两者都会让
    //   ingest 返回 ok:true / items:0 / bySegment[段]=0。
  });

  // 已知风险（**不锁死现状**，故记为 todo）：mascus 再次改版把 items 移层时，
  //   parseMascusNextData 会返回 { items: [], totalResults: 0 } 且不抛异常，
  //   ingest 只会把它当成「本段 0 条新挂牌」（好在 emptySegments 会把 0 条段报出来）。
  //   该行为不该被钉成契约 —— 期望将来能以显式错误暴露。
  it.todo("items 移层（mascus 再次改版）时应显式报错而不是静默 0 条");

  it("大批量（500 条）解析不丢条、不抛异常", () => {
    const items = Array.from({ length: 500 }, (_, i) => item(`{ID-${i}}`));
    const result = parseMascusNextData(htmlWithItems(items, 500));
    expect(result.items).toHaveLength(500);
    expect(new Set(result.items.map((row) => row.productId)).size).toBe(500);
  });

  it("48 字段真实 item 的未知字段不丢失（raw 原样保留，供回溯）", () => {
    const extra = { meterReadout: 1234, auctionEventName: null, favoriteAd: true };
    const result = parseMascusNextData(htmlWithItems([item("{R}", extra)], 1));
    expect(result.items[0].raw.meterReadout).toBe(1234);
    expect(result.items[0].raw.favoriteAd).toBe(true);
  });
});

describe("字段归一化边界", () => {
  it("year 为字符串 / 0 / 负数 / 小数时的归一", () => {
    const rows = [
      item("{Y1}", { yearOfManufacture: "2015" }),
      item("{Y2}", { yearOfManufacture: 0 }),
      item("{Y3}", { yearOfManufacture: -3 }),
      item("{Y4}", { yearOfManufacture: 2015.7 }),
    ];
    const { items } = parseMascusNextData(htmlWithItems(rows, 4));
    expect(items[0].year).toBe(2015);
    expect(items[1].year).toBeNull();
    expect(items[2].year).toBeNull();
    expect(items[3].year).toBe(2015);
  });

  it("locationCountry 优先取 ISO 码，缺失时回落自由文本", () => {
    const rows = [
      item("{L1}", { locationCountryCode: "DE", locationCountry: "Germany" }),
      item("{L2}", { locationCountryCode: null, locationCountry: "Germany" }),
    ];
    const { items } = parseMascusNextData(htmlWithItems(rows, 2));
    expect(items[0].locationCountry).toBe("DE");
    expect(items[1].locationCountry).toBe("Germany");
  });

  it("assetUrl 协议相对 // 补 https，非 http 协议被强行拼到 mascus 域（不可逃逸）", () => {
    const rows = [
      item("{U1}", { assetUrl: "//cdn.example.com/a.html" }),
      item("{U2}", { assetUrl: "javascript:alert(1)" }),
      item("{U3}", { assetUrl: null }),
    ];
    const { items } = parseMascusNextData(htmlWithItems(rows, 3));
    expect(items[0].assetUrl).toBe("https://cdn.example.com/a.html");
    expect(items[1].assetUrl).toBe(`${MASCUS_ORIGIN}/javascript:alert(1)`);
    expect(items[2].assetUrl).toBeNull();
  });

  it("createDate 各种形态：带时区不补 Z、纯日期按 UTC、非法 → null", () => {
    const rows = [
      item("{D1}", { createDate: "2026-11-03T00:02:53.857+02:00" }),
      item("{D2}", { createDate: "2026-11-03" }),
      item("{D3}", { createDate: "not-a-date" }),
      item("{D4}", { createDate: null }),
      item("{D5}", { createDate: "2026-11-03 08:00:00" }),
    ];
    const { items } = parseMascusNextData(htmlWithItems(rows, 5));
    expect(items[0].listedAt?.toISOString()).toBe("2026-11-02T22:02:53.857Z");
    expect(items[1].listedAt?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(items[2].listedAt).toBeNull();
    expect(items[3].listedAt).toBeNull();
    // 空格分隔的无时区形态同样按 UTC（不能被宿主机 Asia/Shanghai 解释）
    expect(items[4].listedAt?.toISOString()).toBe("2026-11-03T08:00:00.000Z");
  });

  it("createDate 为数字时间戳（若 mascus 改传 epoch）时解析为 null —— 会静默丢挂牌时间", () => {
    // toText(number) → String(number) → new Date("1793000000000") 为 Invalid Date → null
    const { items } = parseMascusNextData(htmlWithItems([item("{E1}", { createDate: 1793000000000 })], 1));
    expect(items[0].productId).toBe("{E1}");
    expect(items[0].listedAt).toBeNull();
  });
});

describe("已知风险（todo）：本地化数字字符串", () => {
  // **不锁死现状**：`toNumber` 里 `trimmed.replace(/,/g, "")` 只处理英文千分位
  //   （"12,500" → 12500）。遇到欧式格式 "1.234,56" 会静默产出 1.23456（差 1000 倍）；
  //   "12 500"（空格千分位）会 Number() 失败 → null（这条是 fail-closed，风险较低）。
  //   当前 mascus 发送的是 JSON number，尚未触发；一旦上游改成格式化字符串就会全表价格失真。
  //   这属于**潜在 bug**，不能钉成契约，故只登记待修。
  it.todo('欧式千分位 "1.234,56" 应解析为 1234.56（当前会错读成 1.23456）');
  it.todo('空格千分位 "12 500" 应解析为 12500（当前为 null）');
});

describe("dedupeByProductId 运行时脏数据边界", () => {
  it("null 行 / 非字符串 productId / 空串一律跳过且不抛异常", () => {
    const rows = [
      null,
      { productId: 123 as unknown as string },
      { productId: "" },
      { productId: "{A}" },
      { productId: "{A}" },
    ];
    const unique = dedupeByProductId(rows as unknown as { productId: string }[]);
    expect(unique).toHaveLength(1);
    expect(unique[0].productId).toBe("{A}");
  });

  it("跨段重复时保留「首次出现」的 scanSegment —— 段归属由扫描顺序决定", () => {
    // ingest.ts:148 的去重发生在 bySegment 统计之后，因此：
    //   - bySegment 统计的是**去重前**的原始命中数（会重复计入）；
    //   - 落库的 scanSegment 只记第一个命中的段（MASCUS_SCAN_SEGMENTS 顺序在前的段）。
    const rows = [
      { productId: "{A}", scanSegment: "tractors" },
      { productId: "{A}", scanSegment: "soil-preparation" },
    ];
    expect(dedupeByProductId(rows)[0].scanSegment).toBe("tractors");
  });
});
