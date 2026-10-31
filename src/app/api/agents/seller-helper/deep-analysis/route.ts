/**
 * POST /api/agents/seller-helper/deep-analysis
 * AI深度分析 — 统一豆包版（火山方舟 ARK）
 *
 * V2.2（2026-09-26）：移除全部价格/估值内容，价格口径统一到 /api/valuation
 * V1.3 升级（2026-10）：全量统一到豆包多模态能力（.cn 直连 / .com 经 B 通道代理），不再使用 Gemini / OpenRouter。
 *   接受 isChineseBrand 参数，在 `.cn` 站自动切换分析 prompt。
 * V2.3（2026-11）AI 输出质量修复（老板 `.com` 实测反馈三连）：
 *   ① 语种：接入 `@/lib/i18n/ai-locale`，8 语种用户按 locale 拿到对应语言报告（初稿 + 续写指令都注入语言指令）；
 *   ② 去中国化：`.com` 是国际站，**一律走国际版 prompt**（此前按品牌国籍切，`.com` 卖中国农机时
 *      大量产品误走国内版 prompt，导致国际买家看到「国内就是中国」「补贴政策」这类中国市场视角内容）；
 *   ③ 空小节：prompt 不再要求 `## 结构化数据（JSON）` 小标题，同时服务端清洗加固，
 *      把模型残留的标题 / 引导语 / 多余空行全部剥掉（JSON 代码块本身仍保留给 `extractStructured()`）。
 * V2.5（2026-11）**截断韧性**：结构化 JSON 从「正文末尾」挪到「正文最前」。
 *   动机：截断（`finish_reason=length`）时被砍掉的永远是**尾部**，JSON 放在末尾 ⇒ `structured` 为空，
 *   前端技术参数表 / 六维度评分整块空白。挪到开头后，只要模型还在写字，JSON 就一定已经写完。
 *   改动面：**只改两个 prompt 的顺序与说明文字 + 续写指令第④条**，`extractStructured()` /
 *   `cleanAnalysisText()` 的正则本来就是位置无关的，逻辑一行未动。
 *   同时把图片张数上限提取到 `@/lib/ai/deep-analysis-limits`（前后端同一个数字）。
 *
 * Body: { imageUrls?: string[], imageDataUris?: string[], videoUrls?: string[], isChineseBrand?: boolean, locale?: string }
 * Response: { success: true, data: { analysis: "Markdown报告", structured: {...}, model: "...",
 *             mediaCount, pointsCharged, creditsBalance, truncated: boolean, budgetExhausted: boolean,
 *             continueRounds: number } }
 *
 * ── 截断契约（V2.4，硬要求，前端据此提示用户）─────────────────────────────
 * 本接口**不允许**静默返回半截报告。两个布尔字段必须一起看：
 *   - `truncated`      = 响应正文**确实不完整**。为 true 的三种来源：
 *                        ① `finishReason === "length"` 且续写轮次用尽；
 *                        ② `finishReason === "length"` 但剩余预算不足以再来一轮续写；
 *                        ③ 续写调用本身抛错（已生成的正文保留，但尾巴缺了）。
 *   - `budgetExhausted`= 中止原因是**总预算**（`DEEP_ANALYSIS_TOTAL_BUDGET_MS`）而不是轮次上限
 *                        或上游报错。前端可据此区分「内容太长」与「服务器时间不够」两类提示。
 * 正文一个 token 都没拿到时**不返回 200**，仍走下面的 `ALL_MODELS_FAILED` 503 出口。
 * ────────────────────────────────────────────────────────────────────────
 *
 * ── 计费安全（V2.4，2026-10-31）────────────────────────────────────────
 * 本路由单次真实成本 ¥0.28~0.43（8 图，含续写），且要跑 190~290 秒。旧实现只在**末尾**扣费，
 * 余额 0 的账号照样能跑完整流程 ⇒ 报告丢弃 + 成本白烧，且可无限重复。现在入口处两道闸：
 *   ① **余额预检**（`estimateDeepAnalysisPoints`）：按实测最坏单次成本估门槛，不足直接 402 早退；
 *   ② **限流**（按 userId，3 次/10 分钟）：见 `DEEP_ANALYSIS_RATE_*` 常量，注意当前是进程内计数。
 * 两道闸都在**任何图片下载与模型调用之前**，且都**只读不写**（不做预扣/退款）。
 */

import { NextRequest, NextResponse } from "next/server";

import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { computeAiCost, deductCredits, type AiCostBreakdown } from "@/lib/credits/spend";
import { getBillingCountry } from "@/lib/credits/fx";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { chatCompletionDoubao, getArkModelId } from "@/lib/ai/ark-client";
import { buildDoubaoContent } from "@/lib/ai/multimodal";
// 图片张数上限必须与前端「同一份定义」：前端截取、服务端夹取。
// 该模块零运行时依赖（不 import 任何 `node:*`），因此可被 `"use client"` 组件安全引用。
import { MAX_DEEP_ANALYSIS_IMAGES } from "@/lib/ai/deep-analysis-limits";
import { resolveAiLocale, withLanguage, type AiLocale } from "@/lib/i18n/ai-locale";
import { isCnSite } from "@/config/site";

export const dynamic = "force-dynamic";

/** LLM 调用结果：文本 + token 用量（用于积分计费） */
interface LlmCallResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  /** 豆包停止原因：length = 触及 max_tokens 被截断（长报告需续写） */
  finishReason?: string;
}

/**
 * 深度分析单次生成的 `max_tokens`。
 *
 * ⚠️ 定位：这是**防跑飞的安全上限，不是「提高输出量的按钮」**。
 *    平时不该咬到它；一旦咬到，说明这一单就是长尾。所以取值的原则是
 *    「宁可平时用不满，也不能在长尾那一刻把报告腰斩」。
 *
 * ── 为什么最终是 16384（2026-11 定稿，此前曾在 8000 上试过并回退）──────────
 * 曾经的推理是「单轮 280s 写不完 ⇒ 降低单轮输出量、靠续写轮补」。**这条路被实测否掉了**：
 *   ① 降 cap **不提速**。实测吞吐恒定在 **27~34 tokens/s**，跟 cap 设多大毫无关系；
 *   ② 降 cap 会**主动制造截断**。两次实测的自然输出都超过了 8000：
 *        · 3 张真实商品图 → 8,590 tokens（走路由 256.7s）
 *        · 8 张真实商品图 → 8,366 tokens（直调 264.1s）
 *      也就是说 8000 会在这两单的**结尾**砍一刀，而结尾恰恰是报告收束处；
 *   ③ 老板拍板「保持现有详细度、不缩短报告」⇒ 不允许用降 cap 的方式换稳定性。
 * 结论：cap 保持 16384，稳定性交给**总预算**（285s）与**续写轮**（≤2 轮）去兜。
 *
 * 实测依据（真实 ARK / doubao-seed-2-1-pro-260915 / 真实 OSS 商品图）：
 *   - 单图 64×64 探针：215s 写完，输出 **6,152** tokens
 *   - 3 张真实商品图：227.6s / 6,152 tokens；走路由 256.7s / 8,590 tokens
 *   - 8 张真实商品图：264.1s / 8,366 tokens；走路由 220.4s / 7,465 tokens
 *   - 实测吞吐 **27~34 tokens/s**（注意：不是 16384/215s=76 —— 那次只写了 6,152 tokens，
 *     `max_tokens` 只是 cap，**真实输出量必须看 `usage.completion_tokens`**）
 *
 * 与总预算的关系：16384 tokens @ 30 tok/s ≈ 546s，**远大于** 285s 总预算。
 * 所以 cap 从来不是约束项，真正决定「能不能写完」的是预算；cap 只负责
 * 「别让模型无限写下去」，以及「预算够的时候别在 8k 处被砍」。
 */
