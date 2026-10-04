/**
 * .cn → .com 产品同步「字段白名单」
 *
 * 设计要点：
 * - 采用「显式白名单 pick（默认拒绝）」语义：仅 PRODUCT_ALLOW 与各关联对象的白名单
 *   字段会被保留，任何未列字段（含 PII / 精确坐标）一律丢弃；与
 *   `scripts/export-cn-content.js` 的 pick() 同款范式，从结构上杜绝 PII 意外出境。
 * - 运行时再做一次「禁字段深扫描」自检（fail-closed）：输出里一旦出现任何禁字段即抛错，
 *   宁可本轮同步失败，也不放行可疑 payload。
 *
 * 合规边界（用户已拍板）：
 * - 不同步 Valuation；
 * - 精确坐标 latitude / longitude 不出境，只同步 location 文本地址；
 * - sellerId / contact* / 任何 User 行字段一律不出境。
 */

/** Product 主表允许出境的标量字段（坐标与 PII 均不在列） */
export const PRODUCT_ALLOW = [
  "id",
  "modelName",
  "year",
  "condition",
  "priceCny",
  "priceUsd",
  "location",
  "province",
  "city",
  "country",
  "descriptionZh",
  "priceMode",
  "tradeTerm",
  "tradePort",
  "enginePower",
  "engineType",
  "driveSystem",
  "mainConfig",
  "netWeight",
  "overallLength",
  "overallWidth",
  "overallHeight",
  "status",
  "aiGenerated",
  "createdAt",
  "updatedAt",
] as const;

/** Brand 允许出境字段 */
export const BRAND_ALLOW = ["nameZh", "nameEn", "originCountry", "isImported"] as const;

/** Category 允许出境字段 */
export const CATEGORY_ALLOW = ["nameZh", "nameEn"] as const;

/** ProductImage 允许出境字段 */
export const IMAGE_ALLOW = ["url", "sortOrder", "isPrimary"] as const;

/** ProductVideo 允许出境字段（fileSize 视需要可选，此处不传） */
export const VIDEO_ALLOW = ["url", "sortOrder", "title", "duration", "moderationStatus"] as const;

/**
 * 【硬禁】绝不出现于出境 payload 的字段名：
 * - 精确地理坐标（可定位自然人经营场所 → 位置信息边界）；
 * - 卖家身份 sellerId（改由 .com 侧解析为系统账号）；
 * - 自然人联系方式 contact*（schema 中 Product 的卖家自留 PII）；
 * - User 行字段（纵深防御：即使误 join seller 也必须被挡下）。
 */
export const FORBIDDEN_FIELDS = [
  // 精确坐标
  "latitude",
  "longitude",
  // 卖家身份
  "sellerId",
  // 自然人联系方式
  "contactName",
  "contactPhone",
  "contactWechat",
  "contactEmail",
  // User 行字段（纵深防御）
  "email",
  "phone",
  "passwordHash",
  "wxOpenid",
  "miniOpenid",
  "deviceFingerprint",
  "registerIp",
  "resetToken",
  "resetTokenExpires",
  "consentCrossBorderAt",
  "inviteCode",
] as const;

const FORBIDDEN_SET: ReadonlySet<string> = new Set<string>(FORBIDDEN_FIELDS);

/** 按白名单从一行对象中挑选字段（默认拒绝：未列字段一律丢弃） */
function pickFields(
  row: Record<string, unknown> | null | undefined,
  allow: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!row) {
    for (const f of allow) out[f] = null;
    return out;
  }
  for (const f of allow) out[f] = row[f] ?? null;
  return out;
}

/** 递归深扫描：输出中一旦出现禁字段即抛错（fail-closed） */
function assertNoForbidden(value: unknown, path: string = "$"): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoForbidden(v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_SET.has(k)) {
      throw new Error(`[cn-sync] forbidden field leaked in export payload: ${path}.${k}`);
    }
    assertNoForbidden(v, `${path}.${k}`);
  }
}

/**
 * 把一条 .cn 产品（含 brand / category / images / videos 关联）裁剪为可出境的白名单 payload。
 * 返回结构稳定（字段顺序固定），便于 .com 侧做内容哈希（sourceHash）。
 */
export function pickProductWhitelist(
  p: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!p) return out;

  for (const f of PRODUCT_ALLOW) out[f] = p[f] ?? null;

  const brand = p.brand as Record<string, unknown> | null | undefined;
  out.brand = brand ? pickFields(brand, BRAND_ALLOW) : null;

  const category = p.category as Record<string, unknown> | null | undefined;
  out.category = category ? pickFields(category, CATEGORY_ALLOW) : null;

  const images = p.images as Array<Record<string, unknown>> | null | undefined;
  out.images = Array.isArray(images) ? images.map((i) => pickFields(i, IMAGE_ALLOW)) : [];

  const videos = p.videos as Array<Record<string, unknown>> | null | undefined;
  out.videos = Array.isArray(videos) ? videos.map((v) => pickFields(v, VIDEO_ALLOW)) : [];

  // 运行时自检（fail-closed）：任何禁字段残留 → 抛错
  assertNoForbidden(out);
  return out;
}

/** 判断某字段名是否被硬禁（供单测 / 其他模块复用） */
export function isForbiddenField(name: string): boolean {
  return FORBIDDEN_SET.has(name);
}
