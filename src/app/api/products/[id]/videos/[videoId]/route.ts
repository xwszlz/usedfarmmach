import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import {
  checkProductEditPermission,
  describeEditDenial,
} from "@/lib/product-edit-auth";

/**
 * DELETE /api/products/[id]/videos/[videoId]
 * 删除产品单个视频
 * 权限（2026-10-29 调整）：产品 owner 或 admin / super_admin / editor
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  // 鉴权：登录 + （owner 或管理角色）
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Token 无效" }, { status: 401 });
  }

  const { id: productId, videoId } = await params;

  const permission = await checkProductEditPermission(payload.userId, productId);
  if (permission.outcome === "not_found") {
    return NextResponse.json({ error: describeEditDenial(permission) }, { status: 404 });
  }
  if (!permission.allowed) {
    return NextResponse.json({ error: describeEditDenial(permission) }, { status: 403 });
  }

  // 验证视频归属
  const video = await prisma.productVideo.findFirst({
    where: { id: videoId, productId },
  });

  if (!video) {
    return NextResponse.json({ error: "视频不存在" }, { status: 404 });
  }

  // 删除OSS文件（忽略失败）
  try {
    const { deleteFromOSS } = await import("@/lib/oss-upload");
    await deleteFromOSS(video.url);
  } catch {}

  await prisma.productVideo.delete({ where: { id: videoId } });

  return NextResponse.json({
    success: true,
    message: "视频已删除",
    deletedId: videoId,
  });
}
