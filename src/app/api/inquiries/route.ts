import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inquirySchema } from "@/lib/validators";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";
import { notifyInquiry } from "@/lib/email";

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
    });
  } catch (error) {
    console.error("Inquiry error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
