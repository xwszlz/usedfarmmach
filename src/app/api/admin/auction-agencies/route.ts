/**
 * 合作持牌拍卖机构管理 API（合规红线 #4/#5：资质核验 + 登记 + 台账）
 *
 * GET  /api/admin/auction-agencies       — 列表（含名下拍卖师数 / 场次数）
 * POST /api/admin/auction-agencies       — 录入合作机构（licenseNo 唯一）
 *
 * 鉴权：admin / super_admin。
 *
 * 语义注意（关键）：本表登记的是「合作机构」的《拍卖经营批准证书》，
 *   不是平台自有资质 —— 对外文案不得写成「本公司已取得」。
 *   平台自身不持证，全部真实拍卖由本表机构作为拍卖人依法开展。
 *
 * 资质失效联动：status 改为非 ACTIVE 后，hammer 路由会立即拒绝该机构名下所有落槌
 *   （assertHammerPrivilege 校验 agency.status === "ACTIVE"），无需改代码即自动下线。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const AGENCY_STATUS = ["ACTIVE", "SUSPENDED", "EXPIRED", "REVOKED"];

function assertAdmin(req: NextRequest): { payload: ReturnType<typeof verifyToken> } | { error: NextResponse } {
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    return { error: NextResponse.json({ success: false, error: "请先登录" }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ success: false, error: "Token无效" }, { status: 401 }) };
  }
  if (payload.role !== "admin" && payload.role !== "super_admin") {
    return { error: NextResponse.json({ success: false, error: "权限不足" }, { status: 403 }) };
  }
  return { payload };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if ("error" in guard) return guard.error;

  try {
    const agencies = await prisma.licensedAuctionAgency.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { auctioneers: true, auctions: true } },
      },
    });
    return NextResponse.json({ success: true, data: agencies });
  } catch (err) {
    console.error("Auction agency list error:", err);
    return NextResponse.json({ success: false, error: "加载合作机构列表失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = assertAdmin(req);
  if ("error" in guard) return guard.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求体解析失败" }, { status: 400 });
  }

  const str = (k: string): string | null =>
    typeof body[k] === "string" && (body[k] as string).trim() ? (body[k] as string).trim() : null;

  const name = str("name");
  const licenseNo = str("licenseNo");
  if (!name || !licenseNo) {
    return NextResponse.json(
      { success: false, error: "缺少必填字段：name（机构法定全称）、licenseNo（拍卖经营批准证书编号）" },
      { status: 400 }
    );
  }

  const status = str("status") ?? "ACTIVE";
  if (!AGENCY_STATUS.includes(status)) {
    return NextResponse.json(
      { success: false, error: `status 须为 ${AGENCY_STATUS.join(" | ")}` },
      { status: 400 }
    );
  }

  const licenseValidToRaw = str("licenseValidTo");
  const licenseValidTo = licenseValidToRaw ? new Date(licenseValidToRaw) : null;
  if (licenseValidTo && Number.isNaN(licenseValidTo.getTime())) {
    return NextResponse.json({ success: false, error: "licenseValidTo 日期格式无效" }, { status: 400 });
  }

  const licenseFileUrl = str("licenseFileUrl");

  try {
    const created = await prisma.licensedAuctionAgency.create({
      data: {
        name,
        licenseNo,
        unifiedCreditCode: str("unifiedCreditCode"),
        licenseAuthority: str("licenseAuthority"),
        licenseValidTo,
        contactName: str("contactName"),
        contactPhone: str("contactPhone"),
        status,
        licenseFileUrl,
        remark: str("remark"),
        // 核验留痕：录入即视为已完成人工核验（须线下查验原件后录入）
        licenseVerifiedAt: licenseFileUrl ? new Date() : null,
        licenseVerifiedBy: licenseFileUrl ? guard.payload!.userId : null,
      },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { success: false, error: "该《拍卖经营批准证书》编号已登记" },
        { status: 409 }
      );
    }
    console.error("Auction agency create error:", err);
    return NextResponse.json({ success: false, error: "录入失败" }, { status: 500 });
  }
}
