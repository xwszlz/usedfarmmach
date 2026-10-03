// ───────────────────────────────────────────────
// #1 卖方采集 Agent — 搜索 API 路线（C 路线）
// ───────────────────────────────────────────────
// 背景：Agriaffaires 已上 DataDome 反爬；直抓无望。本路线消费「搜索引擎索引里
// 已存在的带价挂牌」，不撞反爬、不直连对方页面。
//
// 后端选择：
//   A) 有 SEARCH_API_KEY           → 搜索 API（tavily / serper / brave）取 results[]，
//                                     再交给 Ark 抽成 listings[]（有 ARK_API_KEY 时），
//                                     无 Ark 时退回规则抽取。
//   B) 无 SEARCH_API_KEY 但有 ARK  → Ark 联网插件（Web Search，Responses API）一次调用
//                                     内完成「联网搜索 + 抽取」。
//   C) 两者都没有                  → 打印跳过原因，写空契约，退出码 0。
//
// provider 选择：SEARCH_API_PROVIDER 显式设置时用它；未设置时按 key 前缀自动识别
//   （`tvly-` → tavily）。识别不出时**不瞎猜**，打印清晰错误后优雅退出。
//
// Tavily REST（官方形状）：POST https://api.tavily.com/search
//   { query, max_results(0-20), search_depth, include_answer, include_raw_content }
//   → { results:[{title,url,content,score}] }
//
// 🔴 Ark chat/completions 路径必须带 `thinking:{type:"disabled"}`（本项目实证）。
//    Ark Responses（联网插件）路径按官方示例即可。
//
// 🔴 安全：绝不把 key 写进代码/commit；日志只打掩码（如 tvly-dev-****eJ3wq）。
//    非 2xx 时打**原始响应体**，不吞错。
//
// 合规：仅保留搜索 API 返回的原站 sourceUrl，绝不直连抓取对方页面。
//
// 用法: npx tsx scripts/scout-via-search-api.ts
// 环境变量:
//   SEARCH_API_KEY       搜索 API 密钥（tavily `tvly-…` / serper / brave）
//   SEARCH_API_PROVIDER  serper | tavily | brave（可选；不设则按 key 前缀识别）
//   ARK_API_KEY          豆包密钥（用于抽取；也可单独作为联网搜索后端）
//   ARK_MODEL_ID         豆包模型 ID（默认 doubao-seed-2-1-pro-260915）
//   ARK_BASE_URL         豆包网关（默认 https://ark.cn-beijing.volces.com/api/v3）
//   SEARCH_MAX_QUERIES   最多查询数（默认 9）
// ───────────────────────────────────────────────

import * as fs from "fs";
import * as path from "path";

// ── 契约类型（与 scripts/import-seller-scout.ts 的 IntlOutput 完全对齐）──

interface IntlListing {
  brand: string;
  modelName: string;
  year: number | null;
  engineHours: number | null;
  priceCny: number | null;
  priceEur: number | null;
  country: string;
  location: string;
  sellerName?: string;
  sellerPhone?: string;
  source: string;
  sourceDate: string;
  sourceUrl?: string;
}

