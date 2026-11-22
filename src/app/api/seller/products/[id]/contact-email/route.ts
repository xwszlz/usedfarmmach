/**
 * 卖家联系邮箱验证 —— 第 1 步：发送验证邮件
 * POST /api/seller/products/[id]/contact-email
 * body: { email?: string, locale?: string }
 *
 * 设计要点（2026-11-22）：
 * - 必须登录，且对产品有编辑权限（owner 或 editor/admin，走 product-edit-auth 同一口径）
 * - 无状态令牌：JWT 签一个 `verify_contact_email` 用途的链接，**不新增任何验证码表**
 * - 发信限频：同一产品 10 分钟内只允许发 1 封（用 `contactEmailVerifySentAt` 落库判定，
 *   不用进程内 Map —— serverless / 双站多实例下内存限流形同不设）
 * - 未验证的 contactEmail 永不作为询价收件人、也永不公开展示（见 contact-visibility.ts）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { checkProductEditPermission, describeEditDenial } from "@/lib/product-edit-auth";
import { signEmailToken } from "@/lib/email-token";
import { sendEmail } from "@/lib/email";
import { normalizeContactEmail, contactEmailChanged } from "@/lib/products/contact-visibility";

export const dynamic = "force-dynamic";

/** 同类邮件最小间隔（毫秒）；10 分钟 ⇒ 单产品每小时最多 6 封 */
const RESEND_INTERVAL_MS = 10 * 60 * 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromHeaders(request.headers);
    const payload = token ? verifyToken(token) : null;
    if (!payload?.userId) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { id } = params;
    const permission = await checkProductEditPermission(payload.userId, id);
    if (!permission.allowed) {
      return NextResponse.json(
        { success: false, error: describeEditDenial(permission) },
        { status: permission.outcome === "not_found" ? 404 : 403 }
      );
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const bodyEmail = typeof body?.email === "string" ? body.email : undefined;
    const locale = typeof body?.locale === "string" && body.locale ? body.locale : "zh";

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        modelName: true,
        contactEmail: true,
        contactEmailVerifySentAt: true,
      },
    });
    if (!product) {
      return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
    }

    const email = normalizeContactEmail(bodyEmail ?? product.contactEmail);
    if (!email) {
      return NextResponse.json(
        { success: false, error: "请先填写有效的联系邮箱" },
        { status: 400 }
      );
    }

    // 限频：从数据库读上次发送时间（不信任客户端）
    if (product.contactEmailVerifySentAt) {
      const elapsed = Date.now() - product.contactEmailVerifySentAt.getTime();
      if (elapsed < RESEND_INTERVAL_MS) {
        const waitMin = Math.ceil((RESEND_INTERVAL_MS - elapsed) / 60000);
        return NextResponse.json(
          { success: false, error: `验证邮件刚发过，请 ${waitMin} 分钟后再试` },
          { status: 429 }
        );
      }
    }

    // 卖家在编辑页改了邮箱再点验证：顺手把新邮箱落库，并作废旧验证状态，
    // 否则会出现「验证了 A 邮箱，页面展示的却是 B 邮箱」。
    const changed = contactEmailChanged(product.contactEmail, email);
    await prisma.product.update({
      where: { id },
      data: {
        contactEmail: email,
        ...(changed ? { contactEmailVerifiedAt: null } : {}),
        contactEmailVerifySentAt: new Date(),
      },
    });

    const verifyTokenValue = signEmailToken({
      userId: payload.userId,
      email,
      purpose: "verify_contact_email",
      productId: id,
    });
    const origin = request.nextUrl.origin;
    const link = `${origin}/api/seller/products/contact-email/verify?token=${encodeURIComponent(
      verifyTokenValue
    )}&locale=${encodeURIComponent(locale)}`;

    const ok = await sendEmail({
      to: email,
      subject: "【神雕农机】请验证你的联系邮箱 / Verify your contact email",
      html: `<div style="font-family:sans-serif;line-height:1.7">
<p>你好，</p>
<p>你在神雕农机为产品「${escapeHtml(product.modelName)}」填写了联系邮箱。请点击下面的链接完成验证，验证通过后该邮箱才可在商品页展示，询价通知也会优先发到这里。</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none">验证邮箱 / Verify email</a></p>
<p style="color:#6b7280;font-size:13px">链接 24 小时内有效。如果这不是你本人操作，请忽略本邮件，邮箱不会被展示也不会被使用。</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
<p style="color:#6b7280;font-size:13px">You added this email as the contact address for「${escapeHtml(product.modelName)}」on UsedFarmMach. Click the link above within 24 hours to verify it. Until verified, the address is neither shown on the product page nor used for inquiry notifications.</p>
</div>`,
      text: `验证你的联系邮箱（24 小时有效）：${link}`,
    });

    if (!ok) {
      // 发信失败时把时间戳退回去，避免卖家被自己的 10 分钟限频挡住却什么都没收到
      await prisma.product.update({
        where: { id },
        data: { contactEmailVerifySentAt: null },
      });
      return NextResponse.json(
        { success: false, error: "验证邮件发送失败，请稍后重试或联系客服" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: { email, sent: true } });
  } catch (error) {
    console.error("[POST /api/seller/products/[id]/contact-email]", error);
    return NextResponse.json({ success: false, error: "发送验证邮件失败" }, { status: 500 });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
