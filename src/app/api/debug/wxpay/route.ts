/**
 * 【临时调试接口】微信支付 errno:102 排查
 *
 * 用途：报告线上运行时真实的 AppID / 商户号 / 环境变量完整性，
 * 并可选发起一笔 0.01 元真实下单，捕获微信侧返回的原始错误码。
 *
 * ⚠️ 排查完成后必须删除此文件并重新部署！
 *
 * 用法：
 *   GET /api/debug/wxpay           → 只报告配置，不下单
 *   GET /api/debug/wxpay?probe=1   → 额外发起 1 分钱测试单（不会拉起支付）
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const APP_ID = process.env.WECHAT_APP_ID || "";
  const MINI_APP_ID = process.env.WECHAT_MINI_APPID || "";
  const MCH_ID = process.env.WECHAT_MCH_ID || "";
  const API_V3_KEY = process.env.WECHAT_API_V3_KEY || "";
  const SERIAL_NO = process.env.WECHAT_SERIAL_NO || "";
  const PRIVATE_KEY = process.env.WECHAT_PRIVATE_KEY || "";
  const NOTIFY_URL = process.env.WECHAT_NOTIFY_URL || "";

  const EXPECTED_APPID = "wx8ac59ab483285cb4";
  const EXPECTED_MCH = "1748329455";

  const mask = (v: string, head = 6, tail = 4) =>
    v.length <= head + tail ? v : `${v.slice(0, head)}...${v.slice(-tail)}`;

  const report: Record<string, unknown> = {
    env: {
      WECHAT_APP_ID: mask(APP_ID),
      WECHAT_MINI_APPID: mask(MINI_APP_ID),
      WECHAT_MCH_ID: mask(MCH_ID, 4, 3),
      WECHAT_NOTIFY_URL: NOTIFY_URL || "(empty)",
      API_V3_KEY_len: API_V3_KEY.length,
      SERIAL_NO_len: SERIAL_NO.length,
      PRIVATE_KEY_len: PRIVATE_KEY.length,
      PRIVATE_KEY_has_begin: PRIVATE_KEY.includes("BEGIN"),
    },
    match: {
      appIdMatchesExpected:
        APP_ID === EXPECTED_APPID || MINI_APP_ID === EXPECTED_APPID,
      effectiveMiniAppId: mask(MINI_APP_ID || APP_ID),
      mchMatchesExpected: MCH_ID === EXPECTED_MCH,
      allGood:
        (APP_ID === EXPECTED_APPID || MINI_APP_ID === EXPECTED_APPID) &&
        MCH_ID === EXPECTED_MCH &&
        API_V3_KEY.length === 32 &&
        SERIAL_NO.length > 0 &&
        PRIVATE_KEY.length > 100,
    },
  };

  // 可选：真实下单探针（1 分钱，用 fake openid，微信会在业务校验阶段报错，但错误码极有诊断价值）
  if (request.nextUrl.searchParams.get("probe") === "1") {
    try {
      const { createMiniOrder } = await import("@/lib/wechat-pay");
      await createMiniOrder(
        `DEBUG${Date.now()}`,
        1,
        "errno102-probe",
        "oFakeOpenIdForProbe1234567890"
      );
      report.probe = { ok: true, note: "unexpected success with fake openid" };
    } catch (e) {
      report.probe = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return NextResponse.json(report, { status: 200 });
}
