import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { NextResponse } from "next/server";
import { prisma } from "./db";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

export function ensureJwtSecret(): void {
  if (!process.env.JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET environment variable is not set.");
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: {
  userId: string;
  role: string;
  tier?: string;
}): string {
  return jwt.sign(
    {
      userId: payload.userId,
      role: payload.role,
      tier: payload.tier || "free",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): {
  userId: string;
  role: string;
  tier: string;
} | null {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
      tier: string;
    };
  } catch {
    return null;
  }
}

/**
 * 从 Headers 中提取 token（兼容旧代码）
 */
export function getTokenFromHeaders(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = headers.get("cookie");
  const m = cookie?.match(/token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * 从 token 解析用户（兼容旧代码）
 */
export async function getUserFromToken(token: string) {
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      username: true,
      phone: true,
      role: true,
      companyName: true,
      country: true,
      preferredLanguage: true,
      credits: true,
      membershipTier: true,
      membershipExpiresAt: true,
      freeValuationsUsed: true,
      freeValuationsResetAt: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.isActive) return null;
  return user;
}

/**
 * 从请求中解析当前用户（完整信息）
 */
export async function getUserFromRequest(req: {
  headers: Headers;
  cookies?: { get: (name: string) => { value: string } | undefined };
}) {
  // 优先从 Authorization header 读
  let token: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    token = auth.slice(7);
  }
  // 回退到 cookie
  if (!token && req.cookies) {
    token = req.cookies.get("token")?.value || null;
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      companyName: true,
      country: true,
      preferredLanguage: true,
      credits: true,
      membershipTier: true,
      membershipExpiresAt: true,
      freeValuationsUsed: true,
      freeValuationsResetAt: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.isActive) return null;

  return user;
}

/**
 * 写 token 到响应 cookie（SSR 用）
 */
export function setTokenCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: "token",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 天
    path: "/",
  });
}

export function clearTokenCookie(response: NextResponse) {
  response.cookies.set({
    name: "token",
    value: "",
    maxAge: 0,
    path: "/",
  });
}
