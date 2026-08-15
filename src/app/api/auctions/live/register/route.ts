/**
 * P2 真实拍卖（LIVE）— 报名
 * POST /api/auctions/live/register
 * 权限：已登录用户  站点：仅 .cn
 *
 * 创建 AuctionRegistration（唯一约束 auctionId+bidderId），记录应缴保证金金额（取自 auction.deposit）。
 * 实际保证金支付由 deposit 路由发起（持牌代收代付，路径C）。
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
  if (auction.status !== "LIVE_OPEN") {
    return NextResponse.json(
      { success: false, error: "当前不在报名期（需 LIVE_OPEN）" },
      { status: 409 }
    );
  }

  const existing = await prisma.auctionRegistration.findUnique({
    where: { auctionId_bidderId: { auctionId, bidderId } },
  });
  if (existing) {
    return NextResponse.json({ success: true, data: existing, alreadyRegistered: true });
  }

  const reg = await prisma.auctionRegistration.create({
    data: { auctionId, bidderId, depositAmount: auction.deposit },
  });
  return NextResponse.json({ success: true, data: reg, depositRequired: auction.deposit });
}
