/**
 * 拍卖师挂靠管理 API（路径C 资质准备 · S5 P1 骨架）
 *
 * GET  /api/admin/auctioneers  — 列表（仅 admin/super_admin），?q= 按姓名/证书号/电话检索
 * POST /api/admin/auctioneers  — 录入挂靠拍卖师（licenseNo 唯一）
 *
 * 鉴权：复用 getTokenFromHeaders + verifyToken（与 analytics 路由一致）。
 *  role ∉ {admin, super_admin} → 403（拍卖师管理属敏感操作，editor/seller 不可见）。
 *
 * 说明：Auctioneer.userId 为逻辑外键（可空，支持外部挂靠拍卖师无平台账号）。
 *       P1 仅建档案，hostedCount 由 P2 真实主持时回写留痕。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

  const q = new URL(req.url).searchParams.get("q")?.trim();
  const where = q
    ? {
        OR: [
          { realName: { contains: q } },
          { licenseNo: { contains: q } },
          { phone: { contains: q } },
        ],
      }
    : {};

  try {
    const auctioneers = await prisma.auctioneer.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: auctioneers });
  } catch (err) {
    console.error("Auctioneer list error:", err);
    return NextResponse.json({ success: false, error: "加载拍卖师列表失败" }, { status: 500 });
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

  const licenseNo = typeof body.licenseNo === "string" ? body.licenseNo.trim() : "";
  const realName = typeof body.realName === "string" ? body.realName.trim() : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const remark = typeof body.remark === "string" && body.remark.trim() ? body.remark.trim() : null;
  const userId = typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : null;
  const isAffiliated = body.isAffiliated === false ? false : true;

  if (!licenseNo || !realName) {
    return NextResponse.json(
      { success: false, error: "缺少必填字段：licenseNo（执业证书编号）、realName（姓名）" },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.auctioneer.create({
      data: {
        licenseNo,
        realName,
        phone,
        remark,
        userId,
        isAffiliated,
      },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (err: unknown) {
    // 证书编号唯一约束冲突（Prisma P2002）
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { success: false, error: "该拍卖师执业证书编号已存在" },
        { status: 409 }
      );
    }
    console.error("Auctioneer create error:", err);
    return NextResponse.json({ success: false, error: "录入失败" }, { status: 500 });
  }
}
