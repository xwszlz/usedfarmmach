/**
 * P2 真实拍卖（LIVE）— 发布 / 开启竞价
 * POST /api/auctions/live/publish
 * 权限：平台管理员  站点：仅 .cn
 *
 * 状态机：LIVE_DRAFT/active → LIVE_OPEN（报名+保证金）→ LIVE_BIDDING（竞价）
 * 前置：auctionMode=LIVE、已指派 auctioneerId、已设 reservePrice（保留价）、已指定落槌主体（licensedAgencyId），且落槌机构与拍卖师归属机构一致且为 ACTIVE。
 * 资金：本接口不碰钱；保证金与结算见 deposit / settle 路由（路径C 持牌代收代付）。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCnOnly, assertAuctionAdmin } from "@/lib/auction-live-guards";

export const dynamic = "force-dynamic";

const PRE_OPEN = ["active", "LIVE_DRAFT", "LIVE_OPEN"];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cn = assertCnOnly();
  if (!cn.ok) return cn.error;
  const admin = assertAuctionAdmin(req);
  if (!admin.ok) return admin.error;

  let body: { auctionId?: string; openBidding?: boolean };
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
  if (auction.auctionMode !== "LIVE") {
    return NextResponse.json({ success: false, error: "该拍卖非 LIVE 模式" }, { status: 400 });
  }
  if (!auction.auctioneerId) {
    return NextResponse.json({ success: false, error: "未指派主持拍卖师（auctioneerId）" }, { status: 400 });
  }
  if (auction.reservePrice == null) {
    return NextResponse.json({ success: false, error: "未设置保留价（reservePrice）" }, { status: 400 });
  }
  if (!auction.licensedAgencyId) {
    return NextResponse.json(
      { success: false, error: "该场拍卖未指定落槌主体（合作持牌拍卖机构），不得开竞价" },
      { status: 400 }
    );
  }
  // 合规红线 #1：落槌主体须与主持拍卖师归属机构一致且机构为 ACTIVE —— 在「开竞价」环节就拦住，
  // 避免场次先开放报名 / 收保证金、到落槌时才发现无合法落槌主体（届时既不能落槌也不能流拍）。
  const [host, agency] = await Promise.all([
    prisma.auctioneer.findUnique({
      where: { id: auction.auctioneerId },
      select: { licensedAgencyId: true },
    }),
    prisma.licensedAuctionAgency.findUnique({
      where: { id: auction.licensedAgencyId },
      select: { status: true, name: true },
    }),
  ]);
  if (!host || host.licensedAgencyId !== auction.licensedAgencyId) {
    return NextResponse.json(
      { success: false, error: "主持拍卖师所属机构与该场落槌机构不一致，不得开竞价（不得跨机构主持）" },
      { status: 409 }
    );
  }
  if (!agency) {
    return NextResponse.json(
      { success: false, error: "落槌主体（合作持牌拍卖机构）档案不存在" },
      { status: 400 }
    );
  }
  if (agency.status !== "ACTIVE") {
    return NextResponse.json(
      { success: false, error: `合作持牌拍卖机构「${agency.name}」当前状态为 ${agency.status}，不得开竞价` },
      { status: 403 }
    );
  }
  if (!PRE_OPEN.includes(auction.status)) {
    return NextResponse.json(
      { success: false, error: `当前状态 ${auction.status} 不可发布` },
      { status: 409 }
    );
  }

  const openBidding = body.openBidding === true;
  const updated = await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: openBidding ? "LIVE_BIDDING" : "LIVE_OPEN",
      startTime: auction.startTime ?? new Date(),
      ...(openBidding && !auction.endTime
        ? { endTime: new Date(Date.now() + 2 * 60 * 60 * 1000) }
        : {}),
    },
  });
  return NextResponse.json({ success: true, data: updated });
}
