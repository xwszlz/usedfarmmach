import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken, ensureJwtSecret } from "@/lib/auth";
import { code2Session } from "@/lib/wechat-miniprogram";

/**
 * POST /api/auth/miniprogram/login
 * 小程序登录：wx.login() code → code2Session → openid → 自动建号/登录 → 返回 JWT
 * 入参: { code: string }
 * 出参: { success, data: { token, user } }
 *
 * 神雕自营模型：下单时同一 openid 即真实买家，订单挂在真实 User 上。
 */
export async function POST(request: NextRequest) {
  ensureJwtSecret();
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: "缺少 code 参数" },
        { status: 400 }
      );
    }

    const { openid } = await code2Session(code);
    if (!openid) {
      return NextResponse.json(
        { success: false, error: "获取 openid 失败" },
        { status: 401 }
      );
    }

    // 已有该小程序用户则直接登录，否则自动建号
    let user = await prisma.user.findUnique({ where: { miniOpenid: openid } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          miniOpenid: openid,
          // username 唯一约束：用 openid 派生，避免与现有用户名冲突
          username: `mini_${openid}`,
          // 小程序自动建号无密码，置随机哈希（后续可绑定手机号/密码）
          passwordHash: await bcrypt.hash(Math.random().toString(36), 10),
          role: "buyer",
          preferredLanguage: "zh",
        },
      });
      console.log(`[miniprogram/login] 新建小程序用户 ${user.id} (openid=${openid.slice(0, 6)}...)`);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      tier: user.membershipTier,
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          role: user.role,
          username: user.username,
          companyName: user.companyName,
          country: user.country,
          phone: user.phone,
        },
      },
    });
  } catch (error) {
    console.error("[miniprogram/login] 失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "登录失败" },
      { status: 500 }
    );
  }
}
