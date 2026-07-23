import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// 邮箱格式校验：标准且足够严格
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/subscribe
 * 小程序邮箱订阅（资讯推送）
 * body: { email: string, source?: string }
 * 用于向订阅用户推送农机行业资讯与交易动态
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "请求格式错误" },
      { status: 400 }
    );
  }

  const email = (body?.email || "").toString().trim().toLowerCase();
  const source = (body?.source || "miniprogram").toString().trim() || "miniprogram";

  // 校验邮箱
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, error: "请输入有效的邮箱地址" },
      { status: 400 }
    );
  }

  try {
    // upsert：已订阅则刷新订阅时间并置为活跃，未订阅则新建
    await prisma.subscriber.upsert({
      where: { email },
      update: {
        isActive: true,
        subscribedAt: new Date(),
        source,
      },
      create: {
        email,
        source,
      },
    });

    // 发送订阅确认邮件（Resend）。未配置 / 发件域名未验证时 sendEmail 内部自动降级，
    // 不影响订阅结果；用户后续可在 Resend 验证正式域名后切换 RESEND_FROM_EMAIL。
    await sendEmail({
      to: email,
      subject: "神雕农机 — 订阅成功",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #E34D2D;">订阅成功 🚜</h2>
          <p>您好，</p>
          <p>您已成功订阅 <strong>神雕农机</strong> 的农机行业资讯与最新交易动态。</p>
          <p>我们会通过邮件向您推送：</p>
          <ul style="color: #374151;">
            <li>全球二手农机货源上新</li>
            <li>农机行情与价格参考</li>
            <li>交易与物流政策更新</li>
          </ul>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            如需退订，直接回复本邮件即可。
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">神雕农机 UsedFarmMach.com</p>
        </div>
      `,
      text: "您已成功订阅神雕农机资讯，我们将向您推送最新农机行业动态与交易信息。",
    });

    return NextResponse.json({ success: true, message: "订阅成功" });
  } catch (err: any) {
    console.error("[subscribe] 写入失败:", err);
    return NextResponse.json(
      { success: false, error: "订阅失败，请稍后重试" },
      { status: 500 }
    );
  }
}
