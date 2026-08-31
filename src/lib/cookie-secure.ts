/**
 * 根据请求上下文判断 cookie 是否应带 secure 属性。
 * - 实际协议为 https → true
 * - 反向代理（如 nginx）以 x-forwarded-proto: https 透传 → true
 * - 其余（HTTP / 未传 request）→ false（保证 cookie 能被存储，避免后台被锁死）
 */
export function isSecureContext(
  req?: { nextUrl?: { protocol?: string }; headers?: { get?: (key: string) => string | null } }
): boolean {
  if (!req) return false;
  if (req.nextUrl?.protocol === "https:") return true;
  if (req.headers?.get?.("x-forwarded-proto") === "https") return true;
  return false;
}
