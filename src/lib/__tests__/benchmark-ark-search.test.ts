/**
 * 单测：Ark web_search 兜底通道（**全程离线**，注入 fake fetch，不打真实网络）
 * ─────────────────────────────────────────────────────────
 * 背景（2026-11）：machinerypete(470 自建 WAF) / tractorhouse(403 Cloudflare) /
 * agriaffaires(403 DataDome) 这类硬拦源，提超时换 UA 全无效。方舟 web_search 打通后
 * 实测能绕过 WAF 拿到真实挂牌价，故加一条**默认关闭**的兜底通道。
 *
 * 🔴 本文件的第一原则是**不许把别家的价记在这个源头上**。第二轮反向探针实测：
 *    `site:agriaffaires.co.uk ...` 的正文写满 €62,500 / €80,000，但 12 条 url_citation
 *    里一条 agriaffaires 都没有（全在 tractorhouse.com.au / nongjitong 上）。
 *    所以实现改成「按 citation 溯源」：只认引用在源站域名上的页面摘要里的价。
 *    下面的 ⑤b / ⑭ / ⑮ / ⑯ 就是这条规则的四个守卫。
 *
 * 覆盖：
 *   ① extractArkSearchPrices：只认带币种符号/前缀的数字（裸数字 = 年份/工时/库存号，必须丢）
 *   ② 千分位归一：`99,900` / `1,234.56`（英美）与 `99.900`（欧陆）都要算对
 *   ③ 金额区间闸：<1000 / >5,000,000 一律丢
 *   ④ extractArkSearchText：output[].content[].text（type=message）优先，output_text 兜底
 *   ⑤ fetchViaArkSearch 正常路径：≥3 条溯源价 → ok，中位价正确，confidence 固定 0.3，
 *      sourceUrl 带 `#ark-search` 标记（事后可区分检索行与直连行）
 *   ⑤b 反向探针守卫：agriaffaires 一条自家 citation 都拿不到 ⇒ skip `no-site-citation`
 *   ⑥ 去重：同一价格重复出现只算一次（不虚增样本数）
 *   ⑦ 样本 <3 ⇒ skip `insufficient-samples`；0 条 ⇒ skip `no-price`（绝不编造）
 *   ⑧ agroline 硬排除：连请求都不发（健康源不许被检索价污染）
 *   ⑨ 无 ARK_API_KEY ⇒ failed `ark-no-api-key`；网络错误 ⇒ 降级且带 errors
 *   ⑩ shouldArkFallback：只有 `failed` 触发，`skip` 不触发
 *   ⑪ runRefresh 探针模式：只跑注入的那几条，不建靶标池、不跑 mascus bulk
 *   ⑫ 双重门控：默认关时 stats 里**没有** arkFallback 字段（行为与加此功能前一致）
 *   ⑬ arkHostMatchesSite：同品牌国别站（.com ↔ .com.au）要认，不同品牌要拒
 *   ⑭ 币种闸：镜像站的 `AUD $88,227` 不得被当成 USD（只取 `USD $61,500`）
 *   ⑮ 机型闸：同页里 `Jaguar 8700` 的价不得算进 `Jaguar 870`
 *
 * ⚠️ 文件名必须是 `.test.ts`（vitest.config.ts include = `src/**\/*.test.ts`）。
 * 运行：npx vitest run src/lib/__tests__/benchmark-ark-search.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";

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

/** 一条引用（真实响应里 url_citation 就是这个形状的超集） */
interface FakeCitation {
  url: string;
  /** 该页的搜索结果摘要原文（价格只能从这里取） */
  summary: string;
  title?: string;
}

/** 构造一个 Ark Responses 响应（message + content[].text + annotations[]） */
function arkResp(text: string, citations: FakeCitation[] = []) {
  return {
    output: [
      {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text,
            annotations: citations.map((c) => ({
              type: "url_citation",
              url: c.url,
              title: c.title || c.url,
              site_name: "",
              summary: c.summary,
            })),
          },
        ],
      },
    ],
  };
}

