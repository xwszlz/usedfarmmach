/**
 * P2 真实拍卖（LIVE）— 结算
 * POST /api/auctions/live/settle
 * 权限：平台管理员  站点：仅 .cn
 *
 * 资金清算（路径C：持牌拍卖企业代收代付，平台不碰资金）：
 *   1) 买受人价款到账（buyerPaid 已含买方佣金）；
 *   2) 扣除平台佣金后，净额支付委托人（sellerId）。
 * STUB：实际调用持牌代收代付 / 收付通结算层完成资金转移；本接口仅落库状态。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCnOnly, assertAuctionAdmin } from "@/lib/auction-live-guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cn = assertCnOnly();
  if (!cn.ok) return cn.error;
  const admin = assertAuctionAdmin(req);
  if (!admin.ok) return admin.error;

  let body: { auctionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求体解析失败" }, { status: 400 });
  }
  const auctionId = typeof body.auctionId === "string" ? body.auctionId.trim() : "";
  if (!auctionId) {
    return NextResponse.json({ success: false, error: "缺少 auctionId" }, { status: 400 });
  }

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) {
    return NextResponse.json({ success: false, error: "拍卖不存在" }, { status: 404 });
  }
  if (auction.status !== "LIVE_HAMMERED") {
    return NextResponse.json(
      { success: false, error: "当前不在待结算状态（需 LIVE_HAMMERED）" },
      { status: 409 }
    );
  }
  const settlement = await prisma.settlement.findUnique({ where: { auctionId } });
  if (!settlement || settlement.status !== "PENDING") {
    return NextResponse.json({ success: false, error: "结算单不存在或非待结算" }, { status: 409 });
  }

  // TODO(路径C): 调用持牌代收代付 / 收付通结算层：买受价款 → 扣佣 → 净额付委托人(sellerId)。
  await prisma.$transaction(async (tx) => {
    await tx.settlement.update({
      where: { id: settlement.id },
      data: { status: "SETTLED", settledAt: new Date() },
    });
    await tx.auction.update({
      where: { id: auctionId },
      data: { status: "LIVE_SETTLED", settledAt: new Date() },
    });
  });

  return NextResponse.json({
    success: true,
    note: "结算完成（状态已落库）",
    settlementId: settlement.id,
  });
}
