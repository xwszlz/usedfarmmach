/**
 * 卖家联系邮箱验证 —— 第 2 步：点邮件链接完成验证
 * GET /api/seller/products/contact-email/verify?token=...&locale=zh
 *
 * 判定顺序（任一不满足即失败跳回，不改任何数据）：
 * 1. 令牌可验签、用途必须是 verify_contact_email、未过期
 * 2. 令牌里的 productId 对应产品仍存在
 * 3. 产品当前 contactEmail 与令牌里的邮箱一致（卖家中途改了邮箱 ⇒ 旧链接自动失效）
 *
 * 成功后只写 `contactEmailVerifiedAt`；**不自动打开公开展示**——公开是卖家在编辑页的
 * 独立勾选（老板口径：默认隐藏，卖家可自愿公开）。
 *
 * `.cn` 是 Next standalone，GET 路由必须显式 force-dynamic，否则会被构建期静态固化。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyEmailToken } from "@/lib/email-token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const localeParam = request.nextUrl.searchParams.get("locale") || "zh";
  const locale = /^[a-z]{2}$/.test(localeParam) ? localeParam : "zh";
  const origin = request.nextUrl.origin;

  const fail = (reason: string, productId?: string) => {
    const back = productId
      ? `${origin}/${locale}/seller/products/${productId}/edit?emailVerifyError=${encodeURIComponent(reason)}`
      : `${origin}/${locale}/seller/products?emailVerifyError=${encodeURIComponent(reason)}`;
    return NextResponse.redirect(back, { status: 307 });
  };

  const payload = token ? verifyEmailToken(token, "verify_contact_email") : null;
  if (!payload?.productId || !payload.email) return fail("invalid_token");

  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
    select: { id: true, contactEmail: true },
  });
  if (!product) return fail("product_not_found");

  const current = (product.contactEmail || "").trim().toLowerCase();
  const expected = payload.email.trim().toLowerCase();
  if (!current || current !== expected) return fail("email_changed", product.id);

  await prisma.product.update({
    where: { id: product.id },
    data: { contactEmailVerifiedAt: new Date(), contactEmailVerifySentAt: null },
  });

  return NextResponse.redirect(
    `${origin}/${locale}/seller/products/${product.id}/edit?emailVerified=1`,
    { status: 307 }
  );
}
