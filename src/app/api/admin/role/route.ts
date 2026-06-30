/**
 * Admin: 用户角色管理
 * POST /api/admin/role { userId, role }
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
    const { userId, role } = await request.json();
    if (!["buyer", "seller", "editor", "admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "无效角色" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}
