/**
 * 统一豆包（火山方舟 ARK）客户端 —— 全站所有 AI 调用的唯一出口。
 *
 * 设计目标（PRD V1.3 §3.10 / R-24）：
 *   - 5 个 AI 路由 + valuation 的 image/video analyzer 全部统一走国行火山方舟豆包（CNY 结算）。
 *   - .cn 直连国行 ARK（数据不出境红线不动）；.com 经 HK/SG 代理节点（B 通道）代调国行。
 *     切换仅通过环境变量 ARK_PROXY_URL：有值且为 .com 站 → 代理；否则直连。
 *   - API Key（ARK_API_KEY）只存在于服务端 env，绝不进前端 / 入 git；.com 不持有 ARK key，
 *     仅持 ARK_PROXY_URL + 代理鉴权 token（纵深防御，见部署文档）。
 *   - 超时 / 重试 / 熔断：75s 超时；429/5xx 重试 1 次指数退避；连续失败达阈值开启熔断，快速失败。
 *     熔断**只对 429/5xx 与网络错计数**；4xx 属调用方/配置问题（参数越界、权限未开通、
 *     路由不存在），端点已正常应答，不构成端点不可用的证据 —— 且计数全站共享，
 *     计进去会让一个子功能的 4xx 连坐深度分析/估值/销售策略全部熔断（2026-10-28 P0）。
 *
 * 合规灰区（§3.6 / E-1）：.com 海外输入经代理进入国行节点处理属合规灰区，
 * 由部署/法务侧决策留痕；本客户端仅保证数据最小化（只转发 AI 必需内容）与错误不泄漏明文。
 */
import axios from "axios";
import { isComSite } from "@/config/site";

const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_BASE_URL = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const ARK_PROXY_URL = process.env.ARK_PROXY_URL || ""; // .com B 通道：HK/SG 轻量代理转发
const ARK_MODEL_ID = process.env.ARK_MODEL_ID || "doubao-seed-2-1-pro-260915";
/** 视觉（图片）模型：覆盖于 ARK_MODEL_ID；部署侧按方舟视觉能力模型填（如 doubao-vision 系列） */
const ARK_VISION_MODEL_ID = process.env.ARK_VISION_MODEL_ID || ARK_MODEL_ID;
/** 视频模型：覆盖于 ARK_MODEL_ID；部署侧按方舟视频理解能力模型填（待选，见 E-2） */
const ARK_VIDEO_MODEL_ID = process.env.ARK_VIDEO_MODEL_ID || ARK_MODEL_ID;

/** 豆包文本/通用模型标识（调用方统一使用） */
export function getArkModelId(): string {
  return ARK_MODEL_ID;
}
/** 视觉（图片分析）模型标识 */
export function getArkVisionModelId(): string {
  return ARK_VISION_MODEL_ID;
}
/** 视频分析模型标识（E-2：ARK 视频能力模型待选） */
export function getArkVideoModelId(): string {
  return ARK_VIDEO_MODEL_ID;
}

/** 当前链路路径（用于计费 breakdown.linkPath 与可观测） */
export function getArkLinkPath(): "b-channel" | "direct" {
  return isComSite() && ARK_PROXY_URL ? "b-channel" : "direct";
}

/** 熔断状态（模块级，进程内共享） */
let circuitFailures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;

export interface DoubaoUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

export interface DoubaoResult {
  text: string;
  usage?: DoubaoUsage;
  /** 模型停止原因：stop=自然结束；length=触及 max_tokens 被截断（调用方据此决定是否续写） */
  finishReason?: string;
}

