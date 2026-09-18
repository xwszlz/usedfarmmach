import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken, setTokenCookie } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { nanoid } from "nanoid";
import { grantRegisterGiftIfNeeded } from "@/lib/credits/grant";

/**
 * 品牌认领审核 API
 * POST /api/expo/brand-claim/{id}/approve
 *
 * 将 pending 的 brand_claim 转为：
 *   1. User —— **先按手机号（归一化，邮箱兜底）匹配已有账号**：
 *        · 命中：复用老账号，不新建 User、不发礼包、不动积分、不下发任何凭证
 *        · 未命中：新建 merchant 账号，并补发幂等注册礼包（口径同网页注册）
 *   2. Booth（始终创建——展台是展台，不是账号）
 *   3. 发送入驻成功邮件（新建场景含登录凭证；复用场景只提示"用原有账号登录"）
 *   4. 发送入驻成功短信（仅新建场景；复用场景模板无法承载"已开通"语义，改为跳过）
 *
 * 邮件 / 短信任一失败均不阻断审批流程（non-blocking），仅记录日志并在响应中反映状态。
 */

const EXPO_SLUG = "always-on-expo";

/** 11 位手机号校验（国内手机号） */
const PHONE_RE = /^1\d{10}$/;

/**
 * 手机号归一化：去除非数字字符，并剥掉 86 / +86 国家码前缀。
 *
 * 展商在认领表单里可能填 "13812345678" / "+86 138 1234 5678" / "8613812345678"，
 * 而 User.phone 里的存量数据写法同样五花八门，因此匹配时必须**双向归一化**后再比。
 * 无效（非 11 位国内号）时返回空串，交由调用方跳过手机号匹配。
 */
function normalizePhone(raw?: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  // 13 位且以 86 开头，且其后 11 位是合法国内号 → 剥掉国家码
  const stripped = /^86(1\d{10})$/.exec(digits)?.[1] ?? digits;
  return /^1\d{10}$/.test(stripped) ? stripped : "";
}

/**
 * 候选拉取后的内存复核：把候选按"归一化后相等"再筛一遍。
 * 不能只靠字面量 in 收窄——存量数据里可能写成 "138 1234 5678" 这类带分隔符形式。
 */
