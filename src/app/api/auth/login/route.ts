import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, signToken, ensureJwtSecret, setTokenCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  ensureJwtSecret();
  try {
  const body = await request.json();
  const { identifier, password } = body;  // identifier = username or email

  if (!identifier || !password) {
    return NextResponse.json(
      { success: false, error: "Username/email and password required" },
      { status: 400 }
    );
  }

  // 支持用户名或邮箱登录
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { username: identifier },
      ],
    },
  });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Account disabled" },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

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
          id: user.id,
          email: user.email,
          role: user.role,
          companyName: user.companyName,
          country: user.country,
          preferredLanguage: user.preferredLanguage,
          credits: user.credits,
          membershipTier: user.membershipTier,
          membershipExpiresAt: user.membershipExpiresAt,
          freeValuationsUsed: user.freeValuationsUsed,
        },
      },
    });

    // 写入 HTTP-only cookie（供中间件 SSR 读取）
    setTokenCookie(response, token);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
