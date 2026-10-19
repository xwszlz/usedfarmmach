import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/oss";
import { uploadFileToOSS } from "@/lib/oss-upload";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // Auth check - require valid token
  const token = getTokenFromHeaders(request.headers);
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: "Invalid or expired token" },
      { status: 401 }
    );
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

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf", // 宣传册 PDF（发布页「宣传册 PDF」上传此前必然 400）
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type" },
        { status: 400 }
      );
    }

    const subfolder = (formData.get("folder") as string) || "products";
    const allowedFolders = ["products", "avatars", "documents"];
    if (!allowedFolders.includes(subfolder)) {
      return NextResponse.json(
        { success: false, error: "Invalid folder" },
        { status: 400 }
      );
    }
    // 优先 OSS（持久化、容器重建不丢）；OSS 未配置/失败时回退本地磁盘（fail-safe，不改变既有可用性）
    let result: { url: string; key?: string };
    let storage: "oss" | "local" = "oss";
    try {
      result = await uploadFileToOSS(file, subfolder);
    } catch (ossErr) {
      console.error("[upload] OSS 上传失败，回退本地磁盘:", ossErr);
      result = await uploadFile(file, subfolder);
      storage = "local";
    }

    return NextResponse.json({
      success: true,
      storage,
      // 顶层 url 兼容旧客户端（booth/publish-new 等页面此前直接读 data.url）
      url: result.url,
      data: { ...result },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}
