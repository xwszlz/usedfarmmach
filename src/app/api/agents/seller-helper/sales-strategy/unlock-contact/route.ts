/**
 * POST /api/agents/seller-helper/sales-strategy/unlock-contact
 * 付费解锁线索/经销商明文联系方式（决策 B：viewcontact_cost 计费）
 *
 * 计费：单次固定预估 token（UNLOCK_ESTIMATED_TOKENS）× SystemConfig 系数；
 *       系数/护栏只从 SystemConfig 读取（[商业机密·内部]），代码不持有明文倍数。
 * 合规：明文联系方式仅在付费解锁后返回，并写 PiiAuditLog 留痕；
 *       responsibilityConfirmed 必须为真（二次确认责任声明）。
 *
 * Body: { candidateId: "lead_xxx" | "dealer_xxx", responsibilityConfirmed: true }
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deductAiUsage, estimateAiCost, UNLOCK_ESTIMATED_TOKENS } from "@/lib/credits/deduct";
import { fetchLeadDealerContact } from "@/lib/sales-strategy/retrieval";

export const dynamic = "force-dynamic";

function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) return m[1];
  return "zh";
}

function rechargeResp(locale: string, required: number, balance: number, status: number, code: string) {
  return NextResponse.json(
    {
      success: false,
      error:
        locale === "zh"
          ? "积分不足，请先充值后再解锁联系方式"
          : "Insufficient credits. Please recharge first.",
      code,
      rechargeUrl: `/${locale}/credits`,
      required,
      balance,
    },
    { status }
  );
}

export async function POST(request: NextRequest) {
  const locale = getLocaleFromRequest(request);
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: locale === "zh" ? "请先登录后再解锁联系方式" : "Please sign in to unlock contacts",
          code: "LOGIN_REQUIRED",
          loginUrl: `/${locale}/auth/login`,
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      candidateId?: string;
      responsibilityConfirmed?: boolean;
    };

    if (!body.candidateId) {
      return NextResponse.json(
        { success: false, error: locale === "zh" ? "缺少 candidateId" : "Missing candidateId", code: "NO_CANDIDATE" },
        { status: 400 }
      );
    }
    // 责任声明二次确认：防止误点导致明文 PII 外发
    if (body.responsibilityConfirmed !== true) {
      return NextResponse.json(
        {
          success: false,
          error:
            locale === "zh"
              ? "请先确认责任声明（跨境/数据合规由买卖方自担）再解锁"
              : "Please confirm the responsibility statement before unlocking",
          code: "RESPONSIBILITY_REQUIRED",
        },
        { status: 400 }
      );
    }

    // 余额预检（按固定预估 token）
    const est = await estimateAiCost(UNLOCK_ESTIMATED_TOKENS);
    if (user.credits < est) {
      return rechargeResp(locale, est, user.credits, 402, "INSUFFICIENT_CREDITS");
    }

    const contact = await fetchLeadDealerContact(body.candidateId);
    if (!contact) {
      return NextResponse.json(
        { success: false, error: locale === "zh" ? "线索不存在或已失效" : "Lead not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // ── 按量扣费（决策 B）──
    const deduction = await deductAiUsage({
      userId: user.id,
      action: "unlockContact",
      estimatedTokens: UNLOCK_ESTIMATED_TOKENS,
      reason: "解锁销售线索联系方式",
      breakdown: { candidateId: body.candidateId, type: contact.type, productId: contact.productId },
    });
    if (!deduction.ok) {
      if (deduction.code === "GUARDRAIL") {
        return NextResponse.json(
          {
            success: false,
            error:
              locale === "zh"
                ? "本次解锁成本超出单次上限，已熔断（未扣费）"
                : "Unlock cost exceeded single-request cap; circuit-broken (no charge).",
            code: "GUARDRAIL",
            balance: deduction.balance,
          },
          { status: 429 }
        );
      }
      return rechargeResp(locale, deduction.cost, deduction.balance, 402, "INSUFFICIENT_CREDITS");
    }

    // ── PII 审计留痕（谁、何时、读了哪个线索的哪个字段、用途）──
    try {
      await prisma.piiAuditLog.create({
        data: {
          actorId: user.id,
          targetListingId: contact.productId ?? null,
          field: `unlock:${body.candidateId}`,
          action: "view_full",
          purpose: "ai_sales_strategy_unlock",
        },
      });
    } catch (e) {
      console.warn("[UnlockContact] PiiAuditLog 写入失败(非致命):", (e as Error)?.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        candidateId: body.candidateId,
        type: contact.type,
        name: contact.name,
        phone: contact.phone,
        wechat: contact.wechat,
        email: contact.email,
        cost: deduction.cost,
        balance: deduction.balance,
      },
    });
  } catch (error: any) {
    console.error("[UnlockContact] 未处理异常:", error?.message);
    return NextResponse.json(
      { success: false, error: locale === "zh" ? "解锁失败，请稍后重试" : "Unlock failed", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
