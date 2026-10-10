/**
 * 卖方采集「客户急需车型」白名单（PURE CONFIG · 仅配置，不改任何采集/解析逻辑）
 *
 * 用途：标记老板指定的 4 款急需机型，供 seller-scout 采集时优先覆盖，并供
 * 去交易化只读栏目（/overseas，见 `src/lib/raw-listing/publish.ts`）的
 * 「客户急需车源」置顶区识别。
 *
 * 匹配规则（与 `publish.ts#listPublicSourced` 的 urgent 判定严格一致）：
 *   某条 RawListing 视为"急需" ⇔
 *     `categorySlug` ∈ URGENT_CATEGORY_SLUGS
 *     OR `modelName`（小写）包含 URGENT_MODEL_KEYWORDS 中任一关键词。
 *
 * 注意：本文件**仅导出常量**，不被任何采集/解析逻辑 import（避免改动既有链路）。
 * 真正消费方是后台审核导出与 /overseas 只读展示；如需接入采集优先级，请在
 * seller-scout 调度处显式 import 本常量，且不得改变抓取/解析本身。
 */
export interface UrgentScoutTarget {
  /** 中文品牌名（Brand.nameZh，用于归类展示） */
  brand: string;
  /** 归一品牌键（RawListing.brandKey 取值，如 claas / new_holland） */
  brandKey: string;
  /** 展示机型名 */
  model: string;
  /** 命中关键词（小写，对 RawListing.modelName 做 contains 匹配） */
  keywords: string[];
  /** 自由品类标签（RawListing.categorySlug 取值） */
  categorySlug: string;
}

/**
 * 4 款客户急需机型（克拉斯 CLAAS / 纽荷兰 New Holland）。
 * 品牌 CLAAS：Axion 850 / AXION 2204 / AXION 2504；
 * 大方捆（BB 9080 为克拉斯 Big Baler，按需求归入「纽荷兰大方捆」品类标签）。
 */
export const URGENT_SCOUT_TARGETS: readonly UrgentScoutTarget[] = [
  { brand: "克拉斯", brandKey: "claas", model: "Axion 850", keywords: ["axion 850"], categorySlug: "克拉斯AXION" },
  { brand: "克拉斯", brandKey: "claas", model: "AXION 2204", keywords: ["axion 2204"], categorySlug: "克拉斯AXION" },
  { brand: "克拉斯", brandKey: "claas", model: "AXION 2504", keywords: ["axion 2504"], categorySlug: "克拉斯AXION" },
  { brand: "克拉斯", brandKey: "claas", model: "BB 9080", keywords: ["bb 9080", "bb9080"], categorySlug: "纽荷兰大方捆" },
];

/** 急需品类标签集合（RawListing.categorySlug ∈ 此集合即判为急需） */
export const URGENT_CATEGORY_SLUGS: readonly string[] = Array.from(
  new Set(URGENT_SCOUT_TARGETS.map((t) => t.categorySlug))
);

/** 急需机型关键词（小写，对 modelName contains 匹配） */
export const URGENT_MODEL_KEYWORDS: readonly string[] = Array.from(
  new Set(URGENT_SCOUT_TARGETS.flatMap((t) => t.keywords))
);
