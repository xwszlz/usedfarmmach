/**
 * POST /api/agents/seller-helper/sales-strategy/unlock-contact
 * 解锁线索/经销商明文联系方式（2026-10-28 口径：**免费**，不再按积分收费）
 *
 * 计费：无。历史上按 viewcontact_cost 固定名义 token 计费（800），现已取消：
 *       联系方式是成交的最后一公里，收费挡的是付费用户，收益远小于流失。
 *       如需恢复收费，请按 `@/lib/credits/spend` 的「成本加成」口径新写一段（旧的
 *       `@/lib/credits/deduct` 已于 2026-10-31 随 `ai_cost_coeff` 退役被整体删除）。
 * 合规：明文联系方式仍强制「责任声明二次确认」后返回，并写 PiiAuditLog 留痕
 *       （免费 ≠ 无审计：谁、何时、读了哪个线索的哪个字段，必须可追溯）。
 *
 * Body: { candidateId: "lead_xxx" | "dealer_xxx", responsibilityConfirmed: true }
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchLeadDealerContact } from "@/lib/sales-strategy/retrieval";

export const dynamic = "force-dynamic";

function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) return m[1];
  return "zh";
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

    // 已取消积分预检与扣费：解锁免费（余额为 0 也可解锁），故这里不再有任何余额门槛。
    // 保留 user.credits 仅用于响应里回报当前余额，供前端展示。
    const balance = user.credits ?? 0;

    const contact = await fetchLeadDealerContact(body.candidateId);
    if (!contact) {
      return NextResponse.json(
        { success: false, error: locale === "zh" ? "线索不存在或已失效" : "Lead not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // ── 免费解锁（2026-10-28 口径）：不扣分、不写 CreditTransaction ──
    // 旧实现此处调 deductAiUsage(action="unlockContact")，按 800 名义 token 扣费；
    // 现已取消。`@/lib/credits/deduct` 已于 2026-10-31 随 `ai_cost_coeff` 退役整体删除，
    // 本路由不再依赖它（导出链路同样已免费，不再有任何按量计费的下游）。

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
        // 免费：cost 恒为 0（保留字段名以兼容既有前端与日志解析）
        cost: 0,
        balance,
        free: true,
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
