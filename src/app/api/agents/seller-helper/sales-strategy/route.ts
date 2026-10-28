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
 *       明文仅在 unlock-contact 路由按积分解锁。
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { chatCompletionDoubao, getArkModelId } from "@/lib/ai/ark-client";
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
  parseStrategyResult,
  type StrategyLlmResult,
} from "@/lib/sales-strategy/prompt";
import { WEB_STATUS_NOTE } from "@/lib/sales-strategy/strategy-schema";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

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
 */
const SALES_STRATEGY_MAX_TOKENS = 8192;

/** 单次 LLM 调用超时（与既有值一致） */
const LLM_CALL_TIMEOUT_MS = 85000;

/** LLM 总预算（maxDuration=90s，含检索与渲染余量；重试只允许在预算内追加 1 次） */
const LLM_TOTAL_BUDGET_MS = 88000;

/** 重试时最少需要的剩余预算，低于此值不再重试（否则必然超时被平台杀进程） */
const LLM_RETRY_MIN_REMAINING_MS = 15000;

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

function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) return m[1];
  return "zh";
}

/** 当前自然月起点（UsageLog.periodStart 口径，与额度月度窗口一致） */
function currentPeriodStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function POST(request: NextRequest) {
  const locale = getLocaleFromRequest(request);
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
    };

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
    const messages = buildStrategyMessages({
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

    /**
     * 单次 LLM 调用的封装：把 usage 拆成 input/output 两段原样带回。
     *
     * ⚠️ 必须保留拆分：成本加成按「输入单价 ≠ 输出单价」分别计价（输出单价是输入的 5 倍），
     *    合并成一个总数会让成本算错；重试的 token 也必须由调用方累加计入（见下方 `+=`）。
     */
    const callLlm = async (
      callMessages: Array<{ role: string; content: string }>,
      timeoutMs: number
    ): Promise<{ text: string; promptTokens: number; completionTokens: number }> => {
      const res = await chatCompletionDoubao({
        model,
        maxTokens: SALES_STRATEGY_MAX_TOKENS,
        timeoutMs,
        messages: callMessages,
      });
      return {
        text: res.text || "",
        promptTokens: res.usage?.prompt_tokens ?? 0,
        completionTokens: res.usage?.completion_tokens ?? 0,
      };
    };

    let llmText = "";
    // 累计两段 token：首轮 + 重试（重试是真实发生的第二次 LLM 调用，必须一起计价）
    let promptTokens = 0;
    let completionTokens = 0;
    let llmCalls = 0;
    const llmDeadline = Date.now() + LLM_TOTAL_BUDGET_MS;
    try {
      const first = await callLlm(messages, LLM_CALL_TIMEOUT_MS);
      llmText = first.text;
      promptTokens += first.promptTokens;
      completionTokens += first.completionTokens;
      llmCalls = 1;

      // ── rejected 不达标 ⇒ 重试 ≤1 次（PRD §3.3：不达标严禁静默通过）──
      if (!isRejectedAdequate(parseStrategyResult(llmText))) {
        const remaining = llmDeadline - Date.now();
        if (remaining > LLM_RETRY_MIN_REMAINING_MS) {
          try {
            const retry = await callLlm(
              [...messages, { role: "user", content: REJECTED_RETRY_HINT }],
              Math.min(LLM_CALL_TIMEOUT_MS, remaining - 3000)
            );
            llmText = retry.text;
            promptTokens += retry.promptTokens;
            completionTokens += retry.completionTokens;
            llmCalls = 2;
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
      console.error("[SalesStrategy] LLM 调用失败:", err?.message);
      return NextResponse.json(
        {
          success: false,
          error:
            locale === "zh"
              ? "AI 策略生成服务暂时不可用，请稍后重试"
              : "AI strategy service unavailable, please retry.",
          code: "LLM_FAILED",
        },
        { status: 503 }
      );
    }

    // ── 扣费：成本加成口径（与实际模型成本 × 运营定价倍率挂钩，币种全球统一 CNY）──
    // 实际 token（首轮 + 重试）先按「输入单价 / 输出单价」分别算成本，得到 cost.points。
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
      rejectedRetried: llmCalls > 1,
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

    // ── 解析策略 JSON ──
    const parsedStrategy = parseStrategyResult(llmText);
    const strategy: StrategyLlmResult =
      parsedStrategy && typeof parsedStrategy === "object" ? parsedStrategy : {};

    // ── 关联线索/经销商候选（按 LLM 返回的 candidateId 取脱敏联系方式）──
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

    for (const ch of strategy.channels || []) {
      const cand = candidateMap.get(ch.candidateId);
      if (!cand) continue; // 丢弃 LLM 幻觉出的未知候选
      const contact = await fetchLeadDealerContact(ch.candidateId);
      channels.push({
        candidateId: ch.candidateId,
        type: ch.type || cand.type,
        name: cand.name,
        brand: cand.brand,
        model: cand.model,
        region: cand.region,
        rationale: ch.rationale || "",
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
        ...strategy,
        // ── 9 个老字段保持"永不 undefined"的既有契约（前端直接读，不做空值判断）──
        summary: strategy.summary || "",
        targetMarkets: strategy.targetMarkets || [],
        priceRange: strategy.priceRange || null,
        // channels 显式覆盖：用脱敏后的版本，绝不回传 LLM 原始 channels（保持既有脱敏逻辑）
        channels,
        compliance: strategy.compliance || null,
        actionChecklist: strategy.actionChecklist || [],
        responsibility: strategy.responsibility || null,
        scripts: strategy.scripts || [],
        listingChecklist: strategy.listingChecklist || [],
        // ── 检索状态：沿用已上线的响应字段名 `searchStatus / searchNote`（半公开契约，不改名）──
        // 供前端顶部黄条与 PDF/Excel 的「外部证据未接入」标注（PRD §6.5）；
        // ok 时 searchNote 为空串，前端据此不渲染任何提示。
        searchStatus: webStatus,
        searchNote,
        model,
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
