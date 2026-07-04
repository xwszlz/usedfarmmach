import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";

/**
 * DELETE /api/products/[id]/videos/[videoId]
 * 删除产品单个视频（admin/editor/super_admin）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  // 鉴权
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = verifyToken(token);
  if (!user || !["admin", "super_admin", "editor"].includes(user.role)) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const { id: productId, videoId } = await params;

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
