/**
 * 《采集数据上架》审核后台 —— 鉴权守卫
 *
 * 复用 `@/lib/auth` 的 `getTokenFromHeaders` + `verifyToken`（与
 * `src/app/api/admin/analytics/views/route.ts` 同范式）。
 *
 * 角色限 `admin` / `super_admin`（**不含 editor**，老板已拍板）。
 * ⚠️ 关键：JWT 内的 role 可能已过期（用户被降权），因此**以 DB `prisma.user.role`
 * 为准**，并校验 `isActive`。
 */
import type { NextRequest } from "next/server";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type GuardOk = { ok: true; userId: string; role: string };
export type GuardErr = {
  ok: false;
  status: 401 | 403;
  body: { success: false; error: string; code: string };
};
export type GuardResult = GuardOk | GuardErr;

/** 允许访问采集审核的 DB 角色（⚠️ 不含 editor） */
const ALLOWED_ROLES = new Set(["admin", "super_admin"]);

/**
 * 校验当前请求是否具备「采集审核」权限。
 * 通过 → `{ ok: true, userId, role }`；否则 → `{ ok: false, status, body }`。
 */
export async function requireRawListingAdmin(req: NextRequest): Promise<GuardResult> {
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    return { ok: false, status: 401, body: { success: false, error: "请先登录", code: "UNAUTHORIZED" } };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { ok: false, status: 401, body: { success: false, error: "Token无效", code: "UNAUTHORIZED" } };
  }
  // 以 DB 真身为准（防 JWT 内 role 过期 / 被降权）
  const u = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true, isActive: true },
  });
  if (!u || !u.isActive || !ALLOWED_ROLES.has(u.role)) {
    return {
      ok: false,
      status: 403,
      body: { success: false, error: "权限不足（仅 admin/super_admin）", code: "FORBIDDEN" },
    };
  }
  return { ok: true, userId: payload.userId, role: u.role };
}

/** 供 server 组件复用的纯角色判定 */
export function isRawListingAdminRole(role: string | null | undefined): boolean {
  return ALLOWED_ROLES.has(role ?? "");
}
