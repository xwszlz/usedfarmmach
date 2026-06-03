import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken, ensureJwtSecret, setTokenCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { membershipConfig } from "@/lib/permissions";

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

    const { username, email, password, confirmPassword, phone, companyName, country, role } = parsed.data;

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
    const freeCredits = membershipConfig.free.credits;
    const freeValuations = membershipConfig.free.freeValuationsPerMonth;

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        phone,
        companyName,
        country,
        role: role || "buyer",
        membershipTier: "free",
        credites: freeCredits,
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
        credites: true,
        membershipTier: true,
        freeValuationsUsed: true,
        freeValuationsResetAt: true,
      },
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
          ...user,
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
