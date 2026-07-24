/**
 * GET /api/user/me —— 本人账户真实数据（P0 I-1）
 *
 * 设计依据：《用户体系完善方案_2026-07-24》§3.1 I-1。
 *
 * 鉴权：复用 getUserFromRequest —— 优先 Authorization header，回退到 httpOnly cookie。
 *   真实登录态由 middleware / login 写入 httpOnly cookie（token），浏览器对同源请求
 *   自动附带，无需前端读取 localStorage（前端也无从读取 httpOnly cookie）。
 *
 * 返回：本人真实 { id, email, username, role, credits, membershipTier,
 *   membershipExpiresAt, emailVerified, lifetime, ... }。
 *
 * 错误码：
 *   401 未登录（cookie 缺失/无效/已过期，或账号被禁用）
 *   500 服务器内部错误
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1) 会话鉴权（cookie 优先，兼容 Authorization header）
    const authUser = await getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "未登录" },
        { status: 401 }
      );
    }

    // 2) 取本人完整真实字段（含 emailVerified / lifetime 等 getUserFromRequest 未选字段）
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        companyName: true,
        country: true,
        preferredLanguage: true,
        credits: true,
        membershipTier: true,
        membershipExpiresAt: true,
        emailVerified: true,
        lifetime: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "用户不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        role: user.role,
        companyName: user.companyName,
        country: user.country,
        preferredLanguage: user.preferredLanguage,
        credits: user.credits,
        membershipTier: user.membershipTier,
        membershipExpiresAt: user.membershipExpiresAt,
        emailVerified: user.emailVerified,
        lifetime: user.lifetime,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("User me error:", error);
    return NextResponse.json(
      { success: false, error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