const DEEP_ANALYSIS_MAX_TOKENS = 16384;
/**
 * 单次 LLM 调用超时。
 *
 * ⚠️ 2026-11 修正（旧注释与实现不一致）：这里原先写「必须小于路由 maxDuration(300s)」，
 *    但 **`.cn` 是 Next standalone 部署，根本不读 `maxDuration`** —— 该常量只对 Vercel 生效。
 *    `.cn` 真正生效的墙钟闸门只有两个：本文件的**总预算**（`DEEP_ANALYSIS_TOTAL_BUDGET_MS`）
 *    与 nginx 的 `proxy_read_timeout 330s`（`deploy/nginx/conf.d/cn.conf`）。
 *    所以单次超时不再用于"对齐 maxDuration"，而是作为**单次上限**，实际生效值由总预算裁剪
 *    （见 `callDoubao` 的 `deadlineMs`）。保留 280s 仅为 `.com`(Vercel) 侧的单次调用上限。
 */
const DEEP_ANALYSIS_TIMEOUT_MS = 280_000;
/** 续写轮次上限：1 次初稿 + 2 次续写，理论可覆盖约 48k tokens 的报告 */
const DEEP_ANALYSIS_MAX_CONTINUE_ROUNDS = 2;

/**
 * 深度分析**总预算**（从请求入口起算，含图片下载 + 初稿 + 全部续写轮次）。
 *
 * 为什么必须有（线上真实故障）：`.cn` 产品详情页点「AI 深度分析」→ 504。
 * 旧实现三者都是"每次调用"口径、**没有任何总闸**：
 *   图片下载 3 张串行 × 20s = 60s；单次 LLM 280s，且 `ark-client` 内部还会重试 1 次；
 *   续写最多 2 轮 ⇒ 最坏墙钟 ≈ 60s + 280s × 3 = 900s ≫ nginx 330s
 *   ⇒ 反代先掐断，返回 HTML 504，前端走非 JSON 分支显示「AI服务返回异常」。
 *
 * 285s 的取值理由（三层不倒挂，三条都必须同时成立）：
 *   - < nginx `proxy_read_timeout` 330s，留 **45s** 余量给响应序列化（长报告 + base64 元数据）与网络抖动；
 *   - < `maxDuration` 300s，保证 `.com`(Vercel) 侧同样不会被平台杀进程，留 **15s** 余量；
 *   - 前端 `DEEP_ANALYSIS_CLIENT_TIMEOUT_MS` = 300s **> 285s**，浏览器不会抢在服务端返回之前掐断连接。
 * ⚠️ **不要再往上调**：> 290s 会同时撞 Vercel 300s 与 nginx 330s 两个硬闸门。
 * ⚠️ 若将来确实要调大本值，必须同步把 nginx 的 `proxy_read_timeout` 提到「本值 + 30s」以上。
 *
 * ── 2026-10-31 二次复盘：单轮 280s 都写不完，根因是吞吐（不是三轮累加）──────────
 * 老板线上看到的报错是「…timeout of 280000ms exceeded」+ `ALL_MODELS_FAILED`（**应用自己的 503 JSON**），
 * 说明请求墙钟 < 330s、是**单次 LLM 调用自己跑满 280s 被掐**，不是 3 轮累加。实测吞吐只有
 * **27~32 tokens/s**（不是先前假设的 40~90），于是：
 *   - 3 张图：6,152 tokens → 227.6s
 *   - 8 张图：8,366 tokens → 264.1s      （老板 2026-10-29 拍板 3→8 张图）
 *
 * ── 为什么从 260s 抬到 285s（2026-11 定稿）──────────────────────────────
 * 曾一度把 260s 当"够用"：实测 8 图自然收尾 264.1s ⇒ **260s 只剩 -4s ~ +3s**，等于没有余量。
 * 老板环境比开发机慢 10~20%，且已拍板「不缩短报告」⇒ 必须给长尾留真实余量：
 *   - 长尾报告（8.6k tokens）在 260s 下必然被截断（240s 停下，剩 20s < 50s 续写门槛 ⇒ 续不上）；
 *   - 抬到 285s 后可容纳到 ~8.5k tokens 的自然收尾（实测 256.7s 那单），长尾也能完整出报告。
 * 代价：失败时最长等待多 25s，但比"截断后前端提示半截报告"便宜得多。
 */
const DEEP_ANALYSIS_TOTAL_BUDGET_MS = 285_000;

/**
 * 允许开始下一轮续写所需的最小剩余预算。
 *
 * 50s 的理由：一轮续写要重新把「已写正文」作为 assistant 上下文回灌（输入侧同样要算 prefill 时间），
 * 实测续写段首 token 明显慢于初稿；剩余预算低于 50s 时发起续写，几乎必然在
 * `deadlineMs` 之前被打断，还会把**已经拿到的时间**浪费在 TCP/排队上。
 * 不足就不续写 → 返回 `truncated: true` + `budgetExhausted: true`，让前端如实提示。
 */
const DEEP_ANALYSIS_CONTINUE_MIN_REMAINING_MS = 50_000;

/**
 * 图片下载阶段的子预算（相对请求入口起算的**阶段上限**）。
 *
 * 3 张图并行下载，每张超时取 `min(20s, 剩余预算)`；整个阶段再叠加 45s 上限。
 * 45s 的理由：单张 20s（守卫默认值）×2 轮最坏情况 + 队列抖动 ≈ 42s，
 * 取整到 45s 后仍给 LLM 留出 ≥ 240s（总预算 285s）。实测 8 图下载仅 358ms（并行 1s 内），该上限基本用不到。
 * 阶段超时**不整体失败**：带着已拿到的图继续分析（保持既有"丢图不丢链路"语义）。
 */
const DEEP_ANALYSIS_DOWNLOAD_BUDGET_MS = 45_000;

/**
 * 发起 LLM 调用所需的最小剩余预算（5s）。
 * 低于这个值再发起调用没有任何意义，直接判预算耗尽（快速失败 → 503 JSON，而不是等 nginx 掐断）。
 */
const DEEP_ANALYSIS_MIN_CALL_REMAINING_MS = 5_000;

/**
 * 单次请求最多送进模型的图片数 —— **从共享模块派生，不要在这里写死数字**。
 *
 * 老板 2026-10-29 拍板 3 → 8。前端 `deep-analysis-card.tsx` 与服务端共用
 * `@/lib/ai/deep-analysis-limits` 的 `MAX_DEEP_ANALYSIS_IMAGES`，避免「改了一处忘另一处」
 * 造成「前端送 8 张、服务端按 3 张夹」的静默不一致。
 * 服务端这里**必须再夹一次**：前端只是第一道，接口是登录即可调的，
 * 若有人直接 POST 30 张，input token 会翻几倍、prefill 与输出都会拖长，
 * 预算闸虽能兜住（不会 504），但白白烧钱并让报告变成截断。
 * 实测（600px 商品图）：3 图 → prompt 4,919 tokens / 输出 6,152 tokens / 227.6s；
 *                        8 图 → prompt 11,309 tokens / 输出 8,366 tokens / 264.1s。
 */
const DEEP_ANALYSIS_MAX_IMAGES = MAX_DEEP_ANALYSIS_IMAGES;

