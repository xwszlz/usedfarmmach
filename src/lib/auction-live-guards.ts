/**
 * P2 真实拍卖（LIVE）共享守卫
 *
 * - assertCnOnly：真实拍卖仅限 .cn 站点（路径C 合规硬开关，避免 .com 触国内拍卖资质红线）。
 * - assertUser：任意已登录用户（报名 / 竞价）。
 * - assertAuctionAdmin：平台管理员 / 超级管理员（发布 / 保证金确认 / 结算 等平台运营操作）。
 * - assertAuctionStaff：平台身份（超管 / 管理员，仅代录）**或** 合作持牌机构操作员（法定落槌主体，落槌权，合规红线 #1）。
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

/** 平台管理员 / 超级管理员（发布 / 保证金确认 / 结算 等平台运营操作） */
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
 * 两类合法身份：
 *   1. super_admin / admin   —— 平台身份（仅可代录，recorder=platform_proxy）；
 *   2. auctioneer            —— 合作持牌机构操作员（法定落槌主体，recorder=licensed_agency）。
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

  if (role === "super_admin") {
    return { ok: true, payload, liveRole: "platform_super", label: "平台超级管理员（代录）" };
  }
  // 平台管理员：一律按平台身份处理（recorder = platform_proxy），必须在此提前返回。
  // ⚠️ 不得放行到底部的 Auctioneer 档案查询 —— 否则一个恰好有拍卖师档案的 admin
  //    会被判为「合作持牌机构操作员」并被记为法定落槌主体，触「平台不得成为拍卖人」红线。
  if (role === "admin") {
    return { ok: true, payload, liveRole: "platform_admin", label: "平台管理员（代录）" };
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
 * 流拍前置校验（轻）—— 宣布流拍同为拍卖师的行为，但此时无成交、无落槌，
 * 故只要求「已指派主持拍卖师」+「已指定落槌主体（合作持牌拍卖机构）」两项配置到位，
 * 不校验机构当前状态（机构停牌时仍应允许把已开场的场次正常收口）。
 */
export function assertPassPrerequisite(auction: {
  auctioneerId?: string | null;
  licensedAgencyId?: string | null;
}): Guard {
  if (!auction.auctioneerId) {
    return {
      ok: false,
      error: NextResponse.json(
        { success: false, error: "该场拍卖未指派主持拍卖师，不得宣布流拍（网络拍卖会应由拍卖师主持）" },
        { status: 409 }
      ),
    };
  }
  if (!auction.licensedAgencyId) {
    return {
      ok: false,
      error: NextResponse.json(
        { success: false, error: "该场拍卖未指定落槌主体（合作持牌拍卖机构），不得宣布流拍" },
        { status: 409 }
      ),
    };
  }
  return { ok: true, payload: null };
}

/**
 * 落槌主体校验（合规红线 #1）——返回该场拍卖的持牌机构与主持拍卖师。
 *
 * 拦截条件（任一不满足即拒绝），共 7 个出口：
 *   1. 该场拍卖未指派主持拍卖师（auctioneerId 为空）            → 409
 *   2. 主持拍卖师档案不存在                                    → 409
 *   3. 主持拍卖师未登记执业注册所属持牌机构                     → 409
 *   4. 该持牌机构档案不存在                                    → 409
 *   5. 该持牌机构状态非 ACTIVE（失效、吊销、暂停即自动下线）     → 403
 *   6. 该场拍卖未指定落槌主体（licensedAgencyId 为空）          → 409
 *   7. 主持拍卖师所属机构与该场落槌机构不一致（跨机构主持）      → 409
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
