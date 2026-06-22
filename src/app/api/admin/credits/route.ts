/**
 * Admin: 用户积分管理
 * POST /api/admin/credits { userId, amount }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";

async function checkAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
  if (!user || !["admin", "super_admin"].includes(user.role)) return null;
  return payload;
}

export async function POST(request: NextRequest) {
  const admin = await checkAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const { userId, amount } = await request.json();
    const user = await prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
      select: { credits: true },
    });
    return NextResponse.json({ success: true, credits: user.credits });
  } catch {
    return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}