interface IntlOutput {
  scrapedAt: string;
  source: string;
  totalListings: number;
  withPrice: number;
  priceOnRequest: number;
  platformStats?: Record<string, number>;
  listings: IntlListing[];
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

type Provider = "serper" | "tavily" | "brave";
type Backend = "provider" | "ark-websearch" | "none" | "badkey";

interface BrandModel {
  zh: string;
  en: string;
  models: string[];
}

// ── 配置 ──

const SEARCH_API_KEY = (process.env.SEARCH_API_KEY || "").trim();
const PROVIDER_ENV = (process.env.SEARCH_API_PROVIDER || "").trim().toLowerCase();

const ARK_API_KEY = (process.env.ARK_API_KEY || "").trim();
const ARK_MODEL_ID = (process.env.ARK_MODEL_ID || "doubao-seed-2-1-pro-260915").trim();
const ARK_BASE_URL = (process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/$/, "");

const MAX_QUERIES = Math.max(1, parseInt(process.env.SEARCH_MAX_QUERIES || "9", 10) || 9);

const TAVILY_MAX_RESULTS = 10; // 官方约束 0–20
const GBP_CNY_RATE = 9.2; // 与 scrape_mascus.py 一致

// 9 大国际品牌 × 代表型号（沿用国内爬虫的品牌定义）
const BRAND_MODELS: BrandModel[] = [
  { zh: "约翰迪尔", en: "John Deere", models: ["6155R", "6R 185"] },
  { zh: "克拉斯", en: "Claas", models: ["Arion 460"] },
  { zh: "纽荷兰", en: "New Holland", models: ["T6.180"] },
  { zh: "凯斯", en: "Case IH", models: ["Puma 185"] },
  { zh: "麦赛福格森", en: "Massey Ferguson", models: ["MF 7719"] },
  { zh: "明斯克", en: "MTZ Belarus", models: ["82.1"] },
  { zh: "久保田", en: "Kubota", models: ["M7040"] },
  { zh: "科罗尼", en: "Krone", models: ["Comprima"] },
  { zh: "麦克海尔", en: "McHale", models: ["Fusion 3"] },
];

const OUTPUT_FILE = path.join(__dirname, "search_api_data.json");

// ── 通用工具 ──

/** 掩码显示密钥，日志里绝不出现完整 key */
function maskKey(key: string): string {
  if (!key) return "(空)";
  if (key.length <= 12) return "****";
  return `${key.slice(0, 8)}****${key.slice(-5)}`;
}

/** "YYYYMMDD" 口径的当日日期（与其它采集器一致） */
function todayCompact(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** 写空契约文件（未配置密钥 / 无法识别 provider / 无结果兜底） */
function writeEmptyOutput(reason: string): void {
  const empty: IntlOutput = {
    scrapedAt: new Date().toISOString(),
    source: "search_api",
    totalListings: 0,
    withPrice: 0,
    priceOnRequest: 0,
    platformStats: { search_api: 0 },
    listings: [],
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(empty, null, 2), "utf-8");
  console.log(`📁 已写入空契约文件（${reason}）: ${OUTPUT_FILE}`);
}

/** 从模型输出中稳健抽取 JSON（容忍 markdown 代码块与前后杂文本） */
function extractJsonObject(text: string): unknown {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** 把模型给出的原始 listing 规整为契约条目 */
function normalizeListings(rawListings: unknown, brandZhFallback: string, urlPool: string[]): IntlListing[] {
  if (!Array.isArray(rawListings)) return [];
  const sourceDate = todayCompact();
  const out: IntlListing[] = [];
  for (const raw of rawListings as Array<Record<string, unknown>>) {
    if (!raw || typeof raw !== "object") continue;
    const modelName = String(raw.modelName || "").trim();
    if (!modelName) continue;
    let sourceUrl = String(raw.sourceUrl || "").trim();
    if (!sourceUrl && urlPool.length > 0) sourceUrl = urlPool[0];
    out.push({
      brand: String(raw.brand || "").trim() || brandZhFallback,
      modelName: modelName.slice(0, 80),
      year: typeof raw.year === "number" ? raw.year : null,
      engineHours: typeof raw.engineHours === "number" ? raw.engineHours : null,
      priceCny: typeof raw.priceCny === "number" ? raw.priceCny : null,
      priceEur: typeof raw.priceEur === "number" ? raw.priceEur : null,
      country: String(raw.country || "").trim(),
      location: String(raw.location || "").trim(),
      sellerName: String(raw.sellerName || "").trim(),
      source: "search_api",
      sourceDate,
      sourceUrl,
    });
  }
  return out;
}

// ── provider 识别 ──

function resolveProvider(): { provider: Provider | null; reason?: string } {
  if (PROVIDER_ENV) {
    if (PROVIDER_ENV === "serper" || PROVIDER_ENV === "tavily" || PROVIDER_ENV === "brave") {
      return { provider: PROVIDER_ENV };
    }
    return { provider: null, reason: `SEARCH_API_PROVIDER='${PROVIDER_ENV}' 不受支持（仅 serper/tavily/brave）` };
  }
  // 未显式设置 → 按 key 前缀自动识别（不瞎猜）
  if (SEARCH_API_KEY.startsWith("tvly-")) return { provider: "tavily" };
  return { provider: null, reason: "无法识别 SEARCH_API_KEY 前缀，请显式设置 SEARCH_API_PROVIDER" };
}

// ═══════════════════════════════════════════════
// 搜索 API 客户端（tavily / serper / brave）
// ═══════════════════════════════════════════════

async function searchTavily(query: string, maxResults: number): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SEARCH_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query.slice(0, 399), // 官方建议 < 400 字符
      max_results: Math.min(Math.max(maxResults, 0), 20),
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error(`  ❌ Tavily HTTP ${res.status}，原始响应体：`);
    console.error(raw.slice(0, 1000));
    throw new Error(`tavily HTTP ${res.status}`);
  }
  const data = JSON.parse(raw) as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (data.results || []).map((r) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.content || "",
  }));
}

