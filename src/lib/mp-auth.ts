/**
 * 小程序接入鉴权助手
 *
 * 双通道放行（不破坏现有 Web 调用）：
 *  - 经 middleware 已认证的 Web 用户（注入了 x-user-id / x-user-role）
 *  - 携带有效 MP_API_KEY 的小程序请求（x-mp-key 头 或 Authorization: Bearer）
 *
 * 若 MP_API_KEY 未配置，则不强制小程序密钥（开发期放行），仅依赖 Web 登录。
 */

export function isMiniProgramRequest(req: Request): boolean {
  const key = process.env.MP_API_KEY || "";
  if (!key) return false;
  const headerKey =
    req.headers.get("x-mp-key") ||
    req.headers.get("Authorization")?.replace("Bearer ", "") ||
    "";
  return headerKey === key;
}

export function isWebUser(req: Request): boolean {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role");
  return !!(userId && userRole);
}

/** 返回 null 表示放行，否则返回 401 响应 */
export function mpOrWebGuard(req: Request): { status: 401; body: { ok: false; error: string } } | null {
  if (isWebUser(req) || isMiniProgramRequest(req)) return null;
  return { status: 401, body: { ok: false, error: "Unauthorized" } };
}
