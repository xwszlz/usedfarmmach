import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * 小程序 API — 获取 OSS 直传凭证
 * 小程序获取临时凭证后，直接 POST 文件到 OSS，绕过 Vercel 4.5MB 限制
 */
const OSS_BUCKET = "usedfarmmach-oss";
const OSS_REGION = "oss-cn-beijing";
const OSS_HOST = `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com`;

function requireAuth(req: NextRequest) {
  const envKey = process.env.MINIAPP_API_KEY;
  if (!envKey) return true;
  const key = req.headers.get("x-miniapp-key");
  return key === envKey;
}

export async function POST(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { folder, ext } = await request.json().catch(() => ({}));
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET!;

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
        { "x-oss-credential": accessKeyId },
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
