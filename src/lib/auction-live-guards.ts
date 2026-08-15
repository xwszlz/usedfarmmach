/**
 * P2 真实拍卖（LIVE）共享守卫
 *
 * - assertCnOnly：真实拍卖仅限 .cn 站点（路径C 合规硬开关，避免 .com 触国内拍卖资质红线）。
 * - assertUser：任意已登录用户（报名 / 竞价）。
 * - assertAuctionAdmin：平台管理员 / 超级管理员（发布 / 落槌 / 结算 等敏感操作）。
 *
 * 复用既有 @/lib/auth 的 getTokenFromHeaders + verifyToken（返回 { userId, role, tier }）。
 */

import { NextRequest, NextResponse } from "next/server";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { isCnSite } from "@/config/site";

type AuthPayload = ReturnType<typeof verifyToken>;

export type Guard =
  | { ok: true; payload: AuthPayload | null }
  | { error: NextResponse };

/** 真实拍卖（LIVE）仅限 .cn 站点 */
export function assertCnOnly(): Guard {
  if (!isCnSite()) {
    return {
      error: NextResponse.json({ success: false, error: "真实拍卖仅限 .cn 站点" }, { status: 403 }),
    };
  }
  return { ok: true, payload: null };
}

/** 任意已登录用户（报名 / 竞价） */
export function assertUser(req: NextRequest): Guard {
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    return { error: NextResponse.json({ success: false, error: "请先登录" }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ success: false, error: "Token 无效" }, { status: 401 }) };
  }
  return { ok: true, payload };
}

/** 平台管理员 / 超级管理员（发布 / 落槌 / 结算 等敏感操作） */
export function assertAuctionAdmin(req: NextRequest): Guard {
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    return { error: NextResponse.json({ success: false, error: "请先登录" }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ success: false, error: "Token 无效" }, { status: 401 }) };
  }
  if (payload.role !== "admin" && payload.role !== "super_admin") {
    return {
      error: NextResponse.json({ success: false, error: "权限不足（需管理员）" }, { status: 403 }),
    };
  }
  return { ok: true, payload };
}
