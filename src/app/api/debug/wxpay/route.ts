import { NextResponse } from "next/server";

/**
 * 临时调试接口：确认微信支付运行时环境变量是否正确
 * 验证完必须删除并重新部署
 * GET /api/debug/wxpay
 */
export async function GET() {
  const appId = process.env.WECHAT_APP_ID || "";
  const miniAppId = process.env.WECHAT_MINI_APPID || "";
  const effectiveMini = miniAppId || appId;

  const privKey = process.env.WECHAT_PRIVATE_KEY || "";
  const hasBegin = privKey.includes("BEGIN PRIVATE KEY");
  const keyLen = privKey.length;

  const apiV3 = process.env.WECHAT_API_V3_KEY || "";

  const checks = {
    WECHAT_APP_ID: appId,
    WECHAT_MINI_APPID: miniAppId,
    effectiveMiniAppId: effectiveMini,
    miniMatchesLoginApp: effectiveMini === "wx8ac59ab483285cb4",
    MCH_ID: process.env.WECHAT_MCH_ID || "",
    SERIAL_NO_prefix: (process.env.WECHAT_SERIAL_NO || "").slice(0, 8),
    NOTIFY_URL: process.env.WECHAT_NOTIFY_URL || "",
    privateKey_hasPEMHeader: hasBegin,
    privateKey_length: keyLen,
    apiV3_length: apiV3.length,
  };

  const allGood =
    checks.miniMatchesLoginApp &&
    checks.privateKey_hasPEMHeader &&
    checks.apiV3_length === 32;

  return NextResponse.json({ allGood, checks });
}
