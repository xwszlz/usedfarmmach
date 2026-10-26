/**
 * Web 检索证据层（T07 · 包 A｜数据供给扩容）
 * ─────────────────────────────────────────────────────────
 * 职责边界（ARCHITECTURE-INCR-2026-10-26 §1.2.1）：
 *   `ark-client.ts`        ← 传输层：URL 选路 / 熔断 / 重试（唯一 AI 出口）
 *   `web-evidence.ts`（本文件） ← 编排层：provider 白名单 / query 构造 / 预算 / 并发 /
 *                                  缓存 / 证据归一化 / 失败分档
 *   `retrieval.ts`         ← 装配层：把本模块产出塞进 `StrategyContext.webEvidence`
 *
 * 设计红线：
 *   1. **永不抛错**：任何异常（含 fetch throw / 403 / 500 / abort）都转成结果对象，
 *      用 `status` 表达。理由：检索是增强不是依赖，异常冒到 route 会 500，直接阻断策略生成。
 *   2. **站点白名单是合规闸门，不是配置建议**：
 *        `.cn` 只允许 `ark`（境内节点）；配了 Tavily/Serper/Brave ⇒ `disabled` + `reason:"site-blocked"`，
 *        **一个请求都不发**。`.cn` 的 `ARK_PROXY_URL` 一律不采用（境内服务不许走境外代理）。
 *   3. **出境闸**：只发送「品牌 / 机型 / 品类 / 年段 / 目标国别 / 检索问题文本」。
 *      `WebQueryInput` 结构层就没有 `productId / 报价 / 联系方式 / 图片 URL` 字段，
 *      运行时再由 `sanitizeQuery()` 二次清洗（手机号 / 邮箱 / URL / cuid / 价格）。
 *   4. **四档状态必有 `dataSources` 记录**（PRD §2 ⑫ / §6.3）：`ok | partial | timeout | disabled`
 *      全部产出一条 `{ name:"Web检索", ref }`，`ref:"—"` 也必须存在 ——
 *      省略了用户无法区分「没查到」和「没查」。
 *
 * 说明：内部异常归一到 `status:"timeout"`（PRD §6.3 只有四档，`error` 作为超集值不落库），
 *       真实原因写在 `reason`（`"timeout" | "error"`）与 `errorDetail`，供排障与断言。
 */
import {
  EMPTY_CELL,
  WEB_STATUS_NOTE,
} from "@/lib/sales-strategy/strategy-schema";
import type { WebEvidenceStatus } from "@/lib/sales-strategy/strategy-schema";
import { isCnSite } from "@/config/site";
import { arkWebSearch, resolveArkResponsesEndpoint } from "@/lib/ai/ark-client";

// 类型再从唯一真相源透出，避免出现两份同名字符串联合（arch §3.5）
export type { WebEvidenceStatus } from "@/lib/sales-strategy/strategy-schema";

// ═══════════════════════════════════════════════════════════
// 0. 常量（预算 / 并发 / 缓存）
// ═══════════════════════════════════════════════════════════

/** 单 query 超时（PRD §6.2：8s） */
const DEFAULT_TIMEOUT_MS = 8_000;
/** 检索总预算（PRD §6.2：20s） */
const DEFAULT_BUDGET_MS = 20_000;
/** 并发度上限（PRD §6.2：≤5） */
const DEFAULT_MAX_CONCURRENCY = 5;
/** 重试次数上限（PRD §6.2：≤1，且不延长总预算） */
const DEFAULT_RETRY = 1;
/**
 * 缓存 TTL 默认 6h（任务书指定；arch §1.2.4 原文为 10min）。
 * 两者都可被 `WEB_SEARCH_CACHE_TTL_MS` 覆盖，`0` = 关闭缓存。
 */
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** 剩余预算低于该值时放弃重试（重试超出预算无意义，PRD §6.2） */
const RETRY_MIN_BUDGET_MS = 3_000;
/** 缓存条目上限（手写 LRU，不引 lru-cache） */
const CACHE_MAX_ENTRIES = 50;
/** 固定 5 条 query 上限（PRD §6.2 的 5 类检索） */
const MAX_QUERIES = 5;
/** 默认境内 ARK 网关（与 ark-client.ts 的 ARK_BASE_URL 缺省值一致） */
const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

// ═══════════════════════════════════════════════════════════
// 1. 对外类型（arch §3.5 逐字 + 必要的排障扩展字段）
// ═══════════════════════════════════════════════════════════

/** 支持的检索源 */
export type WebSearchProvider = "ark" | "tavily" | "serper" | "brave";

/**
 * 检索入参（**结构层出境闸**）。
 *
 * ⚠️ 这里**没有** `productId / userId / sellerId / phone / email / priceCny / imageUrls`
 * 字段 —— 传不进来，就发不出去（arch §1.2.6 闸①）。
 */
export interface WebQueryInput {
  brand: string;
  model: string;
  category: string;
  /** "2016-2022"（可空） */
  yearRange?: string;
  /** 只允许国别 / 区域名 */
  markets: string[];
}

/** 运行时环境覆盖（默认从 process.env 读取；测试与多站注入用，不读模块级常量） */
export interface SearchRuntimeEnv {
  site?: "cn" | "com";
  arkApiKey?: string;
  arkBaseUrl?: string;
  arkProxyUrl?: string;
  arkResponsesViaProxy?: boolean;
  searchApiKey?: string;
  searchApiProvider?: string;
  /** 显式指定检索源（优先级最高；`WEB_SEARCH_PROVIDER`） */
  webSearchProvider?: string;
}