interface FakeReply {
  /** 模型正文（**永不参与聚合**，只进 prosePrices 诊断） */
  text?: string;
  citations?: FakeCitation[];
}

/** 生成 fake fetch：按 query 顺序返回预设回复，并记录调用 */
function makeFakeFetch(replies: FakeReply[]) {
  const calls: Array<{ url: string; body: any }> = [];
  let i = 0;
  const fn = async (url: string, body: any) => {
    calls.push({ url, body });
    const r = replies[Math.min(i, replies.length - 1)] || {};
    i += 1;
    return arkResp(r.text || "", r.citations || []);
  };
  return { fn, calls };
}

const FX = { EUR: 8, USD: 7.2, GBP: 9.6, CNY: 1, RUB: 0.09 };

/** tractorhouse 上三条真实形状的挂牌摘要（USD 计价，含机型串） */
const TH_CITES: FakeCitation[] = [
  {
    url: "https://www.tractorhouse.com/listings/for-sale/john-deere/5075e/1110",
    summary: "2023 JOHN DEERE 5075E 40 HP to 99 HP Tractors $39,995 USD 63 hours Abbeville, AL",
  },
  {
    url: "https://www.tractorhouse.com/listing/for-sale/258961573/2024-john-deere-5075e",
    summary: "2024 JOHN DEERE 5075E Tractors $49,900 USD 618 hours Pauls Valley, OK",
  },
  {
    url: "https://www.tractorhouse.com/listing/for-sale/251126509/2025-john-deere-5075e",
    summary: "2025 JOHN DEERE 5075E Tractors $61,500 USD 8 hours Ridge Spring, SC",
  },
];

describe("extractArkSearchPrices —— 只认带币种的价格", () => {
  it("① 裸数字（年份/工时/库存号）一律丢弃", () => {
    const out = engine.extractArkSearchPrices(
      "Model year 2024, 1525 hours, stock 88990011, price on request."
    );
    expect(out).toEqual([]);
  });

  it("①b 带币种符号/前缀的数字被抽出（含 US$ / 欧元 / 英镑）", () => {
    const out = engine.extractArkSearchPrices("$99,900 and US$74,600 and €103,000 or £96,250");
    expect(out.map((p) => `${p.currency}:${p.amount}`)).toEqual([
      "USD:99900",
      "USD:74600",
      "EUR:103000",
      "GBP:96250",
    ]);
  });

  it("② 千分位归一：英美逗号与欧陆点号", () => {
    const out = engine.extractArkSearchPrices("EUR 99.900 / USD 1,234,567.89");
    expect(out[0].amount).toBe(99900);
    expect(out[1].amount).toBe(1234567.89);
  });

  it("③ 区间闸：配件价与写错位数被丢", () => {
    expect(engine.extractArkSearchPrices("$12 filters")).toEqual([]);
    expect(engine.extractArkSearchPrices("$9,999,999 typo")).toEqual([]);
    expect(engine.extractArkSearchPrices("$1,000 ok")).toHaveLength(1);
  });

  it("③b 币种过滤：只保留指定币种（镜像站双币种的场景）", () => {
    const text = "AUD $88,227 Price entered as : USD $61,500";
    expect(engine.extractArkSearchPrices(text, { currency: "USD" }).map((p) => p.amount)).toEqual([
      61500,
    ]);
    expect(engine.extractArkSearchPrices(text, { currency: "EUR" })).toEqual([]);
  });
});

describe("extractArkSearchText —— 正文抽取", () => {
  it("④ output[type=message].content[].text 优先", () => {
    const text = engine.extractArkSearchText(arkResp("hello $1,234"));
    expect(text).toContain("hello $1,234");
  });

  it("④b output_text 兜底", () => {
    expect(engine.extractArkSearchText({ output_text: "fallback $2,000" })).toContain("$2,000");
  });

  it("④c 结构不认识 ⇒ 空串，不抛错", () => {
    expect(engine.extractArkSearchText(null)).toBe("");
    expect(engine.extractArkSearchText({ nothing: 1 })).toBe("");
  });
});

