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
}

export interface ChatCompletionOptions {
  messages: Array<{ role: string; content: unknown }>;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  /** 是否携带 thinking 关闭开关（豆包 seed 思考型模型实测关闭后延迟从 63s→2s） */
  disableThinking?: boolean;
}

/**
 * 调用豆包 chat/completions（OpenAI 兼容）。
 * 自动选择直连 / B 通道，处理超时、重试、熔断；成功时返回文本与 usage 供计费归集。
 */
export async function chatCompletionDoubao(opts: ChatCompletionOptions): Promise<DoubaoResult> {
  const model = opts.model || ARK_MODEL_ID;
  const base = isComSite() && ARK_PROXY_URL ? ARK_PROXY_URL : ARK_BASE_URL;
  const url = `${base.replace(/\/$/, "")}/chat/completions`;

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
          timeout: timeoutMs,
        }
      );
      circuitFailures = 0;
      const data = resp.data as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        error?: { message?: string };
      };
      const text = data?.choices?.[0]?.message?.content || "";
      if (data?.error) {
        throw new Error(`豆包API错误: ${data.error.message || JSON.stringify(data.error)}`);
      }
      return {
        text,
        usage: data?.usage
          ? { prompt_tokens: data.usage.prompt_tokens, completion_tokens: data.usage.completion_tokens }
          : undefined,
      };
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { response?: { status?: number } })?.response?.status;
      // 鉴权/参数类错误不重试，直接抛出
      if (status === 401 || status === 403 || status === 402) throw err;
      circuitFailures += 1;
      if (circuitFailures >= CIRCUIT_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
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