function isSamePhone(candidate: string | null | undefined, digits11: string): boolean {
  return normalizePhone(candidate) === digits11;
}

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

    // 4. 账号匹配：手机号优先（双向归一化）+ 邮箱兜底
    //    命中 → 复用老账号；未命中 → 真·新客，新建账号并发注册礼包。
    const claimPhone = normalizePhone(claim.phone);
    const claimEmail = claim.email && claim.email.includes("@") ? claim.email : "";

    let matched: {
      id: string;
      username: string | null;
      credits: number | null;
      email: string | null;
      phone: string | null;
      companyName: string | null;
    } | null = null;
    let matchedBy: "phone" | "email" | null = null;

    if (claimPhone) {
      // 收窄查询范围：Prisma 无法对"归一化后"做 WHERE，全表 findMany 在 User 表膨胀后代价过高。
      // 折中方案：OR 并集取 138…/86…/+86… 三种字面量，以及 以 digits11 结尾 的模糊匹配
      //   （后者覆盖 "138 1234 5678" 这类带分隔符的存量写法），
      //   再在内存里逐条归一化复核，取第一条真正相等的记录。
      const candidates = await prisma.user.findMany({
        where: {
          OR: [
            { phone: { in: [claimPhone, `86${claimPhone}`, `+86${claimPhone}`] } },
            { phone: { endsWith: claimPhone } },
          ],
        },
        select: { id: true, phone: true, username: true, credits: true, email: true, companyName: true },
      });
      const hit = candidates.find((u) => isSamePhone(u.phone, claimPhone));
      if (hit) {
        matched = hit;
        matchedBy = "phone";
      }
    }

    if (!matched && claimEmail) {
      // User.email 是唯一键，直接 findUnique。
      // 注意 email 为 "" 时不能走 findUnique（会退化成"查无邮箱账号"），已在 claimEmail 里挡掉
      const hit = await prisma.user.findUnique({
        where: { email: claimEmail },
        select: { id: true, phone: true, username: true, credits: true, email: true, companyName: true },
      });
      if (hit) {
        matched = hit;
        matchedBy = "email";
      }
    }

    const reused = !!matched;

    // 4.1 复用分支：不新建 User、不发礼包、不改积分、不生成任何凭证
    // 4.2 新建分支：保留原随机账号 + 占位邮箱策略，并补发幂等注册礼包
    let user: { id: string; username: string | null; credits: number | null };
    let username = "";
    let rawPassword = "";
    let finalCredits = 0;

    if (matched) {
      user = matched;
      username = matched.username ?? "";
      finalCredits = matched.credits ?? 0;
      console.log(
        `[approve] 命中已有账号（matchedBy=${matchedBy}）→ 复用，不新建 User、不发礼包。claim=${claim.id} userId=${matched.id}`
      );
    } else {
      username = `booth_${(claim.company || brandName).replace(/[^a-zA-Z0-9]/g, "_")}_${nanoid(6)}`;
      rawPassword = nanoid(10); // 自动生成密码
      const hashedPwd = await hashPassword(rawPassword);

      // 邮箱策略：始终生成唯一占位邮箱，避免 brand_claim 中的邮箱与现有 User 冲突
      const userEmail = `booth_${nanoid(8)}@booth.shendiao.com`;

      const created = await prisma.user.create({
        data: {
          username,
          passwordHash: hashedPwd,
          email: userEmail,
          phone: claim.phone,
          companyName: claim.company || brandName,
          country: claim.country || "中国",
          role: "seller", // seller = merchant
          isActive: true,
          credits: 0, // 与网页/小程序注册口径一致：先置 0，再由幂等礼包补发
        },
        select: { id: true, username: true, credits: true },
      });
      user = created;

      // 与 src/app/api/auth/register/route.ts:93-94 口径完全一致
      const gift = await grantRegisterGiftIfNeeded(created.id);
      finalCredits = (created.credits ?? 0) + (gift.granted ? gift.amount : 0);
      console.log(
        `[approve] 未命中已有账号 → 新建 User ${created.id}，注册礼包 granted=${gift.granted} amount=${gift.amount}，最终积分=${finalCredits}。claim=${claim.id}`
      );
    }

    // 5. 创建 Booth（无论复用还是新建都必须建——这是展台，不是账号）
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
    // 邮件链接站点感知 + 收件人语种（ExpoRegistration.locale，缺省 zh）
    const mailOrigin = request.nextUrl.origin;
    const mailLocale = claim.locale || "zh";

    // 文案分流：复用场景绝不出现账号/密码（老账号有自己的密码，平台不掌握、更不重置）
    const mailSubject = reused
      ? `🎉 ${brandName} 展台已开通，请用原有账号登录查看`
      : `🎉 ${brandName} 已成功入驻神雕农机·始终展`;

    const mailHtml = reused
      ? `
          <h2>您好，${claim.name}！</h2>
          <p><strong>${brandName}</strong> 的展台已在 <strong>神雕农机·永不落幕的农机世界展会</strong> 开通。</p>
          <h3>您的展台信息</h3>
          <ul>
            <li>品牌名称：${brandName}</li>
            <li>登录方式：请使用您原有的神雕农机账号（${username || "已注册账号"}）登录查看</li>
          </ul>
          <p>您此前已注册过神雕农机账号，本次认领已直接关联到该账号，<strong>无需新建账号，密码保持不变</strong>。</p>
          <p><a href="${mailOrigin}/${mailLocale}/expo/booth/${booth.id}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;">进入我的展台 →</a></p>
          <p style="margin-top:24px;color:#666;font-size:12px;">如忘记密码，请在登录页使用"忘记密码"功能自助重置。</p>
        `
      : `
          <h2>祝贺您，${claim.name}！</h2>
          <p><strong>${brandName}</strong> 已成功入驻 <strong>神雕农机·永不落幕的农机世界展会</strong>。</p>
          <h3>您的自助展台信息</h3>
          <ul>
            <li>品牌名称：${brandName}</li>
            <li>登录账号：${username}</li>
            <li>登录密码：${rawPassword}</li>
          </ul>
          <p>登录后即可管理您的展品、查看询盘。</p>
          <p><a href="${mailOrigin}/${mailLocale}/expo/booth/${booth.id}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;">进入我的展台 →</a></p>
          <p style="margin-top:24px;color:#666;font-size:12px;">建议首次登录后立即修改密码。</p>
        `;

    const mailText = reused
      ? `${claim.name} 您好！${brandName} 的展台已在神雕农机始终展开通。\n本次认领已关联到您原有的神雕农机账号（${username || "已注册账号"}），密码保持不变，请直接用原账号登录查看。\n\n展台地址：${mailOrigin}/${mailLocale}/expo/booth/${booth.id}\n如忘记密码，请在登录页自助重置。`
      : `祝贺您！${brandName} 已成功入驻神雕农机始终展。\n登录账号：${username}\n登录密码：${rawPassword}\n\n登录后管理展品：${mailOrigin}/${mailLocale}/expo/booth/manage`;

    if (emailValid) {
      try {
        // sendEmail 旧式签名返回 boolean：true=成功，false=缺 key / API 失败（已内部降级记录）
        emailSent = await sendEmail({
          to: recipientEmail,
          subject: mailSubject,
          html: mailHtml,
          text: mailText,
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
    // 复用场景必须跳过：现有阿里云模板变量只有 {brand, account, password}（见 src/lib/sms.ts），
    // 既无法表达"用原有账号登录"，又会被迫下发老账号可用的凭证 → 以安全为先，不发。
    const phoneValid = PHONE_RE.test(claim.phone || "");
    let smsSent = false;
    let smsSkippedReason: string | undefined;
    if (reused) {
      smsSkippedReason = "reused_account_no_password_sms";
      console.warn(
        `[approve] 跳过短信发送：claim=${claim.id} 命中已有账号（${matchedBy}）→ 不向老账号下发含密码短信，请以邮件/其他方式通知`
      );
    } else if (phoneValid) {
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

    // 复用分支不下发任何可用的账号/密码字段
    const credentialFields = reused ? {} : { username, rawPassword };

    return NextResponse.json({
      success: true,
      data: {
        boothId: booth.id,
        userId: user.id,
        reused,
        matchedBy,
        credits: finalCredits,
        ...credentialFields,
        url: `/expo/booth/${booth.id}`,
        emailSent,
        emailSkippedReason,
        smsSent,
        smsSkippedReason,
        notifySummary,
      },
      message: reused
        ? `Brand approved. Booth created on existing account (matchedBy=${matchedBy}). Notify summary: ${notifySummary}.`
        : `Brand approved. Booth created. Notify summary: ${notifySummary}.`,
    });
  } catch (error) {
    console.error("Approve error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
