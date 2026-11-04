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
    expect(engine.MASCUS_BULK_SEGMENTS).toEqual(MASCUS_SCAN_SEGMENTS.map((s) => s.key));
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
