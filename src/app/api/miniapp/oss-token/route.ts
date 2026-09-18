/**
 * 小程序 API — 获取 OSS 直传凭证
 * 小程序获取临时凭证后，直接 POST 文件到 OSS，绕过 Vercel 4.5MB 限制
 *
 * ⚠️ maxDuration=30：此接口涉及 crypto 签名计算，虽通常很快，
 *    但在冷启动或高并发时可能延迟，需避免 Vercel 默认10s超时。
 *
 * 🔒 安全说明（2026-09-13）：已移除历史遗留的 Base64 硬编码 FALLBACK_OSS 凭据
 *    与 CORRECT_SECRET_PREFIX 回退逻辑。现仅从环境变量 OSS_ACCESS_KEY_ID /
 *    OSS_ACCESS_KEY_SECRET 读取；缺失即抛错（由 POST 的 try/catch 兜底为 500），
 *    绝不静默回退到硬编码凭据。请确保部署环境正确配置上述变量。
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Vercel Serverless Function 超时延长至30秒（默认10秒）
export const maxDuration = 30;

const OSS_BUCKET = "usedfarmmach-oss";
const OSS_REGION = "oss-cn-beijing";
const OSS_HOST = `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com`;

/**
 * 读取 OSS 凭据。
 *
 * 🔒 安全（2026-09-13）：移除历史遗留的 Base64 硬编码 FALLBACK_OSS 凭据与
 *    CORRECT_SECRET_PREFIX 回退逻辑，改为仅从环境变量 OSS_ACCESS_KEY_ID /
 *    OSS_ACCESS_KEY_SECRET 读取；缺失即抛错（由 POST 的 try/catch 兜底为 500），
 *    绝不静默回退到硬编码凭据。
 */
function getOSSCredentials(): { accessKeyId: string; accessKeySecret: string } {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim();

  if (!accessKeyId || !accessKeySecret) {
    console.error(
      "[oss-token] ❌ OSS 凭据缺失：请配置环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET"
    );
    throw new Error(
      "OSS 凭据未配置：缺失环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET"
    );
  }
  return { accessKeyId, accessKeySecret };
}

// 统一使用 INTERNAL_API_KEY 认证（与 /api/internal/products 一致）
function requireAuth(req: NextRequest): boolean {
  const header = req.headers.get("x-api-key");
  if (!header) return false;
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    // ⚠️ fail-closed：未配置密钥时必须拒绝，绝不跳过认证。
    // 原实现返回 true（放行），任何人都能拿到云存储直传凭证。
    console.error("[oss-token] INTERNAL_API_KEY 未配置，拒绝所有请求");
    return false;
  }
  return header === expected;
}

export async function POST(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { folder, ext } = await request.json().catch(() => ({}));
    // 从环境变量读取 OSS 凭据（缺失时 getOSSCredentials 抛错 → 走下方 catch 返回 500）
    const { accessKeyId, accessKeySecret } = getOSSCredentials();

    if (!accessKeyId || !accessKeySecret) {
      return NextResponse.json(
        { success: false, error: "OSS not configured" },
        { status: 500 }
      );
    }

    const dir = `uploads/${folder || "miniapp"}/`;
    const fileExt = ext || "jpg";
    const key = `${dir}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

    // OSS POST Policy
    const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    const policy = {
      expiration,
      conditions: [
        { bucket: OSS_BUCKET },
        ["starts-with", "$key", dir],
      ],
    };

    const policyBase64 = Buffer.from(JSON.stringify(policy)).toString("base64");

    // HMAC-SHA1 signature — OSS requires uppercase "Signature" in form field
    const hmac = crypto.createHmac("sha1", accessKeySecret);
    hmac.update(policyBase64, "utf-8");
    const signature = hmac.digest("base64");

    return NextResponse.json({
      success: true,
      data: {
        host: OSS_HOST,
        accessKeyId,
        policy: policyBase64,
        Signature: signature,  // 注意大写 S — OSS POST 表单要求
        key,
        dir,
        url: `${OSS_HOST}/${key}`,
      },
    });
  } catch (error) {
    console.error("oss-token error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate OSS token" },
      { status: 500 }
    );
  }
}
