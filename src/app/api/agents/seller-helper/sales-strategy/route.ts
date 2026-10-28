/**
 * POST /api/agents/seller-helper/sales-strategy
 * AI 销售策略 —— 第四个 AI 能力模块（LLM 版，决策 A/B 落地）
 *
 * 流程：登录校验 → 余额预检（成本加成口径）→ 检索上下文（内部实时 + 外部日报快照）
 *       → 豆包生成结构化策略 → rejected 不达标则重试 ≤1 次（PRD §3.3）
 *       → 按实际 token 的模型成本加成扣费（单次护栏熔断）→ 写 UsageLog
 *       → 关联线索/经销商候选并脱敏联系方式 → 返回。
 *
 * 计费口径（2026-10-28 统一）：与估值/识别/深度分析同一口径 ——
 *   `computeAiCost()` 按豆包实际 CNY 成本 × 运营定价倍率反算积分（`spend.ts` 的
 *   `AI_COST_MULTIPLIER`），再经 `deductCredits()` 落库扣减。
 *   另设策略专属「单次最低消费」（见 `SALES_STRATEGY_MIN_POINTS`）：策略是旗舰产品，
 *   单次收费不得低于深度分析。
 *   ⚠️ 运营倍率、护栏、最低消费这些**定价参数名与取值**不得以明文形式出现在响应体里
 *   （响应只回「本次实际扣了多少」的 `cost` 与余额；`__tests__/route.test.ts` 有断言守着）。
 *
 * 返回体：`...strategy` 展开透传（9 个老字段 + 12 个新增决策字段，arch §1.3）
 *         + channels（脱敏后覆盖）+ searchStatus / searchNote（PRD §6.5：前端黄条 +
 *         PDF/Excel 降级标注；前端卡片侧在传给导出按钮时映射为 `webStatus / webNote`）。
 *         ⚠️ 响应体**不**输出 rejectedAdequate：导出层 payload 无此字段、前端也不会透传
 *         ⇒ 会烂在 API 里。PDF 侧（T10）从 `bestDestinations[].rejected` 现算是纯函数，零成本。
 *
 * Body: { productId?, brandName?, modelName?, categoryName?, year?, location?,
 *         isChineseBrand?, text?, imageUrls?, videoUrls? }
 *
 * 合规：.cn 数据不出境 —— 仅调用国行火山方舟豆包；Lead/Dealer 联系方式默认脱敏，
 *       明文仅在 unlock-contact 路由解锁（2026-10-28 起免费，仍需责任确认 + PiiAuditLog 留痕）。
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { chatCompletionDoubao, getArkCircuitState, getArkModelId } from "@/lib/ai/ark-client";
import { computeAiCost, deductCredits } from "@/lib/credits/spend";
import { getAiCostGuardrail } from "@/lib/credits/config";
import { maskPhone, maskEmail } from "@/lib/pii";
import {
  retrieveStrategyContext,
  fetchLeadDealerContact,
  type StrategyContext,
  type LeadCandidate,
} from "@/lib/sales-strategy/retrieval";
import {
  buildStrategyMessages,
  isStrategyEmpty,
  parseStrategyResultDetailed,
  sanitizeStrategy,
  type StrategyLlmResult,
  type StrategyMessage,
} from "@/lib/sales-strategy/prompt";
import { WEB_STATUS_NOTE } from "@/lib/sales-strategy/strategy-schema";
import { resolveAiLocale, type AiLocale } from "@/lib/i18n/ai-locale";

export const dynamic = "force-dynamic";
//
// ═══════════════════════════════════════════════════════════════════════════════════
// ⚠️ 超时闸门两站不同（改下面任何一个预算常量前都必须读这段）：
//    `.com`：由本文件的 `maxDuration`(300s) 约束 —— **只有 Vercel 会读这个导出**；
//    `.cn` ：跑在阿里云 ECS 的 nginx 后面，Next.js standalone **根本不读 maxDuration**，
//            真正的闸门是 `deploy/nginx/conf.d/cn.conf` 的 `proxy_read_timeout`
//            —— 已从 180s 对齐到 **330s**（330 = 最大路由预算 300 + 30s 余量，本次同步改）。
//    改这里的预算前必须同步核对 nginx 那个值，否则 `.cn` 会被反代先掐断返 **504 HTML**
//    （前端拿到的是 HTML 而不是 JSON 错误，表现为"按钮转很久然后白屏/报错"）。
//    两站共同的天花板因此取 300s：`.com` 是 Vercel 硬上限口径，`.cn` 是 nginx 330s 减去 30s 余量。
// ═══════════════════════════════════════════════════════════════════════════════════
//
/**
 * 路由最长执行时间（**仅 `.com`/Vercel 生效**，见上方两站闸门说明）。
 *
 * ⚠️ 2026-11 修复（`.com` 上「AI 销售策略不能用」的头号成因）：
 *    旧值是 **90s**，而本路由要一次吐出 19 个字段（equipmentProfiles 1-8 条 +
 *    marketAnchors 每机型 3-8 格 + marketRanking 3-6 条 + complianceTasks 3-10 条 +
 *    dataSources 3-12 条 …），实测输出 3000-6000 中文 token；豆包 40-60 tok/s
 *    ⇒ 需要 75-150s，**必然越过 85s 的单次超时线** ⇒ 平台杀进程返 HTML 504。
 *    这里与 `deep-analysis/route.ts:58` 的 300s 对齐 —— 那条链路同样的输出量级，
 *    300s 一直工作正常，属于"已经被生产验证过的取值"。
 */