/**
 * 预算耗尽哨兵错误。
 *
 * 为什么要单独一个类：`callDoubao` 的其它失败（鉴权/超时/空响应）混在同一个 catch 里，
 * 前端需要区分「内容被预算截断」与「上游真的挂了」—— 只有前者应显示
 * 「因时间预算限制被截断」的黄色提示条，后者应显示错误。
 */
class DeepAnalysisBudgetExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeepAnalysisBudgetExhaustedError";
  }
}
/** 续写指令：明确要求只写剩余部分，避免 LLM 从头重复整篇报告 */
const DEEP_ANALYSIS_CONTINUE_PROMPT =
  "上面的内容是你正在撰写的深度分析报告，因单次输出长度上限被截断。" +
  "请紧接着截断处继续输出剩余部分，严格要求：" +
  "① 严禁重复任何已写内容；② 不要输出报告摘要或开头语；" +
  "③ 保持原有章节编号与格式继续往下写；" +
  "④ **严禁再输出 ```json 结构化代码块**（它已在报告最开头输出过，重复会让程序解析到错的那份），" +
  "正文写完后直接结束。";

/**
 * ⚠️ 只有 Vercel（`.com`）读这个值；**`.cn` 是 Next standalone，不读 `maxDuration`**。
 * `.cn` 的实际墙钟闸门是 `DEEP_ANALYSIS_TOTAL_BUDGET_MS`(285s) 与 nginx `proxy_read_timeout`(330s)。
 * 保留 300 是为了 `.com` 侧与 internal/products 对齐。
 */
export const maxDuration = 300;

/**
 * ── 余额预检（早退）────────────────────────────────────────────────────
 *
 * 洞（2026-10-31 排查）：本路由**没有余额预检**，只在最末尾 `deductCredits` 处拦「积分不足」。
 * 后果：余额 0 的账号点一次，系统照样跑完 190~290 秒、生成完整报告，最后才 402
 * ⇒ 报告丢弃、一分钱收不到，而单次真实成本 ¥0.28~0.43 已经烧掉，且可无限重复。
 *
 * 预检的目的是**在花钱之前**把明显付不起的账号挡掉，不是精确报价。
 * 因此按「实测最坏单次成本」估，不按平均成本估 —— 估低了就又回到「跑完才说没钱」。
 *
 * 预估模型（真实计价公式见 `spend.ts` 的 `computeAiCost`：points ≈ 人民币成本 × 1000）：
 *   ① 输入 token 随图片数近似线性。实测同一台设备的真实商品图：
 *        3 图 → prompt 4,919 tokens；8 图 → prompt 11,309 tokens
 *      ⇒ 斜率 (11,309 − 4,919) / 5 ≈ **1,278 tokens/图**，截距 ≈ 4,919 − 3×1,278 ≈ **1,085 tokens**
 *   ② 一次请求最多 1 轮初稿 + 2 轮续写，而续写会把**已写正文**作为 assistant 上下文回灌，
 *      所以累计输入远大于单轮。实测 8 图 3 轮：累计输入 42,145 / 单轮 11,703 ≈ **3.6×**
 *   ③ 累计输出实测 6,000 ~ 8,123 tokens，取上界 **8,700** 留余量
 * 代入 `computeAiCost` 反算（8 图）：输入 3.6 × 11,309 ≈ 40,700、输出 8,700
 *   ⇒ 成本 ≈ (40,700/1,000) × ¥0.006 + (8,700/1,000) × ¥0.03 = ¥0.244 + ¥0.261 = **¥0.505** ⇒ **505 积分**
 * 实测对照：8 图单轮 = 273 积分；8 图 2 轮续写（input 42,145 / output 6,000）= **433 积分**。
 * 即预估 505 比实测最贵一单高约 17%，这段余量就是留给「输出再长一点」的。
 *
 * 用 `computeAiCost` 反算而不是写死积分，是为了让预检**跟着价目表走**：
 * 将来 `MODEL_PRICING` 一改，门槛自动跟上，不会出现「预检 505、实扣 900」的双输。
 */
const DEEP_ANALYSIS_EST_INPUT_TOKENS_BASE = 1_085;
const DEEP_ANALYSIS_EST_INPUT_TOKENS_PER_IMAGE = 1_278;
const DEEP_ANALYSIS_EST_ROUND_INPUT_FACTOR = 3.6;
const DEEP_ANALYSIS_EST_OUTPUT_TOKENS = 8_700;

/**
 * 单次请求最低门槛（积分）。
 *
 * 正常情况下按上面反算出的预估（1 图 312 / 3 图 367 / 8 图 505）都高于本值，本值不生效；
 * 它只在**预估本身失真**时兜底 —— 典型场景是 `getArkModelId()` 返回了价目表里没有的模型，
 * `computeAiCost` 回落到 `FALLBACK_PRICING`（¥0.004/1K），8 图只算出 198 积分，
 * 那时 300 的下限能挡住「余额 200 也想跑一次 285 秒」的请求。
 */
const DEEP_ANALYSIS_MIN_POINTS = 300;

/**
 * ── 限流参数（按 userId 维度）──────────────────────────────────────────
 *
 * 为什么按 userId 而不是 IP：本接口已强制登录，userId 是稳定身份；
 * 而 `.cn` 的 IP 来自 nginx 的 `X-Forwarded-For`，运营商 NAT 下大量真实用户共享出口 IP，
 * 按 IP 限流会误伤无关用户，且换 IP 就能绕过 —— 两头不讨好。
 *
 * 频次推导：单次生成 190~290s（实测 191.4s / 218.6s / 263.1s），10 分钟窗口内
 * 理论上最多排进 2~3 次；再给「超时/失败后重试」留 1 次余量 ⇒ **3 次 / 10 分钟**。
 * 最坏烧钱上限 = 3 × ¥0.43 ≈ **¥1.29 / 10 分钟 / 账号**（改前是无上限）。
 */
const DEEP_ANALYSIS_RATE_WINDOW_SEC = 600;
const DEEP_ANALYSIS_RATE_MAX = 3;

/**
 * ⚠️ 这个限流**当前不是全局限流**，别当成分布式锁用。核实结论（2026-10-31）：
 *
 *   `@/lib/rate-limit` → `@/lib/cache`：只有配了 `UPSTASH_REDIS_REST_URL` +
 *   `UPSTASH_REDIS_REST_TOKEN` 才走跨实例 Redis，否则回落到**进程内 `MemoryCache`**。
 *   现状是**未配置 Upstash**（`grep -rn "UPSTASH_REDIS"` 全仓只命中 `cache.ts` 自己，
 *   `.env` 也没有这两个键），所以实际行为是：**进程内、重启清零、多实例不共享**。
 *
 *   - `.cn`：`docker-compose.yml` 只有单个 `cn-app` 容器（无 `replicas` / `deploy` 段），
 *     每个进程就是全部实例 ⇒ 进程内计数**等价于全局**，3 次/10 分钟在本站真实有效。
 *   - `.com`(Vercel)：多实例 ⇒ 每个实例各自计数，实际全局上限 ≈ 3 × 实例数，
 *     且冷启动/扩缩容会清零。属于「尽力而为」的兜底，不是硬约束。
 *   - 想变成真正的全局：配 Upstash 两个环境变量即可，**本文件一行都不用改**。
 *
 * 已有的三个调用方（forgot-password / send-verify-email / admin-reminder）也是同样的边界。
 */