async function searchSerper(query: string, num: number): Promise<SearchResult[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": SEARCH_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num }),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error(`  ❌ serper HTTP ${res.status}，原始响应体：`);
    console.error(raw.slice(0, 1000));
    throw new Error(`serper HTTP ${res.status}`);
  }
  const data = JSON.parse(raw) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (data.organic || []).map((r) => ({ title: r.title || "", url: r.link || "", snippet: r.snippet || "" }));
}

async function searchBrave(query: string, num: number): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${num}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "X-Subscription-Token": SEARCH_API_KEY },
    signal: AbortSignal.timeout(20000),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error(`  ❌ brave HTTP ${res.status}，原始响应体：`);
    console.error(raw.slice(0, 1000));
    throw new Error(`brave HTTP ${res.status}`);
  }
  const data = JSON.parse(raw) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return (data.web?.results || []).map((r) => ({ title: r.title || "", url: r.url || "", snippet: r.description || "" }));
}

async function runSearch(provider: Provider, query: string): Promise<SearchResult[]> {
  if (provider === "tavily") return searchTavily(query, TAVILY_MAX_RESULTS);
  if (provider === "brave") return searchBrave(query, 8);
  return searchSerper(query, 8);
}

// ═══════════════════════════════════════════════
// 抽取 1：Ark chat/completions（喂搜索结果，抽 listings[]）
// ═══════════════════════════════════════════════

const ARK_EXTRACT_SYSTEM = `你是农机二手挂牌信息抽取器。输入是一组搜索引擎结果（标题/链接/摘要）。
请从中抽取**真实的、带价格或明确议价的**二手农机挂牌，输出严格 JSON：
{"listings":[{"brand":"中文品牌名","modelName":"型号","year":年份数字或null,"engineHours":台时数或null,"priceCny":人民币数字或null,"priceEur":欧元数字或null,"country":"国家","location":"地区","sellerName":"卖家或空串","sourceUrl":"原站链接"}]}
规则：
- 只抽取与给定品牌/型号相关、且来自二手农机交易/挂牌页面的条目；
- 价格若为欧元填 priceEur，若为人民币填 priceCny，其它币种可换算或留 null；
- 缺失字段用 null（字符串字段用空串）；不要编造没有出现的信息；
- 没有可抽取条目时返回 {"listings":[]}；
- 只输出 JSON，不要任何解释文字。`;