export const maxDuration = 300;

/**
 * 生成类名义预估 token —— 只用于两件事：① 给用户展示「本次约需 X 积分」
 * ② LLM 调用前提前拦掉余额明显不足的请求。
 *
 * ⚠️ 口径铁律（勿"对齐"成 8192）：
 *   - 这里估的是**期望输出量**，**不是** `maxTokens` 上限（8192 是 cap，按 cap 预检会把
 *     大量余额够用的正常用户挡在门外）；
 *   - **真实扣费恒按 LLM 实测 usage** 计（见下方 `computeAiCost({ inputTokens, outputTokens })`），
 *     本常量不参与计价，改它不会让任何用户多付一分钱；
 *   - 3000 → 4500 的原因：12 个决策字段让输出必然变长（+1200~2000 token），按老字段量级
 *     估属**系统性低估**；低估计的后果不是"少扣钱"，而是扣费环节在生成完成后返回
 *     余额不足 ⇒ 用户白等 80 秒只看到"积分不足"、内容全丢，平台还白烧一次 token（双输）。
 */
const SALES_STRATEGY_ESTIMATED_TOKENS = 4500;

/**
 * 预检用的**输入侧**典型规模（token）。
 * 实测 system 段约 2627 + user 段约 2360 ≈ 5000；取 4000 作为偏保守的典型值，
 * 与 `SALES_STRATEGY_ESTIMATED_TOKENS`（输出侧）一起按成本加成口径估算门槛。
 */
const SALES_STRATEGY_ESTIMATED_INPUT_TOKENS = 4000;

/**
 * 策略专属「单次最低消费」（积分）。
 *
 * 老板要求：AI 销售策略扣的积分必须高于 AI 深度分析。但策略与深度分析的实测成本区间重叠
 * （策略 output 3000–8192、深度分析输出量级相近），按纯成本加成算，策略并不天然更贵。
 * 故设此下限兜住「旗舰产品不得比深度分析更便宜」的产品规则。
 *
 * ⚠️ 这是**策略专属**规则，故放在本路由而非 `spend.ts`（那是全站共用计费层）。
 * ⚠️ 泄露铁律：本数值不得出现在 API 响应体里（`__tests__/route.test.ts` 有断言守着）。
 */
const SALES_STRATEGY_MIN_POINTS = 250;

/**
 * 首轮输出上限：12 个决策字段让输出显著变长（PM 估算 +1200~2000 token），
 * 4096 会把 bestDestinations / marketRanking 截断成半截 JSON ⇒ 提到 8192。
 *
 * ⚠️ 2026-11 再提到 **16384**：实测 19 个字段全量输出 3000-6000 中文 token，
 *    但 8192 在"机型 3 台以上 + 否决理由写细"的长尾请求里仍会被截断成半截 JSON；
 *    16384 与 `deep-analysis` 同口径（它 16384 稳定够用）。截断本身也已有兜底（续写 + 补全解析）。
 */
const SALES_STRATEGY_MAX_TOKENS = 16384;

/**
 * 单次 LLM 调用超时。
 *
 * ⚠️ 铁律：**单次超时必须小于路由的总闸门**（`.com` = maxDuration 300s；
 *    `.cn` = nginx `proxy_read_timeout` 330s），否则路由先被平台/反代杀掉，
 *    自身设置的超时永远等不到（表现为前端收到 HTML 504 而不是 JSON 错误）。
 *    旧值 85_000 是在 `maxDuration=90` 下算出来的，与 300s 的预算完全不匹配
 *    ⇒ 输出需要 75-150s 的请求 100% 超时。现取 240s（< 280s 总预算，留 40s 给续写/重试/扣费）。
 * ⚠️ 实际生效值还会被 `budgetedTimeout()` 按剩余预算再收一次（见下方），
 *    保证「首轮 + 续写 + 重试」的累计时间永远落在 `LLM_TOTAL_BUDGET_MS` 之内。
 */
const LLM_CALL_TIMEOUT_MS = 240_000;

