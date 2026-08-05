/**
 * Edge-compatible JWT verification (Web Crypto API)
 *
 * 背景：Next.js Middleware 运行在 Edge Runtime，不支持 `jsonwebtoken`（Node.js-only）。
 * 本文件用浏览器/Edge 都内置的 Web Crypto API 验签 HS256。
 *
 * 与 `src/lib/auth.ts` 的 `verifyToken` 行为一致：
 *   - 同一个 JWT_SECRET
 *   - HS256
 *   - 验证 exp 过期时间
 *   - 解析 payload 为 { userId, role, tier, ... }
 *
 * 只能用在 Edge Runtime / 浏览器；服务端 Node.js 代码继续用 `verifyToken`。
 */

export interface EdgeJwtPayload {
  userId: string;
  role: string;
  tier?: string;
  iat?: number;
  exp?: number;
}

function base64UrlDecode(input: string): Uint8Array {
  // JWT 用 base64url 编码（- _ 替换 + /）
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const b64 = pad ? padded + "=".repeat(4 - pad) : padded;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeString(input: string): string {
  return new TextDecoder().decode(base64UrlDecode(input));
}

async function hmacSha256(key: string, data: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  return new Uint8Array(sig);
}

/**
 * 验证 JWT 并返回 payload；失败返回 null
 */
export async function verifyTokenEdge(token: string): Promise<EdgeJwtPayload | null> {
  if (!token) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = base64UrlDecodeString(headerB64);
  if (!header.includes('"alg":"HS256"') && !header.includes('"alg":"hs256"')) {
    return null;
  }

  // 验签
  const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const expectedSig = await hmacSha256(secret, dataBytes);
  const givenSig = base64UrlDecode(signatureB64);

  if (expectedSig.length !== givenSig.length) return null;
  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig[i] ^ givenSig[i];
  }
  if (diff !== 0) return null;

  // 解析 payload
  let payload: EdgeJwtPayload;
  try {
    payload = JSON.parse(base64UrlDecodeString(payloadB64));
  } catch {
    return null;
  }

  // 检查 exp
  if (typeof payload.exp === "number") {
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
  }

  return payload;
}
