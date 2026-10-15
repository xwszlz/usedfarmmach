import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inquirySchema } from "@/lib/validators";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";
import { notifyInquiry } from "@/lib/email";
import { getQuotaUser, consumeQuota, quotaExceededResponse, rollbackQuota } from "@/lib/quota";
import { deductCredits } from "@/lib/credits/spend";

/** 从 referer / 路径推断 locale（与 quota guard / 各 AI 路由保持一致） */
function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) return m[1];
  return "zh";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = inquirySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { productId, name, email, phone, company, message } = parsed.data;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // Try to get logged-in user
    let buyerId: string | null = null;
    const token = getTokenFromHeaders(request.headers);
    if (token) {
      const user = await getUserFromToken(token);
      if (user) buyerId = user.id;
    }

    // ── P1-a 双闸门：额度(50/月) + 积分(1/次)（仅登录用户）──
    // 顺序：先 consumeQuota（超额→QUOTA_EXCEEDED），再 deductCredits（不足→INSUFFICIENT_CREDITS 并回滚额度）。
    let creditsRemaining: number | null = null;
    if (buyerId) {
      const qUser = await getQuotaUser(buyerId);
      if (qUser) {
        const q = await consumeQuota(qUser, "inquiry");
        if (!q.ok) return quotaExceededResponse(q.resetAt);
        const cost = await deductCredits(
          buyerId,
          1,
          "发送询盘",
          { action: "inquiry", quotaRemaining: q.remaining },
          "inquiry_cost",
        );
        if (!cost.ok) {
          await rollbackQuota(qUser, "inquiry");
          return NextResponse.json(
            {
              success: false,
              error: "积分不足，请先充值后再发送询盘",
              code: "INSUFFICIENT_CREDITS",
              rechargeUrl: `/${getLocaleFromRequest(request)}/credits`,
              required: cost.required,
              balance: cost.credits,
            },
            { status: 402 },
          );
        }
        creditsRemaining = cost.credits ?? null;
      }
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        productId,
        buyerId,
        name,
        email,
        phone,
        company,
        message,
      },
    });

    // 发送邮件通知管理员
    notifyInquiry({
      productName: `${product.modelName}`,
      buyerName: name,
      buyerContact: `${phone || ''} ${email || ''}`.trim(),
      buyerMessage: message || '',
    });

    return NextResponse.json({
      success: true,
      data: inquiry,
      creditsRemaining,
    });
  } catch (error) {
    console.error("Inquiry error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
