/**
 * 开放直连 P0：读取产品卖家自留的联系方式
 * - 必须登录（Bearer token）才能读取；未登录/过期 → 401
 * - 只返回产品上卖家自愿填写的 4 个联系字段，不返回卖家账号任何其他 PII
 *
 * 2026-11-22 增量（卖家邮箱默认隐藏，老板拍板）：
 * - `contactEmail` 是**唯一需要字段级过滤**的字段：只有 `contactEmailPublic === true`
 *   且邮箱已验证时才返回明文，否则置 null（前端据此不渲染邮箱行）。
 *   其余 3 个字段（联系人 / 电话 / 微信）行为一行不变。
 * - 卖家本人看自己产品时不过滤，否则卖家会以为自己的邮箱丢了。
 * - 判定统一走 `@/lib/products/contact-visibility`，与询价收件人共用同一套口径。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { shouldExposeContactEmail } from "@/lib/products/contact-visibility";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) {
    return NextResponse.json({ success: false, error: "请先登录后查看卖家联系方式" }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return NextResponse.json({ success: false, error: "登录已过期，请重新登录" }, { status: 401 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      sellerId: true,
      contactName: true,
      contactPhone: true,
      contactWechat: true,
      contactEmail: true,
      contactEmailPublic: true,
      contactEmailVerifiedAt: true,
    },
  });
  if (!product) {
    return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
  }

  const isOwner = product.sellerId === payload.userId;
  const exposeEmail = isOwner || shouldExposeContactEmail(product);

  return NextResponse.json({
    success: true,
    data: {
      contactName: product.contactName,
      contactPhone: product.contactPhone,
      contactWechat: product.contactWechat,
      contactEmail: exposeEmail ? product.contactEmail : null,
    },
  });
}
