/**
 * POST /api/agents/seller-helper/sales-strategy
 * AI 销售策略 —— 第四个 AI 能力模块（LLM 版，决策 A/B 落地）
 *
 * 流程：登录校验 → 检索上下文（内部实时 + 外部日报快照）→ 豆包生成结构化策略
 *       → 按量扣费（决策 B：实际 token × SystemConfig 系数，护栏熔断）→ 写 UsageLog
 *       → 关联线索/经销商候选并脱敏联系方式 → 返回。
 *
 * Body: { productId?, brandName?, modelName?, categoryName?, year?, location?,
 *         isChineseBrand?, text?, imageUrls?, videoUrls? }
 *
 * 合规：.cn 数据不出境 —— 仅调用国行火山方舟豆包；Lead/Dealer 联系方式默认脱敏，
 *       明文仅在 unlock-contact 路由按积分解锁。计费系数只从 SystemConfig 读取，
 *       代码不持有明文倍数（[商业机密·内部]）。
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { chatCompletionDoubao, getArkModelId } from "@/lib/ai/ark-client";
import { deductAiUsage, estimateAiCost } from "@/lib/credits/deduct";
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

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** 生成类名义预估 token（扣费前门槛展示 + 余额预检；真实成本以 LLM 实测 usage 为准） */
const SALES_STRATEGY_ESTIMATED_TOKENS = 3000;

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

    // 软门槛：余额不足（按名义预估）直接 402，避免浪费 LLM 调用
    const estimatedCost = await estimateAiCost(SALES_STRATEGY_ESTIMATED_TOKENS);
    if (user.credits < estimatedCost) {
      return NextResponse.json(
        {
          success: false,
          error:
            locale === "zh"
              ? "积分不足，请先充值后再生成 AI 销售策略"
              : "Insufficient credits. Please recharge first.",
          code: "INSUFFICIENT_CREDITS",
          rechargeUrl: `/${locale}/credits`,
          required: estimatedCost,
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
    const model = getArkModelId();
    let llmText = "";
    let actualTokens = 0;
    try {
      const res = await chatCompletionDoubao({
        model,
        maxTokens: 4096,
        timeoutMs: 85000,
        messages,
      });
      llmText = res.text || "";
      actualTokens = (res.usage?.prompt_tokens ?? 0) + (res.usage?.completion_tokens ?? 0);
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

    // ── 按量扣费（决策 B：实际 token × SystemConfig 系数；护栏熔断不扣费）──
    const deduction = await deductAiUsage({
      userId: user.id,
      action: "aiSalesStrategy",
      actualTokens: actualTokens || SALES_STRATEGY_ESTIMATED_TOKENS,
      reason: "AI销售策略",
      breakdown: {
        model,
        actualTokens,
        brand: finalBrand,
        modelName: ctx.product?.modelName || body.modelName || "",
        candidateCount: ctx.candidates.length,
      },
    });
    if (!deduction.ok) {
      if (deduction.code === "GUARDRAIL") {
        return NextResponse.json(
          {
            success: false,
            error:
              locale === "zh"
                ? "本次请求成本超出单次上限，已熔断（未扣费）。请简化输入或联系平台。"
                : "Request cost exceeded single-request cap; circuit-broken (no charge).",
            code: "GUARDRAIL",
            balance: deduction.balance,
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error:
            locale === "zh"
              ? "积分不足，请先充值后再生成 AI 销售策略"
              : "Insufficient credits.",
          code: "INSUFFICIENT_CREDITS",
          rechargeUrl: `/${locale}/credits`,
          required: deduction.cost,
          balance: deduction.balance,
        },
        { status: 402 }
      );
    }

    // ── 解析策略 JSON ──
    const strategy: StrategyLlmResult = parseStrategyResult(llmText);

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
        summary: strategy.summary || "",
        targetMarkets: strategy.targetMarkets || [],
        priceRange: strategy.priceRange || null,
        channels,
        compliance: strategy.compliance || null,
        actionChecklist: strategy.actionChecklist || [],
        responsibility: strategy.responsibility || null,
        scripts: strategy.scripts || [],
        listingChecklist: strategy.listingChecklist || [],
        model,
        estimatedCost,
        cost: deduction.cost,
        balance: deduction.balance,
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
