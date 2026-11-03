/**
 * mascus 线索池后台 —— SITE 闸门 + 鉴权守卫
 *
 * 为什么**另建**一份而不复用 `@/lib/raw-listing/admin-auth`：
 *   两者当前白名单恰好相同（admin / super_admin），但语义不同 ——
 *   将来「采集上架」放宽到 editor 时，不应顺带把 mascus 线索池（含卖家电话 PII）也放开。
 *   独立一份，改一边不会误伤另一边。
 *
 * 角色以 **DB `prisma.user.role`** 为准（JWT 内的 role 可能已过期/被降权），并校验 `isActive`。
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

/**
 * 允许访问 mascus 线索池的 DB 角色。
 * ⚠️ 不含 editor：`app/admin/layout` 可能放行 editor 进后台，
 * 但线索池含卖家电话明文，**只有 admin/super_admin 能看**。
 */
const ALLOWED_ROLES = new Set(["admin", "super_admin"]);

/** 当前部署站点是否为 `.com`（未设置 `SITE` 时按 `.com` 处理，与 `db.ts` 口径一致） */
export function isMascusSiteAllowed(): boolean {
  return (process.env.SITE ?? "com") === "com";
}

/**
 * SITE 闸门（必须在鉴权**之前**调用）。
 *
 * 理由：`MascusListing` 的 schema 注释明写「本表在 .cn 库中应始终为 0 行，
 * 若发现数据即为合规事故」。因此 `.cn` 侧整个后台接口面必须直接 403。
 *
 * 顺序要求：先 SITE 再鉴权 —— 外部无法凭「401 vs 403」反推 token 是否有效，
 * 也不会在 `.cn` 上产生任何 DB 查询。
 */
export function requireMascusSite(): { ok: true } | GuardErr {
  if (isMascusSiteAllowed()) return { ok: true };
  return {
    ok: false,
    status: 403,
    body: { success: false, error: "mascus 线索池仅部署在 .com 站点", code: "SITE_BLOCKED" },
  };
}

/**
 * 校验当前请求是否具备「mascus 线索池后台」权限。
 * 通过 → `{ ok: true, userId, role }`；否则 → `{ ok: false, status, body }`。
 */
export async function requireMascusAdmin(req: NextRequest): Promise<GuardResult> {
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    return { ok: false, status: 401, body: { success: false, error: "请先登录", code: "UNAUTHORIZED" } };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { ok: false, status: 401, body: { success: false, error: "Token无效", code: "UNAUTHORIZED" } };
  }
  // 以 DB 真身为准（防 JWT 内 role 过期 / 被降权）
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive || !ALLOWED_ROLES.has(user.role)) {
    return {
      ok: false,
      status: 403,
      body: { success: false, error: "权限不足（仅 admin/super_admin）", code: "FORBIDDEN" },
    };
  }
  return { ok: true, userId: payload.userId, role: user.role };
}

/** 供 server 组件复用的纯角色判定 */
export function isMascusAdminRole(role: string | null | undefined): boolean {
  return ALLOWED_ROLES.has(role ?? "");
}
