/**
 * P2 真实拍卖（LIVE）— 落槌
 * POST /api/auctions/live/hammer
 * 权限：合作持牌拍卖机构操作员（法定落槌主体）/ 平台身份（超管·管理员，仅代录）  站点：仅 .cn
 *
 * ⚠️ 合规红线 #1：落槌是「拍卖人」的法定行为。平台不持《拍卖经营批准证书》，
 *    因此落槌权必须落在合作持牌拍卖机构名下 —— 平台身份（含平台管理员）一律记为代录，
 *    不得作为法定落槌主体，也不得升级为 licensed_agency。
 *    且必须同时满足：主持拍卖师已登记于该场落槌的持牌机构、该机构状态为 ACTIVE。
 *    平台身份调用时仅记为「代录」（recorder=platform_proxy），不改变拍卖人认定。
 *
 * 取当前 isWinning 最高价；
 *   - 达保留价 → 落槌（hammerPrice / winnerId / 建结算单 / 拍卖师 hostedCount+1）；
 *   - 未达保留价或无出价 → 流拍（LIVE_PASSED），保证金退还（STUB）；
 *     流拍走 assertPassPrerequisite 轻校验（要求已指派主持拍卖师 + 已指定落槌主体，不查机构状态）。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCnOnly, assertAuctionStaff, assertHammerPrivilege, assertPassPrerequisite } from "@/lib/auction-live-guards";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cn = assertCnOnly();
  if (!cn.ok) return cn.error;
  const staff = await assertAuctionStaff(req);
  if (!staff.ok) return staff.error;

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
    const prereq = assertPassPrerequisite(auction);
    if (!prereq.ok) return prereq.error;
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
  const buyerPremium = round2(hammerPrice * 0.03); // 买方佣金 3%（由合作持牌拍卖机构收取）
  const sellerCommission = round2(hammerPrice * 0.02); // 卖方佣金 2%（由合作持牌拍卖机构收取）
  const commission = round2(buyerPremium + sellerCommission);
  const buyerPaid = round2(hammerPrice + buyerPremium);

  // 合规红线 #1：落槌主体校验（持牌机构 + 其登记拍卖师），不通过不得落槌
  const priv = await assertHammerPrivilege(auction, staff.liveRole);
  if (!priv.ok) return priv.error;

  await prisma.$transaction(async (tx) => {
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        status: "LIVE_HAMMERED",
        hammerPrice,
        winnerId: top!.bidderId,
        winningBid: hammerPrice,
        hammeredAt: new Date(),
        hammeredBy: staff.payload!.userId,
        hammeredByType: priv.recorder,
        hammeredByLabel:
          `${staff.label ?? ""}｜落槌机构：${priv.agencyName}（${priv.agencyLicenseNo}）` +
          `｜主持拍卖师：${priv.auctioneerName}（${priv.auctioneerLicenseNo}）`,
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
    hammeredByType: priv.recorder,
    licensedAgency: { name: priv.agencyName, licenseNo: priv.agencyLicenseNo },
    auctioneer: { name: priv.auctioneerName, licenseNo: priv.auctioneerLicenseNo },
    note: "落槌成功，待结算（settle 路由，路径C 持牌代收代付）",
  });
}