/**
 * LLM 总预算（含首轮 + 续写 + rejected 重试），**从请求进入时开始计时**。
 *
 * ⚠️ 旧实现把 deadline 算成「检索完成之后的 88s」，于是最坏情况是
 *    「检索 20s + LLM 88s = 108s > maxDuration 90s」⇒ 平台直接杀进程返 HTML 504。
 *    现在 `llmDeadline = requestStartMs + LLM_TOTAL_BUDGET_MS`（**前置检索被算进同一份预算**），
 *    所以总墙钟时间恒定为：
 *
 *      [0 → 检索完成]  ⊆ 280s 预算之内（检索再慢也不会额外叠加）
 *      [检索完成 → LLM 结束] ≤ llmDeadline
 *      [LLM 结束 → 响应写出] ≈ 2-5s（扣费事务 + 联系方式查询 + 序列化）
 *      ⇒ 最坏总耗时 ≈ 285s
 *
 *    `.com`：285s < maxDuration 300s ✅
 *    `.cn` ：285s < nginx proxy_read_timeout 330s ✅（余量 45s）
 *
 *    如果将来把本值改大（例如 300s），必须同步把 nginx 的 `proxy_read_timeout`
 *    提到「本值 + 30s 余量」以上，否则 `.cn` 会先被反代掐断。
 */
const LLM_TOTAL_BUDGET_MS = 280_000;

/** 重试时最少需要的剩余预算，低于此值不再重试（否则必然超时被平台杀进程） */
const LLM_RETRY_MIN_REMAINING_MS = 15000;

/**
 * 截断续写：最多续写 2 轮（= 最多 3 段拼接，理论上可覆盖 ~48k token 的输出）。
 * 与 `deep-analysis/route.ts:40` 的 `DEEP_ANALYSIS_MAX_CONTINUE_ROUNDS` 对齐。
 */
const LLM_CONTINUE_MAX_ROUNDS = 2;

/** 续写至少需要的剩余预算：不够就不续写，直接按 truncated 返回（宁缺尾也不超时被杀） */
const LLM_CONTINUE_MIN_REMAINING_MS = 15_000;

/**
 * 截断续写指令（照 `deep-analysis` 的 `DEEP_ANALYSIS_CONTINUE_PROMPT` 思路，但目标不同）。
 *
 * 深度分析续写的是 **Markdown 正文**，本路由续写的是 **JSON**：
 * 因此必须强调「只补完 JSON 剩余部分、不要重开一个 `{`」，否则会拼出
 * `{...}{...}` 这种永远解析不出来的东西（补全算法也救不回来）。
 */
const SALES_STRATEGY_CONTINUE_PROMPT =
  "上面的 JSON 是你正在输出的 AI 销售策略，因单次输出长度上限被截断（不是内容写完了）。" +
  "请紧接着**截断的那个字符**继续输出剩余部分，严格要求：" +
  "① 严禁重复任何已输出的内容；② 不要输出任何解释、开场白或 Markdown 代码围栏；" +
  "③ **不要重新输出开头的 `{`，也不要重新输出已写过的键**，只从截断处继续补完剩下的键值对，" +
  "并在最后把尚未闭合的 `}` / `]` 补齐；④ 若某个字段已完整输出则跳过它，绝不要重复输出；" +
  "⑤ 输出必须是合法 JSON 的**剩余片段**，不得包含 `{` 之前的内容。";

/**
 * rejected 不达标时的追加指令（PRD §3.3：首轮不满足 ⇒ 重试 1 次并把缺失项点名要求补齐）。
 */
const REJECTED_RETRY_HINT =
  "【重试指令】上次输出的否决建议不达标：bestDestinations 中缺失 rejected，或全部停留在 L1（不建议/可暂缓）措辞。" +
  "请为**每个机型**至少给 1 条明确否决，并保证：① 至少 1 条达到 L2（千万别/不要碰/放弃/绝对不要）或 L3（禁入/法规禁止/不得出口）；" +
  "② L2 必须给 ≥2 条独立理由，L3 必须附具名法规/决议编号；③ 若本轮检索状态不是 ok，则禁止 L3。" +
  "其余字段结构与数量要求不变，仍然只输出一个 JSON 对象。";

// ═══════════════════════════════════════════════════════════
// 检索状态桥接（`webEvidence` 由 T07 在 retrieval.ts 中新增）
// ═══════════════════════════════════════════════════════════

/** 检索状态四档（PRD §6.3，与 strategy-schema.ts 的 WebEvidenceStatus 结构等价） */
type WebStatus = "ok" | "partial" | "timeout" | "disabled";

/** 本文件只读用到的 webEvidence 子集（结构等价声明，避免被 T07 的落地节奏阻塞） */
interface WebEvidenceLite {
  status?: WebStatus;
  note?: string;
  totalQueries?: number;
  elapsedMs?: number;
}

/**
 * 读取 `ctx.webEvidence`。
 *
 * ⚠️ 本文件**唯一**一处类型断言：`webEvidence` 由 T07 在 `retrieval.ts` 里新增，
 *    而本文件不能从 prompt.ts 引入新增的 `resolveWebStatus`（`__tests__/route.test.ts`
 *    对 `@/lib/sales-strategy/prompt` 做了模块级 mock，只提供 buildStrategyMessages /
 *    parseStrategyResult），故在此本地读一次。T07 落地后本断言会因结构一致而继续成立。
 */
function pickWebEvidence(ctx: StrategyContext): WebEvidenceLite {
  const raw = (ctx as unknown as { webEvidence?: WebEvidenceLite | null }).webEvidence;
  return raw && typeof raw === "object" ? raw : {};
}

