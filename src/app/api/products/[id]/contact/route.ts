/**
 * 开放直连 P0：读取产品卖家自留的联系方式
 * - 必须登录（Bearer token）才能读取；未登录/过期 → 401
 * - 只返回产品上卖家自愿填写的 4 个联系字段，不返回卖家账号任何其他 PII
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

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
      contactName: true,
      contactPhone: true,
      contactWechat: true,
      contactEmail: true,
    },
  });
  if (!product) {
    return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: product });
}