export interface ChatCompletionOptions {
  messages: Array<{ role: string; content: unknown }>;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  /** 是否携带 thinking 关闭开关（豆包 seed 思考型模型实测关闭后延迟从 63s→2s） */
  disableThinking?: boolean;
  /**
   * 绝对截止时间戳（`Date.now()` 口径，毫秒）。**可选，不传则行为与旧版完全一致。**
   *
   * 为什么需要：本函数内部对 429/5xx 有「退避 1s 再试一次」的重试，若每次都吃满
   * `timeoutMs`，总耗时就是 2×timeout —— 调用方（如销售策略路由）按 `maxDuration`
   * 算出的预算会被这一次盲重试直接击穿，表现为平台杀进程返 HTML 504。
   * 传入 `deadlineMs` 后，每次重试前都会检查剩余预算，不足就**不再重试**而是抛出最后一次错误，
   * 让调用方能拿到一个正常的 JSON 错误响应。
   */
  deadlineMs?: number;
}

/**
 * 重试前要求的最小剩余预算。
 *
 * 取 15s 的理由：豆包在 `disableThinking` 关闭思考链后首 token 延迟约 2s，
 * 一次有意义的尝试至少要留出「排队 + 首 token + 若干 token 输出」的时间；
 * 低于 15s 再重试几乎必然超时，只会把「快速失败」拖成「慢速失败」。
 */
const RETRY_MIN_REMAINING_MS = 15_000;

/**
 * 调用豆包 chat/completions（OpenAI 兼容）。
 * 自动选择直连 / B 通道，处理超时、重试、熔断；成功时返回文本、usage 与 finishReason 供计费归集与截断判定。
 */
