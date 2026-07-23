import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken, ensureJwtSecret, setTokenCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { grantRegisterGiftIfNeeded } from "@/lib/credits/grant";
import { sendVerificationEmail } from "@/lib/email-actions";

export async function POST(request: NextRequest) {
  ensureJwtSecret();
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { username, email, password, confirmPassword, phone, companyName, country, role, dataCrossBorderConsent } = parsed.data;

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: "Username already taken" },
        { status: 409 }
      );
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: "Email already registered" },
          { status: 409 }
        );
      }
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        ...(email ? { email } : {}),
        passwordHash,
        phone,
        companyName,
        country,
        role: role || "buyer",
        membershipTier: "free",
        // 邮箱待补全标记：有邮箱则 false，无邮箱（小程序等）则 true
        emailPending: email ? false : true,
        // 阶段0：注册即视为未验证，补全资料后置 true（自证）
        emailVerified: false,
        // 数据出境单独同意留痕（注册已强制勾选）
        consentCrossBorderAt: dataCrossBorderConsent ? new Date() : null,
        credits: 0,
        freeValuationsUsed: 0,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        companyName: true,
        country: true,
        preferredLanguage: true,
        credits: true,
        membershipTier: true,
        freeValuationsUsed: true,
        freeValuationsResetAt: true,
      },
    });

    // 统一幂等发放注册礼包（替代旧 credits:10 直写，口径统一为 registerGift=5）
    const gift = await grantRegisterGiftIfNeeded(user.id);
    const finalCredits = (user.credits ?? 0) + (gift.granted ? gift.amount : 0);

    // 阶段 1（T05）：注册成功且提供了邮箱并已勾选数据出境同意 → 自动发验证邮件
    // 邮件发送失败不影响注册成功（catch 兜底）。
    if (user.email && dataCrossBorderConsent) {
      try {
        await sendVerificationEmail({
          userId: user.id,
          email: user.email,
          locale: user.preferredLanguage || "zh",
          origin: request.nextUrl.origin,
        });
      } catch (emailErr: unknown) {
        console.error("Auto send verify email failed:", emailErr);
      }
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      tier: user.membershipTier,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          ...user,
          credits: finalCredits,
          membershipTier: user.membershipTier,
          freeValuationsUsed: user.freeValuationsUsed,
        },
      },
    });

    setTokenCookie(response, token);

    return response;
  } catch (error: any) {
    console.error("Register error:", error);
    const message = error?.code === "P2002"
      ? "Username or email already exists"
      : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
