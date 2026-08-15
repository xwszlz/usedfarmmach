/**
 * P2 真实拍卖（LIVE）— 落槌
 * POST /api/auctions/live/hammer
 * 权限：平台管理员  站点：仅 .cn
 *
 * 取当前 isWinning 最高价；
 *   - 达保留价 → 落槌（hammerPrice / winnerId / 建结算单 / 拍卖师 hostedCount+1）；
 *   - 未达保留价或无出价 → 流拍（LIVE_PASSED），保证金退还（STUB）。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCnOnly, assertAuctionAdmin } from "@/lib/auction-live-guards";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
  if (auction.status !== "LIVE_BIDDING") {
    return NextResponse.json(
      { success: false, error: "当前不在竞价期（需 LIVE_BIDDING）" },
      { status: 409 }
    );
  }

  const top = await prisma.bid.findFirst({ where: { auctionId, isWinning: true } });
  const reserve = auction.reservePrice;
  const meetsReserve = top != null && (reserve == null || top.amount >= reserve);

  if (!meetsReserve) {
    // 流拍
    await prisma.auction.update({ where: { id: auctionId }, data: { status: "LIVE_PASSED" } });
    // TODO(路径C): 退还保证金（持牌代收代付原路退回）。
    return NextResponse.json({
      success: true,
      passed: true,
      note: "未达保留价，流拍；保证金将退还",
    });
  }

  const hammerPrice = top!.amount;
  const buyerPremium = round2(hammerPrice * 0.03); // 买方佣金 3%
  const sellerCommission = round2(hammerPrice * 0.02); // 卖方佣金 2%
  const commission = round2(buyerPremium + sellerCommission);
  const buyerPaid = round2(hammerPrice + buyerPremium);

  await prisma.$transaction(async (tx) => {
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        status: "LIVE_HAMMERED",
        hammerPrice,
        winnerId: top!.bidderId,
        winningBid: hammerPrice,
      },
    });
    await tx.settlement.upsert({
      where: { auctionId },
      create: { auctionId, buyerPaid, hammerPrice, commission, status: "PENDING" },
      update: { buyerPaid, hammerPrice, commission, status: "PENDING" },
    });
    if (auction.auctioneerId) {
      await tx.auctioneer.update({
        where: { id: auction.auctioneerId },
        data: { hostedCount: { increment: 1 } },
      });
    }
  });

  return NextResponse.json({
    success: true,
    hammerPrice,
    winnerId: top!.bidderId,
    buyerPaid,
    commission,
    note: "落槌成功，待结算（settle 路由，路径C 持牌代收代付）",
  });
}