describe("extractArkCitations —— 溯源依据", () => {
  it("④d 只认 url_citation，按 url 去重，主机名去掉 www", () => {
    const resp = {
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "x",
              annotations: [
                { type: "url_citation", url: "https://www.machinerypete.com/a", summary: "A $1" },
                { type: "url_citation", url: "https://www.machinerypete.com/a", summary: "A $1" },
                { type: "url_citation", url: "https://machinerypete.com/b", summary: "B $2" },
                { type: "file_citation", file_id: "f1" },
                { type: "url_citation", url: "/relative", summary: "C" },
              ],
            },
          ],
        },
      ],
    };
    const cites = engine.extractArkCitations(resp);
    expect(cites.map((c) => c.host)).toEqual(["machinerypete.com", "machinerypete.com"]);
    expect(cites.map((c) => c.url)).toEqual([
      "https://www.machinerypete.com/a",
      "https://machinerypete.com/b",
    ]);
  });

  it("④e 无 annotations ⇒ 空数组，不抛错", () => {
    expect(engine.extractArkCitations(null)).toEqual([]);
    expect(engine.extractArkCitations({ output: [{ type: "message", content: [] }] })).toEqual([]);
  });
});

describe("arkHostMatchesSite —— 只认同品牌同站点", () => {
  it("⑬ 主域/子域/同品牌国别站都认；不同品牌与不同市场要拒", () => {
    expect(engine.arkHostMatchesSite("machinerypete.com", "machinerypete.com")).toBe(true);
    expect(engine.arkHostMatchesSite("www.machinerypete.com", "machinerypete.com")).toBe(true);
    // 实测：site:tractorhouse.com 返回的 citations 全在 .com.au 镜像站上
    expect(engine.arkHostMatchesSite("www.tractorhouse.com.au", "tractorhouse.com")).toBe(true);
    expect(engine.arkHostMatchesSite("tractorhouse.co.uk", "tractorhouse.com")).toBe(true);
    // 别家站点一律拒（agriaffaires 事故的核心）
    expect(engine.arkHostMatchesSite("www.tractorhouse.com.au", "agriaffaires.co.uk")).toBe(false);
    expect(engine.arkHostMatchesSite("toutiao.nongjitong.com", "agriaffaires.co.uk")).toBe(false);
    expect(engine.arkHostMatchesSite("claasharvestcentre.com", "machinerypete.com")).toBe(false);
    // 空值不匹配，不抛错
    expect(engine.arkHostMatchesSite("", "machinerypete.com")).toBe(false);
    expect(engine.arkHostMatchesSite("machinerypete.com", "")).toBe(false);
  });
});