async function arkExtract(query: string, results: SearchResult[], brandZh: string): Promise<IntlListing[]> {
  const digest = results
    .map((r, i) => `#${i + 1} ${r.title}\nURL: ${r.url}\n摘要: ${r.snippet}`)
    .join("\n\n");
  const res = await fetch(`${ARK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ARK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ARK_MODEL_ID,
      messages: [
        { role: "system", content: ARK_EXTRACT_SYSTEM },
        { role: "user", content: `查询: ${query}\n\n搜索结果:\n${digest}` },
      ],
      max_tokens: 2048,
      // ★ 关闭思考链：豆包是思考型模型，reasoning token 是批量超时主因（已实证）
      thinking: { type: "disabled" },
    }),
    signal: AbortSignal.timeout(90000),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error(`  ❌ Ark chat/completions HTTP ${res.status}，原始响应体：`);
    console.error(raw.slice(0, 1000));
    throw new Error(`Ark HTTP ${res.status}`);
  }
  let content = "";
  try {
    content = (JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message
      ?.content || "";
  } catch {
    return [];
  }
  const parsed = extractJsonObject(content) as { listings?: unknown } | null;
  if (!parsed) return [];
  return normalizeListings(parsed.listings, brandZh, results.map((r) => r.url));
}

// ═══════════════════════════════════════════════
// 抽取 2：规则兜底（无 Ark 时）
// ═══════════════════════════════════════════════

function heuristicExtract(results: SearchResult[], brandZh: string, model: string): IntlListing[] {
  const sourceDate = todayCompact();
  const out: IntlListing[] = [];
  const modelKey = model.toLowerCase().replace(/\s+/g, "");
  const num = (s?: string) => (s ? parseFloat(s.replace(/[^\d.]/g, "")) || null : null);
  for (const r of results) {
    const blob = `${r.title} ${r.snippet}`;
    const blobKey = blob.toLowerCase().replace(/\s+/g, "");
    if (modelKey && !blobKey.includes(modelKey)) continue;

    const yearMatch = blob.match(/\b(?:19|20)\d{2}\b/);
    const hoursMatch = blob.match(/(\d[\d,\.]*)\s*(?:h\b|hours?|hrs?|台时)/i);
    const priceEurMatch = blob.match(/(?:€|EUR)\s*([\d][\d.,]*)/i) || blob.match(/([\d][\d.,]*)\s*(?:€|EUR)/i);
    const priceCnyMatch = blob.match(/(?:¥|￥|CNY|RMB)\s*([\d][\d.,]*)/i);
    const priceGbpMatch = blob.match(/(?:£|GBP)\s*([\d][\d.,]*)/i);

    let priceEur: number | null = priceEurMatch ? num(priceEurMatch[1]) : null;
    let priceCny: number | null = priceCnyMatch ? num(priceCnyMatch[1]) : null;
    const gbp = priceGbpMatch ? num(priceGbpMatch[1]) : null;
    if (priceCny === null && priceEur === null && gbp !== null) priceCny = Math.round(gbp * GBP_CNY_RATE);

    out.push({
      brand: brandZh,
      modelName: model,
      year: yearMatch ? parseInt(yearMatch[0], 10) : null,
      engineHours: hoursMatch ? parseInt(hoursMatch[1].replace(/[^\d]/g, ""), 10) || null : null,
      priceCny,
      priceEur,
      country: "",
      location: "",
      sellerName: "",
      source: "search_api",
      sourceDate,
      sourceUrl: r.url,
    });
  }
  return out;
}

// ═══════════════════════════════════════════════
// 后端 A：搜索 API（tavily / serper / brave）+ 抽取
// ═══════════════════════════════════════════════

async function providerBackend(provider: Provider): Promise<IntlListing[]> {
  const useArk = !!ARK_API_KEY;
  console.log(`🔧 抽取器: ${useArk ? `Ark chat/completions(${ARK_MODEL_ID})` : "规则抽取（无 ARK_API_KEY）"}`);
  const listings: IntlListing[] = [];
  let done = 0;
  for (const bm of BRAND_MODELS) {
    for (const model of bm.models) {
      if (done >= MAX_QUERIES) break;
      done += 1;
      const query = `used ${bm.en} ${model} tractor for sale price`;
      console.log(`\n▶ [${done}/${MAX_QUERIES}] ${query}`);
      try {
        const results = await runSearch(provider, query);
        console.log(`  搜索结果: ${results.length} 条`);
        const extracted = useArk
          ? await arkExtract(query, results, bm.zh)
          : heuristicExtract(results, bm.zh, model);
        console.log(`  抽取挂牌: ${extracted.length} 条`);
        listings.push(...extracted);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ⚠️ 查询失败（跳过）: ${msg}`);
      }
    }
    if (done >= MAX_QUERIES) break;
  }
  return listings;
}

// ═══════════════════════════════════════════════
// 后端 B：Ark 联网插件（Web Search，Responses API）
// ═══════════════════════════════════════════════

