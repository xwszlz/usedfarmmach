/**
 * 品牌派生器 —— 从「覆盖机型 / 覆盖机型组」自由文本派生规范品牌 key。
 *
 * ## 为什么需要本模块
 * 源 xlsx（82户经销商联系表-外发版）**没有品牌列**，而 `import-leads.ts:148` 的
 * `validateRow` 要求 `brandName` 非空。品牌信息只能从 `覆盖机型` / `覆盖机型组`
 * 的自由文本里反推。
 *
 * ## brandName 取值口径（本任务最重要的决定）
 * `src/lib/raw-listing/model-aliases.ts:128` 的 `BRAND_KEYS` 实测为
 * `Object.keys(BRAND_VARIANTS)`，即 **12 个小写下划线规范 key**：
 *
 *   claas, new_holland, john_deere, lovol, yto, changfa,
 *   dongfeng, huaxia, kubota, case_ih, yanmar, krone
 *
 * 而库里实际落过的 `brandName` 是人类可读串（`CLAAS` / `克拉斯` / `Claas` 三种写法并存）。
 * 本 ETL **输出规范 key**（`claas` 而非 `CLAAS`），理由：
 *   1. 验收口径要求「全部取值 ∈ BRAND_KEYS」，只有 key 字面量才满足；
 *   2. `resolveBrandKey("claas") === "claas"`、`resolveBrandKey("CLAAS") === "claas"`，
 *      写 key 与写变体**读侧都能解析**，但写 key 是唯一无歧义的规范形；
 *   3. `brandName` 参与 `contentHash`，取规范 key 才能让同批次/跨批次 hash 稳定。
 *
 * ## 硬约束
 * - 输出必须是 `BRAND_KEYS` 内**单一**值，禁止 `CLAAS/New Holland` 合并串；
 * - 多品牌户取**优先级最高者**，完整机型串原样写进 `modelName` 走双通道筛选；
 * - 绝不因多品牌拆多行（PRD §4.4：一户拆两行会导致外呼重复拨打）。
 */

import * as fs from "fs";
import * as path from "path";

/** 规范品牌 key（`BRAND_KEYS` 的实测副本，由 `verifyBrandKeysAgainstSource()` 校验） */
export const BRAND_KEYS: readonly string[] = [
  "claas",
  "new_holland",
  "john_deere",
  "lovol",
  "yto",
  "changfa",
  "dongfeng",
  "huaxia",
  "kubota",
  "case_ih",
  "yanmar",
  "krone",
];

/** 兜底品牌（第 8 级） */
export const BRAND_FALLBACK = "claas";

/** 派生结果 */
export interface BrandDerivation {
  /** 规范品牌 key，必定 ∈ BRAND_KEYS */
  brandName: string;
  /** 命中的级别（1–8），8 = 兜底 */
  level: number;
  /** 命中的关键词（兜底时为空串） */
  matchedToken: string;
  /** 是否走到第 8 级兜底（决定是否打 `[品牌兜底]`） */
  isFallback: boolean;
  /** 命中的所有品牌 key（按优先级排序，用于报告，不写进 CSV） */
  allMatchedKeys: string[];
}

interface BrandRule {
  level: number;
  brandName: string;
  tokens: readonly string[];
  /** 机型组等于该值时直接命中（仅第 1 级用） */
  tierEquals?: string;
  note: string;
}

/**
 * 八级派生规则表（自上而下，命中即停）。
 *
 * 依据 `线索池-工程方案与任务分解` §8.2。第 2 级额外补充 `CLAAS` 字面量：
 * 源数据 #9「CLAAS 含 850 系」不含 AXION/JAGUAR/XERION/克拉斯 任一 token，
 * 若不补会误落兜底并被错误标记为 `[品牌兜底]`。`CLAAS` 本就在
 * `BRAND_VARIANTS.claas` 内，补充与权威常量一致。
 */
const BRAND_RULES: readonly BrandRule[] = [
  {
    level: 1,
    brandName: "new_holland",
    tokens: ["BB9080", "BB9000", "NH", "纽荷兰", "大方捆"],
    tierEquals: "9080",
    note: "机型组=9080 或 含 BB9080/BB9000/NH/纽荷兰/大方捆",
  },
  {
    level: 2,
    brandName: "claas",
    tokens: ["AXION", "JAGUAR", "XERION", "克拉斯", "CLAAS"],
    note: "含 AXION/JAGUAR/XERION/克拉斯/CLAAS",
  },
  {
    level: 3,
    brandName: "lovol",
    tokens: ["雷沃", "LOVOL", "M2204", "M2504", "RG"],
    note: "含 雷沃/LOVOL/M2204/M2504/RG",
  },
  {
    level: 4,
    brandName: "yto",
    tokens: ["东方红", "LX2204", "LX2504", "YTO"],
    note: "含 东方红/LX2204/LX2504/YTO",
  },
  {
    level: 5,
    brandName: "changfa",
    tokens: ["常发", "J2204", "CFJ", "CFK"],
    note: "含 常发/J2204/CFJ/CFK",
  },
  {
    level: 6,
    brandName: "dongfeng",
    tokens: ["东风"],
    note: "含 东风（且非东方红，因第 4 级先命中）",
  },
  {
    level: 7,
    brandName: "huaxia",
    tokens: ["华夏"],
    note: "含 华夏",
  },
];

