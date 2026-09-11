/**
 * P2 真实拍卖（LIVE）共享守卫
 *
 * - assertCnOnly：真实拍卖仅限 .cn 站点（路径C 合规硬开关，避免 .com 触国内拍卖资质红线）。
 * - assertUser：任意已登录用户（报名 / 竞价）。
 * - assertAuctionAdmin：平台管理员 / 超级管理员（发布 / 保证金确认 / 结算 等平台运营操作）。
 * - assertAuctionStaff：平台超管 / 平台拍卖运营岗 **或** 合作持牌机构操作员（落槌权，合规红线 #1）。
 *   落槌权必须落在持牌拍卖机构手上，平台方仅可代录，平台不得成为事实上的拍卖人。
 *
 * 复用既有 @/lib/auth 的 getTokenFromHeaders + verifyToken（返回 { userId, role, tier }）。
 */

import { NextRequest, NextResponse } from "next/server";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { isCnSite, siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";

type AuthPayload = ReturnType<typeof verifyToken>;

export type Guard =
  | { ok: true; payload: AuthPayload | null }
  | { ok: false; error: NextResponse };

/** 真实拍卖（LIVE）仅限 .cn 站点 */
export function assertCnOnly(): Guard {
  if (!isCnSite()) {
    return {
      ok: false,
      error: NextResponse.json({ success: false, error: "真实拍卖仅限 .cn 站点" }, { status: 403 }),
    };
  }
  return { ok: true, payload: null };
}

/** 任意已登录用户（报名 / 竞价） */
export function assertUser(req: NextRequest): Guard {
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    return { ok: false, error: NextResponse.json({ success: false, error: "请先登录" }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { ok: false, error: NextResponse.json({ success: false, error: "Token 无效" }, { status: 401 }) };
  }
  return { ok: true, payload };
}

/** 平台管理员 / 超级管理员（发布 / 落槌 / 结算 等敏感操作） */
export function assertAuctionAdmin(req: NextRequest): Guard {
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    return { ok: false, error: NextResponse.json({ success: false, error: "请先登录" }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { ok: false, error: NextResponse.json({ success: false, error: "Token 无效" }, { status: 401 }) };
  }
  if (payload.role !== "admin" && payload.role !== "super_admin") {
    return {
      ok: false,
      error: NextResponse.json({ success: false, error: "权限不足（需管理员）" }, { status: 403 }),
    };
  }
  return { ok: true, payload };
}

/**
 * 拍卖业务操作身份（合规红线 #1）——落槌权归合作持牌拍卖机构。
 *
 * 三类合法身份：
 *   1. super_admin                —— 平台超管（过渡期代录 / 应急）
 *   2. admin + dept="auction"     —— 平台拍卖运营岗（受持牌机构书面指派，仅可代录）
 *   3. auctioneer                 —— 合作持牌机构操作员（法定落槌主体）
 *
 * 「auctioneer」身份判定（Auctioneer.userId 逻辑外键 + 执业注册归属持牌机构）：
 *   - 该用户已录入 Auctioneer 档案；
 *   - 该档案已登记 licensedAgencyId（执业关系明确挂在某持牌机构名下）；
 *   - 该持牌机构状态为 ACTIVE；
 *   - 若未挂机构，则回退到 auctionLicenseNo 配置（兼容单机构早期过渡）。
 *
 * 注意：payload.role 为 admin 的用户即便同时有 Auctioneer 档案，也按平台身份处理
 *      （不升级为法定落槌主体）。
 */
export async function assertAuctionStaff(
  req: NextRequest
): Promise<Guard & { liveRole?: string; label?: string }> {
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    return { ok: false, error: NextResponse.json({ success: false, error: "请先登录" }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { ok: false, error: NextResponse.json({ success: false, error: "Token 无效" }, { status: 401 }) };
  }
  if (!payload.userId) {
    return { ok: false, error: NextResponse.json({ success: false, error: "Token 无效" }, { status: 401 }) };
  }

  const role = (payload as { role?: string }).role;
  const dept = (payload as { dept?: string }).dept;

  if (role === "super_admin") {
    return { ok: true, payload, liveRole: "platform_super", label: "平台超级管理员（代录）" };
  }
  if (role === "admin" && dept === "auction") {
    return { ok: true, payload, liveRole: "platform_ops", label: "平台拍卖运营岗（代录）" };
  }

  // 合作持牌机构操作员
  try {
    const auctioneer = await prisma.auctioneer.findFirst({
      where: { userId: payload.userId },
      orderBy: { createdAt: "asc" },
    });
    if (auctioneer) {
      let agencyActive = false;
      if (auctioneer.licensedAgencyId) {
        const agency = await prisma.licensedAuctionAgency.findUnique({
          where: { id: auctioneer.licensedAgencyId },
        });
        agencyActive = !!agency && agency.status === "ACTIVE";
      } else {
        agencyActive = !!siteConfig.compliance.auctionLicenseNo;
      }
      if (agencyActive) {
        return {
          ok: true,
          payload,
          liveRole: "licensed_agency",
          label: `合作持牌机构操作员·${auctioneer.realName}`,
        };
      }
    }
  } catch (err) {
    console.error("assertAuctionStaff auctioneer lookup error:", err);
  }

  return {
    ok: false,
    error: NextResponse.json(
      {
        success: false,
        error: "权限不足：落槌权归合作持牌拍卖机构（须以持牌机构登记的拍卖师账号操作）",
      },
      { status: 403 }
    ),
  };
}

/**
 * 落槌主体校验（合规红线 #1）——返回该场拍卖的持牌机构与主持拍卖师。
 *
 * 拦截条件（任一不满足即拒绝）：
 *   1. 该场拍卖未指定主持拍卖师（auctioneerId）；
 *   2. 该拍卖师执业注册未归属任何持牌机构；
 *   3. 归属的持牌机构不存在 / 状态非 ACTIVE（失效、吊销、暂停即自动下线）；
 *   4. 该场拍卖未指定落槌主体机构（licensedAgencyId）；
 *   5. 拍卖师归属机构 ≠ 该场落槌机构（跨机构主持 = 拍卖人错位）。
 *
 * 若落槌方为平台身份（非 licensed_agency），recorder 记为 platform_proxy ——
 * 平台只是替持牌机构录入，不改变拍卖人认定。
 */
export async function assertHammerPrivilege(
  auction: {
    id: string;
    auctioneerId?: string | null;
    licensedAgencyId?: string | null;
  },
  liveRole?: string
): Promise<
  | {
      ok: true;
      agencyId: string;
      agencyName: string;
      agencyLicenseNo: string;
      auctioneerName: string;
      auctioneerLicenseNo: string;
      recorder: string;
    }
  | { ok: false; error: NextResponse }
> {
  const deny = (msg: string, status = 403) => ({
    ok: false as const,
    error: NextResponse.json({ success: false, error: msg }, { status }),
  });

  if (!auction.auctioneerId) {
    return deny("该场拍卖未指派主持拍卖师，落槌不合规（网络拍卖会应由拍卖师主持）", 409);
  }

  const auctioneer = await prisma.auctioneer.findUnique({ where: { id: auction.auctioneerId } });
  if (!auctioneer) {
    return deny("主持拍卖师档案不存在，落槌不合规", 409);
  }
  if (!auctioneer.licensedAgencyId) {
    return deny(
      `主持拍卖师「${auctioneer.realName}」未登记执业注册所属持牌拍卖机构，落槌不合规（请在后台补登其归属机构）`,
      409
    );
  }

  const agency = await prisma.licensedAuctionAgency.findUnique({
    where: { id: auctioneer.licensedAgencyId },
  });
  if (!agency) {
    return deny("主持拍卖师归属的持牌拍卖机构档案不存在，落槌不合规", 409);
  }
  if (agency.status !== "ACTIVE") {
    return deny(`合作持牌拍卖机构「${agency.name}」当前状态为 ${agency.status}，不得落槌`, 403);
  }
  if (!auction.licensedAgencyId) {
    return deny("该场拍卖未指定落槌主体（合作持牌拍卖机构），落槌不合规", 409);
  }
  if (auction.licensedAgencyId !== agency.id) {
    return deny("主持拍卖师所属机构与该场落槌机构不一致，落槌不合规（不得跨机构主持）", 409);
  }

  return {
    ok: true,
    agencyId: agency.id,
    agencyName: agency.name,
    agencyLicenseNo: agency.licenseNo,
    auctioneerName: auctioneer.realName,
    auctioneerLicenseNo: auctioneer.licenseNo,
    recorder: liveRole === "licensed_agency" ? "licensed_agency" : "platform_proxy",
  };
}
