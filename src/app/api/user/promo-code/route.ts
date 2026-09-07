/**
 * 开放直连分销 P0：我的推广码
 * - GET：返回当前登录用户的邀请码；没有则自动生成（User.inviteCode @unique）
 * - 生成的码仅作推广归因标识（P0 只写 cookie，P1 做订单归因结算）
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆的 I/O/0/1

function genCode(): string {
  const bytes = randomBytes(8);
  let code = "SD";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code; // 形如 SD7K2M9X，8 位
}

export async function GET(request: NextRequest) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) {
    return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return NextResponse.json({ success: false, error: "登录已过期，请重新登录" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, inviteCode: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 });
  }

  if (user.inviteCode) {
    return NextResponse.json({ success: true, data: { inviteCode: user.inviteCode, created: false } });
  }

  // 无码 → 自动生成（唯一索引兜底，冲突重试）
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { inviteCode: code },
        select: { inviteCode: true },
      });
      return NextResponse.json({ success: true, data: { inviteCode: updated.inviteCode, created: true } });
    } catch {
      // 唯一冲突 → 重试
    }
  }
  return NextResponse.json({ success: false, error: "推广码生成失败，请稍后重试" }, { status: 500 });
}
