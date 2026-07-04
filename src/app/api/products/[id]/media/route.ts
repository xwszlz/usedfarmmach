/**
 * 产品媒体管理 API — 添加图片/视频到已有产品
 * POST /api/products/[id]/media
 *
 * 请求格式: multipart/form-data
 *   - type: "image" | "video"
 *   - files: 一个或多个文件
 *
 * 权限: admin / super_admin / editor
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { uploadBufferToOSS } from "@/lib/oss-upload";
import { randomUUID } from "crypto";

async function checkAuth(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  });
  if (!user || !["admin", "super_admin", "editor"].includes(user.role)) return null;
  return payload;
}

const MIME_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function getExtension(mimeType: string): string {
  return MIME_MAP[mimeType] || "bin";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, modelName: true },
    });
    if (!product) {
      return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
    }

    const formData = await request.formData();
    const type = formData.get("type") as string; // "image" | "video"
    const files = formData.getAll("files") as File[];

    if (!type || !["image", "video"].includes(type)) {
      return NextResponse.json({ success: false, error: "type 必须为 image 或 video" }, { status: 400 });
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: "没有上传文件" }, { status: 400 });
    }

    const results: Array<{ id: string; url: string; name: string }> = [];
    const folder = `uploads/products/${id}`;
    const now = Math.floor(Date.now() / 1000);

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = getExtension(file.type);
      const ossKey = `${folder}/${randomUUID()}.${ext}`;

      const url = await uploadBufferToOSS(ossKey, buffer, file.type);

      if (type === "image") {
        // 第一张图设为主图
        const existingImages = await prisma.productImage.count({ where: { productId: id } });
        const isPrimary = existingImages === 0;

        const img = await prisma.productImage.create({
          data: {
            productId: id,
            url: `/${ossKey}`, // 存储相对路径，与现有格式一致
            isPrimary,
            sortOrder: now + results.length,
          },
        });
        results.push({ id: img.id, url: img.url, name: file.name });
      } else {
        const vid = await prisma.productVideo.create({
          data: {
            productId: id,
            url: `/${ossKey}`,
            thumbnail: null,
            duration: null,
            createdAt: new Date(),
          },
        });
        results.push({ id: vid.id, url: vid.url, name: file.name });
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功上传 ${results.length} 个${type === "image" ? "图片" : "视频"}`,
      data: results,
    });
  } catch (error) {
    console.error("[products/media] upload error:", error);
    return NextResponse.json(
      { success: false, error: "上传失败" },
      { status: 500 }
    );
  }
}