/** 从 Responses API 的响应对象里取正文（兼容 output_text / output[].content[].text） */
function textFromResponseObject(resp: unknown): string {
  const r = resp as { output_text?: unknown; output?: unknown } | null;
  if (!r) return "";
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  let text = "";
  if (Array.isArray(r.output)) {
    for (const item of r.output as Array<{ content?: unknown }>) {
      if (Array.isArray(item?.content)) {
        for (const c of item.content as Array<{ text?: unknown }>) {
          if (typeof c?.text === "string") text += c.text;
        }
      }
    }
  }
  return text;
}

/** 解析 Ark 返回（兼容 SSE 流式与非流式 JSON），返回 { text, urls } */
function parseArkOutput(raw: string, contentType: string): { text: string; urls: string[] } {
  const urls = new Set<string>();
  for (const m of raw.matchAll(/"url"\s*:\s*"(https?:\/\/[^"]+)"/g)) urls.add(m[1]);

  if (contentType.includes("application/json") && !raw.trimStart().startsWith("data:")) {
    try {
      const obj = JSON.parse(raw);
      return { text: textFromResponseObject(obj.response ?? obj), urls: [...urls] };
    } catch {
      /* 落到 SSE 分支 */
    }
  }

  let acc = "";
  let completed = "";
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      continue;
    }
    const type = String(obj.type || "");
    if (type.includes("output_text.delta") && typeof obj.delta === "string") {
      acc += obj.delta;
    } else if (type === "response.output_text.done" && typeof obj.text === "string") {
      completed = obj.text;
    } else if (type === "response.completed" && obj.response) {
      const t = textFromResponseObject(obj.response);
      if (t) completed = t;
    }
    for (const m of JSON.stringify(obj).matchAll(/"url"\s*:\s*"(https?:\/\/[^"]+)"/g)) urls.add(m[1]);
  }
  return { text: completed || acc, urls: [...urls] };
}

const ARK_WEBSEARCH_INSTRUCTIONS = `你是农机二手挂牌信息抽取器。请使用联网搜索查找指定二手农机的真实挂牌，并只输出严格 JSON：
{"listings":[{"brand":"中文品牌名","modelName":"型号","year":年份数字或null,"engineHours":台时数或null,"priceCny":人民币数字或null,"priceEur":欧元数字或null,"country":"国家","location":"地区","sellerName":"卖家或空串","sourceUrl":"原站链接"}]}
规则：
- 只抽取来自二手农机交易/挂牌页面、且带价格或明确议价的真实条目；
- 价格若为欧元填 priceEur，若为人民币填 priceCny，其它币种可换算或留 null；
- 缺失字段用 null（字符串字段用空串）；不要编造没有出现的信息；
- 没有可抽取条目时返回 {"listings":[]}；
- 只输出 JSON，不要任何解释文字。`;

async function arkSearchAndExtract(query: string, brandZh: string): Promise<IntlListing[]> {
  const url = `${ARK_BASE_URL}/responses`;
  const prompt = `${ARK_WEBSEARCH_INSTRUCTIONS}\n\n查询：${query}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${ARK_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ARK_MODEL_ID,
      stream: true,
      tools: [{ type: "web_search", sources: ["doubao"] }],
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
    }),
    signal: AbortSignal.timeout(120000),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error(`  ❌ Ark /responses HTTP ${res.status}，原始响应体：`);
    console.error(raw.slice(0, 1200));
    throw new Error(`Ark /responses HTTP ${res.status}`);
  }
  const { text, urls } = parseArkOutput(raw, res.headers.get("content-type") || "");
  const parsed = extractJsonObject(text) as { listings?: unknown } | null;
  if (!parsed) {
    console.error(`  ⚠️ Ark 输出未能解析为 JSON（前 300 字）：${text.slice(0, 300)}`);
    return [];
  }
  return normalizeListings(parsed.listings, brandZh, urls);
}

async function arkWebSearchBackend(): Promise<IntlListing[]> {
  const listings: IntlListing[] = [];
  let done = 0;
  for (const bm of BRAND_MODELS) {
    for (const model of bm.models) {
      if (done >= MAX_QUERIES) break;
      done += 1;
      const query = `used ${bm.en} ${model} tractor for sale price`;
      console.log(`\n▶ [${done}/${MAX_QUERIES}] ${query}`);
      try {
        const extracted = await arkSearchAndExtract(query, bm.zh);
        console.log(`  抽取挂牌: ${extracted.length} 条`);
        listings.push(...extracted);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ⚠️ 查询失败（跳过）: ${msg}`);
      }
    }
    if (done >= MAX_QUERIES) break;
  }
  return listings;
}