/** 检索状态：缺失 / 非法值一律视为 `disabled`（绝不当 ok，否则前端不显黄条、prompt 不降级） */
function pickWebStatus(ctx: StrategyContext): WebStatus {
  const status = pickWebEvidence(ctx).status;
  if (status === "ok" || status === "partial" || status === "timeout" || status === "disabled") {
    return status;
  }
  return "disabled";
}

/** 前端黄条副标题文案（PRD §6.5：可展开「为什么没接上」显示 note 原文） */
function pickSearchNote(ctx: StrategyContext, status: WebStatus): string {
  if (status === "ok") return "";
  const note = pickWebEvidence(ctx).note;
  return typeof note === "string" && note.trim() ? note.trim() : WEB_STATUS_NOTE[status];
}

/**
 * 决断力达标判定（PRD §3.3 数量与分布硬指标 + §3.5 走过场检测器）。
 *
 * 四条任一不满足即判「不达标」⇒ 触发 1 次重试：
 *   ① 存在 bestDestinations 且每机型 ≥1 条 rejected；
 *   ② 全局 ≥1 条 L2 / L3（全 L1 = 等于没否决）；
 *   ③ 不得是「全员可考虑」软性输出（targetMarkets 无"低" + rejected 全 L1）；
 *   ④ bestDestinations 为空（老格式输出）也算不达标。
 */
function isRejectedAdequate(strategy: StrategyLlmResult | null | undefined): boolean {
  if (!strategy || typeof strategy !== "object") return false;

  const destinations = Array.isArray(strategy.bestDestinations) ? strategy.bestDestinations : [];
  if (!destinations.length) return false; // ④

  const everyEquipmentHasRejected = destinations.every(
    (d) => Array.isArray(d?.rejected) && d.rejected.length >= 1
  );
  if (!everyEquipmentHasRejected) return false; // ①

  const allRejected = destinations.flatMap((d) => (Array.isArray(d?.rejected) ? d.rejected : []));
  const hasStrongReject = allRejected.some((r) => r?.level === "L2" || r?.level === "L3");
  if (!hasStrongReject) return false; // ②

  const markets = Array.isArray(strategy.targetMarkets) ? strategy.targetMarkets : [];
  const noLowPriority = markets.length > 0 && markets.every((m) => m?.priority !== "低");
  const allL1 = allRejected.every((r) => !r?.level || r.level === "L1");
  if (noLowPriority && allL1) return false; // ③

  return true;
}

/**
 * 当前自然月起点（UsageLog.periodStart 口径，与额度月度窗口一致）
 */
function currentPeriodStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function POST(request: NextRequest) {
  /**
   * 请求入口时间戳：LLM 总预算从这里起算（含检索耗时），
   * 保证「检索 + LLM + 扣费」的总墙钟时间不超过 `LLM_TOTAL_BUDGET_MS < maxDuration`。
   */
  const requestStartMs = Date.now();
  /**
   * 输出语种：全站唯一决策入口（`src/lib/i18n/ai-locale.ts`，8 语种，`.cn` 收敛到 zh/en）。
   * 这里先不带 body 解析一次 —— 401 分支也要用 locale 回登录/充值链接，
   * 而 body 必须等鉴权通过后才读（未登录时不解析请求体）。读到 body 后再解析一次覆盖。
   */
  let locale: AiLocale = resolveAiLocale({ request }).locale;
  try {
    // ── 登录校验：按真实 token 计费，必须知道扣谁的积分别 ──
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: locale === "zh" ? "请先登录后再使用 AI 销售策略" : "Please sign in to use AI Sales Strategy",
          code: "LOGIN_REQUIRED",
          loginUrl: `/${locale}/auth/login`,
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      productId?: string;
      brandName?: string;
      modelName?: string;
      categoryName?: string;
      year?: number;
      location?: string;
      isChineseBrand?: boolean;
      text?: string;
      imageUrls?: string[];
      videoUrls?: string[];
      /** 前端当前 next-intl 语言（用户主动选的，语种决策优先级最高） */
      locale?: string;
    };

    // ── 输出语种：带上 body.locale 再解析一次（用户显式选择的语言最优先）──
    const localeDecision = resolveAiLocale({ bodyLocale: body?.locale, request });
    locale = localeDecision.locale;
    console.log(
      `[SalesStrategy] locale=%s source=%s`,
      localeDecision.locale,
      localeDecision.source
    );

    // ── 空内容守卫：text / imageUrls / videoUrls 全空则不触发检索与扣费 ──
    const hasText = typeof body.text === "string" && body.text.trim().length > 0;
    const hasImages = Array.isArray(body.imageUrls) && body.imageUrls.length > 0;
    const hasVideos = Array.isArray(body.videoUrls) && body.videoUrls.length > 0;
    if (!hasText && !hasImages && !hasVideos) {
      return NextResponse.json(
        {
          success: false,
          error:
            locale === "zh"
              ? "请提供文字描述、图片或视频中的至少一项"
              : "Please provide at least one of text, image, or video.",
          code: "MISSING_INPUT",
        },
        { status: 400 }
      );
    }

    // ── 检索上下文（内部实时 + 外部快照）──
    const ctx: StrategyContext = await retrieveStrategyContext({
      productId: body.productId,
      brandName: body.brandName,
      modelName: body.modelName,
      categoryName: body.categoryName,
      year: typeof body.year === "number" ? body.year : undefined,
      location: body.location,
      isChineseBrand: body.isChineseBrand,
    });

    const finalBrand = ctx.product?.brandName || body.brandName || "";

    // ── 模型 ID 提前解析：预检与扣费都要拿它查价格表，必须共用同一个变量（勿各写各的）──
    const model = getArkModelId();

    // 软门槛：余额不足（按成本加成口径预估）直接 402，避免浪费 LLM 调用。
    // 门槛取 max(预估成本, 单次最低消费)：否则余额落在 [预估成本, 最低消费) 区间的用户会
    // 先通过预检、白等 80 秒，再在扣费环节被 402 拦下 —— 那正是本预检要消灭的双输场景。
    const estCost = computeAiCost({
      model,
      inputTokens: SALES_STRATEGY_ESTIMATED_INPUT_TOKENS,
      outputTokens: SALES_STRATEGY_ESTIMATED_TOKENS,
    });
    const requiredPoints = Math.max(estCost.points, SALES_STRATEGY_MIN_POINTS);
    if (user.credits < requiredPoints) {
      return NextResponse.json(
        {
          success: false,
          error:
            locale === "zh"
              ? "积分不足，请先充值后再生成 AI 销售策略"
              : "Insufficient credits. Please recharge first.",
          code: "INSUFFICIENT_CREDITS",
          rechargeUrl: `/${locale}/credits`,
          required: requiredPoints,
          balance: user.credits,
        },
        { status: 402 }
      );
    }

    // ── 调用豆包生成结构化策略（统一国行 ARK 出口；.cn 数据不出境）──
    // ⚠️ 图片/视频在这里真正进入模型（`buildDoubaoContent` 下载转 base64 + 拼多模态数组）：
    //    旧实现收了 `imageUrls / videoUrls` 却完全没用，用户只传图不写字时 prompt 里几乎是空的
    //    ⇒ 模型只能编，还照扣 250 积分。`buildStrategyMessages` 现在是 async（要下载图片）。
    const messages: StrategyMessage[] = await buildStrategyMessages({
      ctx,
      text: body.text,
      locale,
      imageUrls: body.imageUrls,
      videoUrls: body.videoUrls,
    });
    // 响应字段沿用已上线的 `searchStatus / searchNote`（半公开契约：小程序端也在打这个接口，
    // 不改名以避开“静默破坏下游”）；前端卡片把它映射成导出层的 `webStatus / webNote`。
    const webStatus = pickWebStatus(ctx);
    const webEvidence = pickWebEvidence(ctx);
    const searchNote = pickSearchNote(ctx, webStatus);

    /** LLM 总预算截止时间（**从请求入口起算**，见 `LLM_TOTAL_BUDGET_MS` 注释） */
    const llmDeadline = requestStartMs + LLM_TOTAL_BUDGET_MS;

    /**
     * 本次调用可用的超时：`min(单次上限, 剩余预算 - 5s 收尾)`,且不低于 10s 底噪。
     *
     * 为什么要按剩余预算收：`LLM_CALL_TIMEOUT_MS`(240s) 本身小于总预算(280s)，
     * 但**首轮是在检索之后才发起的** —— 若检索花了 30s，首轮再吃满 240s 就到 270s，
     * 加上收尾（扣费事务 + 联系方式查询 + 序列化）就会贴近闸门。
     * 统一走这个函数后，任何一次调用都不可能越过 `llmDeadline`，总耗时恒定可控。
     */
    const budgetedTimeout = (): number => {
      const remaining = llmDeadline - Date.now();
      return Math.max(10_000, Math.min(LLM_CALL_TIMEOUT_MS, remaining - 5_000));
    };

    /**
     * 单次 LLM 调用的封装：把 usage 拆成 input/output 两段原样带回，并**透传 finishReason**。
     *
     * ⚠️ 必须保留 usage 拆分：成本加成按「输入单价 ≠ 输出单价」分别计价（输出单价是输入的 5 倍），
     *    合并成一个总数会让成本算错。
     * ⚠️ `finishReason` 必须透传：`ark-client` 一直有返回它，是旧版 `callLlm` 把它丢了
     *    ⇒ 「被 max_tokens 截断」这个信号在策略链路里从未被读到（这正是"JSON 半截 + 静默成功"的根源）。
     * ⚠️ `deadlineMs` 传给 `ark-client`：让它内部的 429/5xx 重试不能突破本路由的预算。
     */
    const callLlm = async (
      callMessages: Array<{ role: string; content: unknown }>,
      timeoutMs: number
    ): Promise<{
      text: string;
      promptTokens: number;
      completionTokens: number;
      finishReason?: string;
    }> => {
      const res = await chatCompletionDoubao({
        model,
        maxTokens: SALES_STRATEGY_MAX_TOKENS,
        timeoutMs,
        deadlineMs: llmDeadline,
        messages: callMessages,
      });
      return {
        text: res.text || "",
        promptTokens: res.usage?.prompt_tokens ?? 0,
        completionTokens: res.usage?.completion_tokens ?? 0,
        finishReason: res.finishReason,
      };
    };

    /** 累计两段 token：首轮 + 续写 + rejected 重试（每一次真实调用都必须计价） */
    let promptTokens = 0;
    let completionTokens = 0;
    let llmCalls = 0;
    /** 用尽续写轮次仍被截断（响应里回传，便于排障；不影响扣费口径） */
    let truncated = false;

    /**
     * 「一次完整生成」= 首轮 + 截断续写轮次。
     *
     * 为什么必须续写：这份 JSON 要装 19 个字段，实测 3000-6000 中文 token；
     * 单次 `max_tokens=16384` 在长尾请求里仍会被截断，而**截断的 JSON = 零内容**。
     * 续写策略照 `deep-analysis` 的成熟做法，但针对 JSON 改写指令（见 `SALES_STRATEGY_CONTINUE_PROMPT`）。
     *
     * @param callMessages 本次生成的完整消息序列（含 system）
     * @returns 拼接后的文本与累计 token（含续写消耗）
     */
    const runGeneration = async (
      callMessages: Array<{ role: string; content: unknown }>
    ): Promise<{ text: string; finishReason?: string }> => {
      const first = await callLlm(callMessages, budgetedTimeout());
      llmCalls += 1;
      promptTokens += first.promptTokens;
      completionTokens += first.completionTokens;
      let text = first.text;
      let finishReason = first.finishReason;
      let rounds = 0;

      while (finishReason === "length" && rounds < LLM_CONTINUE_MAX_ROUNDS) {
        const remaining = llmDeadline - Date.now();
        if (remaining < LLM_CONTINUE_MIN_REMAINING_MS) {
          // 预算不够再来一轮：宁可按 truncated 返回（有补全解析兜底），也不要被平台杀成 HTML 504
          console.warn(
            `[SalesStrategy] 截断需续写但剩余预算不足(${remaining}ms)，放弃续写并标记 truncated`
          );
          truncated = true;
          break;
        }
        rounds += 1;
        console.warn(
          `[SalesStrategy] 输出被 max_tokens 截断(finish_reason=length)，第 ${rounds}/${LLM_CONTINUE_MAX_ROUNDS} 次续写`
        );
        const cont = await callLlm(
          [
            ...callMessages,
            { role: "assistant" as const, content: text },
            { role: "user" as const, content: SALES_STRATEGY_CONTINUE_PROMPT },
          ],
          budgetedTimeout()
        );
        llmCalls += 1;
        promptTokens += cont.promptTokens;
        completionTokens += cont.completionTokens;
        text += cont.text;
        finishReason = cont.finishReason;
      }
      if (finishReason === "length") truncated = true;
      return { text, finishReason };
    };

    let llmText = "";
    try {
      const firstRun = await runGeneration(messages);
      llmText = firstRun.text;

      /**
       * ── rejected 不达标 ⇒ 重试 ≤1 次（PRD §3.3：不达标严禁静默通过）──
       *
       * ⚠️ 关键修复：**解析失败不得触发重试**。
       *    旧代码是 `if (!isRejectedAdequate(parseStrategyResult(llmText)))`，
       *    而解析失败返回 `{}` ⇒ 必然 false ⇒ 立刻再打一次同样的 16384 token 请求：
       *    时间翻倍、费用翻倍，且第二次大概率先超时。现在只有「首轮 JSON 可解析且非空」才进达标判断；
       *    解析失败直接走下方 502（不扣费、不重试）。
       */
      const firstOutcome = parseStrategyResultDetailed(llmText);
      const firstStrategy = sanitizeStrategy(firstOutcome.strategy);
      const firstParsedOk = !isStrategyEmpty(firstStrategy);

      if (firstParsedOk && !isRejectedAdequate(firstStrategy)) {
        const remaining = llmDeadline - Date.now();
        if (remaining > LLM_RETRY_MIN_REMAINING_MS) {
          try {
            const retryRun = await runGeneration([
              ...messages,
              { role: "user", content: REJECTED_RETRY_HINT },
            ]);
            const retryOutcome = parseStrategyResultDetailed(retryRun.text);
            const retryStrategy = sanitizeStrategy(retryOutcome.strategy);
            // 重试结果可用才覆盖首轮：解析为空时宁可保留首轮的可用结果（不能把好结果换成空）
            if (!isStrategyEmpty(retryStrategy)) {
              llmText = retryRun.text;
            }
            console.warn(
              `[SalesStrategy] rejected 不达标已重试 1 次，结果采用=${!isStrategyEmpty(retryStrategy) ? "重试轮" : "首轮"}`
            );
          } catch (retryErr: any) {
            // 重试失败不阻断主链路：保留首轮结果（渲染层会有告警条兜底）
            console.warn("[SalesStrategy] rejected 重试失败(沿用首轮结果):", retryErr?.message);
          }
        } else {
          console.warn(
            `[SalesStrategy] rejected 不达标但剩余预算不足(${remaining}ms)，跳过重试`
          );
        }
      }
    } catch (err: any) {
      // 可观测性：旧版只打 err.message ⇒ 线上永远只看到同一句 LLM_FAILED，
      // 分不清是「熔断短路」「401 鉴权」「参数越界」还是「超时」。补齐可判别字段。
      // 只打响应体前 300 字符且不含任何凭据（Bearer 已由 axios 放在请求头，不在 body 里）。
      console.error("[SalesStrategy] LLM 调用失败:", {
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
        body:
          typeof err?.response?.data === "string"
            ? err.response.data.slice(0, 300)
            : undefined,
        circuit: getArkCircuitState(),
        llmCalls,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            locale === "zh"
              ? "AI 策略生成服务暂时不可用，请稍后重试"
              : "AI strategy service unavailable, please retry.",
          code: "LLM_FAILED",
          retryable: true,
        },
        { status: 503 }
      );
    }

    // ── 解析 + 类型清洗 + 实质空判定（**必须在扣费之前**）──
    // 旧实现的顺序是「先扣 250 积分 → 再解析 → 解析失败 `{}` → 展开成空策略 → 返回 success:true」，
    // 用户花 250 积分买到一张空表。现在：解析不出实质内容 ⇒ 502 + 明确提示 + **一分不扣**。
    const parseOutcome = parseStrategyResultDetailed(llmText);
    const strategy: StrategyLlmResult = sanitizeStrategy(parseOutcome.strategy);
    if (isStrategyEmpty(strategy)) {
      console.error(
        `[SalesStrategy] LLM 输出无法解析出任何字段（len=${llmText.length}, truncated=${parseOutcome.truncated || truncated}, repaired=${parseOutcome.repaired}），未扣费`
      );
      return NextResponse.json(
        {
          success: false,
          code: "LLM_UNPARSEABLE",
          error:
            locale === "zh"
              ? "AI 返回内容无法解析，本次未扣除积分，请重试"
              : "The AI response could not be parsed. You were not charged — please retry.",
          retryable: true,
          debug: { textLength: llmText.length, sample: llmText.slice(0, 300) },
        },
        { status: 502 }
      );
    }

    // ── 扣费：成本加成口径（与实际模型成本 × 运营定价倍率挂钩，币种全球统一 CNY）──
    // 实际 token（首轮 + 续写 + 重试）先按「输入单价 / 输出单价」分别算成本，得到 cost.points。
    const cost = computeAiCost({
      model,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
    });
    // 策略专属最低消费（见常量注释）；实际扣减以此为准。
    const finalPoints = Math.max(cost.points, SALES_STRATEGY_MIN_POINTS);

    // 防御性护栏：成本加成下正常单次成本远低于此上限，护栏实际永不触发，
    // 保留只为在「模型价目表被误改 / usage 异常暴涨」时兜住失控请求。
    // 注意比的是 finalPoints（真正要扣的钱），不是 cost.points —— 否则最低消费一旦高过
    // 护栏，就会出现「实际扣费 > 护栏」的漏洞。
    const guardrail = await getAiCostGuardrail();
    if (finalPoints > guardrail) {
      return NextResponse.json(
        {
          success: false,
          error:
            locale === "zh"
              ? "本次请求成本超出单次上限，已熔断（未扣费）。请简化输入或联系平台。"
              : "Request cost exceeded single-request cap; circuit-broken (no charge).",
          code: "GUARDRAIL",
          balance: user.credits,
        },
        { status: 429 }
      );
    }

    const deduction = await deductCredits(user.id, finalPoints, "AI销售策略", {
      ...cost,
      brand: finalBrand,
      modelName: ctx.product?.modelName || body.modelName || "",
      candidateCount: ctx.candidates.length,
      // PRD §6.6：检索耗时与次数写入 breakdown，供后续定价（检索按 query 计费）
      searchQueries: typeof webEvidence.totalQueries === "number" ? webEvidence.totalQueries : 0,
      searchMs: typeof webEvidence.elapsedMs === "number" ? webEvidence.elapsedMs : 0,
      searchStatus: webStatus,
      // 实际发生过的 LLM 调用次数（>2 说明发生了续写或重试；>3 说明两者都有）
      llmCalls,
      rejectedRetried: llmCalls > 1,
      truncated: parseOutcome.truncated || truncated,
      repaired: parseOutcome.repaired,
      locale,
      // 审计：两段 token 与实际计费点数分开留痕，便于对账
      promptTokens,
      completionTokens,
      chargedPoints: finalPoints,
    });
    if (!deduction.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            locale === "zh"
              ? "积分不足，请先充值后再生成 AI 销售策略"
              : "Insufficient credits.",
          code: "INSUFFICIENT_CREDITS",
          rechargeUrl: `/${locale}/credits`,
          required: deduction.required ?? finalPoints,
          balance: deduction.credits ?? 0,
        },
        { status: 402 }
      );
    }

    // ── 关联线索/经销商候选（按 LLM 返回的 candidateId 取脱敏联系方式）──
    // ⚠️ `strategy` 已在扣费前解析并过 `sanitizeStrategy`（数组字段保证是「对象数组」），
    //    这里的 `Array.isArray` 是第二道闸：任何上游改动都不得让 `for...of` 吃到非数组。
    const candidateMap = new Map<string, LeadCandidate>(ctx.candidates.map((c) => [c.id, c]));
    const channels: Array<{
      candidateId: string;
      type: "lead" | "dealer";
      name: string;
      brand: string | null;
      model: string | null;
      region: string | null;
      rationale: string;
      phoneMasked: string;
      wechatMasked: string;
      emailMasked: string;
    }> = [];

    const llmChannels = Array.isArray(strategy.channels) ? strategy.channels : [];
    for (const ch of llmChannels) {
      if (!ch || typeof ch.candidateId !== "string") continue;
      const cand = candidateMap.get(ch.candidateId);
      if (!cand) continue; // 丢弃 LLM 幻觉出的未知候选
      const contact = await fetchLeadDealerContact(ch.candidateId);
      channels.push({
        candidateId: ch.candidateId,
        type: ch.type === "dealer" || ch.type === "lead" ? ch.type : cand.type,
        name: cand.name,
        brand: cand.brand,
        model: cand.model,
        region: cand.region,
        rationale: typeof ch.rationale === "string" ? ch.rationale : "",
        phoneMasked: contact?.phone ? maskPhone(contact.phone) : "",
        wechatMasked: contact?.wechat ? "微信:********" : "",
        emailMasked: contact?.email ? maskEmail(contact.email) : "",
      });
    }

    // ── 写 UsageLog（动作审计，不影响扣费；失败非致命）──
    try {
      await prisma.usageLog.create({
        data: { userId: user.id, action: "aiSalesStrategy", periodStart: currentPeriodStart() },
      });
    } catch (e) {
      console.warn("[SalesStrategy] UsageLog 写入失败(非致命):", (e as Error)?.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        // ── 12 个新增决策字段：靠展开透传，避免再被字段白名单丢掉（arch §1.3）──
        // `strategy` 已过 `sanitizeStrategy()`（类型全部收敛），前端与 PDF/Excel 可安全 `.map()`
        ...strategy,
        // ── 9 个老字段保持"永不 undefined"的既有契约（前端直接读，不做空值判断）──
        // ⚠️ 每个数组字段都补 `Array.isArray`：模型偶尔把 targetMarkets 返回成字符串，
        //    直接 `|| []` 会把字符串原样透传 ⇒ 前端 `.map()` 白屏。这里是**响应体最后一道闸**。
        summary: typeof strategy.summary === "string" ? strategy.summary : "",
        targetMarkets: Array.isArray(strategy.targetMarkets) ? strategy.targetMarkets : [],
        priceRange: strategy.priceRange && typeof strategy.priceRange === "object" ? strategy.priceRange : null,
        // channels 显式覆盖：用脱敏后的版本，绝不回传 LLM 原始 channels（保持既有脱敏逻辑）
        channels,
        compliance: strategy.compliance && typeof strategy.compliance === "object" ? strategy.compliance : null,
        actionChecklist: Array.isArray(strategy.actionChecklist) ? strategy.actionChecklist : [],
        responsibility:
          strategy.responsibility && typeof strategy.responsibility === "object"
            ? strategy.responsibility
            : null,
        scripts: Array.isArray(strategy.scripts) ? strategy.scripts : [],
        listingChecklist: Array.isArray(strategy.listingChecklist) ? strategy.listingChecklist : [],
        // ── 检索状态：沿用已上线的响应字段名 `searchStatus / searchNote`（半公开契约，不改名）──
        // 供前端顶部黄条与 PDF/Excel 的「外部证据未接入」标注（PRD §6.5）；
        // ok 时 searchNote 为空串，前端据此不渲染任何提示。
        searchStatus: webStatus,
        searchNote,
        model,
        // 输出是否**最终仍**因 max_tokens 被截断（续写补齐了就是 false；前端可提示"内容可能不完整"）
        truncated: parseOutcome.truncated || truncated,
        // 本次实际发生的 LLM 调用次数（1=一次成；2=续写或重试；3+=两者都有）—— 排障与验证用
        llmCalls,
        // 输出语种（前端排障用：确认 8 语种是否真的生效）
        locale,
        // 预检门槛积分（= 余额门槛，前端据此展示「约需 X 积分」，与真实扣费口径一致）
        estimatedCost: requiredPoints,
        // 本次实际扣减积分（成本加成结果，已含策略最低消费）
        cost: finalPoints,
        balance: deduction.credits ?? 0,
        realtimeExternal: ctx.realtimeExternal,
        dataDate: ctx.dailyReport?.date || null,
      },
    });
  } catch (error: any) {
    console.error("[SalesStrategy] 未处理异常:", error?.message);
    return NextResponse.json(
      {
        success: false,
        error:
          locale === "zh"
            ? "AI 销售策略生成失败，请稍后重试"
            : "Failed to generate AI sales strategy.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
