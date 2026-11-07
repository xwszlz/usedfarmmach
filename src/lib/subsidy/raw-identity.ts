/**
 * .cn 补贴库 C 档明文 —— 身份提供者（可插拔，T03/T04 唯一入口）
 * ===========================================================================
 * 依赖方向：本模块**单向** import raw-detail.ts 的类型；raw-detail.ts 绝不 import
 * 本模块（避免环依赖）。RawViewer / RawIdentitySource 的规范定义在 raw-detail.ts，
 * 这里重导出 RawIdentitySource，使调用方从本模块即可拿到完整身份契约。
 *
 * 为什么可插拔：老板已拍板「若 .cn User 表为 0 则给 .cn 建/同步账号」，将来 provider
 * 可能换成企微 / 小程序 JWT。页面与 API 只调 resolveRawViewer()，只消费 RawViewer，
 * 换 provider 时 T03/T04 零返工（设计 §12.2 / §12.3 C′）。
 *
 * 单测零 IO：next/headers 与 @/lib/auth 都在函数内动态 import，模块顶层不加载
 * 任何请求上下文或 Prisma；单测可只测 provider 选择与 public 通道，绝不连库。
 */

import { createHash } from "crypto";
import type { RawViewer } from "./raw-detail";

export type { RawIdentitySource, RawViewer } from "./raw-detail";
import type { RawIdentitySource } from "./raw-detail";

export interface RawViewerProvider {
  readonly source: RawIdentitySource;
  resolve(headers: Headers): Promise<RawViewer | null>;
}

/* ─────────────────────────── provider: db_user ─────────────────────────── */

/**
 * 复用 src/lib/auth.ts 的既有三段链路（该文件为 CRLF，只读复用、0 行改动）：
 * headers() → getTokenFromHeaders → verifyToken → getUserFromToken（含 isActive）。
 * 动态 import 保证模块加载阶段不触碰 Prisma / 请求上下文。
 */
const DbUserViewerProvider: RawViewerProvider = {
  source: "db_user",
  async resolve(headers: Headers): Promise<RawViewer | null> {
    try {
      const { getTokenFromHeaders, verifyToken, getUserFromToken } = await import("@/lib/auth");
      const token = getTokenFromHeaders(headers);
      if (!token) return null;
      const payload = verifyToken(token);
      if (!payload) return null;
      const user = await getUserFromToken(token);
      if (!user || user.isActive !== true) return null;
      return {
        userId: user.id,
        role: typeof user.role === "string" ? user.role : null,
        isActive: true,
        anonKeyHash: null,
        identitySource: "db_user",
        subject: user.id,
      };
    } catch (error) {
      console.warn("[subsidy-raw] db_user 身份解析失败，fail-closed 返回 null", error);
      return null;
    }
  },
};

/* ─────────────────────────── provider: public ─────────────────────────── */

/** 只落哈希，绝不存原始 IP / UA 原值（P0-8 匿名限流键）。 */
function computeAnonKeyHash(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for") ?? "";
  const realIp = headers.get("x-real-ip") ?? "";
  const userAgent = headers.get("user-agent") ?? "";
  const material = `${forwarded}|${realIp}|${userAgent}`;
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

const PublicViewerProvider: RawViewerProvider = {
  source: "public",
  async resolve(headers: Headers): Promise<RawViewer | null> {
    return {
      userId: null,
      role: null,
      isActive: true,
      anonKeyHash: computeAnonKeyHash(headers),
      identitySource: "public",
      subject: null,
    };
  },
};

/* ─────────────────────────── provider: 外部 JWT（C′ 预留） ─────────────────────────── */

/**
 * 企微 / 小程序 JWT 来源需外部验签密钥与映射规则（设计 §12.3 C′，由后续 additive
 * provider 文件实现）。T01 不引入任何验签猜测：这两个来源在本轮恒为 fail-closed
 * （resolve 返回 null），换实现时页面/API 无需改动。
 */
function createReservedJwtProvider(source: RawIdentitySource): RawViewerProvider {
  return {
    source,
    async resolve(_headers: Headers): Promise<RawViewer | null> {
      void _headers;
      return null;
    },
  };
}

const WeComJwtViewerProvider = createReservedJwtProvider("wecom_jwt");
const MiniAppJwtViewerProvider = createReservedJwtProvider("miniapp_jwt");

/**
 * 未知值 fail-closed：报告来源为 db_user（缺省口径），但 resolve 恒返回 null，
 * 绝不因拼错 env 而误放行明文。
 */
const UnknownValueViewerProvider: RawViewerProvider = {
  source: "db_user",
  async resolve(_headers: Headers): Promise<RawViewer | null> {
    void _headers;
    return null;
  },
};

/* ─────────────────────────── provider 选择 ─────────────────────────── */

/** 按 CN_SUBSIDY_IDENTITY_PROVIDER 选择 provider；缺省 db_user；未知值 fail-closed。 */
export function getRawIdentityProvider(): RawViewerProvider {
  const raw = process.env.CN_SUBSIDY_IDENTITY_PROVIDER;
  switch (raw) {
    case undefined:
    case "":
    case "db_user":
      return DbUserViewerProvider;
    case "public":
      return PublicViewerProvider;
    case "wecom_jwt":
      return WeComJwtViewerProvider;
    case "miniapp_jwt":
      return MiniAppJwtViewerProvider;
    default:
      return UnknownValueViewerProvider;
  }
}

/* ─────────────────────────── 唯一入口 ─────────────────────────── */

/**
 * 把 Next 的 ReadonlyHeaders 转成标准 Headers（provider 契约要求 Headers）。
 * 兼容 forEach / entries 两种形状；任一不可用都返回空 Headers（fail-closed）。
 */
function toStandardHeaders(source: unknown): Headers {
  const standard = new Headers();
  if (source === null || typeof source !== "object") return standard;
  const candidate = source as {
    forEach?: (callback: (value: string, key: string) => void) => void;
    entries?: () => Iterable<[string, string]>;
  };
  if (typeof candidate.forEach === "function") {
    candidate.forEach((value, key) => standard.set(key, value));
    return standard;
  }
  if (typeof candidate.entries === "function") {
    for (const [key, value] of candidate.entries()) standard.set(key, value);
    return standard;
  }
  return standard;
}

/**
 * 🔴 唯一入口：T03 页面与 T04 API 只调它，不得硬绑 getUserFromToken。
 * next/headers 在函数内动态 import；解析失败一律返回 null（不抛、不 302、不 500）。
 */
export async function resolveRawViewer(): Promise<RawViewer | null> {
  try {
    const provider = getRawIdentityProvider();
    const { headers } = await import("next/headers");
    // Next 14 headers() 同步返回 ReadonlyHeaders；Promise.resolve 兼容未来的异步签名。
    const requestHeaders = await Promise.resolve(headers());
    const standardHeaders = toStandardHeaders(requestHeaders);
    const viewer = await provider.resolve(standardHeaders);
    return viewer ?? null;
  } catch (error) {
    console.warn("[subsidy-raw] 身份提供者解析失败，fail-closed 返回 null", error);
    return null;
  }
}