/** 已解析的运行时环境 */
export interface ResolvedSearchEnv {
  site: "cn" | "com";
  arkApiKey: string;
  arkBaseUrl: string;
  arkProxyUrl: string;
  arkResponsesViaProxy: boolean;
  searchApiKey: string;
  searchApiProvider: string;
  webSearchProvider: string;
}

/** provider 解析结果（`reason` 会被写进 `dataSources.note`，便于排障） */
export interface ResolvedProvider {
  provider: WebSearchProvider | null;
  reason: "ok" | "not-configured" | "site-blocked" | "unsupported";
  /** 配置了但被站点白名单拦掉的源（`.cn` 配 Tavily 时为 `"tavily"`） */
  blocked?: WebSearchProvider;
  env: ResolvedSearchEnv;
}

/** 单条证据 */
export interface WebEvidenceItem {
  /** 产出该条证据的检索问题（已 sanitize） */
  query: string;
  title: string;
  url: string;
  snippet: string;
  /** 证据类型（ARK 结构化输出自带；第三方搜索源无此字段） */
  kind?: string;
}

/** `dataSources` 契约的一条记录（PRD §2 ⑫） */
export interface WebDataSourceRecord {
  name: "Web检索";
  ref: string;
  note?: string;
}

/**
 * 检索结果（arch §3.1 `WebEvidence` 逐字 + 排障扩展）。
 *
 * `status` 恒为 PRD §6.3 的四档之一；细节原因在 `reason`。
 */
export interface WebEvidence {
  status: WebEvidenceStatus;
  provider: WebSearchProvider | null;
  items: WebEvidenceItem[];
  urls: string[];
  successQueries: number;
  totalQueries: number;
  /** 直接进 `dataSources.note`（PRD §6.3 四档文案） */
  note: string;
  elapsedMs: number;
  cached: boolean;
  /** 本次检索对应的 `dataSources` 记录（**四档各 1 条，恒存在**） */
  dataSources: WebDataSourceRecord[];
  /** 细分原因（`site-blocked` / `not-configured` / `proxy-rejected` 等），供排障与 QA 断言 */
  reason: string;
  /** 非 PII 的错误摘要（最多 200 字） */
  errorDetail?: string;
  /** `.cn` 误配 `ARK_PROXY_URL` 时置 true（代理被拒绝、实际走境内直连） */
  proxyRejected?: boolean;
}

/** 调用参数（arch §3.5 逐字 + runtime 覆盖口） */
export interface WebEvidenceOptions {
  /** 单 query 超时，默认 8000 */
  timeoutMs?: number;
  /** 总预算，默认 20000 */
  budgetMs?: number;
  /** 并发度，默认 5 */
  maxConcurrency?: number;
  /** 重试次数，默认 1 */
  retry?: number;
  /** 缓存 TTL，默认 6h；0 = 关 */
  cacheTtlMs?: number;
  /** 运行时环境覆盖（测试 / 多站注入） */
  runtime?: SearchRuntimeEnv;
}

// ═══════════════════════════════════════════════════════════
// 2. 站点白名单与 provider 解析
// ═══════════════════════════════════════════════════════════

/** 站点 → 允许的 provider（顺序即优先级）。**这是合规闸门，不是配置建议** */
const SITE_ALLOWED: Record<"cn" | "com", WebSearchProvider[]> = {
  cn: ["ark"], // 境内节点强制，无备选
  com: ["ark", "tavily", "serper", "brave"], // 可切换
};

const ALL_PROVIDERS: WebSearchProvider[] = ["ark", "tavily", "serper", "brave"];

/** 把任意字符串（`SeRper` / 空格）规整为 provider 名；不认识返回 null */
function parseProviderName(raw: string): WebSearchProvider | null {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return null;
  return (ALL_PROVIDERS as string[]).includes(v) ? (v as WebSearchProvider) : null;
}

/**
 * 解析运行时环境（**每次调用现读**，不缓存模块级常量 —— 便于测试与多站复用）。
 */
export function resolveRuntimeEnv(override: SearchRuntimeEnv = {}): ResolvedSearchEnv {
  const env = override || {};
  return {
    site: env.site ?? (isCnSite() ? "cn" : "com"),
    arkApiKey: String(env.arkApiKey ?? process.env.ARK_API_KEY ?? "").trim(),
    arkBaseUrl: String(env.arkBaseUrl ?? process.env.ARK_BASE_URL ?? DEFAULT_ARK_BASE_URL).trim(),
    arkProxyUrl: String(env.arkProxyUrl ?? process.env.ARK_PROXY_URL ?? "").trim(),
    arkResponsesViaProxy:
      typeof env.arkResponsesViaProxy === "boolean"
        ? env.arkResponsesViaProxy
        : process.env.ARK_RESPONSES_VIA_PROXY === "1",
    searchApiKey: String(env.searchApiKey ?? process.env.SEARCH_API_KEY ?? "").trim(),
    searchApiProvider: String(env.searchApiProvider ?? process.env.SEARCH_API_PROVIDER ?? "")
      .trim()
      .toLowerCase(),
    webSearchProvider: String(env.webSearchProvider ?? process.env.WEB_SEARCH_PROVIDER ?? "")
      .trim()
      .toLowerCase(),
  };
}