/**
 * 估算单次深度分析要花多少积分（向上取整到「最坏单次」口径，见上方常量注释）。
 *
 * @param imageCount 本次请求进入模型的图片数（视频未建模，见下）
 * @param model      模型 ID —— 必须与真正计费用的是同一个 ID，否则预检会按错的价目表算
 *
 * ⚠️ 视频未纳入模型：历史请求以图片为主，且视频体积由 `buildDoubaoContent` 单独限；
 *    有视频时本预估会偏松（偏低），最终仍由末尾 `deductCredits` 兜底 —— 预检只负责
 *    挡掉「连图片都不够付」的账号，不承诺 100% 覆盖所有费用组合。
 */
function estimateDeepAnalysisPoints(imageCount: number, model: string): number {
  const safeImageCount = Math.max(0, Math.floor(imageCount || 0));
  const singleRoundInput =
    DEEP_ANALYSIS_EST_INPUT_TOKENS_BASE +
    DEEP_ANALYSIS_EST_INPUT_TOKENS_PER_IMAGE * safeImageCount;
  const inputTokens = Math.round(singleRoundInput * DEEP_ANALYSIS_EST_ROUND_INPUT_FACTOR);
  const { points } = computeAiCost({
    model,
    inputTokens,
    outputTokens: DEEP_ANALYSIS_EST_OUTPUT_TOKENS,
  });
  return Math.max(points, DEEP_ANALYSIS_MIN_POINTS);
}

/**
 * 国际农机深度分析 Prompt — 全球市场
 *
 * ⚠️ 市场中立红线：本 prompt 只服务 `.com` 国际站，**通篇不得出现「中国 / 国内」视角**，
 * 一律以「买家所在目标市场」为参照。`.com` 上卖的是中国农机，但买家在海外，
 * 讲中国补贴政策对买家无意义，还会被误读为「国内就是中国」（老板实测投诉）。
 * 需要中国市场视角的内容一律放 `DOMESTIC_ANALYSIS_PROMPT`（仅 `.cn` 使用）。
 */
const INTERNATIONAL_ANALYSIS_PROMPT = `你是一位拥有20年经验的资深二手农业机械专家和评估师，精通 John Deere、CLAAS、New Holland、Kubota、Massey Ferguson、Case IH 等全球主流品牌的拖拉机、收获机、打捆机、播种机等各类农机设备。

请根据用户提供的农机照片和视频（可能包含整机全貌、铭牌、驾驶室、发动机、轮胎底盘、工作视频等），结合你的专业知识库，给出一份**详尽的深度分析报告**。

说明：本报告面向**国际买家**撰写，请始终站在买家所在的目标销售市场（销售目的地国家/地区）视角做分析与建议；不要默认设备已在该市场落地，也不要默认买家熟悉当地的政策与规则。

⛔ **输出顺序（硬性要求，两步，不许调换、不许合并）：先结构化 JSON，后正文。**

【第 1 步 · 报告最开头】先输出**唯一一个** \`\`\`json 代码块，字段名与类型严格照抄下方模板；
代码块前后不要加任何标题、小节名、序号、引导语或说明文字（不要写「结构化数据」「以下是结构化数据」
「Structured Data」之类的话，程序会直接剥掉这个代码块）：
\`\`\`json
{
  "brand": "品牌",
  "modelName": "型号",
  "year": 年份,
  "enginePower": "马力",
  "engineType": "发动机类型",
  "driveSystem": "驱动方式",
  "overallLength": "长mm",
  "overallWidth": "宽mm",
  "overallHeight": "高mm",
  "netWeight": "重量kg",
  "mainConfig": "主要配置",
  "condition": "excellent|good|fair|poor",
  "conditionScores": {
    "exterior": 1-10,
    "rust": 1-10,
    "tires": 1-10,
    "cabin": 1-10,
    "hydraulic": 1-10,
    "overall": 1-10
  },
  "isChineseBrand": false,
  "confidence": 0.0-1.0
}
\`\`\`

【第 2 步 · 紧接着写正文】代码块结束后**立刻**开始写正文，正文必须包含以下部分（用 Markdown 格式输出）：

## 设备识别
- 品牌（英文标准名）
- 具体型号
- 生产年份（或年份范围）
- 识别依据（从哪张照片/视频的什么特征判断的）

## 技术参数解读
基于你对该型号的专业知识，列出关键技术参数：
- 发动机：型号、额定马力(HP)、排量、缸数
- 传动系统：驱动方式(2WD/4WD)、变速箱档位数
- 液压系统：提升力、输出流量
- 尺寸重量：长×宽×高(mm)、整机重量(kg)
- 燃油箱容量、PTO功率等
- 如果照片中有铭牌信息，以铭牌为准；否则根据你的专业知识补充

## 设备现状评估（六维度评分）
从以下6个维度评估设备现状，每个维度打分（1-10分，10分为最佳）：
- 外观漆面（喷漆完整性、褪色程度）— 评分及说明
- 锈蚀程度（车身、底盘、关键部件锈蚀情况）— 评分及说明
- 轮胎/履带（磨损程度、花纹深度、是否需要更换）— 评分及说明
- 驾驶室/操作台（整洁度、仪表功能、座椅状况）— 评分及说明
- 液压渗漏（管路、接头、油缸是否有渗漏）— 评分及说明
- 整体印象（保养水平、使用痕迹、维保记录）— 评分及说明
最后给出综合评价和总体评分。

## 操作与维修要点
基于你的专业知识，给出该型号农机的：
- 日常操作注意事项
- 定期保养项目及周期（工作小时数）
- 常见故障及排除方法
- 易损件清单
- 关键操作技巧

## 购买建议
- 该设备的优缺点总结
- 适合的作业场景
- 选购时需要重点检查的部位
- 询价空间分析

## 资源与文档
- 官方使用说明书获取途径（制造商官网链接或当地经销商联系方式）
- 零件目录/Parts Manual 查询地址
- 维修手册下载链接（如有）
- 技术培训视频或资料推荐
- 该机型在你目标销售市场（买家所在国家/地区）的授权经销与服务网络信息

⛔ 正文写到最后一行就结束：**不要**再输出第二个 \`\`\`json 代码块、不要再补「结构化数据」小节、
也不要再写任何总结性 JSON（结构化信息只需出现一次，就在报告最开头那份）。

重要提示：
1. **请充分利用你的专业知识**，不要仅依赖照片信息
2. 报告内容要详实、专业、有深度，至少2000字`;

/**
 * 国内农机深度分析 Prompt — 车况评估、操作维修、国内市场
 *
 * ⚠️ 本 prompt 仅 `.cn` 国内站使用（见 `useDomesticPrompt` 的站点优先判定），
 * 其中的「中国 / 国内 / 农机购置补贴」措辞是**该站应有内容，不要删改**。
 */
