/**
 * 《采集数据上架》转换核心：`RawListing → Product`
 *
 * 实现 `docs/采集数据上架方案.md` §3 的逐字段映射，供
 * `scripts/convert-raw-to-product.ts`（P0 CLI）与后续 admin API（T03）复用。
 *
 * 关键决策（老板已拍板）：
 *  - #2  转换后 `Product.status = "draft"`（一律 draft，人工发布）。
 *  - #6  品类无法推断 → 回退兜底品类 + 标记强制人工（本函数置 usedCategoryFallback）。
 *  - #9  PII = B：两端均保留卖家联系方式（contactName/contactPhone/contactWechat）。
 *  - #10 品牌归一 = B：写入前用中英映射表归一，只归一/映射，**不删除既有 Brand 行**。
 *
 * 注意：`resolveBrand` / `resolveCategory` 内部使用 `@/lib/db` 的单例 prisma，
 * 故调用方需在 import 本模块**之前**固定 `process.env.SITE / DATABASE_URL*`。
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { resolveBrand } from "@/lib/agents/seller-helper/resolve-brand";
import { resolveCategory } from "@/lib/agents/seller-helper/resolve-category";
import { checkDuplicateProduct } from "@/lib/content-moderation";
import { resolveEffectivePriceCny } from "./sanity";
import {
  CONVERTED_PRODUCT_STATUS,
  PRICE_MAX_CNY,
  PRICE_MIN_CNY,
  type BrandNormalizationInfo,
  type BrandResolution,
  type CategoryResolution,
  type ConvertResult,
  type PreResolvedFks,
  type RawListingLike,
} from "./types";

// 便于外部从 convert 直接引用这些契约类型
export type { BrandResolution, CategoryResolution, PreResolvedFks } from "./types";

// ───────────────────────────────────────────────
// 常量：采集专用系统卖家 + 币种折算
// ───────────────────────────────────────────────

/** 采集专用系统卖家邮箱（与「小程序发布」账号隔离，仿 internal/products/route.ts:98-119） */
export const SCOUT_SELLER_EMAIL = "scout@shendiao.com";
export const SCOUT_SELLER_USERNAME = "scout";
export const SCOUT_SELLER_COMPANY = "采集导入";

/** priceUsd 折算汇率（对齐 internal/products/route.ts:494） */
export const USD_PER_CNY_DIVISOR = 7.25;

/** 品类兜底候选（决策 #6：回退「农机配件」+强制人工；DB 实际存在「配件」，故按序尝试） */
export const CATEGORY_FALLBACK_CANDIDATES: readonly string[] = ["农机配件", "配件"];

// ───────────────────────────────────────────────
// 品牌中英归一映射（#10）
//   仅把各种写法映射到 **Brand 表已存在的标准名**，不新增/删除 Brand 行。
// ───────────────────────────────────────────────

/**
 * 归一映射表：key=原始写法（小写）→ value=Brand 表标准名（nameZh）。
 * 覆盖 CLAAS/克拉斯、New Holland/纽荷兰、Krone/科罗尼、MTZ Belarus/明斯克 等。
 * 注：DB 中 MTZ Belarus 行的 nameZh 实为「白俄罗斯」（而非「明斯克」），
 *     故此处归一到「白俄罗斯」（贴合 main 真身），详见回报说明。
 */
export const BRAND_NORMALIZATION: Readonly<Record<string, string>> = {
  // CLAAS / 克拉斯
  claas: "克拉斯",
  class: "克拉斯",
  克拉斯: "克拉斯",
  // New Holland / 纽荷兰
  "new holland": "纽荷兰",
  newholland: "纽荷兰",
  nh: "纽荷兰",
  纽荷兰: "纽荷兰",
  凯斯纽荷兰: "纽荷兰",
  // Krone / 科罗尼
  krone: "科罗尼",
  kr: "科罗尼",
  科罗尼: "科罗尼",
  克罗尼: "科罗尼",
  克朗: "科罗尼",
  // MTZ Belarus / 明斯克 → DB 标准名「白俄罗斯」
  "mtz belarus": "白俄罗斯",
  mtz: "白俄罗斯",
  belarus: "白俄罗斯",
  明斯克: "白俄罗斯",
  白俄罗斯: "白俄罗斯",
  // John Deere / 约翰迪尔
  "john deere": "约翰迪尔",
  johndeere: "约翰迪尔",
  deere: "约翰迪尔",
  jd: "约翰迪尔",
  约翰迪尔: "约翰迪尔",
  迪尔: "约翰迪尔",
  // Massey Ferguson / 麦赛福格森
  "massey ferguson": "麦赛福格森",
  massey: "麦赛福格森",
  mf: "麦赛福格森",
  麦赛福格森: "麦赛福格森",
  麦赛弗格森: "麦赛福格森",
  // Fendt / 芬特
  fendt: "芬特",
  芬特: "芬特",
  // Case IH / 凯斯
  "case ih": "凯斯",
  case: "凯斯",
  cih: "凯斯",
  凯斯: "凯斯",
  // Kubota / 久保田
  kubota: "久保田",
  久保田: "久保田",
  // Valtra / 维美德
  valtra: "维美德",
  维美德: "维美德",
  // Kuhn / 库恩
  kuhn: "库恩",
  库恩: "库恩",
  // Deutz-Fahr / 道依茨法尔
  "deutz-fahr": "道依茨法尔",
  deutz: "道依茨法尔",
  道依茨法尔: "道依茨法尔",
  // McHale / 麦克海尔
  mchale: "麦克海尔",
  麦克海尔: "麦克海尔",
  // Grimme / 格立莫
  grimme: "格立莫",
  格立莫: "格立莫",
  // Horsch / 豪狮
  horsch: "豪狮",
  豪狮: "豪狮",
};

