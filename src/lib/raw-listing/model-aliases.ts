/**
 * 机型别名表 v2 —— 两级「马力档」模型（v2 常量文件，零 schema 变更）
 *
 * ## 为什么改掉 v1
 * v1 把 `2504 → "CLAAS AXION 2504"` 写成一对一，属于**过度指定**：
 *   - `2204 / 2504` 是**跨品牌共用的马力档叫法**（数字≈马力级）。
 *     克拉斯 AXION 2204/2504 与雷沃/东方红/常发/东风/华夏的同档拖拉机**共用同一俗称**；
 *   - 结果：国产 2204/2504 要么被漏掉，要么被错配到 CLAAS。
 *
 * ## v2 模型（两级）
 *   一级 **档位俗称 slang**：跨品牌共用，如 `2504` / `250` / `850`（850 经老板确认为 2504 旧称）；
 *   二级 **品牌官方型号 officialByBrand**：品牌 key → 该品牌在此档位下的官方型号（1:N）。
 *
 * ## 品牌双通道（重要）
 * 实测经销商数据里有大量 `"CLAAS/New Holland"` 这类**合并串**，`brandName` 不足以判别品牌，
 * 真正的品牌信息常常藏在 `modelName` 里。因此：
 *   - `BRAND_VARIANTS`：品牌规范 key ↔ 中英**称呼**变体（用于匹配 brandName / 搜索词）；
 *   - `BRAND_MODEL_TOKENS`：品牌规范 key → 可能出现在 **modelName** 里的**机型 token**
 *     （如 `AXION` / `BB9080` / `雷沃`），用于走 modelName 这条第二通道。
 *
 * 调用方（查询器）负责把 `modelTerms` / `brandTerms` 各自 OR 起来，并对
 * `brandName` **与** `modelName` 两个字段同时做 `contains ... mode: "insensitive"`。
 *
 * 老板确认口径（2026-10-11）：
 *   - 2504 / 2204 = 拖拉机马力俗称；9080 = 纽荷兰大方捆（BB 系列）俗称；
 *   - `850` 为 2504 旧称，历史数据若存为 "850"，导入时归一到 "2504" 即可被 "2504" 搜出。
 */

// ───────────────────────────────────────────────
// 1. 档位（tier）定义
// ───────────────────────────────────────────────

/** 一个马力档（机型族） */
export interface ModelTier {
  /** 规范档位键，如 "2504" —— 同时也是一级俗称之一 */
  tier: string;
  /** 一级：跨品牌共用俗称（含旧称 / 简称） */
  slang: string[];
  /** 二级：品牌规范 key → 该品牌在本档位下的官方型号列表 */
  officialByBrand: Record<string, string[]>;
}

/**
 * 两级马力档常量表。
 * ⚠️ `officialByBrand` 中标记为「待业务核实」的条目仅作兜底，不应单独作为成交依据。
 */
export const MODEL_TIERS: ModelTier[] = [
  {
    tier: "2504",
    slang: ["2504", "250", "850"], // 850 经老板确认为 2504 旧称
    officialByBrand: {
      claas: ["CLAAS AXION 2504", "CLAAS AXION 250", "CLAAS AXION 850"],
      lovol: ["雷沃 RG2504", "LOVOL RG2504"],
      yto: ["东方红 2504"],
      changfa: ["常发 2504"],
      dongfeng: ["东风 2504"],
      huaxia: ["华夏 2504"],
    },
  },
  {
    tier: "2204",
    slang: ["2204"],
    officialByBrand: {
      claas: ["CLAAS AXION 2204"],
      lovol: ["雷沃 2204"],
      yto: ["东方红 2204"],
      changfa: ["常发 2204"],
      huaxia: ["华夏 2204"],
    },
  },
  {
    tier: "9080",
    slang: ["9080", "BB9080"],
    officialByBrand: {
      new_holland: ["NEW HOLLAND BB 9080", "BB 9080"],
      // 大方捆，待业务核实，仅兜底
      claas: ["CLAAS ROLLANT", "CLAAS BIG BALER"],
    },
  },
];