const DOMESTIC_ANALYSIS_PROMPT = `你是一位拥有20年经验的中国资深农业机械专家和评估师，精通东方红、雷沃、沃得、福田、久保田（国产）、洋马、井关、时风、五征、常发、星光、中联重科等国内主流品牌的拖拉机、收割机、插秧机、播种机、植保机、打捆机等各类农机设备。你对中国农机购置补贴政策、各省补贴额度、二手农机交易市场行情有深入了解。

请根据用户提供的农机照片和视频（可能包含整机全貌、铭牌、驾驶室、发动机、轮胎底盘、工作视频等），结合你的专业知识库，给出一份**详尽的深度分析报告**。

⛔ **输出顺序（硬性要求，两步，不许调换、不许合并）：先结构化 JSON，后正文。**

【第 1 步 · 报告最开头】先输出**唯一一个** \`\`\`json 代码块，字段名与类型严格照抄下方模板；
代码块前后不要加任何标题、小节名、序号、引导语或说明文字（不要写「结构化数据」「以下是结构化数据」
「Structured Data」之类的话，程序会直接剥掉这个代码块）：
\`\`\`json
{
  "brand": "品牌",
  "modelName": "型号",
  "year": 年份,
  "enginePower": "马力",
  "engineType": "发动机类型",
  "driveSystem": "驱动方式",
  "overallLength": "长mm",
  "overallWidth": "宽mm",
  "overallHeight": "高mm",
  "netWeight": "重量kg",
  "mainConfig": "主要配置",
  "condition": "excellent|good|fair|poor",
  "conditionScores": {
    "exterior": 1-10,
    "rust": 1-10,
    "tires": 1-10,
    "cabin": 1-10,
    "hydraulic": 1-10,
    "overall": 1-10
  },
  "isChineseBrand": true,
  "confidence": 0.0-1.0
}
\`\`\`

【第 2 步 · 紧接着写正文】代码块结束后**立刻**开始写正文，正文必须包含以下部分（用 Markdown 格式输出）：

## 设备识别
- 品牌（中文标准名）
- 具体型号
- 生产年份（或年份范围）
- 识别依据（从哪张照片/视频的什么特征判断的）

## 技术参数解读
基于你对该型号的专业知识，列出关键技术参数：
- 发动机：型号、额定马力(HP)、排量、缸数
- 传动系统：驱动方式(两驱/四驱)、变速箱档位数
- 液压系统：提升力、输出流量
- 尺寸重量：长×宽×高(mm)、整机重量(kg)
- 燃油箱容量、PTO功率等
- 如果照片中有铭牌信息，以铭牌为准；否则根据你的专业知识补充

## 设备现状评估（六维度评分）
从以下6个维度评估设备现状，每个维度打分（1-10分，10分为最佳）：
- 外观漆面（喷漆完整性、褪色程度）— 评分及说明
- 锈蚀程度（车身、底盘、关键部件锈蚀情况）— 评分及说明
- 轮胎/履带（磨损程度、花纹深度、是否需要更换）— 评分及说明
- 驾驶室/操作台（整洁度、仪表功能、座椅状况）— 评分及说明
- 液压渗漏（管路、接头、油缸是否有渗漏）— 评分及说明
- 整体印象（保养水平、使用痕迹、维保记录）— 评分及说明
最后给出综合评价和总体评分。

## 操作与维修要点
- 日常操作注意事项
- 定期保养项目及周期（工作小时数）
- 常见故障及排除方法
- 易损件清单及参考价格
- 关键操作技巧

## 购买建议
- 该设备的优缺点总结
- 适合的作业场景和地块规模
- 选购时需要重点检查的部位
- 询价空间分析
- 售后服务与配件供应情况

## 资源与文档
- 官方使用说明书获取途径（官网链接或经销商联系方式）
- 零件目录/配件手册查询地址
- 维修手册下载链接（如有）
- 技术培训视频或资料推荐
- 该品牌在中国的授权服务商信息

⛔ 正文写到最后一行就结束：**不要**再输出第二个 \`\`\`json 代码块、不要再补「结构化数据」小节、
也不要再写任何总结性 JSON（结构化信息只需出现一次，就在报告最开头那份）。

重要提示：
1. **请充分利用你的专业知识**，不要仅依赖照片信息
2. 报告内容要详实、专业、有深度，至少2000字`;

/**
 * 调用豆包 API（统一出口 chatCompletionDoubao）
 *
 * @param content 多模态消息体（text + image_url… + video_url…）
 * @param extraMessages 续写时追加的历史消息（assistant 已写内容 + user 续写指令）
 * @param deadlineMs 本次请求的**总预算截止时间戳**（`Date.now()` 口径）。
 *   两个作用：
 *     ① 单次 `timeoutMs` 被剩余预算裁剪（`min(280s, max(5s, 剩余))`）；
 *     ② 传给 `ark-client` 的 `deadlineMs`，让它在 429/5xx 重试前检查预算
 *        —— 否则内部那一次盲重试会把总预算直接击穿（2 × timeout）。
 * @throws {DeepAnalysisBudgetExhaustedError} 剩余预算不足以发起调用（调用方据此标记 budgetExhausted）
 */
async function callDoubao(
  content: Array<Record<string, unknown>>,
  /** 续写时追加的历史消息（assistant 已写内容 + user 续写指令） */
  extraMessages: Array<{ role: string; content: string }> = [],
  /** 请求级总预算截止时间戳；不传时才回落到旧的"单次 280s、无总闸"行为（仅供单测/内部调用） */
  deadlineMs?: number
): Promise<LlmCallResult> {
  const model = getArkModelId();

  // ── 预算闸①：剩余不足以发起一次有意义的调用 → 立即失败，不占用时间去排队 ──
  const hasDeadline = typeof deadlineMs === "number" && Number.isFinite(deadlineMs);
  const remainingMs = hasDeadline ? (deadlineMs as number) - Date.now() : Number.POSITIVE_INFINITY;
  if (hasDeadline && remainingMs < DEEP_ANALYSIS_MIN_CALL_REMAINING_MS) {
    throw new DeepAnalysisBudgetExhaustedError(
      `[DeepAnalysis] 总预算耗尽（剩余 ${Math.max(0, Math.round(remainingMs))}ms < ` +
        `${DEEP_ANALYSIS_MIN_CALL_REMAINING_MS}ms），放弃本次 LLM 调用`
    );
  }

  /** 单次超时：不得超过总预算剩余，也不得超过单次上限 280s */
  const timeoutMs = hasDeadline
    ? Math.min(
        DEEP_ANALYSIS_TIMEOUT_MS,
        Math.max(DEEP_ANALYSIS_MIN_CALL_REMAINING_MS, Math.round(remainingMs))
      )
    : DEEP_ANALYSIS_TIMEOUT_MS;

  console.log(
    `[DeepAnalysis] 豆包调用: model=${model}, ` +
    `图片数=${content.filter((c) => c.type === "image_url").length}, ` +
    `视频数=${content.filter((c) => c.type === "video_url").length}, ` +
    `timeoutMs=${timeoutMs}${hasDeadline ? `, 剩余预算=${Math.round(remainingMs)}ms` : ""}`
  );

  const result = await chatCompletionDoubao({
    model,
    maxTokens: DEEP_ANALYSIS_MAX_TOKENS,
    timeoutMs,
    // ark-client 内部有 429/5xx 退避重试；不传 deadlineMs 时那次重试不受预算约束。
    ...(hasDeadline ? { deadlineMs: deadlineMs as number } : {}),
    messages: [{ role: "user", content }, ...extraMessages],
  });

  const text = result.text || "";

  if (!text || text.trim().length < 50) {
    throw new Error("豆包返回空响应或响应过短");
  }

  const usage = {
    inputTokens: result.usage?.prompt_tokens ?? 0,
    outputTokens: result.usage?.completion_tokens ?? 0,
  };

  return { text, usage, finishReason: result.finishReason };
}

/**
 * 从Markdown报告中提取JSON结构化数据
 */
function extractStructured(analysisText: string): Record<string, any> | null {
  // 找 ```json ... ``` 代码块
  const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {
      // 尝试提取花括号内容
      const braceMatch = jsonMatch[1].match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]);
        } catch {
          // ignore
        }
      }
    }
  }

  // 尝试从全文提取 JSON
  const fullJsonMatch = analysisText.match(/\{[\s\S]*"brand"[\s\S]*\}/);
  if (fullJsonMatch) {
    try {
      return JSON.parse(fullJsonMatch[0]);
    } catch {
      // ignore
    }
  }

  return null;
}

