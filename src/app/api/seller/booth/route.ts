import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — fetch current seller's booth(s)
export async function GET(request: NextRequest) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ success: false, error: "Token无效" }, { status: 401 });

  const booths = await prisma.booth.findMany({
    where: { merchantId: payload.userId },
    include: {
      showcaseItems: {
        orderBy: { sortIndex: "asc" },
      },
      expo: {
        select: { name: true, slug: true },
      },
    },
  });

  return NextResponse.json({ success: true, data: booths });
}

// PATCH — update booth
export async function PATCH(request: NextRequest) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ success: false, error: "Token无效" }, { status: 401 });

  const body = await request.json();
  const { id, ...updateData } = body;

  if (!id) return NextResponse.json({ success: false, error: "缺少展位ID" }, { status: 400 });

  // Verify ownership
  const booth = await prisma.booth.findUnique({ where: { id } });
  if (!booth || booth.merchantId !== payload.userId) {
    return NextResponse.json({ success: false, error: "无权操作此展位" }, { status: 403 });
  }

  const allowed = ["template", "status", "coverImage", "logoUrl", "intro", "name", "sortIndex"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updateData) data[key] = updateData[key];
  }

  const updated = await prisma.booth.update({ where: { id }, data });
  return NextResponse.json({ success: true, data: updated });
}
