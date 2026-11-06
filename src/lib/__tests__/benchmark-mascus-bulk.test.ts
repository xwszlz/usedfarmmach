/**
 * 单测：mascus 品类级 bulk 采集（价格基准通道）
 * ─────────────────────────────────────────────────────────
 * 背景（2026-11 实测，勿推翻）：
 *   mascus 改版后服务端**完全忽略** `?q=` 与品牌/型号参数，所以「每个 brand×model
 *   打一次搜索」在 mascus 上原理性地拿不到对应机型 —— 38 个靶标只会在 4 个品类页上
 *   重复 9.5 倍，且旧解析器读的 `SearchResultItem_brandmodel` class 已不存在 ⇒
 *   HTTP 200 但解析出 0 条。故改成「按品类段批量拉 → 合并去重 → 本地按 (brand,model)
 *   匹配」，见 `fetchMascusBulk`。
 *
 * 本文件只测**纯函数与门控**，全程零真实网络（重定向用本地 http server 模拟）：
 *   ① parseMascusNextDataItems：正常页取出 items/totalResults；无 script / 坏 JSON 一律降级不抛错
 *   ② mascusBrandMatches：**brand 为空的条目不得命中任何品牌**（实测踩过：137 条空 brand
 *      拍卖填充件让 18 个品牌的命中数全部虚高 137）
 *   ③ mascusModelTokens：必须在原始串上切 token（先过 norm() 会让 '8R 410' 变成单 token '8r410'）
 *   ④ mascusModelMatches：词块口径 —— `8R 410` 命中 `8R 410`/`8R410`/`8R 410 Premium`，
 *      但**不得**命中 `8R 4100`（否则别家机型价会混进中位价）
 *   ⑤ mascusItemPriceEur：priceEURO 优先；退化到 priceOriginal 时按 fx(外币→CNY) 方向折算；
 *      两者都 ≤0 返回 null（**绝不编造价格**）
 *   ⑥ buildSearchUrl 的 mascus soil 分支指向 tillage-machines（旧值 soil-preparation 是死路径）
 *   ⑦ MASCUS_BULK_SEGMENTS 与 mascus-leads/parse.ts 的 MASCUS_SCAN_SEGMENTS 保持一致
 *   ⑧ httpGet 能跟随**相对路径** Location（实测 308 + 相对路径会抛 ERR_INVALID_URL）
 *   ⑨ runRefresh：注入 targets 时**不得**触发 mascus bulk（单测/探针不能被拖去打 25 次网络）
 *
 * 运行：npx vitest run src/lib/__tests__/benchmark-mascus-bulk.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { MASCUS_SCAN_SEGMENTS } from "@/lib/mascus-leads/parse";

// benchmark-engine.js 在模块加载时就会 new PrismaClient 并读取 DATABASE_URL，
// 故在动态 import 之前注入占位串（本测试全程不查库，不会真连接）。
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://bench:bench@127.0.0.1:5432/benchmark_test";
process.env.SITE = process.env.SITE || "com";

type Engine = typeof import("@/lib/benchmark-engine");
let engine: Engine;

beforeAll(async () => {
  engine = await import("@/lib/benchmark-engine");
});

afterAll(async () => {
  await engine.disconnectBenchmark().catch(() => {});
});

/** 把 Next.js 的 data 对象包成带 __NEXT_DATA__ script 的 HTML */
function htmlWithNextData(pageProps: unknown): string {
  const obj = { props: { pageProps } };
  return (
    `<!doctype html><html><body><div id="__next"></div>` +
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(obj)}</script>` +
    `</body></html>`
  );
}

const SAMPLE_ITEMS = [
  {
    productId: "{A-1}",
    brand: "John Deere",
    model: "8R 410",
    yearOfManufacture: 2021,
    priceEURO: 38711,
    priceOriginal: 43500,
    priceOriginalUnit: "USD",
    userCurrency: "USD",
    locationCountryCode: "US",
    createDate: "2026-11-03T22:58:30.5",
  },
  { productId: "{A-2}", brand: "John Deere", model: "8R 370", priceEURO: 0, priceOriginal: 0 },
];

describe("parseMascusNextDataItems —— 结构解析（不抛错）", () => {
  it("① 正常页：取出 items 与 totalResults", () => {
    const html = htmlWithNextData({
      searchRes: { searchData: { items: SAMPLE_ITEMS, totalResults: 4363 } },
    });
    const r = engine.parseMascusNextDataItems(html);
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(2);
    expect(r.totalResults).toBe(4363);
  });

  it("①b 没有 __NEXT_DATA__ ⇒ ok:false + 空数组，不抛错", () => {
    const r = engine.parseMascusNextDataItems("<html><body>nope</body></html>");
    expect(r.ok).toBe(false);
    expect(r.items).toEqual([]);
    expect(r.reason).toBe("no-next-data");
  });

  it("①c 非法 JSON ⇒ ok:false，不抛错", () => {
    const r = engine.parseMascusNextDataItems(
      '<script id="__NEXT_DATA__" type="application/json">{bad json</script>'
    );
    expect(r.ok).toBe(false);
    expect(r.items).toEqual([]);
    expect(r.reason).toBe("bad-json");
  });

  it("①d items 层级缺失 ⇒ ok:false，不抛错", () => {
    const r = engine.parseMascusNextDataItems(htmlWithNextData({ searchRes: {} }));
    expect(r.ok).toBe(false);
    expect(r.items).toEqual([]);
  });
});

describe("mascusBrandMatches —— 空 brand 不得命中任何品牌", () => {
  it("② 归一化相等 / 双向包含命中", () => {
    expect(engine.mascusBrandMatches("John Deere", "John Deere")).toBe(true);
    expect(engine.mascusBrandMatches("NewHolland", "New Holland")).toBe(true);
    expect(engine.mascusBrandMatches("Case", "Case IH")).toBe(true);
  });

  it("②b 空 / null / 超短 brand 一律 false（防 137 条空 brand 全命中）", () => {
    expect(engine.mascusBrandMatches("", "John Deere")).toBe(false);
    expect(engine.mascusBrandMatches(null, "John Deere")).toBe(false);
    expect(engine.mascusBrandMatches(undefined, "YTO")).toBe(false);
    expect(engine.mascusBrandMatches(" ", "John Deere")).toBe(false);
    expect(engine.mascusBrandMatches("K", "Kubota")).toBe(false);
  });

  it("②c 不相干品牌 false", () => {
    expect(engine.mascusBrandMatches("Arteer", "John Deere")).toBe(false);
    expect(engine.mascusBrandMatches("MacDon", "Massey Ferguson")).toBe(false);
  });
});

describe("mascusModelTokens / mascusModelMatches —— 词块口径", () => {
  it("③ token 在原始串上切分（不得先过 norm）", () => {
    expect(engine.mascusModelTokens("8R 410")).toEqual(["8r", "410"]);
    expect(engine.mascusModelTokens("T7.315")).toEqual(["t7", "315"]);
    expect(engine.mascusModelTokens("Cenius")).toEqual(["cenius"]);
    expect(engine.mascusModelTokens("")).toEqual([]);
  });

  it("④ 词块全命中才算匹配", () => {
    const tk = engine.mascusModelTokens("8R 410");
    expect(engine.mascusModelMatches("8R 410", tk)).toBe(true);
    expect(engine.mascusModelMatches("8R 410 Premium", tk)).toBe(true);
    expect(engine.mascusModelMatches("8R410", tk)).toBe(true); // 连写形态
    expect(engine.mascusModelMatches("6R 155", tk)).toBe(false);
    expect(engine.mascusModelMatches("", tk)).toBe(false);
  });

  it("④b 不得出现前缀式假阳性（8R 410 不能中 8R 4100）", () => {
    expect(engine.mascusModelMatches("8R 4100", engine.mascusModelTokens("8R 410"))).toBe(false);
    expect(engine.mascusModelMatches("7240 Vario", engine.mascusModelTokens("724 Vario"))).toBe(
      false
    );
  });
});

describe("mascusItemPriceEur —— 折价方向与「绝不编造价格」", () => {
  const FX = { EUR: 8, USD: 7.2, GBP: 9.6, CNY: 1 };

  it("⑤ priceEURO > 0 时直接采用，忽略 priceOriginal", () => {
    expect(
      engine.mascusItemPriceEur(
        { priceEURO: 38711, priceOriginal: 43500, priceOriginalUnit: "USD" },
        FX
      )
    ).toEqual({ amount: 38711, currency: "EUR" });
  });

  it("⑤b priceEURO=0 且 priceOriginal 为 USD ⇒ 按 fx(外币→CNY) 折成 EUR", () => {
    // 1000 USD ⇒ 1000 × 7.2 = 7200 CNY ⇒ 7200 / 8 = 900 EUR
    expect(
      engine.mascusItemPriceEur({ priceEURO: 0, priceOriginal: 1000, priceOriginalUnit: "USD" }, FX)
    ).toEqual({ amount: 900, currency: "EUR" });
  });

  it("⑤c 无单位时回落到 userCurrency", () => {
    expect(
      engine.mascusItemPriceEur({ priceEURO: null, priceOriginal: 1000, userCurrency: "GBP" }, FX)
    ).toEqual({ amount: 1200, currency: "EUR" }); // 1000×9.6/8
  });

  it("⑤d 两者都 ≤0 / 汇率缺失 ⇒ null（一律不入库）", () => {
    expect(engine.mascusItemPriceEur({ priceEURO: 0, priceOriginal: 0 }, FX)).toBeNull();
    expect(engine.mascusItemPriceEur({}, FX)).toBeNull();
    expect(
      engine.mascusItemPriceEur({ priceOriginal: 1000, priceOriginalUnit: "XYZ" }, FX)
    ).toBeNull();
  });
});

describe("mascus 段路径与 bulk 段清单", () => {
  it("⑥ buildSearchUrl 的 soil 分支指向真实段 tillage-machines（soil-preparation 已死）", () => {
    const url = engine.buildSearchUrl(
      { key: "mascus", currency: "EUR", name: "Mascus" },
      { nameEn: "Lemken", model: "Rubin 10", category: "soil" }
    );
    expect(url).toContain("/agriculture/tillage-machines");
    expect(url).not.toContain("soil-preparation");
  });

  it("⑦ bulk 段清单与 mascus-leads 的 MASCUS_SCAN_SEGMENTS 一致", () => {
    expect(engine.MASCUS_BULK_SEGMENTS).toEqual(MASCUS_SCAN_SEGMENTS.map((s) => s.key)); // 原 ⑦ 保留
    // ⑦-a 新增：段数锁 6（防误删/误加）
    expect(engine.MASCUS_BULK_SEGMENTS).toHaveLength(6);
    // ⑦-b 新增：sprayers 两段都在，且 path 精确
    expect(engine.MASCUS_BULK_SEGMENTS).toContain("sprayers");
    expect(MASCUS_SCAN_SEGMENTS.find((s) => s.key === "sprayers")?.path).toBe(
      "/agriculture/sprayers"
    );
    // ⑦-c 新增：无重复 key、所有 path 以 /agriculture/ 开头
    expect(new Set(engine.MASCUS_BULK_SEGMENTS).size).toBe(engine.MASCUS_BULK_SEGMENTS.length);
    expect(MASCUS_SCAN_SEGMENTS.every((s) => s.path.startsWith("/agriculture/"))).toBe(true);
    // ⑦-d 新增：trailers / 死路径黑名单不得混入
    expect(engine.MASCUS_BULK_SEGMENTS).not.toContain("trailers");
    expect(engine.MASCUS_BULK_SEGMENTS).not.toContain("soil-preparation");
  });
});

describe("httpGet —— 相对路径 Location", () => {
  it("⑧ 308 + 相对路径 Location 能正确跟随（旧实现抛 ERR_INVALID_URL）", async () => {
    const server = http.createServer((req, res) => {
      if (req.url && req.url.startsWith("/start")) {
        // 刻意用相对路径，复现 mascus 的 308 形态
        res.writeHead(308, { Location: "/final?x=1" });
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK-REDIRECTED");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      const body = await engine.httpGet(`http://127.0.0.1:${port}/start`, { timeout: 5000 });
      expect(body).toBe("OK-REDIRECTED");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("runRefresh —— mascus bulk 门控", () => {
  it("⑨ 注入 targets 时不触发 mascus bulk（stats.mascus 为 null，零网络）", async () => {
    const stats = await engine.runRefresh({
      fx: {},
      targets: [{ sourceSite: "__nosrc__" }],
      dryRun: true,
      budgetMs: 60000,
      concurrency: 1,
    });
    expect(stats.mascus).toBeNull();
    expect(stats.total).toBe(1);
    expect(stats.skip).toBe(1);
  });

  it("⑨b opts.mascus === false 也能关掉（显式关闸优先）", async () => {
    const stats = await engine.runRefresh({
      fx: {},
      sources: ["mascus"],
      dryRun: true,
      mascus: false,
      budgetMs: 1000,
    });
    expect(stats.mascus).toBeNull();
    expect(stats.total).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B 档（2026-11-06）：采样深度 5 段×5 页 → 6 段×20 页、机型串按库存原样重写、
// fetchMascusBulk 离线注入点。以下用例全程零真实网络（注入 fx 跳过 getFxRates，
// 注入 httpGetImpl 使 120 个 job 全部由 fake GET 接收）。dryRun:true 让引擎跳过
// upsertBenchmark —— 这是静态分支核对，不以下面任何断言冒充「零写库」的运行时验证。
// ─────────────────────────────────────────────────────────────────────────────

/** 离线 fixture 固定汇率表（注入 fx 跳过 getFxRates() 真实汇率请求） */
const OFFLINE_FX: Record<string, number> = { EUR: 8, USD: 7.2, GBP: 9.6, CNY: 1 };

/** 造一条 mascus 挂牌（priceEURO>0 ⇒ mascusItemPriceEur 直接采用，绝不编造价格） */
function offlineItem(productId: string, brand: string, model: string, priceEURO: number) {
  return {
    productId,
    brand,
    model,
    yearOfManufacture: 2020,
    priceEURO,
    priceOriginal: 0,
    priceOriginalUnit: "EUR",
    userCurrency: "EUR",
    locationCountryCode: "DE",
    createDate: "2026-11-03T22:58:30.5",
  };
}

/** 6 段×20 页 job 的 URL 形如 …/agriculture/<seg>?lastcreateddays=60&page=<n> */
function offlineParseUrl(url: string): { seg: string; page: number } {
  const seg = /\/agriculture\/([^?]+)/.exec(url)?.[1] ?? "tractors";
  const page = Number(/[?&]page=(\d+)/.exec(url)?.[1] ?? "1");
  return { seg, page };
}

describe("B 档 · 数据契约（T01/T02）", () => {
  it("⑩ MASCUS_BULK_MAX_PAGES=20、段清单 6 段、buildTargets 净变化 0", () => {
    expect(engine.MASCUS_BULK_MAX_PAGES).toBe(20);
    expect(engine.MASCUS_BULK_SEGMENTS).toHaveLength(6);
    expect(engine.MASCUS_BULK_SEGMENTS).toContain("sprayers");
    expect(engine.MASCUS_BULK_SEGMENTS).not.toContain("trailers");

    const all = engine.buildTargets();
    expect(all.length).toBe(306); // 51 机型 × 6 源，删 3 增 3 ⇒ 净变化 0（不是 324）
    expect(all.length % 6).toBe(0);
    expect(all.length).toBeLessThanOrEqual(500);
    expect(all.filter((t) => t.sourceSite === "mascus")).toHaveLength(0);
  });

  it("⑪ 6 条机型串逐条核对：无品牌前缀、删 3 增 3、JD 15 条与 fendt/724 Vario 不动", () => {
    const flat = Object.values(engine.MODELS).flat();
    const forbidden = /\bMF\b|BigX|BiG Pack|John Deere|New Holland\b/;
    for (const def of flat) {
      expect(def.model).not.toMatch(forbidden);
    }
    expect(flat).toHaveLength(51); // 净变化 0

    const modelsOf = (slug: string): string[] =>
      (engine.MODELS[slug] || []).map((m) => m.model);

    // 删 3：全部 0 命中错配串，且无已验证替换串 ⇒ 只删不加
    expect(modelsOf("massey-ferguson")).not.toContain("MF 7700");
    expect(modelsOf("krone")).not.toContain("BigX 1180");
    expect(modelsOf("krone")).not.toContain("BiG Pack 1290");

    // 增 3：库存 model 字段原样，不带品牌前缀
    expect(modelsOf("new-holland")).toContain("T7.260");
    expect(modelsOf("new-holland")).toContain("T5.120");
    expect(modelsOf("john-deere")).toContain("450M");

    // 「不动」清单
    expect(modelsOf("fendt")).toContain("1050 Vario");
    expect(modelsOf("fendt")).toContain("724 Vario");
    for (const kept of [
      "8R 410", "6R 250", "5075E", "8R 370", "6R 155", "S780", "8R 280",
      "5055E", "5045E", "4066R", "8370R", "6155M", "8R 310", "S790", "S680",
    ]) {
      expect(modelsOf("john-deere")).toContain(kept);
    }
    for (const kept of ["T7.315", "T8.435", "FR920"]) {
      expect(modelsOf("new-holland")).toContain(kept);
    }
  });

  it("⑫ 词块口径：T7.260 命中、T7.2600 与 7240 Vario 前缀假阳性不命中", () => {
    const tk = engine.mascusModelTokens("T7.260");
    expect(tk).toEqual(["t7", "260"]);
    expect(engine.mascusModelMatches("T7.260", tk)).toBe(true);
    expect(engine.mascusModelMatches("T7.2600", tk)).toBe(false);
    expect(
      engine.mascusModelMatches("7240 Vario", engine.mascusModelTokens("724 Vario"))
    ).toBe(false);
    // 450M 单 token 全命中，且防 4500M 前缀假阳性
    expect(engine.mascusModelMatches("450M", engine.mascusModelTokens("450M"))).toBe(true);
    expect(engine.mascusModelMatches("4500M", engine.mascusModelTokens("450M"))).toBe(false);
  });
});

describe("B 档 · fetchMascusBulk 离线注入点（T03，零真实网络）", () => {
  // ── 零写库的如实证据与已知局限（偏差 A 裁决，2026-11-06）──────────────────────
  // 静态核对：benchmark-engine.js 的 fetchMascusBulk 在 :1481-1486 命中 `if (dryRun)`
  // 后 `continue`，跳过 :1489 的 `await upsertBenchmark(...)`，故 dryRun:true 分支
  // 结构上不会走到写库调用。这是**静态分支核对**，不是运行时写库次数断言。
  // 已知局限：本轮注入面仅 `fx` 与 `httpGetImpl`，没有 db 层注入点，因此「写库次数
  // === 0」在本轮**不可运行时断言，属已知局限**；按裁决不为此新增 db 注入点（超出
  // T03 封闭改动清单），也绝不拿 written===0 冒充该验证。
  // ───────────────────────────────────────────────────────────────────────────
  it("⑬ 6 段×20 页离线 dryRun：totalPages=120 / bySegment 6 段 / sprayers 存在 / 零达标组 fixture ⇒ written=0", async () => {
    let calls = 0;
    const seenUrls: string[] = [];
    const fakeGet = async (url: string): Promise<string> => {
      calls += 1;
      seenUrls.push(url);
      const { seg, page } = offlineParseUrl(url);
      // 零达标组 fixture：带价但 brand 不匹配任何 BRANDS ⇒ 51 组全部 no-listing，
      // 使真身语义下 rows=[] / written=0 自然成立（不修改引擎任何计数语义）。
      const items = [
        offlineItem(`{off-${seg}-${page}-1}`, "Hardi", "Unrelated 101", 10000 + page),
        offlineItem(`{off-${seg}-${page}-2}`, "Vaderstad", "Unrelated 202", 20000 + page),
      ];
      return htmlWithNextData({
        searchRes: { searchData: { items, totalResults: 471 } },
      });
    };

    const r = await engine.fetchMascusBulk({
      fx: OFFLINE_FX,
      httpGetImpl: fakeGet,
      dryRun: true,
      maxPages: 20,
    });

    expect(r.totalPages).toBe(120); // 6 段 × 20 页
    expect(r.maxPages).toBe(20);
    expect(r.fetchedPages).toBe(120);
    expect(r.failedPages).toBe(0);
    expect(r.budgetExhausted).toBe(false);
    expect(Object.keys(r.bySegment)).toHaveLength(6);
    expect(r.bySegment.sprayers).toBeDefined();
    expect(r.bySegment.sprayers?.pages).toBe(20);
    expect(r.bySegment.sprayers?.items).toBe(40); // 20 页 × 2 条
    expect(r.bySegment.sprayers?.priced).toBe(40);
    expect(r.emptySegments).toEqual([]);
    // 结构契约（非写库验证）：零达标组 fixture ⇒ 51 组全 no-listing ⇒ rows=[] ⇒
    // written=0。真身 `written = groups.filter(status==='ok').length`（:1526）是达标组
    // 数，不是写库行数；此处 0 来自「没有达标组」，与 dryRun 是否写库无关。
    expect(r.written).toBe(0);
    expect(r.rows).toEqual([]); // 与假数据一致：51 组全 no-listing
    expect(r.groups).toBe(51);
    expect(r.byReason["no-listing"]).toBe(51);
    expect(r.items).toBe(240); // 120 页 × 2 条
    expect(r.uniqueItems).toBe(240);
    expect(r.pricedItems).toBe(240); // 与假数据一致

    // 零真实网络反证：120 个 job 的 URL 全部由 fakeGet 接收，且 0 失败页 / 120 成功页
    // ⇒ 没有任何一次走真实 httpGet（否则必打 www.mascus.com，测试环境必失败或超时）。
    expect(calls).toBe(120);
    expect(seenUrls).toHaveLength(120);
    expect(seenUrls.every((u) => u.startsWith("https://www.mascus.com/agriculture/"))).toBe(true);
    expect(seenUrls.filter((u) => u.includes("/agriculture/sprayers?"))).toHaveLength(20);
  });

  // §10.3 测法 1（可选量化对照）：确定性 fixture 复现「改前 5 页 vs 改后 20 页」的收益。
  // 14 / 16 / 7 是 fixture 确定值，不是生产数字（库存每日漂移，单测只锁管线与契约）。
  it("⑭ 5 页 vs 20 页量化对照：达标组 14→≥16、非 JD 0→≥1、fendt/724 Vario 7 样本", async () => {
    // 14 个 JD 机型：page 1..20 每页各 1 条 ⇒ 5 页/20 页两种口径都达标
    const JD_FIXTURE_MODELS = [
      "8R 410", "6R 250", "5075E", "8R 370", "6R 155", "S780", "8R 280",
      "5055E", "5045E", "4066R", "8370R", "6155M", "8R 310", "S790",
    ];
    const LATE_JD_MODEL = "S680"; // 只在 page 6..8 ⇒ 5 页口径 0 条、20 页口径 3 条
    const FENDT_MODEL = "724 Vario"; // 只在 page 6..12 ⇒ 5 页口径 0 条、20 页口径 7 条

    function depthItems(seg: string, page: number): ReturnType<typeof offlineItem>[] {
      const items: ReturnType<typeof offlineItem>[] = [];
      const key = (tag: string) => `{depth-${seg}-${page}-${tag}}`;
      if (seg === "tractors") {
        for (let i = 0; i < JD_FIXTURE_MODELS.length; i += 1) {
          items.push(
            offlineItem(key(`jd${i}`), "John Deere", JD_FIXTURE_MODELS[i], 50000 + i * 100 + page)
          );
        }
        if (page >= 6 && page <= 8) {
          items.push(offlineItem(key("jdLate"), "John Deere", LATE_JD_MODEL, 61000 + page));
        }
        if (page >= 6 && page <= 12) {
          items.push(offlineItem(key("fendt"), "Fendt", FENDT_MODEL, 70000 + page));
        }
      } else if (seg === "sprayers") {
        // sprayers 段刻意放非目标品牌假条目（段覆盖断言用，model 不匹配 ⇒ 不产生达标组）
        items.push(offlineItem(key("sp1"), "Case IH", "Unrelated 301", 30000 + page));
        items.push(offlineItem(key("sp2"), "Amazone", "Unrelated 401", 31000 + page));
        items.push(offlineItem(key("sp3"), "New Holland", "Unrelated 501", 32000 + page));
      } else {
        items.push(offlineItem(key("bg"), "Hardi", "Unrelated 601", 40000 + page));
      }
      return items;
    }

    const fakeGet = async (url: string): Promise<string> => {
      const { seg, page } = offlineParseUrl(url);
      return htmlWithNextData({
        searchRes: { searchData: { items: depthItems(seg, page), totalResults: 471 } },
      });
    };

    const base = { fx: OFFLINE_FX, httpGetImpl: fakeGet, dryRun: true, concurrency: 4 };
    const before = await engine.fetchMascusBulk({ ...base, maxPages: 5 });
    const after = await engine.fetchMascusBulk({ ...base, maxPages: 20 });

    const okGroups = (r: typeof after) => r.rows.filter((g) => g.status === "ok");
    const nonJd = (r: typeof after) => okGroups(r).filter((g) => g.brand !== "john-deere");
    const metMin = (r: typeof after) => okGroups(r).filter((g) => g.samples >= 3);

    expect(before.totalPages).toBe(30); // 6 段 × 5 页
    expect(after.totalPages).toBe(120); // 6 段 × 20 页
    expect(Object.keys(after.bySegment)).toHaveLength(6);
    expect(after.bySegment.sprayers).toBeDefined();
    expect(after.budgetExhausted).toBe(false);
    expect(after.failedPages).toBe(0);

    expect(metMin(before).length).toBe(14); // fixture 确定值
    expect(metMin(after).length).toBeGreaterThanOrEqual(16);
    expect(metMin(after).length - metMin(before).length).toBeGreaterThanOrEqual(2);
    expect(nonJd(before).length).toBe(0);
    expect(nonJd(after).length).toBeGreaterThanOrEqual(1);
    expect(nonJd(after).some((g) => g.brand === "fendt" && g.model === FENDT_MODEL)).toBe(true);
    expect(nonJd(after).find((g) => g.model === FENDT_MODEL)?.samples).toBe(7);

    // ⚠️ 规格勘误 A（真身语义）：dryRun 达标组在 :1481-1486 被标为 status='ok'，而
    //    :1526 written 与返回体 rows 同为 groups.filter(status==='ok') ⇒ written ===
    //    rows.length。真身 written 是**达标组数**，不是写库行数；架构报告 §8.2 /
    //    §10.3 的「written===0 = dryRun 零写库」是口径误读。故此处按真身断言（不写 0）；
    //    派工单要求的「written===0」由用例 ⑬ 的零达标组 fixture 落地。两处不矛盾，
    //    且全程不修改引擎任何计数语义（R11 additive-only）。
    expect(after.written).toBe(after.rows.length);
    expect(after.written).toBeGreaterThan(0);
    expect(after.groupDetail.filter((g) => g.reason === "dry-run")).toHaveLength(
      after.rows.length
    );
  });
});
