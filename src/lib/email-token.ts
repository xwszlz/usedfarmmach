/**
 * 邮箱类令牌（阶段 1，任务 T03）
 *
 * 基于 JWT_SECRET 签名（复用 auth.ts 的密钥与 jsonwebtoken 库），stateless，
 * 不新增任何 DB 令牌表。purpose 强绑定，杜绝混用。
 *
 * 重置令牌内嵌 passwordHash 的 SHA-256 摘要：用户改密后旧链接摘要不匹配 → 自动失效。
 */
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { createHash } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET!;

/** 令牌用途（强绑定，不可混用） */
export type EmailTokenPurpose =
  | "verify_email"
  | "reset_password"
  | "complete_profile_reminder";

/** 签名输入 */
export interface SignEmailTokenInput {
  userId: string;
  email: string;
  purpose: EmailTokenPurpose;
  /** 仅 reset_password 需要：内嵌 passwordHash 摘要，实现"改密即作废" */
  pwdHash?: string;
}

/** 校验结果 */
export interface VerifyEmailTokenResult {
  userId: string;
  email: string;
  /** 仅 reset_password 校验时返回；用于比对"改密即失效" */
  pwdHash?: string;
}

/** 各用途过期时间（JWT 字符串格式） */
const PURPOSE_EXPIRES: Record<EmailTokenPurpose, string> = {
  verify_email: "24h",
  reset_password: "30m",
  complete_profile_reminder: "7d",
};

/** SHA-256（小写十六进制），用于 passwordHash 摘要与限流 key */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** 签名邮箱令牌 */
export function signEmailToken(input: SignEmailTokenInput): string {
  return jwt.sign(
    {
      userId: input.userId,
      email: input.email,
      purpose: input.purpose,
      pwdHash: input.pwdHash,
    },
    JWT_SECRET,
    { expiresIn: PURPOSE_EXPIRES[input.purpose] as SignOptions["expiresIn"] }
  );
}

/** 校验令牌：purpose 必须匹配、未过期、字段完整；失败返回 null */
export function verifyEmailToken(
  token: string,
  expectedPurpose: EmailTokenPurpose
): VerifyEmailTokenResult | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown> | string;
    if (typeof decoded === "string") return null;
    if (decoded.purpose !== expectedPurpose) return null;
    const userId = decoded.userId;
    const email = decoded.email;
    if (typeof userId !== "string" || typeof email !== "string") return null;
    const pwdHash =
      typeof decoded.pwdHash === "string" ? decoded.pwdHash : undefined;
    return { userId, email, pwdHash };
  } catch {
    return null;
  }
}
