/**
 * 《采集数据上架》原始采集单转换 —— 类型契约
 *
 * 本模块只定义「类型 / 常量」，不含任何运行期副作用，供
 * `sanity.ts`（自动判定）、`convert.ts`（逐字段映射）与
 * `scripts/convert-raw-to-product.ts`（CLI）共享。
 *
 * 依据：`docs/采集数据上架方案.md` §2（审核策略）、§3（转换设计）。
 */

// ───────────────────────────────────────────────
// 1. 自动判定（sanity）结果类型
// ───────────────────────────────────────────────

/** 自动判定动作（三态） */
export type SanityAction = "auto_reject" | "needs_review" | "auto_pass";

/** 命中规则标识（用于 notes 留痕与统计） */
export type SanityRuleId =
  | "domain_blacklist"
  | "source_url_missing"
  | "source_url_invalid"
  | "model_noise"
  | "price_hard_bound"
  | "price_outlier"
  | "no_price"
  | "invalid_year"
  | "brand_unmatched"
  | "category_undetermined"
  | "duplicate_product";

/** 单条规则命中记录 */
export interface SanityRuleHit {
  /** 规则标识 */
  rule: SanityRuleId;
  /** 该规则触发的动作（永不为 auto_pass） */
  action: Exclude<SanityAction, "auto_pass">;
  /** 人类可读说明（写入 RawListing.notes） */
  detail: string;
}

/** sanity 评估结果 */
export interface SanityResult {
  /** 最终动作（取全部命中中最高优先级；零命中 → auto_pass） */
  action: SanityAction;
  /** 全部命中明细 */
  hits: SanityRuleHit[];
  /** 命中规则名列表（便于聚合统计） */
  reasons: string[];
  /** 可直接写入 RawListing.notes 的摘要 */
  notes: string;
}

/**
 * 判定优先级：auto_reject(硬规则) > needs_review(软规则) > auto_pass。
 * 数值越大优先级越高。
 */
export const ACTION_PRIORITY: Readonly<Record<SanityAction, number>> = {
  auto_reject: 2,
  needs_review: 1,
  auto_pass: 0,
};

// ───────────────────────────────────────────────
// 2. 判定入参 / 上下文
// ───────────────────────────────────────────────

/** 价格硬边界（人民币元）：超出即为噪声，auto_reject */
export const PRICE_MIN_CNY = 3_000;
export const PRICE_MAX_CNY = 20_000_000;

/** 离群倍数阈值：偏离同品牌中位价 > 8× 或 < 1/8 → needs_review */
export const PRICE_OUTLIER_RATIO = 8;

/** 噪声域名黑名单（sourceUrl host 命中即 needs_review，转人工核实） */
export const SOURCE_URL_BLACKLIST: readonly string[] = [
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "pinterest.com",
];

/** sanity 判定所需的最小字段集（从 RawListing 投影而来） */
export interface SanityInput {
  /** 采集来源标识，如 agriaffaires / domestic_xxx */
  source: string;
  /** 原始挂牌地址（可能为空字符串） */
  sourceUrl: string;
  /** 品牌名（可能中英混写、含噪声） */
  brandName: string;
  /** 型号名（源自页面标题） */
  modelName: string;
  /** 生产年份 */
  year: number | null;
  /** 原币价格 */
  priceRaw: number | null;
  /** 原币币种（EUR/USD/CNY…） */
  currency: string | null;
  /** 采集端已折算的人民币价（可能为空） */
  priceCny: number | null;
}

/**
 * sanity 判定上下文 —— 由调用方（CLI）通过 DB 探测后注入，
 * 使 `evaluateSanity` 保持纯函数、便于单测与复现。
 */
export interface SanityContext {
  /** resolveBrand(normalizedBrandName).matched */
  brandMatched: boolean;
  /** 品类能否从 modelName 直接推断（true 表示未使用兜底品类） */
  categoryInferable: boolean;
  /** 同品牌中位人民币价；null 表示样本不足 */
  brandMedianCny: number | null;
  /** checkDuplicateProduct(...).isDuplicate */
  isDuplicate: boolean;
}

/** 判定选项 */
export interface SanityOptions {
  /** 当前年份（默认取系统当前年），用于「年份 > 当前年+1」判定 */
  currentYear?: number;
  /** 汇率兜底表（币种 → 人民币），默认使用内置表 */
  exchangeRates?: Readonly<Record<string, number>>;
}

// ───────────────────────────────────────────────
// 3. 转换入参 / 出参类型
// ───────────────────────────────────────────────

/** 转换器需要读取的 RawListing 字段投影 */
export interface RawListingLike {
  id: string;
  source: string;
  sourceUrl: string;
  brandName: string;
  modelName: string;
  year: number | null;
  workingHours: number | null;
  condition: string | null;
  priceRaw: number | null;
  currency: string | null;
  priceCny: number | null;
  location: string;
  sellerName: string | null;
  sellerPhone: string | null;
  sellerWechat: string | null;
  sellerWhatsapp: string | null;
}

/** 转换成功结果 */
export interface ConvertSuccess {
  status: "converted";
  productId: string;
  /** 归一后用于落库的品牌展示名 */
  brandDisplayName: string;
  /** 落库品类展示名 */
  categoryDisplayName: string;
  /** 是否使用了兜底品类（true 表示需人工复核） */
  usedCategoryFallback: boolean;
}

/** 转换跳过结果（不产生 Product） */
export interface ConvertSkipped {
  status: "skipped";
  /** 跳过原因（写入 notes，并转入 needs_review） */
  reason: string;
}

export type ConvertResult = ConvertSuccess | ConvertSkipped;

/** 品牌归一命中信息（供汇报/统计） */
export interface BrandNormalizationInfo {
  original: string;
  normalized: string;
  /** 是否命中归一映射表 */
  mapped: boolean;
}

/** 品牌解析结果（归一 + resolveBrand） */
export interface BrandResolution {
  brandId: string | null;
  displayName: string | null;
  matched: boolean;
  original: string;
  normalized: string;
  mapped: boolean;
}

/** 品类解析结果 */
export interface CategoryResolution {
  categoryId: string | null;
  displayName: string | null;
  matched: boolean;
  /** 是否使用了兜底品类（true ⇒ 需人工复核） */
  usedFallback: boolean;
}

/** 预解析外键（批量场景复用，避免重复查询） */
export interface PreResolvedFks {
  brandId: string;
  brandDisplayName: string;
  categoryId: string;
  categoryDisplayName: string;
  usedCategoryFallback: boolean;
}

// ───────────────────────────────────────────────
// 4. 状态机常量（复用现有 RawListing.status 列）
// ───────────────────────────────────────────────

/** 允许被本管线处理的 RawListing.status（幂等：converted/…不在此列） */
export const PROCESSABLE_RAW_STATUSES: readonly string[] = ["pending", "approved"];

/** 转换后 Product.status（决策 #2=A：一律 draft，人工发布） */
export const CONVERTED_PRODUCT_STATUS = "draft";
