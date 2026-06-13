import { NextRequest, NextResponse } from "next/server";
import { uploadBufferToOSS } from "@/lib/oss-upload";

/**
 * 小程序 API — 图片/视频上传到 OSS
 * 小程序通过 wx.uploadFile 将文件发送到此接口，服务端直传 OSS
 */

function requireAuth(req: NextRequest) {
  const envKey = process.env.MINIAPP_API_KEY;
  // 环境变量未配置时自动放行（首次部署模式）
  if (!envKey) return true;
  const key = req.headers.get("x-miniapp-key");
  return key === envKey;
}

export async function POST(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const maxSize = 50 * 1024 * 1024; // 50MB for videos
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File too large (max 50MB)" },
        { status: 400 }
      );
    }

    const folder = (formData.get("folder") as string) || "miniapp";
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const allowedExts = ["jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "webm"];

    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: .${ext}` },
        { status: 400 }
      );
    }

    const isVideo = ["mp4", "mov", "webm"].includes(ext);
    const subFolder = isVideo ? `${folder}/videos` : `${folder}/images`;
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const ossKey = `uploads/${subFolder}/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || (isVideo ? "video/mp4" : "image/jpeg");

    const url = await uploadBufferToOSS(ossKey, buffer, contentType);

    return NextResponse.json({
      success: true,
      data: {
        url,
        key: ossKey,
        type: isVideo ? "video" : "image",
        size: file.size,
      },
    });
  } catch (error) {
    console.error("miniapp upload error:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}