// ── 报告里 JSON 小节 / 代码块的清洗规则 ──
// 根因：prompt 曾要求模型写 `## 结构化数据（JSON）` 小标题 + 引导语 + ```json 代码块；
// 清洗只删代码块，标题与引导语原样留下 → 报告结尾残留一个只有标题、没有内容的小节。
// 现状（V2.5）：prompt 已把 ```json 代码块**挪到正文最前面**（截断时仍能拿到 structured），
// 这些规则同时兜住「头部/尾部」两种残留位置，无需按位置区分。
// 现在 prompt 已不再要求标题，但模型不一定完全听话，故服务端再兜一道。

/**
 * ① 残留中文小标题：行首可选 `#`+空白 + `结构化数据`，整行删除。
 * 例：`## 结构化数据（JSON）` / `**结构化数据（JSON）**` / `结构化数据`
 */
const JSON_SECTION_HEADING_CN = /^[ \t]*#{0,6}[ \t]*\**结构化数据[^\n]*$/gim;

/**
 * ② 残留外语小标题（模型按 locale 换语种后标题名会变，抓不住中文）：
 * 以 `#` 开头的 Markdown 标题行，只要该行出现 JSON 字样即视为结构化数据小节标题。
 * 例：`## Structured Data (JSON)` / `## Données structurées (JSON)`
 */
const JSON_SECTION_HEADING_MD = /^[ \t]*#{1,6}[^\n]*\bJSON\b[^\n]*$/gim;

/**
 * ③ 残留引导语行（「最后附上一个JSON代码块，包含…」这类纯说明行），整行删除。
 * 中文：最后附上 / 最后附加 / 附上一个 / 以下为结构化数据
 * 英文：Finally, append… / Lastly, output…
 */
const JSON_SECTION_LEAD_CN =
  /^[ \t]*(?:最后附上|最后附加|附上一个|以下为结构化数据|下面是结构化数据)[^\n]*$/gim;
const JSON_SECTION_LEAD_EN =
  /^[ \t]*(?:finally|lastly)[,]?[ \t]+(?:append|output|provide|attach|here\s+is)[^\n]*$/gim;

/** ④ 连续 3 个以上空行（含只含空格的行）→ 压成最多 2 个空行 */
const EXCESS_BLANK_LINES = /\n(?:[ \t]*\n){2,}/g;

/**
 * ⑤ 末尾孤立的分隔线（`---` / `***` / `___`，允许尾部空白与换行）。
 * 模型写完 JSON 后常补一条分隔线，代码块被剥掉后它就是报告的最后一行，必须一起删。
 */
