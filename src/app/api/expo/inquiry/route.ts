import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

/**
 * 农机博览会 — 招商意向表提交 API
 * POST /api/expo/inquiry
 *
 * 接收表单数据，发送邮件通知管理员
 * 不依赖数据库表（Phase 0 快速上线），后续 Phase 2 可加 Prisma 模型
 */

const ADMIN_EMAIL = "932133255@qq.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 基本字段校验
    const { company, contact, phone, email, country, category, boothType, message, locale } = body;

    if (!company || !contact || !phone || !country) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 构建邮件内容
    const subject = `[农机博览会招商] ${company} - ${contact}`;
    const html = `
      <h2>农机博览会招商意向表</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">公司名称</td><td style="padding:8px;border:1px solid #ddd;">${company}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">联系人</td><td style="padding:8px;border:1px solid #ddd;">${contact}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">手机号</td><td style="padding:8px;border:1px solid #ddd;">${phone}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">邮箱</td><td style="padding:8px;border:1px solid #ddd;">${email || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">国家/地区</td><td style="padding:8px;border:1px solid #ddd;">${country}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">主营品类</td><td style="padding:8px;border:1px solid #ddd;">${category || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">意向展位</td><td style="padding:8px;border:1px solid #ddd;">${boothType || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">留言</td><td style="padding:8px;border:1px solid #ddd;">${message || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">语言</td><td style="padding:8px;border:1px solid #ddd;">${locale || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">提交时间</td><td style="padding:8px;border:1px solid #ddd;">${new Date().toISOString()}</td></tr>
      </table>
      <p style="margin-top:16px;color:#666;font-size:12px;">此邮件由 usedfarmmach.com 农机博览会页面自动发送</p>
    `;
    const text = `农机博览会招商意向\n公司: ${company}\n联系人: ${contact}\n电话: ${phone}\n邮箱: ${email || "-"}\n国家: ${country}\n品类: ${category || "-"}\n展位: ${boothType || "-"}\n留言: ${message || "-"}`;

    // 发送邮件
    await sendEmail({ to: ADMIN_EMAIL, subject, html, text });

    // 同时输出到控制台日志（备份）
    console.log("[Expo Inquiry]", JSON.stringify({ company, contact, phone, email, country, category, boothType, message, locale, time: new Date().toISOString() }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Expo Inquiry Error]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
