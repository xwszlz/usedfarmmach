/**
 * P2 真实拍卖（LIVE）— 保证金
 * POST /api/auctions/live/deposit
 * 站点：仅 .cn
 *
 * action=create：已报名用户发起保证金支付单（持牌代收代付，路径C）。
 *   —— 资金不入境平台，平台仅记录意向；STUB 返回 mock payUrl，待接入持牌清算。
 * action=confirm：保证金到账确认（由持牌代收代付回拨 / 管理员确认）。
 *   —— 置 depositPaid + eligible=true，竞买人获得竞价资格。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCnOnly, assertUser, assertAuctionAdmin } from "@/lib/auction-live-guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cn = assertCnOnly();
  if (!cn.ok) return cn.error;

  let body: { action?: string; auctionId?: string; registrationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求体解析失败" }, { status: 400 });
  }
  const action = body.action;

  if (action === "create") {
    const user = assertUser(req);
    if (!user.ok) return user.error;
    const bidderId = user.payload!.userId;
    const auctionId = typeof body.auctionId === "string" ? body.auctionId.trim() : "";
    if (!auctionId) {
      return NextResponse.json({ success: false, error: "缺少 auctionId" }, { status: 400 });
    }
    const reg = await prisma.auctionRegistration.findUnique({
      where: { auctionId_bidderId: { auctionId, bidderId } },
    });
    if (!reg) {
      return NextResponse.json({ success: false, error: "请先报名" }, { status: 400 });
    }
    if (reg.depositPaid) {
      return NextResponse.json({ success: true, data: reg, note: "保证金已缴" });
    }
    // TODO(路径C): 调用持牌代收代付 / 收付通结算层创建保证金支付单，支付成功回拨 action=confirm。
    const payUrl = `https://pay.licensed-auction.example/deposit?reg=${reg.id}`;
    return NextResponse.json({
      success: true,
      payUrl,
      mock: true,
      note: "STUB：待接入持牌代收代付，支付成功回拨 action=confirm",
    });
  }

  if (action === "confirm") {
    const admin = assertAuctionAdmin(req);
    if (!admin.ok) return admin.error;
    const registrationId = typeof body.registrationId === "string" ? body.registrationId.trim() : "";
    if (!registrationId) {
      return NextResponse.json({ success: false, error: "缺少 registrationId" }, { status: 400 });
    }
    const reg = await prisma.auctionRegistration.findUnique({ where: { id: registrationId } });
    if (!reg) {
      return NextResponse.json({ success: false, error: "报名记录不存在" }, { status: 404 });
    }
    const updated = await prisma.auctionRegistration.update({
      where: { id: registrationId },
      data: { depositPaid: true, depositConfirmedAt: new Date(), eligible: true },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  return NextResponse.json({ success: false, error: "action 须为 create | confirm" }, { status: 400 });
}