describe("fetchViaArkSearch —— 离线 fake fetch", () => {
  const originalKey = process.env.ARK_API_KEY;
  beforeEach(() => {
    process.env.ARK_API_KEY = "test-key-not-real";
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ARK_API_KEY;
    else process.env.ARK_API_KEY = originalKey;
  });

  const source = { key: "tractorhouse", currency: "USD", region: "US" };
  const target = {
    brand: "john-deere",
    brandNameZh: "约翰迪尔",
    nameEn: "John Deere",
    model: "5075E",
    category: "tractor",
  };

  it("⑤ ≥3 条溯源价 ⇒ ok，中位价正确、confidence 固定 0.3、sourceUrl 带 #ark-search", async () => {
    const { fn, calls } = makeFakeFetch([
      // ① 锁站点检索：3 条 citation，每条摘要各带一个挂牌价
      { text: "三台在售 5075E", citations: TH_CITES },
      // ② 不锁站点检索：正文里 3 条与①重合 + 1 条只出现在这里（只进诊断）
      { text: "Cross-site: $37,995 / $39,995 / $49,900 / $61,500" },
    ]);
    const r = await engine.fetchViaArkSearch(source, target, FX, { fetchImpl: fn, dryRun: true });

    expect(r.status).toBe("ok");
    expect(r.dryRun).toBe(true);
    // 🔴 入库口径只看 citation 溯源到 tractorhouse 的 3 条
    expect(r.prices).toHaveLength(3);
    expect(r.prices.map((p) => p.amount)).toEqual([39995, 49900, 61500]);
    // 每条价都带得来处的 URL（事后可逐条复核）
    expect(r.prices[0].sourceUrl).toContain("tractorhouse.com");
    expect(r.siteCitations).toBe(3);
    expect(r.citedDomains).toEqual(["tractorhouse.com"]);
    // 跨站那条 37,995 只进诊断
    expect(r.crossSitePrices).toHaveLength(1);
    expect(r.crossSitePrices[0].amount).toBe(37995);
    expect(r.corroborated).toBe(3); // ①②撞到的同 3 个价 = 交叉印证
    expect(r.currency).toBe("USD");
    // 3 条升序 39,995 / 49,900 / 61,500 ⇒ 中位 49,900
    expect(r.medianForeign).toBe(49900);
    // 类型收窄：status==='ok' 时必然带 row（skip/failed 分支不会返回 ok）
    const row = r.row!;
    expect(row).toBeTruthy();
    expect(row.confidenceScore).toBe(0.3);
    expect(row.sourceUrl).toBe("https://tractorhouse.com/#ark-search");
    expect(row.sourceDate).toBe(new Date().toISOString().slice(0, 10));
    // 两次调用，且请求体形状正确（web_search + search_engine + bearer）
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.url).toContain("/responses");
      expect(c.body.stream).toBe(false);
      expect(c.body.tools[0].type).toBe("web_search");
      // ⚠️ 必须 search_engine：写 doubao 会 403（见引擎里的坑记录）
      expect(c.body.tools[0].sources).toEqual(["search_engine"]);
      expect(c.body.input[0].content[0].text).toBeTruthy();
    }
    // 第一条 query 必须锁站点
    expect(calls[0].body.input[0].content[0].text).toContain("site:tractorhouse.com");
  });

  it("⑤b 🔴 反向探针守卫：一条自家 citation 都没有 ⇒ no-site-citation，正文价一律丢弃", async () => {
    // 复刻 agriaffaires(DataDome) 的**真实**返回：正文写满欧元价，citations 全在别家
    const { fn } = makeFakeFetch([
      {
        text:
          "我查到 agriaffaires.co.uk 没有能直接确认价格的在售条目。可参考：€62,500 / €80,000 / €85,000",
        citations: [
          {
            url: "https://www.tractorhouse.com.au/en-gb/listing/for-sale/256277241/2001-claas-jaguar-870",
            summary: "2001 CLAAS JAGUAR 870 AUD $98,752 Price entered as : EUR € 62.500",
          },
          {
            url: "https://toutiao.nongjitong.com/product/claas_jaguar_870_silage_harvester.html",
            summary: "科乐收 JAGUAR 870 255万-402万",
          },
        ],
      },
      {
        text:
          "elsewhere: " +
          Array.from({ length: 20 }, (_, i) => `€${100 + i * 10},000`).join(" "),
      },
    ]);
    const r = await engine.fetchViaArkSearch(
      { key: "agriaffaires", currency: "EUR", region: "EU" },
      {
        brand: "claas",
        brandNameZh: "克拉斯",
        nameEn: "CLAAS",
        model: "Jaguar 870",
        category: "forage_harvester",
      },
      FX,
      { fetchImpl: fn, dryRun: true }
    );
    expect(r.status).toBe("skip");
    expect(r.reason).toBe("no-site-citation");
    expect(r.prices).toHaveLength(0); // 一条都不许入库
    expect(r.siteCitations).toBe(0);
    expect(r.citedDomains).toContain("tractorhouse.com.au");
    expect(r.citedDomains).toContain("toutiao.nongjitong.com");
    // 正文里确实抽到了价，但全部只进诊断
    expect(r.prosePrices.length).toBeGreaterThan(0);
    expect(r.row).toBeUndefined(); // 一行都不许写
    expect(r.hint).toContain("agriaffaires.co.uk");
  });

  it("⑤c 跨站价只进诊断，且不足以凑满 2 条样本", async () => {
    // 锁站点只溯源到 2 条，不锁站点给一堆 —— 仍然 skip
    const { fn } = makeFakeFetch([
      { citations: TH_CITES.slice(0, 2) },
      { text: "elsewhere: $37,995 $38,995 $41,000 $45,000 $52,500" },
    ]);
    const r = await engine.fetchViaArkSearch(source, target, FX, { fetchImpl: fn, dryRun: true });
    expect(r.status).toBe("skip");
    expect(r.reason).toBe("insufficient-samples");
    expect(r.prices).toHaveLength(2);
    expect(r.crossSitePrices.length).toBe(5);
    expect(r.row).toBeUndefined();
  });

  it("⑥ 去重：同一价格重复出现只算一次", async () => {
    const { fn } = makeFakeFetch([
      {
        citations: [
          { url: "https://www.tractorhouse.com/a", summary: "5075E $50,000 USD $50,000 USD" },
          { url: "https://www.tractorhouse.com/b", summary: "5075E $50,000 USD" },
        ],
      },
      { text: "$50,000" },
    ]);
    const r = await engine.fetchViaArkSearch(source, target, FX, { fetchImpl: fn, dryRun: true });
    expect(r.status).toBe("skip"); // 去重后只剩 1 条 < 3
    expect(r.reason).toBe("insufficient-samples");
    expect(r.prices).toHaveLength(1);
  });

  it("⑦ 样本 <3 ⇒ skip insufficient-samples（绝不编造）", async () => {
    const { fn } = makeFakeFetch([{ citations: TH_CITES.slice(0, 1) }, { text: "只有一台" }]);
    const r = await engine.fetchViaArkSearch(source, target, FX, { fetchImpl: fn, dryRun: true });
    expect(r.status).toBe("skip");
    expect(r.reason).toBe("insufficient-samples");
    expect(r.hint).toContain("<3");
  });

  it("⑦b 引用到了页面但摘要没有带币种价格 ⇒ skip no-price（裸数字不算）", async () => {
    const { fn } = makeFakeFetch([
      {
        citations: [
          {
            url: "https://www.tractorhouse.com/listing/for-sale/1",
            summary: "2024 JOHN DEERE 5075E, 1525 hours, stock 88990011, price on request",
          },
        ],
      },
      { text: "ask dealer" },
    ]);
    const r = await engine.fetchViaArkSearch(source, target, FX, { fetchImpl: fn, dryRun: true });
    expect(r.status).toBe("skip");
    expect(r.reason).toBe("no-price");
  });

  it("⑦c 正文有价、citation 也有价，但正文价不得进聚合", async () => {
    const { fn } = makeFakeFetch([
      {
        text: "正文里混入别家价：$11,111 $22,222",
        citations: TH_CITES,
      },
      { text: "" },
    ]);
    const r = await engine.fetchViaArkSearch(source, target, FX, { fetchImpl: fn, dryRun: true });
    expect(r.prices.map((p) => p.amount)).toEqual([39995, 49900, 61500]);
    expect(r.prosePrices.map((p) => p.amount)).toEqual([11111, 22222]);
  });

  it("⑧ agroline 硬排除：一次请求都不发", async () => {
    const { fn, calls } = makeFakeFetch([{ citations: TH_CITES }]);
    const r = await engine.fetchViaArkSearch(
      { key: "agroline", currency: "EUR", region: "EU" },
      { ...target, model: "8R 410" },
      FX,
      { fetchImpl: fn, dryRun: true }
    );
    expect(r.status).toBe("skip");
    expect(r.reason).toBe("ark-source-blocked");
    expect(calls).toHaveLength(0);
  });

  it("⑨ 无 API Key ⇒ failed ark-no-api-key，且不发请求", async () => {
    delete process.env.ARK_API_KEY;
    const { fn, calls } = makeFakeFetch([{ citations: TH_CITES }]);
    const r = await engine.fetchViaArkSearch(source, target, FX, { fetchImpl: fn, dryRun: true });
    expect(r.status).toBe("failed");
    expect(r.reason).toBe("ark-no-api-key");
    expect(calls).toHaveLength(0);
  });

  it("⑨b 网络错误 ⇒ 降级且 errors 带原因", async () => {
    const boom = async () => {
      throw new Error("HTTP 403: AccessDenied");
    };
    const r = await engine.fetchViaArkSearch(source, target, FX, { fetchImpl: boom, dryRun: true });
    expect(r.status).toBe("skip");
    expect(r.reason).toBe("no-price");
    expect(r.errors!.join(" ")).toContain("403");
  });

  it("⑭ 币种闸：镜像站的 AUD 换算值不得被当成 USD", async () => {
    const { fn } = makeFakeFetch([
      {
        citations: [
          {
            url: "https://www.tractorhouse.com.au/en-gb/listing/for-sale/254496949/2025-john-deere-5075e",
            summary:
              "2025 JOHN DEERE 5075E $79,216 Price entered as : USD $55,000 Hours 1 South Daytona, FL",
          },
          {
            url: "https://www.tractorhouse.com.au/listing/for-sale/251126509/2025-john-deere-5075e",
            summary:
              "2025 JOHN DEERE 5075E AUD $88,227 Price entered as : USD $61,500 Hours 8 Ridge Spring, SC",
          },
          {
            url: "https://www.tractorhouse.com.au/nl/listing/for-sale/258961573/2024-john-deere-5075e",
            summary:
              "2024 JOHN DEERE 5075E $69,957 Prijs ingevoerd als : USD $49,900 Uur 618 Pauls Valley, OK",
          },
        ],
      },
      { text: "" },
    ]);
    const r = await engine.fetchViaArkSearch(source, target, FX, { fetchImpl: fn, dryRun: true });
    expect(r.status).toBe("ok");
    // 只剩 USD 标注过的三个真价，AUD 换算值 79,216 / 88,227 / 69,957 全部被丢
    expect(r.prices.map((p) => p.amount)).toEqual([55000, 61500, 49900]);
    expect(r.medianForeign).toBe(55000);
  });

  it("⑮ 机型闸：同页里 Jaguar 8700 的价不得算进 Jaguar 870", async () => {
    const { fn } = makeFakeFetch([
      {
        citations: [
          {
            url: "https://www.machinerypete.com/hay-and-forage/windrowers-and-swathers/claas",
            summary: "Used Claas Windrowers for Sale 2009 Claas Jaguar 8700 $169,000 USD 3636 hours",
          },
          {
            url: "https://www.machinerypete.com/harvesting/self-propelled-forage-harvesters/claas/jaguar-870",
            summary:
              "2004 Claas Jaguar 870 $74,600 USD 3500 hours 2010 Claas Jaguar 870 $99,900 USD 4859 hours 2008 Claas Jaguar 870 $107,500 USD 5236 hours",
          },
        ],
      },
      { text: "" },
    ]);
    const r = await engine.fetchViaArkSearch(
      { key: "machinerypete", currency: "USD", region: "US" },
      {
        brand: "claas",
        brandNameZh: "克拉斯",
        nameEn: "CLAAS",
        model: "Jaguar 870",
        category: "forage_harvester",
      },
      FX,
      { fetchImpl: fn, dryRun: true }
    );
    expect(r.status).toBe("ok");
    // 8700 的 169,000 必须被挡掉；剩下三条真 870
    expect(r.prices.map((p) => p.amount)).toEqual([74600, 99900, 107500]);
    expect(r.prices.some((p) => p.amount === 169000)).toBe(false);
    expect(r.medianForeign).toBe(99900);
  });

  it("⑯ 正文抽价永远不写库：dryRun=false 时也只用溯源价", async () => {
    const { fn } = makeFakeFetch([
      { text: "正文 $11,111", citations: TH_CITES.slice(0, 1) },
      { text: "" },
    ]);
    const r = await engine.fetchViaArkSearch(source, target, FX, { fetchImpl: fn, dryRun: true });
    expect(r.prices.map((p) => p.amount)).toEqual([39995]);
    expect(r.prosePrices.map((p) => p.amount)).toEqual([11111]);
    expect(r.status).toBe("skip"); // 1 条 < 3，一行不写
  });
});

