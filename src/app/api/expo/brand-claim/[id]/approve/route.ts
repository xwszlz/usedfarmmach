import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken, setTokenCookie } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { nanoid } from "nanoid";

/**
 * 品牌认领审核 API
 * POST /api/expo/brand-claim/{id}/approve
 *
 * 将 pending 的 brand_claim 转为：
 *   1. User（merchant 角色，自动生成账号密码）
 *   2. Booth（关联到用户，关联到始终展 Expo）
 *   3. 发送入驻成功邮件（含登录凭证，修复无效邮箱跳过逻辑）
 *   4. 发送入驻成功短信（含登录凭证，新增短信通道）
 *
 * 邮件 / 短信任一失败均不阻断审批流程（non-blocking），仅记录日志并在响应中反映状态。
 */

const EXPO_SLUG = "always-on-expo";

/** 11 位手机号校验（国内手机号） */
const PHONE_RE = /^1\d{10}$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. 获取认领申请
    const claim = await prisma.expoRegistration.findUnique({ where: { id } });
    if (!claim) {
      return NextResponse.json({ success: false, error: "Claim not found" }, { status: 404 });
    }
    if (claim.status !== "pending") {
      return NextResponse.json({ success: false, error: `Claim already ${claim.status}` }, { status: 400 });
    }

    // 2. 解析品牌信息（从 message 字段中提取）
    // message 格式: "品牌认领申请\n品牌名称: xxx\n品牌Slug: xxx\n..."
    const msgLines = claim.message?.split("\n") || [];
    const extractValue = (prefix: string): string => {
      const line = msgLines.find((l) => l.startsWith(prefix));
      return line?.replace(prefix, "").trim() || "";
    };
    const brandName = extractValue("品牌名称:");
    const brandSlug = extractValue("品牌Slug:");

    // 3. 查找始终展 Expo
    let expo = await prisma.expo.findFirst({ where: { slug: EXPO_SLUG } });
    if (!expo) {
      // 自动创建
      expo = await prisma.expo.create({
        data: {
          name: "永不落幕的农机世界展会",
          slug: EXPO_SLUG,
          type: "virtual",
          status: "active",
          startDate: new Date("2026-01-01"),
          description: "神雕农机·始终展——品牌自发布平台",
        },
      });
    }

    // 4. 创建 User（merchant 角色）—— 邮箱唯一，避免冲突
    const username = `booth_${(claim.company || brandName).replace(/[^a-zA-Z0-9]/g, '_')}_${nanoid(6)}`;
    const rawPassword = nanoid(10); // 自动生成密码
    const hashedPwd = await hashPassword(rawPassword);

    // 邮箱策略：始终生成唯一占位邮箱，避免 brand_claim 中的邮箱与现有 User 冲突
    const userEmail = `booth_${nanoid(8)}@booth.shendiao.com`;

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: hashedPwd,
        email: userEmail,
        phone: claim.phone,
        companyName: claim.company || brandName,
        country: claim.country || "中国",
        role: "seller", // seller = merchant
        isActive: true,
      },
    });

    // 5. 创建 Booth
    const booth = await prisma.booth.create({
      data: {
        expoId: expo.id,
        merchantId: user.id,
        name: brandName || claim.company || claim.name,
        hall: "virtual",
        template: "standard",
        status: "published",
        sortIndex: 0,
        pavilion: "industry_pillar",
        tier: "free",
        intro: `${brandName} 已入驻神雕农机·永不落幕的农机世界展会。`,
      },
    });

    // 6. 更新申请状态
    await prisma.expoRegistration.update({
      where: { id },
      data: { status: "approved" },
    });

    // 7. 发送入驻通知邮件（修复：无效邮箱则跳过，并在响应中标记）
    const emailValid = !!claim.email && claim.email.includes("@");
    let emailSent = false;
    let emailSkippedReason: string | undefined;
    const recipientEmail = emailValid ? (claim.email ?? "") : "";

    if (emailValid) {
      try {
        // sendEmail 旧式签名返回 boolean：true=成功，false=缺 key / API 失败（已内部降级记录）
        emailSent = await sendEmail({
          to: recipientEmail,
          subject: `🎉 ${brandName} 已成功入驻神雕农机·始终展`,
          html: `
          <h2>祝贺您，${claim.name}！</h2>
          <p><strong>${brandName}</strong> 已成功入驻 <strong>神雕农机·永不落幕的农机世界展会</strong>。</p>
          <h3>您的自助展台信息</h3>
          <ul>
            <li>品牌名称：${brandName}</li>
            <li>登录账号：${username}</li>
            <li>登录密码：${rawPassword}</li>
          </ul>
          <p>登录后即可管理您的展品、查看询盘。</p>
          <p><a href="https://usedfarmmach.com/zh/expo/booth/${booth.id}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;">进入我的展台 →</a></p>
          <p style="margin-top:24px;color:#666;font-size:12px;">建议首次登录后立即修改密码。</p>
        `,
          text: `祝贺您！${brandName} 已成功入驻神雕农机始终展。\n登录账号：${username}\n登录密码：${rawPassword}\n\n登录后管理展品：https://usedfarmmach.com/zh/expo/booth/manage`,
        });
        if (!emailSent) {
          // sendEmail 在缺 RESEND_API_KEY 或 API 失败时返回 false（已内部打印日志）
          console.warn(`[approve] 邮件发送未成功（返回 false），claim=${claim.id}`);
        }
      } catch (emailErr) {
        // 防止异常继续阻断审批流程
        console.error("Approval email failed:", emailErr);
        emailSent = false;
      }
    } else {
      emailSkippedReason = "no_valid_email";
      console.warn(`[approve] 跳过邮件发送：claim=${claim.id} 无有效邮箱（email=${claim.email ?? "null"}）`);
    }

    // 8. 发送入驻通知短信（新增通道）
    const phoneValid = PHONE_RE.test(claim.phone || "");
    let smsSent = false;
    if (phoneValid) {
      const smsResult = await sendSms({
        phone: claim.phone,
        templateParams: {
          brand: brandName || claim.company || "",
          account: username,
          password: rawPassword,
        },
      });
      smsSent = smsResult.success;
      if (!smsResult.success) {
        console.error("[approve] 短信发送失败:", smsResult.error ?? "unknown");
      }
    } else {
      console.warn(`[approve] 跳过短信发送：claim=${claim.id} 手机号无效（phone=${claim.phone ?? "null"}）`);
    }

    // 9. 汇总通知状态，供前端展示
    let notifySummary: string;
    if (emailSent && smsSent) {
      notifySummary = "email+sms均成功";
    } else if (smsSent) {
      notifySummary = "仅短信成功";
    } else if (emailSent) {
      notifySummary = "仅邮件成功";
    } else {
      notifySummary = "均失败需手动通知";
    }

    return NextResponse.json({
      success: true,
      data: {
        boothId: booth.id,
        userId: user.id,
        username,
        rawPassword,
        url: `/expo/booth/${booth.id}`,
        emailSent,
        emailSkippedReason,
        smsSent,
        notifySummary,
      },
      message: `Brand approved. Booth created. Notify summary: ${notifySummary}.`,
    });
  } catch (error) {
    console.error("Approve error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
