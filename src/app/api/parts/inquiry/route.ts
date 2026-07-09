/**
 * 配件询价 API
 *
 * POST /api/parts/inquiry
 * 接收询价表单，发送邮件通知到管理员
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

interface InquiryBody {
  partId?: string;
  partName: string;
  partSku?: string;
  name: string;
  phone: string;
  email?: string;
  quantity?: number;
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: InquiryBody = await request.json();

    // 基本验证
    if (!body.name || !body.phone) {
      return NextResponse.json(
        { success: false, error: "Name and phone are required" },
        { status: 400 }
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL || "jiusei0319@gmail.com";

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">配件询价通知</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr><td style="padding: 8px; background: #fff7ed; font-weight: bold; width: 120px;">配件名称</td>
              <td style="padding: 8px;">${body.partName}</td></tr>
          ${body.partSku ? `<tr><td style="padding: 8px; background: #fff7ed; font-weight: bold;">SKU</td>
              <td style="padding: 8px;">${body.partSku}</td></tr>` : ""}
          <tr><td style="padding: 8px; background: #fff7ed; font-weight: bold;">询价人</td>
              <td style="padding: 8px;">${body.name}</td></tr>
          <tr><td style="padding: 8px; background: #fff7ed; font-weight: bold;">联系电话</td>
              <td style="padding: 8px;">${body.phone}</td></tr>
          ${body.email ? `<tr><td style="padding: 8px; background: #fff7ed; font-weight: bold;">邮箱</td>
              <td style="padding: 8px;">${body.email}</td></tr>` : ""}
          ${body.quantity ? `<tr><td style="padding: 8px; background: #fff7ed; font-weight: bold;">需求数量</td>
              <td style="padding: 8px;">${body.quantity}</td></tr>` : ""}
          ${body.message ? `<tr><td style="padding: 8px; background: #fff7ed; font-weight: bold;">备注</td>
              <td style="padding: 8px;">${body.message}</td></tr>` : ""}
        </table>
        <p style="color: #718096; font-size: 12px; margin-top: 20px;">
          来自 神雕农机配件专区 (usedfarmmach.com)
        </p>
      </div>
    `;

    const text = `配件询价 - 配件: ${body.partName}${body.partSku ? ` (SKU: ${body.partSku})` : ""}, 询价人: ${body.name}, 电话: ${body.phone}${body.email ? `, 邮箱: ${body.email}` : ""}${body.quantity ? `, 数量: ${body.quantity}` : ""}${body.message ? `, 备注: ${body.message}` : ""}`;

    await sendEmail({
      to: adminEmail,
      subject: `[配件询价] ${body.partName} - ${body.name}`,
      html,
      text,
    });

    return NextResponse.json({ success: true, message: "Inquiry submitted successfully" });
  } catch (error) {
    console.error("Parts inquiry API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit inquiry" },
      { status: 500 }
    );
  }
}