/**
 * 品牌名归一：命中映射表则返回标准名，否则返回去空白后的原名（保持向后兼容）。
 */
export function normalizeBrandName(raw: string | null | undefined): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const mapped = BRAND_NORMALIZATION[trimmed.toLowerCase()];
  return mapped ?? trimmed;
}

/** 归一命中信息（供统计/汇报） */
export function brandNormalizationInfo(raw: string | null | undefined): BrandNormalizationInfo {
  const trimmed = (raw || "").trim();
  const mapped = BRAND_NORMALIZATION[trimmed.toLowerCase()];
  return { original: trimmed, normalized: mapped ?? trimmed, mapped: Boolean(mapped) };
}

// ───────────────────────────────────────────────
// 系统卖家
// ───────────────────────────────────────────────

/**
 * 获取/创建「采集专用系统卖家」（仿 internal/products/route.ts 的 getOrCreateDefaultSeller）。
 * 使用 bcryptjs 直接哈希（避免引入 next/server 依赖，便于 CLI 运行）。
 */
export async function getOrCreateScoutSeller(client: PrismaClient = defaultPrisma): Promise<string> {
  const existing = await client.user.findUnique({ where: { email: SCOUT_SELLER_EMAIL } });
  if (existing) return existing.id;

  const randomPassword = crypto.randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(randomPassword, 10);
  const created = await client.user.create({
    data: {
      email: SCOUT_SELLER_EMAIL,
      username: SCOUT_SELLER_USERNAME,
      passwordHash,
      role: "seller",
      companyName: SCOUT_SELLER_COMPANY,
      country: "CN",
      preferredLanguage: "zh",
      credits: 999999, // 系统账号，避免发布积分不足
      isActive: true,
    },
  });
  return created.id;
}

/** 只读查询采集卖家（dry-run 用，不产生写入） */
export async function findScoutSellerId(client: PrismaClient = defaultPrisma): Promise<string | null> {
  const u = await client.user.findUnique({ where: { email: SCOUT_SELLER_EMAIL }, select: { id: true } });
  return u?.id ?? null;
}

// ───────────────────────────────────────────────
// 品牌 / 品类外键解析
// ───────────────────────────────────────────────

/** 归一后解析品牌 → 命中返回 brandId */
export async function resolveBrandForListing(brandName: string): Promise<BrandResolution> {
  const info = brandNormalizationInfo(brandName);
  const match = await resolveBrand(info.normalized);
  return {
    brandId: match.brandId,
    displayName: match.displayName ?? info.normalized,
    matched: match.matched && Boolean(match.brandId),
    original: info.original,
    normalized: info.normalized,
    mapped: info.mapped,
  };
}

/**
 * 由 modelName 推断品类；失败则回退兜底候选（决策 #6）。
 * `usedFallback=true` 表示使用了兜底品类，需强制人工复核。
 */
export async function inferCategory(
  modelName: string,
  client: PrismaClient = defaultPrisma
): Promise<CategoryResolution> {
  void client; // resolveCategory 内部使用单例 prisma；保留形参以对齐未来注入式重构
  const direct = await resolveCategory((modelName || "").trim());
  if (direct.matched && direct.categoryId) {
    return {
      categoryId: direct.categoryId,
      displayName: direct.displayName ?? modelName,
      matched: true,
      usedFallback: false,
    };
  }
  for (const name of CATEGORY_FALLBACK_CANDIDATES) {
    const fb = await resolveCategory(name);
    if (fb.matched && fb.categoryId) {
      return {
        categoryId: fb.categoryId,
        displayName: fb.displayName ?? name,
        matched: false,
        usedFallback: true,
      };
    }
  }
  return { categoryId: null, displayName: null, matched: false, usedFallback: true };
}

// ───────────────────────────────────────────────
// 描述组装
// ───────────────────────────────────────────────

