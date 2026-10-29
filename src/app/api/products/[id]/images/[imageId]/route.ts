import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import {
  checkProductEditPermission,
  describeEditDenial,
} from "@/lib/product-edit-auth";

/**
 * DELETE /api/products/[id]/images/[imageId]
 * 删除产品单张图片
 * 权限（2026-10-29 调整）：产品 owner 或 admin / super_admin / editor
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  // 鉴权：登录 + （owner 或管理角色）
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Token 无效" }, { status: 401 });
  }

  const { id: productId, imageId } = await params;

  const permission = await checkProductEditPermission(payload.userId, productId);
  if (permission.outcome === "not_found") {
    return NextResponse.json({ error: describeEditDenial(permission) }, { status: 404 });
  }
  if (!permission.allowed) {
    return NextResponse.json({ error: describeEditDenial(permission) }, { status: 403 });
  }

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
