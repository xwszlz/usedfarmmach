/**
 * P2 真实拍卖（LIVE）— 竞价（英式递增）
 * POST /api/auctions/live/bid
 * 权限：已报名且保证金已确认的竞买人  站点：仅 .cn
 *
 * 规则：状态须 LIVE_BIDDING；出价 ≥ 当前最高价 + 加价幅度（priceIncrement）；须在 endTime 前；
 *      事务内翻转 isWinning 并更新拍卖最高价 / 出价人数。
 * TODO: 反狙击延时（临近结束的出价自动延长 endTime）。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCnOnly, assertUser } from "@/lib/auction-live-guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cn = assertCnOnly();
  if (!cn.ok) return cn.error;
  const user = assertUser(req);
  if (!user.ok) return user.error;
  const bidderId = user.payload!.userId;

  let body: { auctionId?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求体解析失败" }, { status: 400 });
  }
  const auctionId = typeof body.auctionId === "string" ? body.auctionId.trim() : "";
  const amount = Number(body.amount);
  if (!auctionId) {
    return NextResponse.json({ success: false, error: "缺少 auctionId" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ success: false, error: "amount 须为正数" }, { status: 400 });
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
  if (auction.endTime && new Date() > auction.endTime) {
    return NextResponse.json({ success: false, error: "竞价已结束" }, { status: 409 });
  }

  const reg = await prisma.auctionRegistration.findUnique({
    where: { auctionId_bidderId: { auctionId, bidderId } },
  });
  if (!reg || !reg.eligible) {
    return NextResponse.json({ success: false, error: "未完成保证金，无竞价资格" }, { status: 403 });
  }

  const top = await prisma.bid.findFirst({ where: { auctionId, isWinning: true } });
  const floor = top
    ? top.amount + auction.priceIncrement
    : Math.max(auction.startPrice, auction.reservePrice ?? auction.startPrice);
  if (amount < floor) {
    return NextResponse.json({ success: false, error: `出价需 ≥ ${floor}` }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    if (top) {
      await tx.bid.update({ where: { id: top.id }, data: { isWinning: false } });
    }
    const prior = await tx.bid.count({ where: { auctionId, bidderId } });
    const bid = await tx.bid.create({
      data: { auctionId, bidderId, amount, isWinning: true },
    });
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        winningBid: amount,
        totalBids: { increment: 1 },
        totalBidders: { increment: prior === 0 ? 1 : 0 },
      },
    });
    return bid;
  });

  return NextResponse.json({ success: true, data: result, floor });
}
