import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getSupportEmail } from "@/config/support-email";

// 邮箱格式校验：标准且足够严格
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 订阅确认邮件内容。
 *
 * 分语言口径（2026-11-20）：
 * - `zh` 及缺省 → 中文（与历史行为完全一致，小程序 / .cn 不受影响）；
 * - 其他一律英文。`.com` 站点默认语言是 en，8 语用户里非中文母语者占绝大多数，
 *   给俄语/西语买家发一封中文确认信是明显的专业度破口；逐语种精翻 7 条短句
 *   性价比不高，英文是 B2B 通用语，先收敛到「中文 / 英文」两档。
 *
 * 退订提示用 reply-to 兜底：发件人 = support@usedfarmmach.{com|cn}（见 lib/email/config.ts），
 * 客户直接回复即可，不需要额外的退订链接与令牌。
 */
function buildConfirmEmail(locale: string) {
  const zh = locale === "zh";

  if (zh) {
    return {
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
      text: "您已成功订阅神雕农机资讯，我们将向您推送最新农机行业动态与交易信息。如需退订，直接回复本邮件即可。",
    };
  }

  return {
    subject: "UsedFarmMach — Subscription confirmed",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #E34D2D;">You're subscribed 🚜</h2>
        <p>Hello,</p>
        <p>You have successfully subscribed to <strong>UsedFarmMach</strong> market intelligence for used agricultural machinery.</p>
        <p>You will receive:</p>
        <ul style="color: #374151;">
          <li>New arrivals of used machinery worldwide</li>
          <li>Market prices and benchmark references</li>
          <li>Updates on trade, logistics and import regulations</li>
        </ul>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          To unsubscribe, simply reply to this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">UsedFarmMach — usedfarmmach.com · ${getSupportEmail()}</p>
      </div>
    `,
    text: "You have successfully subscribed to UsedFarmMach market intelligence. To unsubscribe, simply reply to this email.",
  };
}

/**
 * POST /api/subscribe
 * 邮箱订阅（资讯推送）
 * body: { email: string, source?: string, locale?: string }
 *
 * 调用方：
 * - `.com` 首页订阅板块 `src/components/home/market-subscribe.tsx`（source="com-home"）
 * - 小程序（source 缺省 = "miniprogram"）
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
  // 缺省保持 "miniprogram"：小程序是该接口最早的调用方，不能因为加了网站入口就改掉历史归因。
  const source = (body?.source || "miniprogram").toString().trim() || "miniprogram";
  const locale = (body?.locale || "zh").toString().trim().toLowerCase();

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

    // 发送订阅确认邮件。发件人统一由 src/lib/email/config.ts 的 resolveMailConfig() 决定
    // （= support@usedfarmmach.{com|cn}），凭证缺失时降级 console，不影响订阅结果。
    //
    // 🔴 必须检查返回值：`sendEmail` 内部吞掉 provider 异常只返回 false，
    //    此前这里不看返回值、一律回 {"success":true}，导致「订阅成功但信从未发出」
    //    静默了近一整个月（2026-11-20 才靠 Vercel 日志定位）。订阅已入库算成功，
    //    但要不要告诉用户「确认信已发出」，必须由真实结果决定。
    const mail = buildConfirmEmail(locale);
    let emailSent = false;
    try {
      emailSent = await sendEmail({ to: email, ...mail });
    } catch (mailErr) {
      // 兜底：发信失败不得让订阅本身失败
      console.error("[subscribe] 确认邮件发送异常:", mailErr);
      emailSent = false;
    }

    if (!emailSent) {
      console.warn(
        `[subscribe] 订阅已入库但确认邮件未发出（email=${email}, source=${source}, ` +
          `locale=${locale}）—— 检查 RESEND_API_KEY / 发信域名验证状态`
      );
    }

    return NextResponse.json({ success: true, message: "订阅成功", emailSent });
  } catch (err: any) {
    console.error("[subscribe] 写入失败:", err);
    return NextResponse.json(
      { success: false, error: "订阅失败，请稍后重试" },
      { status: 500 }
    );
  }
}