/** tier key → ModelTier 索引（全小写 key） */
export const MODEL_TIER_BY_KEY: Readonly<Record<string, ModelTier>> = MODEL_TIERS.reduce<
  Record<string, ModelTier>
>((acc, tier) => {
  acc[tier.tier.toLowerCase()] = tier;
  return acc;
}, {});

// ───────────────────────────────────────────────
// 2. 品牌常量（双通道）
// ───────────────────────────────────────────────

/** 品牌代号 → 名称变体（用于把用户输入/行上 brandName 收敛到规范品牌） */
export const BRAND_VARIANTS: Record<string, string[]> = {
  claas: ["CLAAS", "克拉斯"],
  new_holland: ["NEW HOLLAND", "纽荷兰", "NewHolland"],
  john_deere: ["JOHN DEERE", "约翰迪尔", "迪尔"],
  lovol: ["LOVOL", "雷沃", "雷沃阿波斯"],
  yto: ["东方红", "YTO", "一拖"],
  changfa: ["常发", "CHANGFA"],
  dongfeng: ["东风"],
  huaxia: ["华夏"],
  kubota: ["久保田", "KUBOTA"],
  case_ih: ["凯斯", "CASE IH", "CASEIH"],
  yanmar: ["洋马", "YANMAR"],
  krone: ["科罗尼", "KRONE"],
};

/**
 * 品牌可能藏在 **modelName** 里的机型 token（53/78 行 brandName 是
 * "CLAAS/New Holland" 合并标签，品牌得靠 modelName 里的机型词识别）。
 * ⚠️ 这些 token 只在 modelName 上做 contains 匹配，不要拿去匹配 brandName。
 */
export const BRAND_MODEL_TOKENS: Record<string, string[]> = {
  claas: ["AXION", "JAGUAR", "XERION", "克拉斯 Axion"],
  new_holland: ["BB9080", "BB9000", "BB", "NH", "纽荷兰", "大方捆"],
  lovol: ["雷沃", "M2204", "M2504", "RG2504"],
  yto: ["东方红", "LX2204", "LX2504"],
  changfa: ["常发", "J2204", "CFJ2204", "CFK2404"],
  dongfeng: ["东风"],
  huaxia: ["华夏"],
};

/** 所有已知品牌代号（按常量表声明顺序） */
export const BRAND_KEYS: readonly string[] = Object.keys(BRAND_VARIANTS);

// ───────────────────────────────────────────────
// 3. 内部工具
// ───────────────────────────────────────────────

