import { NextRequest, NextResponse } from "next/server";
import { getPhoneNumber } from "@/lib/wechat-miniprogram";

/**
 * POST /api/auth/wx-phone
 * 用小程序 wx.getPhoneNumber 返回的 code 换取真实手机号
 * 入参: { code: string }
 * 出参: { success, data: { phone, purePhoneNumber, countryCode } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: "缺少 code 参数" },
        { status: 400 }
      );
    }

    const phoneInfo = await getPhoneNumber(code);

    return NextResponse.json({
      success: true,
      data: {
        phone: phoneInfo.phoneNumber,
        purePhoneNumber: phoneInfo.purePhoneNumber,
        countryCode: phoneInfo.countryCode,
      },
    });
  } catch (error) {
    console.error("[wx-phone] 换取手机号失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "换取手机号失败" },
      { status: 500 }
    );
  }
}
