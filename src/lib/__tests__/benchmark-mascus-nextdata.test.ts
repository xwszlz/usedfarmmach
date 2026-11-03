/**
 * 单测：mascus 源 Next.js 改版后的解析器（parseMascusNextData / parseMascusDiagnostics）
 * ─────────────────────────────────────────────────────────
 * 背景（2026-11 实测）：mascus 整站改版为 Next.js，旧的 `/search?q=` 已被服务端忽略、
 * 返回空占位页，靠 CSS class 的 parseMascus 一条都抓不到。真实数据在
 * `<script id="__NEXT_DATA__">` 的 props.pageProps.searchRes.searchData.items 里
 * （40 条/页，结构化 JSON）。本测试覆盖：
 *   ① 有价条目被保留、无价（priceEURO:0 询价）被跳过、url/currency 正确
 *   ② priceEURO:0 全跳过，结果里不得出现 priceForeign:0
 *   ③ isRelevant 品牌/机型过滤生效（VARIANT 260 不得混入 Quadrant 结果）
 *   ④ __NEXT_DATA__ 缺失 → [] 不抛错
 *   ⑤ __NEXT_DATA__ 非法 JSON → [] 不抛错
 *   ⑥ searchRes/searchData/items 任一层级缺失 → [] 不抛错
 *   ⑦ parseMascusDiagnostics 正确取出 totalResults/itemCount/withPrice；无 __NEXT_DATA__ → {ok:false}
 *   ⑧ buildSearchUrl 的 mascus 分支产出真实品类路径 + lastcreateddays（防回归）
 *
 * ⚠️ 文件名必须是 `.test.ts`：vitest.config.ts 的 include 是 `src/**\/*.test.ts`，
 *    `.test.js` 会被静默忽略。
 *
 * benchmark-engine.js 在模块加载时就会 new PrismaClient 并读取 DATABASE_URL，
 * 故在动态 import 之前注入占位串（本测试全程不查库，不会真连接）。
 *
 * 运行：npx vitest run src/lib/__tests__/benchmark-mascus-nextdata.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://bench:bench@127.0.0.1:5432/benchmark_test";
process.env.SITE = process.env.SITE || "com";

type Engine = typeof import("@/lib/benchmark-engine");
let engine: Engine;

beforeAll(async () => {
  engine = await import("@/lib/benchmark-engine");
});

afterAll(async () => {
  // 未真正建连，$disconnect 是安全收尾
  await engine.disconnectBenchmark().catch(() => {});
});

/** 把 Next.js 的 data 对象包成带 __NEXT_DATA__ script 的 HTML（结构对齐真实页面） */
function htmlWithNextData(pageProps: unknown): string {
  const obj = { props: { pageProps } };
  return (
    `<!doctype html><html><head></head><body><div id="__next"></div>` +
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(obj)}</script>` +
    `</body></html>`
  );
}

/** 构造一个 searchRes 包装 */
function withSearchData(searchData: unknown) {
  return htmlWithNextData({ searchRes: { searchData } });
}

// ── fixtures（PII：sellerPhone 一律用明显占位，绝不写真实号码）──
const TARGET_LEXION = { nameEn: "Claas", model: "LEXION 740" };
const TARGET_QUADRANT = { nameEn: "Claas", model: "Quadrant 5300" };

function lexionScenario() {
  return withSearchData({
    totalResults: 436,
    searchTitle: "Hay and Forage machines",
    resolvedCategory: "foragers",
    errorMessage: "",
    items: [
      {
        brand: "Claas",
        model: "LEXION 740",
        priceEURO: 40491,
        priceOriginal: 45500,
        priceOriginalUnit: "USD",
        assetUrl: "/agriculture/other-forage-harvesting-equipment/claas-lexion-740/9i4m8k6g.html",
        createDate: "2026-09-29T21:49:22",
        sellerPhone: "+31 00 0000000",
        companyName: "Ritchie Bros Chicago",
      },
      {
        brand: "CLAAS",
        model: "970 4WD Forage Harvester",
        priceEURO: 0,
        assetUrl: "/agriculture/forage-harvesters/claas-970/ir8iak9r.html",
      },
      {
        brand: "Krone",
        model: "Big M 450",
        priceEURO: 0,
        assetUrl: "/agriculture/x/krone-big-m.html",
      },
    ],
  });
}

describe("parseMascusNextData —— 正常解析", () => {
  it("① 1 条有价 + 2 条询价 ⇒ 只返回 1 条，currency=EUR，priceForeign/url 正确", () => {
    const out = engine.parseMascusNextData(lexionScenario(), TARGET_LEXION);
    expect(out.length).toBe(1);
    const row = out[0];
    expect(row.currency).toBe("EUR");
    expect(row.priceForeign).toBe(40491);
    expect(row.title).toContain("LEXION");
    expect(row.url).toBe(
      "https://www.mascus.com/agriculture/other-forage-harvesting-equipment/claas-lexion-740/9i4m8k6g.html"
    );
    expect(row.sellerPhone).toBe("+31 00 0000000");
    expect(row.companyName).toBe("Ritchie Bros Chicago");
  });

  it("② priceEURO:0 全部被跳过：结果里不得出现 priceForeign:0", () => {
    const html = withSearchData({
      items: [
        { brand: "Claas", model: "LEXION 740", priceEURO: 0 },
        { brand: "Claas", model: "LEXION 740", priceEURO: 0 },
        { brand: "Claas", model: "LEXION 740", priceEURO: 0 },
      ],
    });
    const out = engine.parseMascusNextData(html, TARGET_LEXION);
    expect(out.length).toBe(0);
    expect(out.some((r) => r.priceForeign === 0)).toBe(false);
  });

  it("③ isRelevant 生效：混入 VARIANT 260 ⇒ 只留 Quadrant 5300", () => {
    const html = withSearchData({
      items: [
        { brand: "Claas", model: "Quadrant 5300", priceEURO: 30000 },
        { brand: "Krone", model: "VARIANT 260", priceEURO: 20000 },
      ],
    });
    const out = engine.parseMascusNextData(html, TARGET_QUADRANT);
    expect(out.length).toBe(1);
    expect(out[0].title).toContain("Quadrant 5300");
    expect(out.some((r) => r.title.includes("VARIANT"))).toBe(false);
  });
});

describe("parseMascusNextData —— 健壮性（不抛错）", () => {
  it("④ 没有 __NEXT_DATA__ ⇒ [] 且不抛错", () => {
    const html = "<!doctype html><html><body>no next data here</body></html>";
    expect(() => engine.parseMascusNextData(html, TARGET_LEXION)).not.toThrow();
    expect(engine.parseMascusNextData(html, TARGET_LEXION)).toEqual([]);
  });

  it("⑤ __NEXT_DATA__ 内容非法 JSON ⇒ [] 且不抛错", () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">{ this is not json </script>`;
    expect(() => engine.parseMascusNextData(html, TARGET_LEXION)).not.toThrow();
    expect(engine.parseMascusNextData(html, TARGET_LEXION)).toEqual([]);
  });

  it("⑥ searchRes/searchData/items 任一层级缺失 ⇒ [] 且不抛错", () => {
    const missingAll = htmlWithNextData({}); // props.pageProps = {} ⇒ searchRes 缺失
    const missingData = htmlWithNextData({ searchRes: {} }); // searchData 缺失
    const missingItems = htmlWithNextData({ searchRes: { searchData: {} } }); // items 缺失
    for (const html of [missingAll, missingData, missingItems]) {
      expect(() => engine.parseMascusNextData(html, TARGET_LEXION)).not.toThrow();
      expect(engine.parseMascusNextData(html, TARGET_LEXION)).toEqual([]);
    }
  });
});