/** 某 provider 是否具备可用凭据 */
function hasCredential(provider: WebSearchProvider, env: ResolvedSearchEnv): boolean {
  if (provider === "ark") return env.arkApiKey.length > 0;
  if (!env.searchApiKey) return false;
  // Tavily 可用 `tvly-` 前缀自动识别；Serper/Brave 无前缀约定，必须显式声明
  if (env.searchApiKey.startsWith("tvly-")) return true;
  return env.searchApiProvider === provider || env.webSearchProvider === provider;
}

/**
 * 解析当前站点允许且可用的检索源。
 *
 * 规则（QA 可断言，arch §1.2.2）：
 *   1. `WEB_SEARCH_PROVIDER`（显式）＞ `SEARCH_API_PROVIDER` ＞ 按 `SITE_ALLOWED[site]` 顺序取第一个有凭据的；
 *   2. `.cn` 解析结果 ≠ `ark` ⇒ `provider:null` + `reason:"site-blocked"` + `blocked`（绝不 fallback 第三方）；
 *   3. 识别不出 provider 名 ⇒ `reason:"unsupported"`（不瞎猜）；
 *   4. 都没凭据 ⇒ `reason:"not-configured"`。
 */
export function resolveProvider(override: SearchRuntimeEnv = {}): ResolvedProvider {
  const env = resolveRuntimeEnv(override);
  const allowed = SITE_ALLOWED[env.site];
  const explicitRaw = env.webSearchProvider || env.searchApiProvider;
  const explicit = parseProviderName(explicitRaw);

  if (explicitRaw && !explicit) {
    return { provider: null, reason: "unsupported", env };
  }

  let chosen: WebSearchProvider | null = explicit;
  if (!chosen) {
    for (const p of allowed) {
      if (hasCredential(p, env)) {
        chosen = p;
        break;
      }
    }
  }

  if (!chosen) {
    // 诊断：有凭据但整类源被站点白名单排除（`.cn` 配了 SEARCH_API_KEY）
    const outside = ALL_PROVIDERS.filter((p) => !allowed.includes(p) && hasCredential(p, env));
    if (outside.length > 0) {
      return { provider: null, reason: "site-blocked", blocked: outside[0], env };
    }
    return { provider: null, reason: "not-configured", env };
  }

  if (!allowed.includes(chosen)) {
    return { provider: null, reason: "site-blocked", blocked: chosen, env };
  }

  return { provider: chosen, reason: "ok", env };
}

// ═══════════════════════════════════════════════════════════
// 3. 出境闸（运行时）+ query 构造
// ═══════════════════════════════════════════════════════════

/** 手机号（中国大陆 11 位） */
const RE_PHONE = /1[3-9]\d{9}/g;
/** 邮箱 */
const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** URL（含图片 URL） */
const RE_URL = /https?:\/\/\S+/gi;
/** cuid（Prisma 主键形态，25 位以 c 开头） */
const RE_CUID = /\bc[a-z0-9]{20,30}\b/gi;
/** 价格（¥ 后跟数字） */
const RE_PRICE = /[¥￥]\s*[\d,.]+/g;
/** 长数字串（台时/序列号等可疑标识） */
const RE_LONG_DIGITS = /\b\d{13,}\b/g;

/**
 * 运行时出境闸：把 query 里**不该出境**的片段抹掉。
 *
 * 抹而不报错：检索是增强，宁可少一条 query 也不阻断策略生成。
 */
export function sanitizeQuery(q: string): string {
  if (typeof q !== "string" || !q) return "";
  return q
    .replace(RE_URL, " ")
    .replace(RE_EMAIL, " ")
    .replace(RE_PHONE, " ")
    .replace(RE_CUID, " ")
    .replace(RE_PRICE, " ")
    .replace(RE_LONG_DIGITS, " ")
    .replace(/[ \t\u3000]+/g, " ")
    .trim()
    .slice(0, 400);
}

