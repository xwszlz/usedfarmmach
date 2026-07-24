/**
 * 站内通知 API
 * GET  /api/notifications        — 列出当前用户通知 + 未读计数
 * POST /api/notifications        — 标记已读（body: { id?: string }，不传则全部已读）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({ where: { userId: user.id, read: false } }),
    ]);

    const serialized = items.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: serialized, unreadCount });
  } catch (error) {
    console.error("List notifications error:", error);
    return NextResponse.json({ success: false, error: "Failed to list notifications" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { id } = body;

    if (id) {
      await prisma.notification.updateMany({
        where: { id, userId: user.id },
        data: { read: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return NextResponse.json({ success: false, error: "Failed to mark read" }, { status: 500 });
  }
}