// ── 主流程 ──

function dedupe(listings: IntlListing[]): IntlListing[] {
  const seen = new Set<string>();
  const unique: IntlListing[] = [];
  for (const l of listings) {
    const key = `${l.brand}|${l.modelName}|${l.year || ""}|${l.location}|${l.priceCny || l.priceEur || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(l);
  }
  return unique;
}

async function main(): Promise<number> {
  // 后端选择
  let backend: Backend;
  let provider: Provider | null = null;
  let badKeyReason = "";
  if (SEARCH_API_KEY) {
    const r = resolveProvider();
    provider = r.provider;
    if (!provider) {
      backend = "badkey";
      badKeyReason = r.reason || "无法识别 SEARCH_API_KEY";
    } else {
      backend = "provider";
    }
  } else if (ARK_API_KEY) {
    backend = "ark-websearch";
  } else {
    backend = "none";
  }

  console.log("=".repeat(60));
  console.log("🔎 #1 卖方采集 — 搜索 API 路线（C 路线）");
  console.log(`🔧 后端: ${backend}｜最多查询: ${MAX_QUERIES}`);
  console.log(`🔧 SEARCH_API_KEY: ${SEARCH_API_KEY ? maskKey(SEARCH_API_KEY) : "未配置"}｜provider: ${provider || "-"}`);
  console.log(`🔧 ARK_API_KEY: ${ARK_API_KEY ? `已配置(${ARK_MODEL_ID})` : "未配置"}`);
  console.log("=".repeat(60));

  if (backend === "none") {
    console.log("⏭️  未配置 ARK_API_KEY / SEARCH_API_KEY，跳过搜索 API 路线");
    writeEmptyOutput("未配置 ARK_API_KEY / SEARCH_API_KEY");
    return 0;
  }

  if (backend === "badkey") {
    console.error(`❌ ${badKeyReason}（key=${maskKey(SEARCH_API_KEY)}）`);
    console.error("   → 跳过搜索 API 路线（不瞎猜 provider）");
    writeEmptyOutput(badKeyReason);
    return 0;
  }

  const allListings = backend === "provider" ? await providerBackend(provider!) : await arkWebSearchBackend();

  const unique = dedupe(allListings);
  const withPrice = unique.filter((l) => l.priceCny || l.priceEur).length;
  const onRequest = unique.length - withPrice;

  const output: IntlOutput = {
    scrapedAt: new Date().toISOString(),
    source: "search_api",
    totalListings: unique.length,
    withPrice,
    priceOnRequest: onRequest,
    platformStats: { search_api: unique.length },
    listings: unique,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");

  console.log("\n" + "=".repeat(60));
  console.log("✅ 采集完成（搜索 API）");
  console.log(`📊 总条数: ${output.totalListings}`);
  console.log(`💰 有价: ${withPrice} ｜ 待询: ${onRequest}`);
  if (output.totalListings === 0) {
    console.log("ℹ️  0 条：搜索 API/联网插件无命中或未抽取到有效挂牌（属正常，不伪造数据）。");
  }
  console.log(`📁 输出文件: ${OUTPUT_FILE}`);
  console.log("=".repeat(60));
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    // 兜底：任何未预期异常都写空契约并以 0 退出，避免把 CI 判红（本路线是补充源）
    console.error("❌ 搜索 API 路线异常:", e instanceof Error ? e.message : e);
    try {
      writeEmptyOutput("运行异常");
    } catch {
      /* 忽略写入失败 */
    }
    process.exit(0);
  });
