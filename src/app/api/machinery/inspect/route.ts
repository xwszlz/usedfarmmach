/**
 * 验机事件 — 上传照片/视频 + 创建检测事件
 *
 * POST /api/machinery/inspect
 *   FormData: { qrCode, title, description, operator, files[] }
 *   → 上传文件到OSS → 创建 inspected 事件
 *
 * 无需登录（扫码即可使用），以 qrCode 为凭证
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/oss";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const qrCode = formData.get("qrCode") as string | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const operator = formData.get("operator") as string | null;
    const location = formData.get("location") as string | null;
    const files = formData.getAll("files") as File[];

    if (!qrCode || !title) {
      return NextResponse.json(
        { success: false, error: "缺少必填字段: qrCode, title" },
        { status: 400 }
      );
    }

    // 通过 qrCode 查找身份档案
    const identity = await prisma.machineryIdentity.findUnique({
      where: { qrCode },
      select: { id: true, productId: true, isVerified: true },
    });

    if (!identity) {
      return NextResponse.json(
        { success: false, error: "未找到此QR码对应的农机档案" },
        { status: 404 }
      );
    }

    // 上传文件到 OSS（inspection 专用文件夹）
    const photos: string[] = [];
    const videos: string[] = [];

    for (const file of files) {
      if (!file || file.size === 0) continue;

      const isVideo = file.type.startsWith("video/");
      const folder = isVideo ? "inspection/videos" : "inspection/photos";

      try {
        const result = await uploadFile(file, folder);
        if (isVideo) {
          videos.push(result.url);
        } else {
          photos.push(result.url);
        }
      } catch (uploadErr: any) {
        console.error("[Inspect] 文件上传失败:", file.name, uploadErr.message);
      }
    }

    // 构建 evidence JSON
    const evidence: any = {};
    if (photos.length > 0) evidence.photos = photos;
    if (videos.length > 0) evidence.videos = videos;

    // 创建 inspected 事件
    const event = await prisma.machineryEvent.create({
      data: {
        identityId: identity.id,
        eventType: "inspected",
        title,
        description: description || null,
        operator: operator || null,
        location: location || null,
        evidence: Object.keys(evidence).length > 0 ? JSON.stringify(evidence) : null,
        eventDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        event: {
          id: event.id,
          eventType: event.eventType,
          title: event.title,
          description: event.description,
          operator: event.operator,
          location: event.location,
          evidence: Object.keys(evidence).length > 0 ? evidence : null,
          eventDate: event.eventDate,
        },
        photosCount: photos.length,
        videosCount: videos.length,
      },
      message: "验机记录已提交",
    });
  } catch (error: any) {
    console.error("[MachineryInspect] 提交错误:", error);
    return NextResponse.json(
      { success: false, error: "提交验机记录失败: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}
