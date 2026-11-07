/**
 * .cn 补贴库 C 档明文 —— 三态开关（运行时 env，唯一真源）
 * ===========================================================================
 * 代码层缺省 fail-closed = "off"：未设置 / 拼错 / 大小写不符 / SITE≠cn 一律 off，
 * 非法值绝不抛错，静默回退 off。
 *
 * 红线（与 PRD §3.4 / 设计 §3.3.1 一致）：
 *   - 不使用 NEXT_PUBLIC_*（开关不得下发客户端）；
 *   - 不写入 siteConfig.features / SiteFeatures（那是编译期常量，紧急回滚要重建镜像）；
 *     本模块一律运行时读 process.env，配合页面/API 既有的 dynamic = "force-dynamic"。
 *   - 与公开聚合层完全解耦，不引用其任何护栏符号或错误类型。
 *
 * 双默认（设计 §3.3.1）：代码缺省 off 是 fail-closed 安全缺省；本轮投产目标值由
 * 境内运维在 /opt/cn/.env.cn 显式设为 login 后 force-recreate 生效。
 */

import { isCnSite } from "@/config/site";

export type RawMode = "off" | "login" | "public";

export interface RawFeatureConfig {
  mode: RawMode;
  roles: string[];
  pageSize: number;
  imageEnabled: boolean;
  imageSourceAllowlist: string[];
  imageModelLimit: number;
}

export const RAW_PAGE_SIZE_DEFAULT = 50;
export const RAW_PAGE_SIZE_MAX = 100;
export const RAW_IMAGE_MODEL_LIMIT_DEFAULT = 100;
export const RAW_IMAGE_MODEL_LIMIT_MAX = 10000;
export const RAW_DB_MODE_KEY = "subsidy.raw.mode";

const RAW_MODE_VALUES: readonly string[] = ["off", "login", "public"];

/** 精确小写三值判定；其余一律 false。 */
export function isRawMode(value: unknown): value is RawMode {
  return typeof value === "string" && RAW_MODE_VALUES.includes(value);
}

/** 非法 / 未设置 / 大小写不符 → "off"；绝不抛错。 */
export function normalizeRawMode(value: unknown): RawMode {
  return isRawMode(value) ? value : "off";
}

/** 唯一真源：非 .cn 站点恒 off。 */
export function getRawMode(): RawMode {
  if (!isCnSite()) return "off";
  return normalizeRawMode(process.env.CN_SUBSIDY_RAW_MODE);
}

function splitCsv(value: unknown): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** CN_SUBSIDY_RAW_ROLES 为空 = 所有已激活用户。 */
export function getRawRoles(): string[] {
  return splitCsv(process.env.CN_SUBSIDY_RAW_ROLES);
}

/** 分页 clamp 到 [1,100]；未设置 / 非法 / <1 一律回默认 50。 */
export function clampPageSize(value: unknown): number {
  let parsed: number;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    parsed = Number(value.trim());
  } else {
    return RAW_PAGE_SIZE_DEFAULT;
  }
  if (!Number.isFinite(parsed) || parsed < 1) return RAW_PAGE_SIZE_DEFAULT;
  return Math.min(Math.floor(parsed), RAW_PAGE_SIZE_MAX);
}

function parseBooleanFlag(value: unknown): boolean {
  return value === "true";
}

function parseImageModelLimit(value: unknown): number {
  const parsed =
    typeof value === "string" && value.trim() !== "" ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return RAW_IMAGE_MODEL_LIMIT_DEFAULT;
  return Math.min(Math.floor(parsed), RAW_IMAGE_MODEL_LIMIT_MAX);
}

export function getRawFeatureConfig(): RawFeatureConfig {
  return {
    mode: getRawMode(),
    roles: getRawRoles(),
    pageSize: clampPageSize(process.env.CN_SUBSIDY_RAW_PAGE_SIZE),
    imageEnabled: parseBooleanFlag(process.env.CN_SUBSIDY_IMAGE_ENABLED),
    imageSourceAllowlist: splitCsv(process.env.SUBSIDY_IMAGE_SOURCE_ALLOWLIST).map((domain) =>
      domain.toLowerCase()
    ),
    imageModelLimit: parseImageModelLimit(process.env.CN_SUBSIDY_IMAGE_MODEL_LIMIT),
  };
}

export function isRawEnabled(): boolean {
  return isCnSite() && getRawMode() !== "off";
}

/** 图片白名单为空 = 禁止一切抓取（fail-closed）。 */
export function isImageFetchAllowed(
  config: RawFeatureConfig = getRawFeatureConfig()
): boolean {
  return config.imageEnabled && config.imageSourceAllowlist.length > 0;
}

/**
 * P1-7 DB 即时开关：仅在 env.mode !== "off" 时允许 DB 值覆盖。
 * env=off 时直接返回 off 且不读库；DB 读取失败 / 未配置 / 非法值 → fail-closed
 * 回落到 env 值，绝不抛错。
 */
export async function getEffectiveRawMode(): Promise<RawMode> {
  const envMode = getRawMode();
  if (envMode === "off") return "off";
  try {
    const { prisma } = await import("@/lib/db");
    const row = await prisma.systemConfig.findUnique({
      where: { key: RAW_DB_MODE_KEY },
      select: { value: true },
    });
    const dbValue: unknown = row?.value;
    return isRawMode(dbValue) ? dbValue : envMode;
  } catch {
    return envMode;
  }
}