describe("shouldArkFallback —— 只有 failed 触发", () => {
  it("⑩ failed 触发；skip / ok 不触发；agroline 永不触发", () => {
    expect(engine.shouldArkFallback("failed", "tractorhouse")).toBe(true);
    expect(engine.shouldArkFallback("failed", "machinerypete")).toBe(true);
    expect(engine.shouldArkFallback("skip", "tractorhouse")).toBe(false);
    expect(engine.shouldArkFallback("ok", "tractorhouse")).toBe(false);
    expect(engine.shouldArkFallback("failed", "agroline")).toBe(false);
  });
});

describe("runRefresh —— 探针模式与双重门控", () => {
  const originalKey = process.env.ARK_API_KEY;
  const originalGate = process.env.BENCHMARK_ARK_FALLBACK;
  beforeEach(() => {
    process.env.ARK_API_KEY = "test-key-not-real";
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ARK_API_KEY;
    else process.env.ARK_API_KEY = originalKey;
    if (originalGate === undefined) delete process.env.BENCHMARK_ARK_FALLBACK;
    else process.env.BENCHMARK_ARK_FALLBACK = originalGate;
  });

  it("⑪ 探针模式只跑注入的条目，不跑靶标池/mascus bulk", async () => {
    const { fn } = makeFakeFetch([{ citations: TH_CITES }]);
    const stats = await engine.runRefresh({
      fx: FX,
      arkSearchProbe: [{ sourceSite: "tractorhouse", brand: "john-deere", model: "5075E" }],
      arkSearchDryRun: true,
      arkSearchFetch: fn,
    });
    expect(stats.total).toBe(1);
    expect(stats.mascus).toBeNull(); // 没跑 mascus bulk
    expect(stats.ok).toBe(1);
    expect(stats.arkProbe).toHaveLength(1);
    const p = stats.arkProbe![0];
    expect(p.sourceSite).toBe("tractorhouse");
    expect(p.medianForeign).toBe(49900);
    expect(p.wrote).toBe(false); // dryRun 不写库
    expect(p.siteCitations).toBe(3);
    expect(p.citedDomains).toEqual(["tractorhouse.com"]);
  });

  it("⑫ 默认关：不注入任何 Ark 选项时 stats 里没有 arkFallback 字段", async () => {
    const stats = await engine.runRefresh({
      fx: FX,
      targets: [{ sourceSite: "__nosrc__" }],
      dryRun: true,
      budgetMs: 60000,
      concurrency: 1,
    });
    expect("arkFallback" in stats).toBe(false);
    expect(stats.mascus).toBeNull();
  });

  it("⑫b 门控缺一不可：只给 opts.arkSearchFallback 但 env 未开 ⇒ 不挂 arkFallback", async () => {
    delete process.env.BENCHMARK_ARK_FALLBACK;
    const stats = await engine.runRefresh({
      fx: FX,
      targets: [{ sourceSite: "__nosrc__" }],
      dryRun: true,
      arkSearchFallback: true,
      budgetMs: 60000,
      concurrency: 1,
    });
    expect("arkFallback" in stats).toBe(false);
  });

  it("⑫c 双闸都开但本轮没有 failed 目标 ⇒ arkFallback 存在且 total=0（skip 不触发）", async () => {
    process.env.BENCHMARK_ARK_FALLBACK = "1";
    const stats = await engine.runRefresh({
      fx: FX,
      targets: [{ sourceSite: "__nosrc__" }],
      dryRun: true,
      arkSearchFallback: true,
      budgetMs: 60000,
      concurrency: 1,
    });
    expect(stats.arkFallback).toBeTruthy();
    const fb = stats.arkFallback!;
    expect(fb.enabled).toBe(true);
    expect(fb.total).toBe(0);
    // 闭合不变量不受影响
    expect(stats.ok + stats.skip + stats.failed + stats.skippedByBudget).toBe(stats.total);
  });
});