/** 把 markets 归一到最多 3 个非空国别/区域名 */
function normalizeMarkets(markets: string[] | undefined): string[] {
  const list = Array.isArray(markets) ? markets : [];
  const out: string[] = [];
  for (const raw of list) {
    const v = String(raw ?? "").trim();
    if (!v || out.includes(v)) continue;
    out.push(v);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * 构造固定 5 条检索问题（PRD §6.2 的 5 类）：
 *   ① 品牌+机型+二手价 ② 机型+新机对标 ③ 市场+准入政策
 *   ④ 市场+关税率费 ⑤ 机型+原厂规格
 */
export function buildEvidenceQueries(input: WebQueryInput): string[] {
  const brand = String(input?.brand ?? "").trim();
  const model = String(input?.model ?? "").trim();
  const category = String(input?.category ?? "").trim();
  const markets = normalizeMarkets(input?.markets);
  const primary = markets[0] ?? "全球";
  const secondary = markets[1] ?? primary;
  const third = markets[2] ?? secondary;
  const subject = [brand, model].filter(Boolean).join(" ").trim() || category || "二手农机";
  const years = String(input?.yearRange ?? "").trim();
  const yearText = years ? ` ${years}` : "";

  const queries = [
    `${subject}${yearText} 二手 价格 used price for sale`,
    `${subject} 新机 报价 new price list price`,
    `${primary} 农机 ${category} 进口 准入 政策 法规`,
    `${secondary} ${third} 农机 进口 关税 增值税 清关`,
    `${subject} 原厂 规格 参数 specifications`,
  ];
  return queries.map((q) => q.replace(/\s+/g, " ").trim()).slice(0, MAX_QUERIES);
}

// ═══════════════════════════════════════════════════════════
// 4. 进程内缓存（手写 Map + TTL + LRU 上限；不引 lru-cache）
// ═══════════════════════════════════════════════════════════

type CachePayload = Omit<WebEvidence, "cached" | "elapsedMs">;

interface CacheEntry {
  expiresAt: number;
  value: CachePayload;
}

const cache = new Map<string, CacheEntry>();

/** 测试用：清空进程内缓存 */
export function __clearCache(): void {
  cache.clear();
}

/** 稳定短哈希（djb2；无需引入 crypto，避免额外依赖） */
function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * 缓存 key = `站点|provider|品牌|机型|市场|queries 哈希`。
 *
 * 品牌/机型/市场是给排障看的可读前缀，queries 哈希保证「改 query 构造即失效」。
 */
function computeCacheKey(
  site: "cn" | "com",
  provider: WebSearchProvider,
  input: WebQueryInput,
  queries: string[]
): string {
  return [
    site,
    provider,
    String(input.brand ?? "").trim(),
    String(input.model ?? "").trim(),
    normalizeMarkets(input.markets).join(","),
    shortHash(queries.join("\u0001")),
  ].join("|");
}

function cacheGet(key: string): CachePayload | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  // 命中即刷新到队尾（LRU）
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key: string, value: CachePayload, ttlMs: number): void {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

// ═══════════════════════════════════════════════════════════
// 5. 从线上脚本搬来的 4 个纯函数（arch §1.2.3）
//    `scripts/scout-via-search-api.ts:149 / :417 / :435 / :537`
//    ⚠️ scripts/ 目录带 fs/argv，不能从 src/ import ⇒ 逐字复制为纯函数
// ═══════════════════════════════════════════════════════════

/** 从模型输出中稳健抽取 JSON（容忍 markdown 代码块与前后杂文本） */
export function extractJsonObject(text: string): unknown {
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

/** 从 Responses API 的响应对象里取正文（兼容 output_text / output[].content[].text） */
export function textFromResponseObject(resp: unknown): string {
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
export function parseArkOutput(raw: string, contentType: string): { text: string; urls: string[] } {
  const urls = new Set<string>();
  const body = typeof raw === "string" ? raw : "";
  for (const m of body.matchAll(/"url"\s*:\s*"(https?:\/\/[^"]+)"/g)) urls.add(m[1]);

  const ct = (contentType || "").toLowerCase();
  if (ct.includes("application/json") && !body.trimStart().startsWith("data:")) {
    try {
      const obj = JSON.parse(body) as { response?: unknown };
      return { text: textFromResponseObject(obj.response ?? obj), urls: [...urls] };
    } catch {
      /* 落到 SSE 分支 */
    }
  }

  let acc = "";
  let completed = "";
  for (const line of body.split(/\r?\n/)) {
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

/** 去重（按 url 唯一；无 url 时退化为 title+snippet 指纹） */
export function dedupeItems(items: WebEvidenceItem[]): WebEvidenceItem[] {
  const seen = new Set<string>();
  const unique: WebEvidenceItem[] = [];
  for (const it of items) {
    const key = it.url ? `u:${it.url}` : `t:${it.title}|${it.snippet.slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(it);
  }
  return unique;
}

// ═══════════════════════════════════════════════════════════
// 6. 三家第三方搜索源（凭据参数化，不读模块级常量）
// ═══════════════════════════════════════════════════════════

/** 带 HTTP 状态的错误（用于区分 429/5xx 是否可重试） */
class SearchHttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SearchHttpError";
    this.status = status;
  }
}

/** Tavily REST（官方形状，见脚本 :210-238） */
async function searchTavily(
  query: string,
  apiKey: string,
  signal: AbortSignal
): Promise<WebEvidenceItem[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query.slice(0, 399), // 官方建议 < 400 字符
      max_results: 10,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
    }),
    signal,
  });
  const raw = await res.text();
  if (!res.ok) throw new SearchHttpError(`tavily HTTP ${res.status}: ${raw.slice(0, 200)}`, res.status);
  const data = JSON.parse(raw) as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (data.results || []).map((r) => ({
    query,
    title: r.title || "",
    url: r.url || "",
    snippet: r.content || "",
  }));
}

/** Serper REST（google.serper.dev，见脚本 :240-255） */
async function searchSerper(
  query: string,
  apiKey: string,
  signal: AbortSignal
): Promise<WebEvidenceItem[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 8 }),
    signal,
  });
  const raw = await res.text();
  if (!res.ok) throw new SearchHttpError(`serper HTTP ${res.status}: ${raw.slice(0, 200)}`, res.status);
  const data = JSON.parse(raw) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (data.organic || []).map((r) => ({
    query,
    title: r.title || "",
    url: r.link || "",
    snippet: r.snippet || "",
  }));
}

/** Brave Search REST（见脚本 :257-274） */
async function searchBrave(
  query: string,
  apiKey: string,
  signal: AbortSignal
): Promise<WebEvidenceItem[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    signal,
  });
  const raw = await res.text();
  if (!res.ok) throw new SearchHttpError(`brave HTTP ${res.status}: ${raw.slice(0, 200)}`, res.status);
  const data = JSON.parse(raw) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return (data.web?.results || []).map((r) => ({
    query,
    title: r.title || "",
    url: r.url || "",
    snippet: r.description || "",
  }));
}

/** ARK 联网检索的抽取指令（只输出严格 JSON，便于归一） */
const ARK_EVIDENCE_INSTRUCTIONS = `你是农机二手交易与出口合规的市场调研助手。请**联网检索**并回答下面的检索问题。
只输出严格 JSON：
{"findings":[{"title":"来源页标题","url":"https://真实来源页","snippet":"关键事实摘要(<=200字)","kind":"新机价|二手挂牌|政策法规|关税|原厂规格|其他"}]}
规则：
- url 必须是检索结果里真实出现过的来源页，禁止编造；
- 只保留与「品牌/机型/国别/准入政策」直接相关的事实；
- 没有可靠结果时返回 {"findings":[]}；
- 只输出 JSON，不要任何解释文字、不要 markdown 围栏。`;

/** 归一 ARK 结构化输出；解析失败时用 url 池兜底 */
function normalizeFindingItems(
  parsed: unknown,
  query: string,
  urlPool: string[],
  fallbackText: string
): WebEvidenceItem[] {
  const findings = (parsed as { findings?: unknown } | null)?.findings;
  if (Array.isArray(findings)) {
    const items: WebEvidenceItem[] = [];
    for (const raw of findings as Array<Record<string, unknown>>) {
      if (!raw || typeof raw !== "object") continue;
      const url = String(raw.url ?? "").trim();
      if (!/^https?:\/\//i.test(url)) continue;
      items.push({
        query,
        title: String(raw.title ?? "").trim().slice(0, 160),
        url,
        snippet: String(raw.snippet ?? "").trim().slice(0, 400),
        kind: String(raw.kind ?? "").trim() || undefined,
      });
      if (items.length >= 5) break;
    }
    if (items.length > 0) return items;
  }
  // 兜底：ARK 只回正文+URL 时，按 URL 各生成一条（摘要取正文头 200 字）
  const snippet = (fallbackText || "").replace(/\s+/g, " ").trim().slice(0, 200);
  return urlPool.slice(0, 5).map((url) => ({
    query,
    title: query.slice(0, 80),
    url,
    snippet,
    kind: "其他",
  }));
}

/** ARK `/responses` 联网检索（境内节点；`.cn` 强制走这里） */
async function searchViaArk(
  query: string,
  env: ResolvedSearchEnv,
  timeoutMs: number,
  signal: AbortSignal
): Promise<WebEvidenceItem[]> {
  const endpoint = resolveArkResponsesEndpoint({
    site: env.site,
    baseUrl: env.arkBaseUrl,
    proxyUrl: env.arkProxyUrl,
    viaProxy: env.arkResponsesViaProxy,
  });
  // 闸③：境内站端点必须是境内域名（`ARK_PROXY_URL` 在 `.cn` 一律不被采用）
  if (env.site === "cn" && !endpoint.domestic) {
    throw new SearchHttpError(`境内站检索端点非境内域名，已拒绝：${endpoint.host}`, 0);
  }
  const prompt = `${ARK_EVIDENCE_INSTRUCTIONS}\n\n检索问题：${query}`;
  const res = await arkWebSearch({
    prompt,
    url: endpoint.url,
    site: env.site,
    timeoutMs,
    signal,
  });
  const parsed = parseArkOutput(res.raw, res.contentType || "");
  const text = parsed.text || res.text || "";
  const urlPool = parsed.urls.length > 0 ? parsed.urls : res.urls;
  const json = extractJsonObject(text);
  return normalizeFindingItems(json, query, urlPool, text);
}

// ═══════════════════════════════════════════════════════════
// 7. 单 query 执行（超时 / 重试 / 错误归类）
// ═══════════════════════════════════════════════════════════

interface QueryOutcome {
  query: string;
  /** `ok` 才计入成功；`timeout` / `error` 都算失败（PRD §6.3 里都归「没查到」） */
  status: "ok" | "timeout" | "error";
  items: WebEvidenceItem[];
  error?: string;
}

interface RunContext {
  provider: WebSearchProvider;
  env: ResolvedSearchEnv;
  timeoutMs: number;
  deadline: number;
  maxAttempts: number;
}

/** abort / axios 超时 / fetch TimeoutError 统一识别 */
function isTimeoutLike(err: unknown): boolean {
  const e = err as { name?: string; code?: string; message?: string } | null;
  if (!e) return false;
  if (e.name === "AbortError" || e.name === "TimeoutError") return true;
  if (e.code === "ECONNABORTED" || e.code === "ETIMEDOUT" || e.code === "ERR_CANCELED") return true;
  const msg = String(e.message ?? "").toLowerCase();
  return msg.includes("timeout") || msg.includes("aborted") || msg.includes("canceled");
}

/** 429 / 5xx / 网络层错误可重试；4xx（除 429）不重试（参数或鉴权错，重试无意义） */
function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number; response?: { status?: number } } | null)?.status
    ?? (err as { response?: { status?: number } } | null)?.response?.status;
  if (typeof status === "number") {
    if (status === 0) return false; // 本地网关守卫（如境内站端点被拒）
    return status === 429 || status >= 500;
  }
  return true; // 无状态码 ⇒ 网络错误，可重试
}

/** 错误摘要（截断，永不含凭据） */
function errorSummary(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***").slice(0, 200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/** 调一个 provider 取一批证据 */
async function callProvider(
  query: string,
  provider: WebSearchProvider,
  env: ResolvedSearchEnv,
  timeoutMs: number,
  signal: AbortSignal
): Promise<WebEvidenceItem[]> {
  if (provider === "tavily") return searchTavily(query, env.searchApiKey, signal);
  if (provider === "serper") return searchSerper(query, env.searchApiKey, signal);
  if (provider === "brave") return searchBrave(query, env.searchApiKey, signal);
  return searchViaArk(query, env, timeoutMs, signal);
}

/**
 * 执行单条 query：
 *   - 单次上限 `min(timeoutMs, deadline-now)`（预算不足时缩短，**不延长总预算**）；
 *   - 仅 429/5xx/网络错/超时重试，且剩余预算 < 3s 直接放弃；
 *   - 任何异常都转成 `QueryOutcome`，**绝不抛出**。
 */
async function runSingleQuery(query: string, ctx: RunContext): Promise<QueryOutcome> {
  let lastError = "";
  let lastWasTimeout = false;

  for (let attempt = 0; attempt < ctx.maxAttempts; attempt++) {
    const remaining = ctx.deadline - Date.now();
    if (remaining <= 0) {
      return { query, status: "timeout", items: [], error: "总预算耗尽，未发起" };
    }
    const perQueryMs = Math.max(1_000, Math.min(ctx.timeoutMs, remaining));
    const signal = AbortSignal.timeout(perQueryMs);
    try {
      const items = await callProvider(query, ctx.provider, ctx.env, perQueryMs, signal);
      const usable = items.filter((it) => /^https?:\/\//i.test(it.url || ""));
      if (usable.length === 0) {
        // 有响应但无可引用 URL：按「没查到」处理（PRD §6.3 `ok` 要求含可引用 URL）
        lastWasTimeout = false;
        lastError = "无可引用 URL";
        break;
      }
      return { query, status: "ok", items: usable };
    } catch (err) {
      lastWasTimeout = isTimeoutLike(err);
      lastError = lastWasTimeout ? "超时" : errorSummary(err);
      const retryable = lastWasTimeout || isRetryableError(err);
      const left = ctx.deadline - Date.now();
      const isLastAttempt = attempt >= ctx.maxAttempts - 1;
      if (!retryable || isLastAttempt || left < RETRY_MIN_BUDGET_MS) break;
      await sleep(300 * (attempt + 1));
    }
  }

  return {
    query,
    status: lastWasTimeout ? "timeout" : "error",
    items: [],
    error: lastError,
  };
}

/** 按并发度分批执行（默认 5 条一次发起；`Promise.allSettled` 保证单条失败不影响其他） */
async function runQueries(queries: string[], ctx: RunContext, maxConcurrency: number): Promise<QueryOutcome[]> {
  const outcomes: QueryOutcome[] = [];
  const size = Math.max(1, Math.min(maxConcurrency, queries.length));
  for (let i = 0; i < queries.length; i += size) {
    const batch = queries.slice(i, i + size);
    const settled = await Promise.allSettled(batch.map((q) => runSingleQuery(q, ctx)));
    for (let j = 0; j < settled.length; j++) {
      const s = settled[j];
      if (s.status === "fulfilled") {
        outcomes.push(s.value);
      } else {
        // runSingleQuery 自身不抛；这里只是纵深兜底
        outcomes.push({
          query: batch[j],
          status: "error",
          items: [],
          error: errorSummary(s.reason),
        });
      }
    }
  }
  return outcomes;
}

// ═══════════════════════════════════════════════════════════
// 8. 结果组装（四档 status + dataSources 必产一条）
// ═══════════════════════════════════════════════════════════

/** `partial` 档的 note 必须带 N/M 成功数（PRD §6.3，可断言） */
function partialNote(success: number, total: number): string {
  return `部分检索超时（${success}/${total} 成功）`;
}

/** 把 status 映射成唯一一条 `dataSources` 记录（四档必有） */
export function buildWebDataSource(evidence: WebEvidence): WebDataSourceRecord {
  const status = evidence.status;
  if (status === "ok" && evidence.urls.length > 0) {
    const record: WebDataSourceRecord = {
      name: "Web检索",
      ref: evidence.urls.slice(0, 3).join("; "),
    };
    if (evidence.note) record.note = evidence.note;
    return record;
  }
  if (status === "partial" && evidence.urls.length > 0) {
    return {
      name: "Web检索",
      ref: evidence.urls[0],
      note: evidence.note || partialNote(evidence.successQueries, evidence.totalQueries),
    };
  }
  if (status === "disabled") {
    return {
      name: "Web检索",
      ref: EMPTY_CELL,
      note: evidence.note || WEB_STATUS_NOTE.disabled,
    };
  }
  // ok 但无 URL / partial 但无 URL / timeout 一律落到「未接入」
  return {
    name: "Web检索",
    ref: EMPTY_CELL,
    note: evidence.note || WEB_STATUS_NOTE.timeout,
  };
}

/** 内部装配：保证字段齐全 + dataSources 恒存在 */
function assemble(partial: Omit<WebEvidence, "dataSources">): WebEvidence {
  const evidence: WebEvidence = { ...partial, dataSources: [] };
  evidence.dataSources = [buildWebDataSource(evidence)];
  return evidence;
}

/** disabled 档（未配凭据 / 被站点白名单拦掉 / 端点被拒） */
function disabledEvidence(
  provider: WebSearchProvider | null,
  note: string,
  reason: string,
  extra: Partial<WebEvidence> = {}
): WebEvidence {
  return assemble({
    status: "disabled",
    provider,
    items: [],
    urls: [],
    successQueries: 0,
    totalQueries: 0,
    note,
    elapsedMs: 0,
    cached: false,
    reason,
    ...extra,
  });
}

/** timeout 档（全部失败 / 全部超时 / 异常兜底） */
function timeoutEvidence(
  provider: WebSearchProvider | null,
  totalQueries: number,
  reason: string,
  errorDetail: string,
  elapsedMs: number,
  extra: Partial<WebEvidence> = {}
): WebEvidence {
  return assemble({
    status: "timeout",
    provider,
    items: [],
    urls: [],
    successQueries: 0,
    totalQueries,
    note: WEB_STATUS_NOTE.timeout,
    elapsedMs,
    cached: false,
    reason,
    errorDetail: errorDetail.slice(0, 200),
    ...extra,
  });
}

// ═══════════════════════════════════════════════════════════
// 9. 唯一入口：retrieveWebEvidence（**永不抛错**）
// ═══════════════════════════════════════════════════════════

/**
 * 检索外部证据（Web 检索）。**永不抛错**：任何异常都转成结果对象。
 *
 * 流程：provider 白名单 → 缓存 → query 构造 + 出境清洗 → 预算内并发执行 → 四档分档 → `dataSources`。
 *
 * @param input 检索入参（结构层出境闸：无 PII / 无 productId / 无图片）
 * @param opts  预算与缓存参数（默认 8s / 20s / 5 并发 / 1 次重试 / 6h 缓存）
 * @returns `ok | partial | timeout | disabled` 四档之一，恒含 1 条 `dataSources`
 */
export async function retrieveWebEvidence(
  input: WebQueryInput,
  opts: WebEvidenceOptions = {}
): Promise<WebEvidence> {
  const startedAt = Date.now();
  const options = opts || {};
  // 环境变量也要给一个现值（缓存 key 需要 site）
  let env = resolveRuntimeEnv(options.runtime ?? {});

  try {
    const safeInput: WebQueryInput = {
      brand: String(input?.brand ?? "").trim(),
      model: String(input?.model ?? "").trim(),
      category: String(input?.category ?? "").trim(),
      yearRange: input?.yearRange ? String(input.yearRange).trim() : undefined,
      markets: normalizeMarkets(input?.markets),
    };

    const resolved = resolveProvider(options.runtime ?? {});
    env = resolved.env;

    // ── 闸①/②：白名单不通过 ⇒ 一个请求都不发 ──
    if (!resolved.provider) {
      const note =
        resolved.reason === "site-blocked"
          ? `${WEB_STATUS_NOTE.disabled}：${env.site === "cn" ? "境内站" : "本站"}不允许第三方检索源（site-blocked${resolved.blocked ? `:${resolved.blocked}` : ""}）`
          : resolved.reason === "unsupported"
            ? `${WEB_STATUS_NOTE.disabled}：WEB_SEARCH_PROVIDER 取值不受支持`
            : WEB_STATUS_NOTE.disabled;
      return disabledEvidence(null, note, resolved.reason);
    }
    const provider = resolved.provider;

    // ── 闸③ 预检：`.cn` 端点必须是境内域名（代理一律不采用） ──
    const endpoint = resolveArkResponsesEndpoint({
      site: env.site,
      baseUrl: env.arkBaseUrl,
      proxyUrl: env.arkProxyUrl,
      viaProxy: env.arkResponsesViaProxy,
    });
    const proxyRejected = env.site === "cn" && endpoint.proxyRejected;
    if (env.site === "cn" && !endpoint.domestic) {
      return disabledEvidence(
        null,
        `${WEB_STATUS_NOTE.disabled}：境内站检索端点必须是 ark.cn-beijing.volces.com`,
        "site-blocked",
        { proxyRejected }
      );
    }

    const queries = buildEvidenceQueries(safeInput)
      .map((q) => sanitizeQuery(q))
      .filter((q) => q.length > 0);
    const totalQueries = queries.length;
    if (totalQueries === 0) {
      return disabledEvidence(provider, WEB_STATUS_NOTE.disabled, "not-configured", { proxyRejected });
    }

    // ── 缓存（进程内，双站共享；`.cn` 缓存也在境内进程） ──
    const ttlRaw = options.cacheTtlMs ?? Number(process.env.WEB_SEARCH_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS);
    const cacheTtlMs = Number.isFinite(ttlRaw) ? ttlRaw : DEFAULT_CACHE_TTL_MS;
    const cacheKey = computeCacheKey(env.site, provider, safeInput, queries);
    const hit = cacheGet(cacheKey);
    if (hit) {
      return {
        ...hit,
        cached: true,
        elapsedMs: Date.now() - startedAt,
        // cached 命中时也要保证 dataSources 存在（老缓存条目兼容）
        dataSources: hit.dataSources?.length ? hit.dataSources : [buildWebDataSource({ ...hit, cached: true, elapsedMs: 0 } as WebEvidence)],
      };
    }

    // ── 预算内并发执行 ──
    const timeoutMs = Math.max(1_000, Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
    const budgetMs = Math.max(1_000, Number(options.budgetMs ?? DEFAULT_BUDGET_MS) || DEFAULT_BUDGET_MS);
    const maxConcurrency = Math.max(
      1,
      Math.min(Number(options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY) || DEFAULT_MAX_CONCURRENCY, DEFAULT_MAX_CONCURRENCY)
    );
    const retry = Math.max(0, Math.min(Number(options.retry ?? DEFAULT_RETRY) || 0, 1));

    const ctx: RunContext = {
      provider,
      env,
      timeoutMs,
      deadline: startedAt + budgetMs,
      maxAttempts: 1 + retry,
    };
    const outcomes = await runQueries(queries, ctx, maxConcurrency);

    const items = dedupeItems(outcomes.flatMap((o) => o.items));
    const urls: string[] = [];
    for (const it of items) {
      if (it.url && !urls.includes(it.url)) urls.push(it.url);
    }
    const successQueries = outcomes.filter((o) => o.status === "ok").length;
    const elapsedMs = Date.now() - startedAt;
    const errorDetail = outcomes
      .filter((o) => o.status !== "ok")
      .map((o) => `${o.query.slice(0, 40)}:${o.error ?? o.status}`)
      .join(" | ")
      .slice(0, 200);

    // ── 四档分档（PRD §6.3） ──
    if (successQueries === 0) {
      const allTimeout = outcomes.every((o) => o.status === "timeout");
      return timeoutEvidence(
        provider,
        totalQueries,
        allTimeout ? "timeout" : "error",
        errorDetail || (allTimeout ? "全部检索超时" : "全部检索失败"),
        elapsedMs,
        { proxyRejected }
      );
    }

    const status: WebEvidenceStatus = successQueries >= totalQueries ? "ok" : "partial";
    const note =
      status === "ok"
        ? proxyRejected
          ? "境内站已拒绝境外代理配置，走境内直连"
          : ""
        : partialNote(successQueries, totalQueries);

    const evidence = assemble({
      status,
      provider,
      items: items.slice(0, 20),
      urls,
      successQueries,
      totalQueries,
      note,
      elapsedMs,
      cached: false,
      reason: status,
      errorDetail: errorDetail || undefined,
      proxyRejected,
    });

    // 只缓存「有证据」的结果（失败不缓存，避免把一次抖动固化 6h）
    cacheSet(
      cacheKey,
      {
        status: evidence.status,
        provider: evidence.provider,
        items: evidence.items,
        urls: evidence.urls,
        successQueries: evidence.successQueries,
        totalQueries: evidence.totalQueries,
        note: evidence.note,
        dataSources: evidence.dataSources,
        reason: evidence.reason,
        errorDetail: evidence.errorDetail,
        proxyRejected: evidence.proxyRejected,
      },
      cacheTtlMs
    );

    return evidence;
  } catch (err) {
    // 红线：任何未预期异常都转成结果对象，绝不冒到 retrieval / route
    return timeoutEvidence(
      null,
      0,
      "error",
      errorSummary(err) || "检索层未预期异常",
      Date.now() - startedAt,
      { proxyRejected: false }
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 10. 给 prompt 用的文本块（非 ok 时返回带原因的空块，而不是 "")
// ═══════════════════════════════════════════════════════════

const NO_EVIDENCE_GUARD =
  "—— 无外部证据时：禁止输出具体新机价（只能写「未找到」）；" +
  "禁止只凭推测给出禁入国；价格若为反推必须标注 basisType=\"推算\"。";

/** 把证据渲染成 prompt 可直接拼装的文本块 */
export function renderEvidenceBlock(ev: WebEvidence): string {
  const head = "【外部检索证据（Web检索）】";
  if (!ev || ev.items.length === 0) {
    const note = ev?.note || WEB_STATUS_NOTE.disabled;
    return [head, `状态: ${ev?.status ?? "disabled"}（${note}）`, NO_EVIDENCE_GUARD].join("\n");
  }
  const lines = ev.items
    .slice(0, 12)
    .map((it, i) => {
      const kind = it.kind ? `[${it.kind}] ` : "";
      const snippet = (it.snippet || "").replace(/\s+/g, " ").slice(0, 200);
      return `#${i + 1} ${kind}${it.title || it.url}\n   URL: ${it.url}\n   摘要: ${snippet}`;
    });
  const statusLine = `状态: ${ev.status}（${ev.successQueries}/${ev.totalQueries} 成功${ev.note ? `；${ev.note}` : ""}）`;
  const guard = ev.status === "ok" ? "" : NO_EVIDENCE_GUARD;
  return [head, statusLine, ...lines, guard].filter(Boolean).join("\n");
}

/** 供调用方（route / derive）在检索层完全不可用时直接取一条降级证据 */
export function buildUnavailableEvidence(note?: string): WebEvidence {
  return disabledEvidence(null, note || WEB_STATUS_NOTE.disabled, "disabled");
}