const TRAILING_HR = /\n[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*\n*$/;

/**
 * 清理报告正文：剥掉 ```json 代码块及其残留标题/引导语 / 分隔线，供前端直接渲染 Markdown。
 *
 * ⚠️ 代码块本身必须在 `extractStructured()` **之后**才删（结构化字段走 `data.structured`），
 * 顺序颠倒会导致六维度评分、技术参数表全部解析失败。
 *
 * 位置无关性（V2.5 关键点）：prompt 现在把结构化 JSON 放在**正文之前**，
 * 所以这里用的正则一律是「全文匹配 + 整块删除」，不能假设代码块在尾部
 * （`/```json[\s\S]*?```/` 与无闭合围栏的 `/```json[\s\S]*$/` 都天然位置无关）。
 */
function cleanAnalysisText(analysisText: string): string {
  const cleaned = analysisText
    // 完整代码块 + 被 max_tokens 截断、缺闭合围栏的代码块，一并剥掉
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*$/i, "")
    // 只剩围栏的空行（``` 单独成行）
    .replace(/^```+$/gm, "")
    // 残留标题 / 引导语（模型不听话时的兜底）
    .replace(JSON_SECTION_HEADING_CN, "")
    .replace(JSON_SECTION_HEADING_MD, "")
    .replace(JSON_SECTION_LEAD_CN, "")
    .replace(JSON_SECTION_LEAD_EN, "")
    // 删行后留下的空洞：连续空行压成最多 2 个
    .replace(EXCESS_BLANK_LINES, "\n\n")
    // 末尾孤立的 `---` 分隔线
    .replace(TRAILING_HR, "")
    .replace(EXCESS_BLANK_LINES, "\n\n")
    .trim();

  // 极端情形：正文剥完只剩一条分隔线 / 空串 → 返回空串，别给前端一个空的 `---`
  return /^(?:-{3,}|\*{3,}|_{3,})$/.test(cleaned) ? "" : cleaned;
}

export async function POST(request: NextRequest) {
  try {
    // ── 总预算起点：必须在 body 解析 / 图片下载之前 ──
    // 只有从请求入口起算，才能保证「下载 + 初稿 + 续写 + 扣费 + 序列化」的**整段墙钟**
    // 落在 DEEP_ANALYSIS_TOTAL_BUDGET_MS 之内（< nginx 330s / maxDuration 300s）。
    const requestStartedAt = Date.now();
    const requestDeadline = requestStartedAt + DEEP_ANALYSIS_TOTAL_BUDGET_MS;

    // ── 登录校验：AI 深度分析需登录并按积分计费（游客不可用）──
    // 401 分支也要拼 /{locale}/credits，此时 body 还没读 → 先用请求头解析一次；
    // body 解析后再带 body.locale 复核（前端显式 locale 优先级最高），得到最终 locale。
    const headerLocale: AiLocale = resolveAiLocale({ request }).locale;
    const token = getTokenFromHeaders(request.headers);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: "请登录后使用 AI 深度分析",
          code: "AUTH_REQUIRED",
          rechargeUrl: `/${headerLocale}/credits`,
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    // ── 输出语种：全站唯一决策入口（见 src/lib/i18n/ai-locale.ts）──
    // 优先级 body.locale → 用户偏好（默认关）→ x-vercel-ip-country → accept-language
    //        → referer → 站点默认；`.cn` 最终收敛到 zh/en。
    const { locale, source } = resolveAiLocale({ bodyLocale: body?.locale, request });
    console.log(`[DeepAnalysis] locale=${locale} source=${source}`);

    console.log(`[DeepAnalysis] 收到请求: ${JSON.stringify({
      imageUrls: (body.imageUrls || []).length,
      imageDataUris: (body.imageDataUris || []).length,
      videoUrls: (body.videoUrls || []).length,
      isChineseBrand: body.isChineseBrand,
      productName: body.productName,
      brandName: body.brandName,
      year: body.year,
      enginePower: body.enginePower,
      locale,
    })}`);
    const imageUrls: string[] = body.imageUrls || [];
    const imageDataUris: string[] = body.imageDataUris || [];
    const videoUrls: string[] = body.videoUrls || [];
    const isChineseBrand = body.isChineseBrand as boolean | undefined;
    const productName = body.productName as string | undefined;
    const categoryName = body.category as string | undefined;
    const brandName = body.brandName as string | undefined;
    const year = body.year as number | undefined;
    const enginePower = body.enginePower as string | undefined;

    const allImages = [...imageUrls, ...imageDataUris];
    // 服务端二次夹取（见 DEEP_ANALYSIS_MAX_IMAGES 注释）：超出的图静默丢弃，
    // 不报错 —— 前端本来就只送 8 张，这里只防"绕过前端直接打接口"。
    const images = allImages.slice(0, DEEP_ANALYSIS_MAX_IMAGES);
    if (allImages.length > images.length) {
      console.warn(
        `[DeepAnalysis] 图片数超上限：收到 ${allImages.length} 张，只取前 ${images.length} 张`
      );
    }

    if (images.length === 0 && videoUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: "需要至少一张图片或一段视频", code: "NO_MEDIA" },
        { status: 400 }
      );
    }

    // ── ① 余额预检（**早退**，不是预扣）──────────────────────────────────
    // 必须在任何图片下载与模型调用之前：一次请求要跑 190~290s、真金白银 ¥0.28~0.43，
    // 跑完才说「积分不足」是把成本 100% 白送出去（详见常量区的洞说明）。
    // 只读余额：**不扣款、不预扣、不退款**（预扣/退款是另一件事，未做）。
    const precheckModel = getArkModelId();
    const requiredPoints = estimateDeepAnalysisPoints(images.length, precheckModel);
    const balanceRow = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { credits: true },
    });
    const currentCredits = balanceRow?.credits ?? 0;
    if (currentCredits < requiredPoints) {
      console.warn(
        `[DeepAnalysis] 余额预检拦截: user=${payload.userId}, 余额=${currentCredits} < ` +
        `门槛=${requiredPoints}（${images.length} 图, model=${precheckModel}），未发起任何模型调用`
      );
      // ⚠️ 响应体必须与末尾 `deductCredits` 失败分支**完全同形**（同一个 code / error 文案 /
      //    rechargeUrl / required / balance 字段），否则前端 `deep-analysis-card.tsx` 要多加一条分支。
      return NextResponse.json(
        {
          success: false,
          error: "积分不足，请先充值后再使用 AI 深度分析",
          code: "INSUFFICIENT_CREDITS",
          rechargeUrl: `/${locale}/credits`,
          required: requiredPoints,
          balance: currentCredits,
        },
        { status: 402 }
      );
    }

    // ── ② 限流（按 userId；放在余额预检之后，保证 400/402 不消耗配额）──
    // 顺序理由：400(NO_MEDIA) 与 402(余额不足) 都是「不花钱」的路径，
    // 让它们吃掉配额会出现「用户补了张图/充了值，却因为前面几次失败被 429」的荒谬体验。
    const rl = await rateLimit({
      key: `rl:deep-analysis:user:${payload.userId}`,
      windowSec: DEEP_ANALYSIS_RATE_WINDOW_SEC,
      max: DEEP_ANALYSIS_RATE_MAX,
    });
    if (!rl.allowed) {
      console.warn(
        `[DeepAnalysis] 触发限流: user=${payload.userId}, ` +
        `${DEEP_ANALYSIS_RATE_WINDOW_SEC}s 内已满 ${DEEP_ANALYSIS_RATE_MAX} 次, ` +
        `retryAfter=${rl.retryAfterSec}s，未发起任何模型调用`
      );
      return NextResponse.json(
        {
          success: false,
          error:
            `请求过于频繁：同一账号 ${Math.round(DEEP_ANALYSIS_RATE_WINDOW_SEC / 60)} 分钟内` +
            `最多 ${DEEP_ANALYSIS_RATE_MAX} 次 AI 深度分析，请 ${rl.retryAfterSec} 秒后再试`,
          code: "RATE_LIMITED",
          retryAfterSec: rl.retryAfterSec,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // 双引擎Prompt选择（站点优先）：
    // `.cn` 是国内站，按品牌国籍切双引擎；`.com` 是国际站，一律走国际版
    // （国际站讲中国市场补贴政策对国际买家没有意义，且会被误读为「国内=中国」）。
    const useDomesticPrompt = isCnSite() && isChineseBrand === true;
    let activePrompt = useDomesticPrompt ? DOMESTIC_ANALYSIS_PROMPT : INTERNATIONAL_ANALYSIS_PROMPT;

    // 注入已知参数作为上下文（让AI以已知信息为准，照片作为辅助验证）。
    // 标签用**英文**：这是输入侧元数据，中文标签会把输出语言往中文带偏；
    // 最终输出语言由下方 `withLanguage` 的语言指令决定。
    const knownParams: string[] = [];
    if (brandName) knownParams.push(`- Brand: ${brandName}`);
    if (productName) knownParams.push(`- Model: ${productName}`);
    if (year) knownParams.push(`- Year: ${year}`);
    if (enginePower) knownParams.push(`- Power: ${enginePower} HP`);
    if (knownParams.length > 0) {
      activePrompt += `\n\n⚠️ Known facts (treat as authoritative; photos are for verification):\n${knownParams.join("\n")}`;
    }

    // 语言指令永远追加到最末（离模型最近，遵从度最高），不改动 prompt 一个字
    activePrompt = withLanguage(activePrompt, locale);
    // 续写轮次同样要带语言指令，否则被截断后补写的那几段会退回中文
    const continuePrompt = withLanguage(DEEP_ANALYSIS_CONTINUE_PROMPT, locale);

    // 引擎标识只用于内部日志排查，不进 modelUsed（`.com` 用户不该看到「国内(DOMESTIC)」徽章）
    const engineLabel = useDomesticPrompt ? "国内(DOMESTIC)" : "国际(INTERNATIONAL)";

    let analysisText = "";
    let modelUsed = "";
    let billingModel = "";
    let lastUsage = { inputTokens: 0, outputTokens: 0 };
    let truncated = false;
    /** 中止/截断是否由**总预算**导致（供前端区分提示文案，见文件头「截断契约」） */
    let budgetExhausted = false;
    let continueRounds = 0;
    const errors: string[] = [];

    // 全站统一豆包（火山方舟 ARK）：.cn 直连国行、.com 经 B 通道代理（见 ark-client.ts）。
    // 数据不出境红线：豆包为境内服务，.cn 数据不经境外。
    try {
      const model = getArkModelId();
      console.log(`[DeepAnalysis] 首选豆包: ${model}, 引擎: ${engineLabel}, 语种: ${locale}, 图片数: ${images.length}, 视频数: ${videoUrls.length}`);
      // ── 图片下载阶段：并行 + 双重预算封顶（阶段 45s 与总预算取早者）──
      // 下载超时**不整体失败**：`buildDoubaoContent` 内部逐图 allSettled，只丢失败的那张。
      const downloadDeadline = Math.min(
        requestDeadline,
        Date.now() + DEEP_ANALYSIS_DOWNLOAD_BUDGET_MS
      );
      const content = await buildDoubaoContent(images, videoUrls, activePrompt, {
        downloadDeadlineMs: downloadDeadline,
      });
      console.log(
        `[DeepAnalysis] 图片下载阶段完成: 用时=${Date.now() - requestStartedAt}ms, ` +
        `实际进入模型图片数=${content.filter((c) => c.type === "image_url").length}/${images.length}`
      );
      const res = await callDoubao(content, [], requestDeadline);
      analysisText = res.text;
      lastUsage = res.usage;
      billingModel = model;
      // 只回模型名：engineLabel 属于内部实现细节
      modelUsed = `豆包 ${model}`;

      // 长报告续写：finishReason === "length" 表示输出触及 max_tokens 被截断
      // （历史上这正是「报告下面没出全」的静默根因——截断信号此前被 ark-client 丢弃）。
      // 按火山官方推荐做法：把已生成内容作为上下文继续写；轮次用尽仍截断则置 truncated。
      let finishReason = res.finishReason;
      while (finishReason === "length" && continueRounds < DEEP_ANALYSIS_MAX_CONTINUE_ROUNDS) {
        // ── 预算闸②：续写前的预算检查（与销售策略链路的 `remaining < 15s` 同口径，但更保守）──
        // 不检查的后果：最后一轮续写吃满 timeout，把总墙钟顶到预算之外 → 反代 504 HTML。
        const remaining = requestDeadline - Date.now();
        if (remaining < DEEP_ANALYSIS_CONTINUE_MIN_REMAINING_MS) {
          budgetExhausted = true;
          truncated = true;
          console.warn(
            `[DeepAnalysis] 剩余预算 ${Math.max(0, Math.round(remaining))}ms < ` +
            `${DEEP_ANALYSIS_CONTINUE_MIN_REMAINING_MS}ms，跳过第 ${continueRounds + 1} 次续写，` +
            `标记 truncated=true / budgetExhausted=true`
          );
          break;
        }
        continueRounds += 1;
        console.warn(
          `[DeepAnalysis] 输出被 max_tokens 截断(finish_reason=length)，第 ${continueRounds}/${DEEP_ANALYSIS_MAX_CONTINUE_ROUNDS} 次续写`
        );
        // 续写同样带 deadlineMs：其内部重试不能突破 requestDeadline
        const cont = await callDoubao(content, [
          { role: "assistant", content: analysisText },
          { role: "user", content: continuePrompt },
        ], requestDeadline);
        analysisText += cont.text;
        lastUsage = {
          inputTokens: lastUsage.inputTokens + cont.usage.inputTokens,
          outputTokens: lastUsage.outputTokens + cont.usage.outputTokens,
        };
        finishReason = cont.finishReason;
      }
      if (finishReason === "length") {
        // 走到这里有两种可能：① 续写轮次用尽（continueRounds 达上限）；
        // ② 预算闸②刚 break（budgetExhausted 已置 true）。两者都算截断。
        truncated = true;
        console.error(
          `[DeepAnalysis] 报告仍不完整：continueRounds=${continueRounds}, ` +
          `budgetExhausted=${budgetExhausted}, 已用墙钟=${Date.now() - requestStartedAt}ms，已标记 truncated`
        );
      }
    } catch (error: any) {
      const isBudget = error instanceof DeepAnalysisBudgetExhaustedError;
      if (isBudget) budgetExhausted = true;
      const msg = `[豆包] ${error.message || ""}`.substring(0, 150);
      console.warn("[DeepAnalysis] 豆包失败:", msg, isBudget ? "(预算耗尽)" : "");
      errors.push(msg);
      // 初稿失败 → analysisText 为空，走下方 ALL_MODELS_FAILED；
      // 续写失败 → 保留已生成内容并标记 truncated，避免静默缺尾。
      if (analysisText) truncated = true;
    }

    // 吞吐可观测：`outputTokens / LLM 墙钟` 是我们校准 DEEP_ANALYSIS_MAX_TOKENS 的唯一依据
    // （2026-10-31 线上事故复盘：单轮 280s 写不完，必须先知道真实 tokens/s 才能定 cap）。
    // 只打数字，不含任何用户内容，可长期保留。
    const elapsedMs = Date.now() - requestStartedAt;
    const outputTokens = lastUsage.outputTokens;
    console.log(
      `[DeepAnalysis] 生成结束: 墙钟=${elapsedMs}ms, 预算=${DEEP_ANALYSIS_TOTAL_BUDGET_MS}ms, ` +
      `续写轮次=${continueRounds}, truncated=${truncated}, budgetExhausted=${budgetExhausted}, ` +
      `输入tokens=${lastUsage.inputTokens}, 输出tokens=${outputTokens}, ` +
      `平均吞吐=${elapsedMs > 0 ? (outputTokens / (elapsedMs / 1000)).toFixed(1) : "0"} tokens/s`
    );

    if (!analysisText || analysisText.trim().length < 50) {
      return NextResponse.json({
        success: false,
        error: "AI深度分析服务暂时不可用，请稍后重试或使用快速识别功能",
        code: "ALL_MODELS_FAILED",
        retryable: true,
        debug: errors.length > 0 ? errors.map(e => e.substring(0, 120)) : ["未捕获到模型错误"],
      }, { status: 503 });
    }

    // 提取结构化数据（必须在清洗之前：清洗会把 ```json 代码块整块删掉）
    const structured = extractStructured(analysisText);

    // 剥离报告尾部的 ```json 块及残留标题/引导语后再返回正文：结构化字段已单独走 data.structured，
    // 正文不应露出裸 JSON，也不该留一个只有标题、没有内容的「结构化数据」空小节。
    const analysisClean = cleanAnalysisText(analysisText);

    // ── 积分扣减（按 LLM token 实际消耗成本乘以运营定价倍率，反算积分）──
    const billingCountry = await getBillingCountry(payload.userId);
    const cost: AiCostBreakdown = computeAiCost({
      model: billingModel || getArkModelId(),
      inputTokens: lastUsage.inputTokens,
      outputTokens: lastUsage.outputTokens,
      billingCountry,
    });
    const deduction = await deductCredits(
      payload.userId,
      cost.points,
      "AI深度分析",
      cost as unknown as Record<string, unknown>
    );
    if (!deduction.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "积分不足，请先充值后再使用 AI 深度分析",
          code: "INSUFFICIENT_CREDITS",
          rechargeUrl: `/${locale}/credits`,
          required: deduction.required,
          balance: deduction.credits,
        },
        { status: 402 }
      );
    }

    /**
     * 成功响应体的 `data` 结构（**契约定义**，见文件头「截断契约」）。
     *
     * 单独声明成类型而不是内联对象字面量，是为了让 `truncated` / `budgetExhausted`
     * 这两个前端依赖的字段不会在将来重构里被悄悄删掉（删了 tsc 会报错）。
     */
    const responseData: {
      analysis: string;
      structured: Record<string, unknown>;
      model: string;
      mediaCount: { images: number; videos: number };
      pointsCharged: number;
      /** 扣费后的余额；`deductCredits` 在上游未返回余额时可能为 undefined（此时 JSON 里不出现该字段） */
      creditsBalance: number | undefined;
      /** true = 正文不完整（轮次用尽 / 预算不足 / 续写失败），前端必须提示 */
      truncated: boolean;
      /** true = 中止原因是总预算（DEEP_ANALYSIS_TOTAL_BUDGET_MS） */
      budgetExhausted: boolean;
      /** 实际发生的续写轮次（0 = 一次写完） */
      continueRounds: number;
      /** 本次请求实际墙钟耗时（毫秒），便于对照预算排障 */
      elapsedMs: number;
    } = {
      analysis: analysisClean,
      structured: structured || {},
      model: modelUsed,
      mediaCount: { images: images.length, videos: videoUrls.length },
      pointsCharged: cost.points,
      creditsBalance: deduction.credits,
      // true = 正文被截断（续写轮次用尽 / 预算不足 / 续写调用失败），前端应提示「报告未完整生成」
      truncated,
      // true = 截断原因是总预算不足，前端可提示「因时间预算限制被截断」
      budgetExhausted,
      continueRounds,
      elapsedMs: Date.now() - requestStartedAt,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });

  } catch (error: any) {
    console.error("[DeepAnalysis] 未处理异常:", error);
    return NextResponse.json({
      success: false,
      error: "AI深度分析暂时不可用，请稍后重试",
      code: "MANUAL_FALLBACK",
    }, { status: 500 });
  }
}