export async function chatCompletionDoubao(opts: ChatCompletionOptions): Promise<DoubaoResult> {
  const model = opts.model || ARK_MODEL_ID;
  const base = isComSite() && ARK_PROXY_URL ? ARK_PROXY_URL : ARK_BASE_URL;
  const url = `${base.replace(/\/$/, "")}/chat/completions`;
  // 闸③对称实现：`.cn` 只许打境内 ARK（.com 不限）。放在发请求之前，不能靠"发出去再判"。
  assertChatEndpointDomestic(base);

  // 熔断开启 → 快速失败（避免雪崩）
  if (Date.now() < circuitOpenUntil) {
    throw new Error("[ARK] 熔断开启，快速失败（circuit open）");
  }

  const maxTokens = opts.maxTokens ?? 2048;
  const disableThinking = opts.disableThinking !== false; // 默认关闭思考链
  const timeoutMs = opts.timeoutMs ?? 75_000;

  let lastErr: unknown;
  const attempts = 2;
  for (let attempt = 0; attempt < attempts; attempt++) {
    // 预算闸：第 2 次及以后的尝试前先看还剩多少时间（`deadlineMs` 未传时行为不变）
    if (attempt > 0 && typeof opts.deadlineMs === "number") {
      const remaining = opts.deadlineMs - Date.now();
      if (remaining < RETRY_MIN_REMAINING_MS) {
        // 预算不足：不再重试，抛上一次的错误（调用方据此返回正常 JSON 错误而非被平台杀掉）
        throw lastErr instanceof Error
          ? lastErr
          : new Error(`[ARK] 剩余预算不足(${remaining}ms)，放弃重试`);
      }
    }

    /**
     * 本次尝试实际使用的 axios 超时：**必须按剩余预算再裁剪一次**。
     *
     * 为什么光有上面的"剩余 < 15s 不重试"还不够（2026-11 补洞）：
     *   `timeoutMs` 是调用方**在发起前一次性算好的**，两次尝试共用同一个值。
     *   于是最坏情况 = 第一次跑 t1（t1 ≤ remaining - 15s）后收到可重试的 429/5xx，
     *   第二次再吃满 `timeoutMs` ⇒ 总耗时 ≈ 2×remaining，仍可能击穿调用方预算
     *   （深度分析 260s ⇒ 最坏 ~505s ≫ nginx 330s ⇒ 又是 HTML 504）。
     *   按剩余裁剪后，任一次尝试都不可能跑过 `deadlineMs`，总耗时恒 ≤ 预算。
     *
     * 不传 `deadlineMs` 时 `attemptTimeoutMs === timeoutMs`，与旧版完全一致。
     */
    const attemptTimeoutMs =
      typeof opts.deadlineMs === "number" && Number.isFinite(opts.deadlineMs)
        ? Math.max(
            Math.min(1_000, timeoutMs),
            Math.min(timeoutMs, opts.deadlineMs - Date.now())
          )
        : timeoutMs;

    try {
      const resp = await axios.post(
        url,
        {
          model,
          messages: opts.messages,
          max_tokens: maxTokens,
          ...(disableThinking ? { thinking: { type: "disabled" } } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${ARK_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: attemptTimeoutMs,
        }
      );
      circuitFailures = 0;
      const data = resp.data as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        error?: { message?: string };
      };
      const text = data?.choices?.[0]?.message?.content || "";
      const finishReason = data?.choices?.[0]?.finish_reason;
      if (data?.error) {
        throw new Error(`豆包API错误: ${data.error.message || JSON.stringify(data.error)}`);
      }
      return {
        text,
        finishReason,
        usage: data?.usage
          ? { prompt_tokens: data.usage.prompt_tokens, completion_tokens: data.usage.completion_tokens }
          : undefined,
      };
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { response?: { status?: number } })?.response?.status;
      // 鉴权/参数类错误不重试，直接抛出
      if (status === 401 || status === 403 || status === 402) throw err;
      // 4xx 不计入熔断（2026-10-28 同批修复，与 `postWithResilience` 口径统一）。
      //   熔断计数是全站共享的（deep-analysis / valuation / sales-strategy 共用一个
      //   `circuitFailures`），而 4xx 只说明「端点活着并正常应答了，只是请求说错了话」：
      //   一次非法 model / 越界 maxTokens 连续 5 次 400 就会把三个功能一起熔断 30s，
      //   与本次事故是同一类「子功能连坐主链路」。只有 429（限流）、5xx（服务端故障）
      //   与网络错/超时（无 status，端点根本没应答）才构成「端点不可用」的证据。
      const circuitFailure = typeof status !== "number" || status === 429 || status >= 500;
      if (circuitFailure) {
        circuitFailures += 1;
        if (circuitFailures >= CIRCUIT_THRESHOLD) {
          circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
        }
      }
      // 429 / 5xx 重试一次（指数退避）；其余 / 末次直接抛出
      const retryable = status === 429 || (typeof status === "number" && status >= 500);
      if (retryable && attempt < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ═══════════════════════════════════════════════════════════
// 联网检索（Responses API `/responses` + web_search 插件）— T07 新增
// ─────────────────────────────────────────────────────────
// 为什么写在本文件而不是新文件（arch §1.2.1）：
//   ① base 选路（`.cn` 直连 / `.com` B 通道）只在 `:78` 一处；
//   ② 熔断状态 `circuitFailures` / `circuitOpenUntil` 是模块私有变量；
//   ③ 重试/退避语义只在 `:91-144` 一处。
//   另起文件必然复制一份 ⇒ 两套熔断阈值、两次调试。故本段与 `chatCompletionDoubao` **共享同一熔断计数**。
//
// ⚠️ 既有 `chatCompletionDoubao`（`:76-147`）与所有既有导出：**一行未改**。
//    `postWithResilience` 是**语义照抄**的新私有函数，只被 `arkWebSearch` 调用。
// ═══════════════════════════════════════════════════════════

/** 境内 ARK 主机（`.cn` 端点断言用；境内服务不许走境外代理） */
const ARK_DOMESTIC_HOST = "ark.cn-beijing.volces.com";

/**
 * 取 base 的 hostname；解析失败返回 `null`（调用方一律按「非境内」处理，即 fail closed）。
 *
 * 为什么 fail closed：这道闸守的是「数据不出境」硬红线，配置写错时**必须**当成违规拒绝，
 * 而不是"解析不了就先放行"。放行一次就可能是用户照片与卖家正文的一次静默出境。
 */
function parseArkBaseHost(base: string): string | null {
  try {
    return new URL(base).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * 聊天通道（`/chat/completions`）的境内端点闸 —— 闸③在检索通道上的对称实现。
 *
 * 为什么必须有：`arkWebSearch` 早有 `site === "cn" && !endpoint.domestic ⇒ throw` 的硬闸，
 * 但**真正承载用户照片、卖家自由文本、RawListing 摘要的主出口**（本函数被 5 个 AI 路由调用）
 * 过去完全没有这层校验：`.cn` 恒用 `ARK_BASE_URL`，却从不验证它的 host 是不是境内。
 * 一次误配（照抄 `.com` 配置、或填了海外代理）就会让 `.cn` 的全部 AI 正文静默出境，
 * 无日志、无报错、健康检查照样绿灯 —— 违反「数据不出境」硬红线（风控审计 R8-1）。
 *
 * `.com` 不做任何限制：B 通道（`ARK_PROXY_URL`）与直连都是合法路径。
 */
function assertChatEndpointDomestic(base: string): void {
  if (isComSite()) return;
  const host = parseArkBaseHost(base);
  if (host === null) {
    // 报错里不带完整 base：base 可能含 user:pass@ 形式的凭据，日志会进平台可搜索区
    throw new Error(
      `[ARK] 境内站聊天端点必须是 ${ARK_DOMESTIC_HOST}，已拒绝请求（base 无法解析：${String(
        base
      )
        .replace(/\/\/[^/@]*@/, "//***@")
        .slice(0, 60)}）`
    );
  }
  if (host !== ARK_DOMESTIC_HOST) {
    throw new Error(
      `[ARK] 境内站聊天端点必须是 ${ARK_DOMESTIC_HOST}，已拒绝请求（host=${host}）`
    );
  }
}

// ── 模块加载期自检（**只告警，不抛错**）──
// 为什么不在这里抛：本模块在构建期（`next build` 收集路由）与单测里也会被加载，
// 抛错会把构建/测试一起炸掉，逼着人临时注释掉这道闸 —— 反而更不安全。
// 运行期的强拦截交给 `assertChatEndpointDomestic()`（每次真实调用前执行，fail closed），
// 这里只负责让误配在启动日志里**第一时间可见**。
if (!isComSite() && parseArkBaseHost(ARK_BASE_URL) !== ARK_DOMESTIC_HOST) {
  console.warn(
    `[ARK] 境内站 ARK_BASE_URL 不是境内端点（host=${
      parseArkBaseHost(ARK_BASE_URL) ?? "无法解析"
    }），聊天请求将在运行期被拒绝，请检查 .env.cn 的 ARK_BASE_URL`
  );
}

/** `/responses` 端点解析入参（全部可覆盖，便于测试与多站注入） */
export interface ArkEndpointOptions {
  site?: "cn" | "com";
  baseUrl?: string;
  proxyUrl?: string;
  /** `.com` 是否经代理调 `/responses`（默认 false：ARK 本身在境内，代理反而多一跳） */
  viaProxy?: boolean;
}

/** `/responses` 端点解析结果 */
export interface ArkEndpoint {
  /** 完整 `/responses` URL */
  url: string;
  /** 站点（决定合规闸） */
  site: "cn" | "com";
  /** URL 主机名 */
  host: string;
  /** 是否境内域名（`ark.cn-beijing.volces.com`） */
  domestic: boolean;
  /** 是否走了代理（仅 `.com` 且显式开启） */
  viaProxy: boolean;
  /** 配置了 `ARK_PROXY_URL` 但被拒绝采用（`.cn` 恒定） */
  proxyRejected: boolean;
}

/** 从 URL 构造端点结果（URL 非法时回落到境内默认值，绝不抛错） */
function endpointFromUrl(
  url: string,
  site: "cn" | "com",
  viaProxy: boolean,
  proxyRejected: boolean
): ArkEndpoint {
  let host = "";
  let safeUrl = url;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    safeUrl = `${ARK_BASE_URL.replace(/\/$/, "")}/responses`;
    try {
      host = new URL(safeUrl).hostname.toLowerCase();
    } catch {
      host = ARK_DOMESTIC_HOST;
    }
  }
  return {
    url: safeUrl,
    site,
    host,
    domestic: host === ARK_DOMESTIC_HOST,
    viaProxy,
    proxyRejected,
  };
}

/**
 * 解析 `/responses` 端点（合规闸③的判定入口）。
 *
 * 规则（arch §1.2.2 规则 3/4）：
 *   - `.cn`：**恒定直连** `ARK_BASE_URL`，`ARK_PROXY_URL` 一律不采用（`proxyRejected:true`）；
 *   - `.com`：默认同样直连境内 ARK（代理多一跳）；仅 `ARK_RESPONSES_VIA_PROXY=1` 且配了代理时走代理。
 */
export function resolveArkResponsesEndpoint(opts: ArkEndpointOptions = {}): ArkEndpoint {
  const options = opts || {};
  const site: "cn" | "com" = options.site ?? (isComSite() ? "com" : "cn");
  const base = (options.baseUrl ?? ARK_BASE_URL).replace(/\/$/, "");
  const proxy = (options.proxyUrl ?? ARK_PROXY_URL).replace(/\/$/, "");

  if (site === "cn") {
    // 境内站：绝不使用代理（配了也是被拒绝）
    return endpointFromUrl(`${base}/responses`, site, false, Boolean(proxy));
  }

  const viaProxy =
    typeof options.viaProxy === "boolean" ? options.viaProxy : process.env.ARK_RESPONSES_VIA_PROXY === "1";
  if (viaProxy && proxy) {
    return endpointFromUrl(`${proxy}/responses`, site, true, false);
  }
  return endpointFromUrl(`${base}/responses`, site, false, false);
}

/**
 * 带熔断 + 单次尝试的 POST（语义照抄 `:91-144`，**不含重试**）。
 *
 * 为什么不在这里重试：检索层的重试必须服从「总预算 20s」（PRD §6.2）。
 * 若这里再重试一次，等于 2×2 次尝试，预算不可控 ⇒ 重试统一由 `web-evidence.ts` 调度。
 * 熔断计数与 `chatCompletionDoubao` 共享（同一个模块级 `circuitFailures`），**但只对 429/5xx
 * 与网络错计数**：4xx 属调用方/配置问题，计进去会让「某个子功能没开通」连坐同账号的主链路生成。
 */
async function postWithResilience(
  url: string,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ raw: string; contentType: string }> {
  // 熔断开启 → 快速失败（避免雪崩，与 `:82-84` 同口径）
  if (Date.now() < circuitOpenUntil) {
    throw new Error("[ARK] 熔断开启，快速失败（circuit open）");
  }
  try {
    const resp = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${ARK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: timeoutMs,
      ...(signal ? { signal } : {}),
      // 非 2xx 也要拿到原始响应体，便于排障（脚本 :498-502 的做法）
      validateStatus: () => true,
      responseType: "text",
    });
    const status = resp.status;
    const raw = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data ?? "");
    const contentType = String(resp.headers?.["content-type"] ?? "");
    if (status < 200 || status >= 300) {
      // 4xx 一律不计入熔断（2026-10-28 线上 P0 根因修复）。
      //   事故链条：方舟账号未开通 web_search 插件 → 检索 5 个 query 全 403 →
      //   旧代码在此**无条件** += 1，恰好把与对话调用共享的计数器喂到阈值 5 →
      //   紧随其后的 chatCompletionDoubao 被熔断短路 → 销售策略 100% LLM_FAILED。
      //   判定依据：4xx 是「请求/权限/功能未开通」类错误，不代表 ARK 端点本身不健康；
      //   且必须与 chatCompletionDoubao(:161-162) 的既有口径对齐 —— 那里 401/403/402
      //   是 `throw err` 且发生在计数之前，本来就不计数。此处补齐对称性。
      //   只有 429（限流）与 5xx（服务端故障）才代表端点真的不可用，才计熔断。
      if (status === 429 || status >= 500) {
        circuitFailures += 1;
        if (circuitFailures >= CIRCUIT_THRESHOLD) {
          circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
        }
      }
      throw Object.assign(new Error(`[ARK] /responses HTTP ${status}: ${raw.slice(0, 200)}`), {
        status,
        response: { status },
      });
    }
    circuitFailures = 0;
    return { raw, contentType };
  } catch (err: unknown) {
    const status = (err as { status?: number; response?: { status?: number } } | null)?.status
      ?? (err as { response?: { status?: number } } | null)?.response?.status;
    if (typeof status !== "number") {
      // 网络错 / 超时 / abort：计入熔断
      circuitFailures += 1;
      if (circuitFailures >= CIRCUIT_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
      }
    }
    throw err;
  }
}

/** `/responses` 调用参数 */
export interface ArkWebSearchOptions {
  /** 检索问题（**已出境清洗**：不得含手机号 / 邮箱 / productId / 图片 URL） */
  prompt: string;
  model?: string;
  timeoutMs?: number;
  /** 覆盖端点（由 `resolveArkResponsesEndpoint` 解析后传入，保证站点闸与请求 URL 一致） */
  url?: string;
  /** 站点（决定合规闸；缺省按 `isComSite()`） */
  site?: "cn" | "com";
  /** 中断信号（检索层按总预算裁剪） */
  signal?: AbortSignal;
}

/** `/responses` 调用结果 */
export interface ArkWebSearchResult {
  /** 正文（JSON 输出或自然语言） */
  text: string;
  /** 正文里出现过的所有 `https?://` URL（去重） */
  urls: string[];
  /** 原始响应体（供 `web-evidence.parseArkOutput` 完整解析，兼容 SSE） */
  raw: string;
  /** 响应 Content-Type */
  contentType: string;
  /** 实际使用的端点（含 `domestic` / `proxyRejected` 证据） */
  endpoint: ArkEndpoint;
}

/**
 * 从 Responses 响应里取正文（最小实现）。
 *
 * ⚠️ 完整解析（含 SSE 分支）在 `src/lib/search/web-evidence.ts` 的 `parseArkOutput()`，
 *    调用方应以 `raw` 为准再解析一次；这里的 `text/urls` 只是契约字段的兜底值。
 */
function extractResponsesText(raw: string): { text: string; urls: string[] } {
  const urls = new Set<string>();
  for (const m of (raw || "").matchAll(/"url"\s*:\s*"(https?:\/\/[^"]+)"/g)) urls.add(m[1]);
  let text = "";
  try {
    const obj = JSON.parse(raw) as {
      response?: { output_text?: unknown; output?: unknown };
      output_text?: unknown;
      output?: unknown;
    };
    const r = (obj?.response ?? obj) as { output_text?: unknown; output?: unknown } | null;
    if (typeof r?.output_text === "string") text = r.output_text;
    if (!text && Array.isArray(r?.output)) {
      for (const item of r!.output as Array<{ content?: unknown }>) {
        if (!Array.isArray(item?.content)) continue;
        for (const c of item.content as Array<{ text?: unknown }>) {
          if (typeof c?.text === "string") text += c.text;
        }
      }
    }
  } catch {
    /* 非 JSON（SSE 分片）：正文交给 web-evidence.parseArkOutput */
  }
  return { text, urls: [...urls] };
}

/**
 * 调用 ARK `/responses` 完成「联网搜索 + 抽取」。
 *
 * 请求体（arch §1.2.3 形状）：
 * ```
 * { "model": "<ARK_MODEL_ID>", "stream": false,
 *   "tools": [{ "type": "web_search", "sources": ["search_engine"] }],
 *   "input": [{ "role": "user", "content": [{ "type": "input_text", "text": "<prompt>" }] }] }
 * ```
 * ⚠️ `sources` 必须是 `["search_engine"]`，**不是** `["doubao"]`（详见下面 `body` 处的注释）。
 * `stream:false`：脚本硬编码 `true`，实测非流式不被拒且省掉 SSE 解析分支。
 *
 * 合规闸③：`site === "cn"` 时端点 host 必须是 `ark.cn-beijing.volces.com`，否则**拒绝发请求**。
 */
export async function arkWebSearch(opts: ArkWebSearchOptions): Promise<ArkWebSearchResult> {
  const prompt = String(opts?.prompt ?? "").trim();
  if (!prompt) throw new Error("[ARK] arkWebSearch 需要非空 prompt");

  const site: "cn" | "com" = opts.site ?? (isComSite() ? "com" : "cn");
  const endpoint = opts.url
    ? endpointFromUrl(opts.url, site, false, false)
    : resolveArkResponsesEndpoint({ site });

  // 闸③：境内站必须打境内主机（`ARK_PROXY_URL` 在 `.cn` 一律不采用）
  if (site === "cn" && !endpoint.domestic) {
    throw new Error(
      `[ARK] 境内站检索端点必须是 ${ARK_DOMESTIC_HOST}，已拒绝请求（host=${endpoint.host}）`
    );
  }

  // ⚠️⚠️ `sources: ["search_engine"]` —— **不要**改回 `["doubao"]`（5 条真实 query 打靶钉死）。
  //
  // 为什么必须写这段注释：`doubao` 看起来像「豆包自己搜」，非常自然，但它**不是**合法的
  // source 枚举值，且它的报错极具误导性 —— 用同一个 key、同一个模型
  // （doubao-seed-2-1-pro-260915）打同一台机器实测：
  //
  //   [{"type":"web_search","sources":["doubao"]}]        ⇒ HTTP 403
  //     {"error":{"code":"AccessDenied","message":"Access denied for web search.
  //      Please go to the Volcano Ark Console to verify the activation status."}}
  //   [{"type":"web_search","sources":["search_engine"]}] ⇒ HTTP 200 ✅（现在用的）
  //   [{"type":"web_search","sources":[]}]                ⇒ HTTP 200 ✅
  //   [{"type":"web_search"}]（省略 sources 字段）         ⇒ HTTP 200 ✅
  //   [{"type":"web_search","sources":["search_engine","doubao"]}] ⇒ HTTP 400
  //   [{"type":"web_search","sources":["volc_search"]}]   ⇒ HTTP 400（非法值）
  //
  // 关键陷阱：403 的文案是 "verify the activation status"，会把人一路带去找火山方舟控制台
  // 确认插件有没有开通、找财务确认订单有没有生效 —— 实际插件早就开通好了，纯粹是
  // source 枚举名写错。**合法值只有 `search_engine`**（也可用空数组或直接省略 `sources`，
  // 此时等价于默认源）。`volc_search` 是 400 非法值，别试。
  const body = {
    model: opts.model || ARK_MODEL_ID,
    stream: false,
    tools: [{ type: "web_search", sources: ["search_engine"] }],
    input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
  };

  const { raw, contentType } = await postWithResilience(
    endpoint.url,
    body,
    opts.timeoutMs ?? 20_000,
    opts.signal
  );
  const { text, urls } = extractResponsesText(raw);
  return { text, urls, raw, contentType, endpoint };
}

/**
 * 熔断状态快照（纯只读，供调用方在错误日志里判别「是熔断短路还是真调用失败」）。
 *
 * 为什么需要：线上 `LLM_FAILED` 只有一个错误码，旧日志只打 `err.message`，
 * 排障时分不清是熔断、401 鉴权、参数越界还是超时 —— 2026-10-28 那次事故就是靠人肉
 * 探针才定位的。暴露计数本身不含任何凭据，无泄漏风险。
 */
export function getArkCircuitState(): {
  failures: number;
  openUntil: number;
  open: boolean;
} {
  return {
    failures: circuitFailures,
    openUntil: circuitOpenUntil,
    open: Date.now() < circuitOpenUntil,
  };
}