describe("parseMascusDiagnostics —— 运维诊断（不参与聚合）", () => {
  it("⑦ 正确取出 totalResults / itemCount / withPrice", () => {
    const diag = engine.parseMascusDiagnostics(lexionScenario());
    expect(diag.ok).toBe(true);
    if (diag.ok) {
      expect(diag.totalResults).toBe(436);
      expect(diag.searchTitle).toBe("Hay and Forage machines");
      expect(diag.resolvedCategory).toBe("foragers");
      expect(diag.itemCount).toBe(3);
      expect(diag.withPrice).toBe(1);
    }
  });

  it("⑦' 无 __NEXT_DATA__ ⇒ {ok:false}", () => {
    const diag = engine.parseMascusDiagnostics("<html><body>nothing</body></html>");
    expect(diag.ok).toBe(false);
    if (!diag.ok) {
      expect(typeof diag.reason).toBe("string");
    }
  });
});

describe("buildSearchUrl —— mascus 改版后真实品类路径（防回归）", () => {
  it("⑧ 按 target.category 映射到真实路径段 + lastcreateddays=7", () => {
    const src = { key: "mascus", currency: "EUR", name: "Mascus" };
    expect(engine.buildSearchUrl(src, { nameEn: "Claas", model: "X", category: "tractor" })).toBe(
      "https://www.mascus.com/agriculture/tractors?lastcreateddays=7"
    );
    expect(
      engine.buildSearchUrl(src, { nameEn: "Claas", model: "X", category: "forage_harvester" })
    ).toBe("https://www.mascus.com/agriculture/hay-and-forage-machines?lastcreateddays=7");
    expect(
      engine.buildSearchUrl(src, { nameEn: "Claas", model: "X", category: "combine" })
    ).toBe("https://www.mascus.com/agriculture/agricultural-harvesters?lastcreateddays=7");
    // 未知品类 ⇒ 回落 hay-and-forage-machines
    expect(
      engine.buildSearchUrl(src, { nameEn: "Claas", model: "X", category: "unknown-cat" })
    ).toBe("https://www.mascus.com/agriculture/hay-and-forage-machines?lastcreateddays=7");
    // 旧废 URL（/search?q=）不得再出现
    expect(
      engine.buildSearchUrl(src, { nameEn: "Claas", model: "X", category: "tractor" })
    ).not.toContain("/search?q=");
  });
});
