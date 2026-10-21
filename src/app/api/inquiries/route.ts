import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inquirySchema } from "@/lib/validators";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";
import { notifyInquiry } from "@/lib/email";
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

    // ── 询盘仅需积分闸门：按积分扣减（无每月次数上限）──
    let creditsRemaining: number | null = null;
    if (buyerId) {
      const cost = await deductCredits(
        buyerId,
        1,
        "发送询盘",
        { action: "inquiry" },
        "inquiry_cost",
      );
      if (!cost.ok) {
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
