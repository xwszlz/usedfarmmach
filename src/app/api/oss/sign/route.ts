/**
 * OSS Presigned URL API
 *
 * 为前端直传 OSS 生成预签名 PUT URL。
 * 前端通过此 URL 直接将文件上传到 OSS，绕过后端转发，彻底不受 Vercel 4.5MB 请求体限制。
 *
 * POST /api/oss/sign
 * Body: { folder: string, filename: string, contentType: string }
 * Response: { uploadUrl: string, publicUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";

// ── OSS 凭证（与 oss-upload.ts 保持一致）──
// 🔒 安全（2026-09-13）：移除历史遗留的 Base64 硬编码 FALLBACK_OSS 凭据与
//    CORRECT_SECRET_PREFIX 回退逻辑，改为仅从环境变量读取；缺失即抛错（由 POST
//    的 try/catch 兜底为 500），绝不静默回退到硬编码凭据。
function getCredentials(): { accessKeyId: string; accessKeySecret: string } {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim();

  if (!accessKeyId || !accessKeySecret) {
    console.error(
      "[oss/sign] ❌ OSS 凭据缺失：请配置环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET"
    );
    throw new Error(
      "OSS 凭据未配置：缺失环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET"
    );
  }
  return { accessKeyId, accessKeySecret };
}

function createOssClient(): {
  signatureUrl(
    name: string,
    options?: { method?: string; expires?: number; "Content-Type"?: string }
  ): string;
} {
  const { accessKeyId, accessKeySecret } = getCredentials();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const OSS = require("ali-oss");
  return new OSS({
    region: "oss-cn-beijing",
    bucket: "usedfarmmach-oss",
    accessKeyId,
    accessKeySecret,
    secure: true, // 强制 HTTPS，防止 Mixed Content 错误
    timeout: 120000,
  });
}

const OSS_BASE_URL = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com";

export async function POST(request: NextRequest) {
  // ── 鉴权 ──
  const token = getTokenFromHeaders(request.headers);
  if (!token) {
    return NextResponse.json(
      { success: false, error: "请先登录" },
      { status: 401 }
    );
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: "登录已过期，请重新登录" },
      { status: 401 }
    );
  }

  try {
    // ── 解析请求体 ──
    const body = await request.json();
    const { folder, filename, contentType } = body as {
      folder?: string;
      filename?: string;
      contentType?: string;
    };

    if (!folder || !filename) {
      return NextResponse.json(
        { success: false, error: "缺少 folder 或 filename 参数" },
        { status: 400 }
      );
    }

    // ── 生成唯一文件名 ──
    const ext =
      filename.includes(".")
        ? filename.split(".").pop() || "bin"
        : "bin";
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const uniqueName = `${ts}_${rand}.${ext}`;
    const ossKey = `${folder}/${uniqueName}`;

    // ── 生成预签名 PUT URL ──
    const client = createOssClient();

    const signOptions: { method: string; expires: number; "Content-Type"?: string } = {
      method: "PUT",
      expires: 300, // 5 分钟有效期
    };

    // 包含 Content-Type 头签名（OSS 会校验该头）
    if (contentType) {
      signOptions["Content-Type"] = contentType;
    }

    const uploadUrl = client.signatureUrl(ossKey, signOptions).replace(/^http:\/\//, "https://");
    const publicUrl = `${OSS_BASE_URL}/${ossKey}`;

    console.log(
      `[oss/sign] ✅ user=${payload.userId} key=${ossKey}`
    );

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl,
      key: ossKey,
    });
  } catch (err) {
    console.error(
      "[oss/sign] 生成签名失败:",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { success: false, error: "签名生成失败，请稍后重试" },
      { status: 500 }
    );
  }
}
