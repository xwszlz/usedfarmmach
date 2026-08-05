import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/field-videos/list
 *
 * 返回地头展现场作业视频列表（改读 FieldVideo 表）。
 * 前端页面据此拿到每条视频的 FieldVideo.id 与 playCount，用于 onPlay 调 track('fieldVideo') 与展示播放量。
 *
 * 返回结构（兼容既有大屏页字段名）：
 *   { success, videos: [{ id, url, brandName, machineType, uploadedAt, playCount, source }] }
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fieldVideos = await prisma.fieldVideo.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        title: true,
        machineType: true,
        playCount: true,
        createdAt: true,
        source: true,
      },
    });

    const videos = fieldVideos.map((fv) => ({
      id: fv.id,
      url: fv.url,
      brandName: fv.title || "现场作业",
      machineType: fv.machineType || "现场作业",
      uploadedAt: fv.createdAt.toISOString(),
      playCount: fv.playCount,
      source: fv.source,
    }));

    return NextResponse.json({ success: true, videos });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
