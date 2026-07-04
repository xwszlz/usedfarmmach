import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";

/**
 * DELETE /api/products/[id]/images/[imageId]
 * 删除产品单张图片（admin/editor/super_admin）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  // 鉴权
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = verifyToken(token);
  if (!user || !["admin", "super_admin", "editor"].includes(user.role)) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const { id: productId, imageId } = await params;

  // 验证图片归属
  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
  });

  if (!image) {
    return NextResponse.json({ error: "图片不存在" }, { status: 404 });
  }

  // 删除OSS文件（忽略失败，确保数据库一致）
  try {
    const { deleteFromOSS } = await import("@/lib/oss-upload");
    await deleteFromOSS(image.url);
  } catch {}

  await prisma.productImage.delete({ where: { id: imageId } });

  return NextResponse.json({
    success: true,
    message: "图片已删除",
    deletedId: imageId,
  });
}