/** 归一：去首尾空格并转大写，保证中英文 token 的包含匹配稳定 */
function normalizeForMatch(input: string): string {
  return (input || "").trim().toUpperCase();
}

/**
 * 派生品牌。
 *
 * @param modelText `覆盖机型` 自由文本
 * @param tierText  `覆盖机型组` 自由文本（如 `850` / `2504/2204` / `9080`）
 * @returns 派生结果（必定返回一个 ∈ BRAND_KEYS 的 brandName）
 */
export function deriveBrand(modelText: string, tierText: string): BrandDerivation {
  const modelHay = normalizeForMatch(modelText);
  const tierHay = normalizeForMatch(tierText);
  const haystack = `${modelHay} ${tierHay}`;

  const allMatchedKeys: string[] = [];
  for (const rule of BRAND_RULES) {
    if (rule.tierEquals && tierHay === normalizeForMatch(rule.tierEquals)) {
      if (!allMatchedKeys.includes(rule.brandName)) allMatchedKeys.push(rule.brandName);
      return {
        brandName: rule.brandName,
        level: rule.level,
        matchedToken: `机型组=${rule.tierEquals}`,
        isFallback: false,
        allMatchedKeys,
      };
    }
    for (const token of rule.tokens) {
      if (haystack.includes(normalizeForMatch(token))) {
        if (!allMatchedKeys.includes(rule.brandName)) allMatchedKeys.push(rule.brandName);
        return {
          brandName: rule.brandName,
          level: rule.level,
          matchedToken: token,
          isFallback: false,
          allMatchedKeys,
        };
      }
    }
  }

  // 第 8 级：兜底
  return {
    brandName: BRAND_FALLBACK,
    level: 8,
    matchedToken: "",
    isFallback: true,
    allMatchedKeys,
  };
}

/** 列出全部命中品牌（用于报告：多品牌户除 brandName 外的其余品牌） */
export function listAllBrands(modelText: string, tierText: string): string[] {
  const modelHay = normalizeForMatch(modelText);
  const tierHay = normalizeForMatch(tierText);
  const haystack = `${modelHay} ${tierHay}`;
  const out: string[] = [];
  for (const rule of BRAND_RULES) {
    const tierHit = rule.tierEquals ? tierHay === normalizeForMatch(rule.tierEquals) : false;
    const tokenHit = rule.tokens.some((t) => haystack.includes(normalizeForMatch(t)));
    if ((tierHit || tokenHit) && !out.includes(rule.brandName)) out.push(rule.brandName);
  }
  return out;
}

/**
 * 自检：把本文件硬编码的 `BRAND_KEYS` 与 `model-aliases.ts` 里 `BRAND_VARIANTS`
 * 的真实声明顺序做比对，防止上游常量变动后本 ETL 静默产出越界值。
 *
 * @param repoRoot 仓库根目录（含 `src/lib/raw-listing/model-aliases.ts`）
 */
export function verifyBrandKeysAgainstSource(repoRoot: string): {
  ok: boolean;
  sourceKeys: string[];
  localKeys: string[];
  detail: string;
} {
  const rel = path.join("src", "lib", "raw-listing", "model-aliases.ts");
  const abs = path.join(repoRoot, rel);
  const localKeys = [...BRAND_KEYS];
  if (!fs.existsSync(abs)) {
    return {
      ok: false,
      sourceKeys: [],
      localKeys,
      detail: `未找到源文件 ${rel}，无法校验`,
    };
  }
  const text = fs.readFileSync(abs, "utf8");
  const start = text.indexOf("export const BRAND_VARIANTS");
  if (start < 0) {
    return { ok: false, sourceKeys: [], localKeys, detail: "源文件中未找到 BRAND_VARIANTS 声明" };
  }
  const braceStart = text.indexOf("{", start);
  const braceEnd = text.indexOf("\n};", braceStart);
  const block = text.slice(braceStart + 1, braceEnd < 0 ? text.length : braceEnd);
  const sourceKeys: string[] = [];
  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm;
  let m: RegExpExecArray | null = re.exec(block);
  while (m !== null) {
    sourceKeys.push(m[1]);
    m = re.exec(block);
  }
  const ok = sourceKeys.length > 0 && sourceKeys.join(",") === localKeys.join(",");
  return {
    ok,
    sourceKeys,
    localKeys,
    detail: ok
      ? `与 ${rel} 的 BRAND_VARIANTS 声明顺序完全一致（${sourceKeys.length} 项）`
      : `与 ${rel} 不一致：源=[${sourceKeys.join(", ")}] 本文件=[${localKeys.join(", ")}]`,
  };
}