/** 归一：去首尾空格、转小写、下划线/连字符视作空格、压缩空白 */
function normalizeToken(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 把可能是合并串的品牌表达式拆成候选片段（"CLAAS/New Holland" → ["CLAAS", "New Holland"]） */
function splitBrandExpr(input: string): string[] {
  return (input || "")
    .split(/[/,、|&]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** 去重追加（按小写判重，保留首次出现的原始大小写） */
function pushUnique(target: string[], incoming: readonly string[]): void {
  const seen = new Set<string>(target.map((t) => t.toLowerCase()));
  for (const item of incoming) {
    const value = (item || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(value);
  }
}

/** 展开某档位的全部官方型号（跨品牌） */
function flattenOfficials(tier: ModelTier): string[] {
  const out: string[] = [];
  for (const list of Object.values(tier.officialByBrand)) pushUnique(out, list);
  return out;
}

/**
 * 品牌写法 → 规范 key 的反查表（懒构建一次）。
 *
 * 优先级：`BRAND_VARIANTS`（称呼）> `BRAND_MODEL_TOKENS`（机型 token），
 * 这样 `"NH" / "BB" / "纽荷兰"` 这类 token 也能反查到品牌（便于用户按缩写筛选），
 * 同时不会覆盖更权威的称呼写法。两个表之间无跨品牌重名，因此不会串牌。
 */
const BRAND_KEY_LOOKUP: Readonly<Record<string, string>> = (() => {
  const map: Record<string, string> = {};
  for (const [key, variants] of Object.entries(BRAND_VARIANTS)) {
    const canonical = normalizeToken(key);
    if (!map[canonical]) map[canonical] = key;
    for (const variant of variants) {
      const token = normalizeToken(variant);
      if (!map[token]) map[token] = key;
    }
  }
  // 第二优先级：机型 token（模式缩写等）
  for (const [key, tokens] of Object.entries(BRAND_MODEL_TOKENS)) {
    for (const token of tokens) {
      const t = normalizeToken(token);
      if (!map[t]) map[t] = key;
    }
  }
  return map;
})();

// ───────────────────────────────────────────────
// 4. 对外：品牌解析
// ───────────────────────────────────────────────

/**
 * 任意品牌写法 → 规范品牌 key；无法判定返回 `null`。
 *
 * - 支持中英、大小写、下划线/连字符：`"CLAAS" / "claas" / "克拉斯"` → `"claas"`；
 * - 支持合并串：`"CLAAS/New Holland"` 会**同时**属于两个品牌 ⇒ 判定为歧义，返回 `null`
 *   （调用方应回退到「原样 contains」语义，`resolveModelFilter` 已经这样处理）；
 * - 完全不在表内的输入返回 `null`。
 */
export function resolveBrandKey(brand: string): string | null {
  const raw = (brand ?? "").trim();
  if (!raw) return null;

  const whole = BRAND_KEY_LOOKUP[normalizeToken(raw)];
  if (whole) return whole;

  const parts = splitBrandExpr(raw);
  if (parts.length === 0) return null;

  const keys: string[] = [];
  for (const part of parts) {
    const key = BRAND_KEY_LOOKUP[normalizeToken(part)];
    if (key && !keys.includes(key)) keys.push(key);
  }
  // 单品牌 → 可用；多品牌 → 歧义，放弃（交给调用方走原文兜底）
  return keys.length === 1 ? keys[0] : null;
}

// ───────────────────────────────────────────────
// 5. 对外：机型/品牌 → 查询词
// ───────────────────────────────────────────────

/** `resolveModelFilter` 的返回值：两组 OR 词项 */
export interface ModelFilter {
  /**
   * 机型词（OR）：
   *   - 原样输入（保证 modelName 存的就是输入串时必中）；
   *   - 命中档位的全部 slang（跨品牌共用）；
   *   - 命中档位的 official：给了可解析 brand 时**只收该品牌**，否则收全部品牌。
   */
  modelTerms: string[];
  /**
   * 品牌词（OR）：`BRAND_VARIANTS` ∪ `BRAND_MODEL_TOKENS`。
   * 需同时对 `brandName` 与 `modelName` 做 insensitive contains。
   * **空数组 = 不限品牌**。
   */
  brandTerms: string[];
}

/** 用输入反查所属档位；查不到返回 `null` */
function matchTier(input: string): ModelTier | null {
  const lower = normalizeToken(input);
  if (!lower) return null;

  // 1) slang 全等
  for (const tier of MODEL_TIERS) {
    if (tier.slang.some((s) => normalizeToken(s) === lower)) return tier;
  }
  // 2) 官方型号全等 / 互为子串（输入 "AXION" 或 "AXION 2504" 都能定位到档位）
  for (const tier of MODEL_TIERS) {
    for (const official of flattenOfficials(tier)) {
      const o = normalizeToken(official);
      if (o === lower || o.includes(lower) || lower.includes(o)) return tier;
    }
  }
  // 3) slang 作为片段兜底（至少 3 个字符，避免 "250" 之类过度宽泛命中被误判到别的档）
  for (const tier of MODEL_TIERS) {
    if (
      tier.slang.some((s) => {
        const ns = normalizeToken(s);
        return ns.length >= 3 && lower.includes(ns);
      })
    ) {
      return tier;
    }
  }
  return null;
}

/**
 * 机型 + 品牌 → 两组 OR 查询词。
 *
 * @param model 机型输入（俗称或官方名片段均可）
 * @param brand 品牌输入（中英均可、可为合并串）
 */
export function resolveModelFilter(model?: string, brand?: string): ModelFilter {
  const modelInput = (model ?? "").trim();
  const brandInput = (brand ?? "").trim();
  const key = resolveBrandKey(brandInput);
  const tier = modelInput ? matchTier(modelInput) : null;

  const modelTerms: string[] = [];
  if (modelInput) modelTerms.push(modelInput);
  if (tier) {
    pushUnique(modelTerms, tier.slang);
    if (key) {
      // 已锁定品牌：只收该品牌在此档位下的官方型号，避免把别的品牌错配进来
      pushUnique(modelTerms, tier.officialByBrand[key] ?? []);
    } else {
      pushUnique(modelTerms, flattenOfficials(tier));
    }
  }

  const brandTerms: string[] = [];
  if (key) {
    pushUnique(brandTerms, BRAND_VARIANTS[key] ?? []);
    pushUnique(brandTerms, BRAND_MODEL_TOKENS[key] ?? []);
  } else if (brandInput) {
    // 无法归一的品牌：回退到「原文 contains」，至少保留用户显式指定的品牌限制
    pushUnique(brandTerms, splitBrandExpr(brandInput));
  }

  return { modelTerms, brandTerms };
}

// ───────────────────────────────────────────────
// 6. 兼容：v1 签名（review.ts 的 listRawListings / listLeads 在用）
// ───────────────────────────────────────────────

/**
 * 输入俗称或官方名 → 展开为可用于 `contains` 的候选串集合（双向）。
 * 调用方负责为返回的每一项构造 `{ modelName: { contains: t, mode: "insensitive" } }`。
 *
 * 展开逻辑：
 *  - 命中某 tier 的 slang 或 official 即展开该档，返回「该档所有 slang ∪ 所有品牌 official」的并集
 *    （v1 只返回一条官方名，会把国产同档机型漏掉）；
 *  - 未命中任何档位时只返回原输入（保持 v1 的「无匹配仅原样」行为）。
 */
export function expandModelQuery(input: string): string[] {
  const t = (input || "").trim();
  if (!t) return [];
  const tier = matchTier(t);
  if (!tier) return [t];
  const out: string[] = [t];
  pushUnique(out, tier.slang);
  pushUnique(out, flattenOfficials(tier));
  return out;
}

// ───────────────────────────────────────────────
// 7. 对外：model/brand → Prisma where 块（双通道）
// ───────────────────────────────────────────────

/**
 * 由机型/品牌构建 Prisma `RawListing` 筛选块（供 listLeads / listUnifiedLeads 等复用）：
 *   - `modelTerms`：仅当 `model` 有值时，对 `modelName` 做 insensitive `contains`（词项之间 OR）；
 *   - `brandTerms`：仅当 `brand` 有值时，**双通道**（同时对 `brandName` 与 `modelName` 做
 *     insensitive `contains`，二者之间 OR），所有词项之间再 OR。
 *     （理由：实测 `brandName` 常为 "CLAAS/New Holland" 合并串，真实品牌藏在 `modelName`
 *      的 AXION/BB9080/NH 里，单走 brandName 会丢失 2/3 行。）
 *   - `modelTerms` 与 `brandTerms` 之间 **AND** 组合（两者都有值时）。
 *
 * 返回 `null` 表示 `model`/`brand` 均未传，调用方无需追加该筛选（向后兼容）。
 */
export function buildModelBrandWhere(
  model?: string,
  brand?: string
): Prisma.RawListingWhereInput | null {
  const { modelTerms, brandTerms } = resolveModelFilter(model, brand);
  const blocks: Prisma.RawListingWhereInput[] = [];

  if (modelTerms.length > 0) {
    blocks.push({
      OR: modelTerms.map((t) => ({ modelName: { contains: t, mode: "insensitive" } })),
    });
  }
  if (brandTerms.length > 0) {
    blocks.push({
      OR: brandTerms.map((t) => ({
        OR: [
          { brandName: { contains: t, mode: "insensitive" } },
          { modelName: { contains: t, mode: "insensitive" } },
        ],
      })),
    });
  }

  if (blocks.length === 0) return null;
  return blocks.length === 1 ? blocks[0] : { AND: blocks };
}