/** 组装 descriptionZh：主体 + 溯源尾注（§3.1：source/sourceUrl → 尾注） */
export function buildDescriptionZh(
  listing: RawListingLike,
  brandDisplayName: string,
  categoryDisplayName: string
): string {
  const lines: string[] = [];
  if (brandDisplayName) lines.push(`品牌：${brandDisplayName}`);
  if (categoryDisplayName) lines.push(`品类：${categoryDisplayName}`);
  lines.push(`型号：${(listing.modelName || "").trim()}`);
  if (listing.year != null) lines.push(`年份：${listing.year}`);
  if (listing.workingHours != null) lines.push(`工作小时：${listing.workingHours}`);
  if (listing.condition) lines.push(`成色：${listing.condition}`);
  // WhatsApp 无对应列，按 §3.1 落到描述尾注
  if (listing.sellerWhatsapp) lines.push(`联系（WhatsApp）：${listing.sellerWhatsapp}`);
  // 溯源尾注
  lines.push(`数据来源：${listing.source} ${listing.sourceUrl || "(无链接)"}`.trim());
  return lines.join("\n");
}

// ───────────────────────────────────────────────
// 主转换函数
// ───────────────────────────────────────────────

/**
 * 将单条 RawListing 转换为 draft Product。
 *
 * @param preResolved 可选的预解析外键（批量场景已解析过品牌/品类时传入，避免重复查询）
 * @returns ConvertSuccess（已建 Product）或 ConvertSkipped（不建 Product，转 needs_review）
 */
export async function convertListing(
  listing: RawListingLike,
  client: PrismaClient = defaultPrisma,
  preResolved?: PreResolvedFks
): Promise<ConvertResult> {
  const model = (listing.modelName || "").trim();
  if (!model) return { status: "skipped", reason: "modelName 为空，不转换" };

  const currentYear = new Date().getFullYear();
  if (listing.year == null || listing.year < 1980 || listing.year > currentYear + 1) {
    return { status: "skipped", reason: `year 非法或缺失（${listing.year == null ? "null" : listing.year}），不写入脏值` };
  }

  const price = resolveEffectivePriceCny(listing);
  if (price == null) return { status: "skipped", reason: "无价格，不转换" };
  if (price < PRICE_MIN_CNY || price > PRICE_MAX_CNY) {
    return { status: "skipped", reason: `价格 ${Math.round(price)} 元超出硬边界，不转换` };
  }

  let fks: PreResolvedFks;
  if (preResolved) {
    fks = preResolved;
  } else {
    const brand = await resolveBrandForListing(listing.brandName);
    if (!brand.brandId) {
      return { status: "skipped", reason: `品牌未匹配（原始：${brand.original}，归一：${brand.normalized}），不转换` };
    }
    const category = await inferCategory(model, client);
    if (!category.categoryId) {
      return { status: "skipped", reason: "品类无法解析且兜底候选均未命中，不转换" };
    }
    fks = {
      brandId: brand.brandId,
      brandDisplayName: brand.displayName ?? brand.normalized,
      categoryId: category.categoryId,
      categoryDisplayName: category.displayName ?? "",
      usedCategoryFallback: category.usedFallback,
    };
  }

  const sellerId = await getOrCreateScoutSeller(client);
  const descriptionZh = buildDescriptionZh(listing, fks.brandDisplayName, fks.categoryDisplayName);

  const product = await client.product.create({
    data: {
      sellerId,
      brandId: fks.brandId,
      categoryId: fks.categoryId,
      modelName: model,
      year: listing.year,
      workingHours: listing.workingHours ?? null,
      condition: listing.condition?.trim() || "used",
      priceCny: price,
      priceUsd: Math.round(price / USD_PER_CNY_DIVISOR),
      location: listing.location?.trim() || "",
      descriptionZh,
      status: CONVERTED_PRODUCT_STATUS, // #2 一律 draft
      // #9 PII = B：两端保留联系方式
      contactName: listing.sellerName?.trim() || null,
      contactPhone: listing.sellerPhone?.trim() || null,
      contactWechat: listing.sellerWechat?.trim() || null,
      contactEmail: listing.sellerEmail?.trim() || null,
    },
  });

  return {
    status: "converted",
    productId: product.id,
    brandDisplayName: fks.brandDisplayName,
    categoryDisplayName: fks.categoryDisplayName,
    usedCategoryFallback: fks.usedCategoryFallback,
  };
}

/** 便捷：判断某品牌是否可匹配（供 sanity 上下文探测复用） */
export async function isBrandMatchable(brandName: string): Promise<boolean> {
  const r = await resolveBrandForListing(brandName);
  return r.matched;
}

/** 便捷：探测重复（供 sanity 上下文探测复用） */
export async function probeDuplicate(
  sellerId: string,
  brandId: string,
  modelName: string,
  year: number,
  client: PrismaClient = defaultPrisma
): Promise<boolean> {
  void client;
  const res = await checkDuplicateProduct(sellerId, brandId, modelName, year);
  return res.isDuplicate;
}
