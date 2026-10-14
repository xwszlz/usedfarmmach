/**
 * 估值情报层（服务端）— 基于真实补贴交易数据（valuation_intelligence.json）。
 *
 * 设计：
 * - JSON 仅在服务端加载（route.ts 通过本模块访问），绝不进入客户端 bundle；
 * - 每次 /api/valuation 请求按 (brand, category, model, region) 切片返回「相关片段」，
 *   响应体极小（KB 级），而非 5.4MB 全量；
 * - 前端组件据返回片段用 recharts 渲染顶级数据报告的 8 大模块。
 *
 * 数据血缘：原始 17 列补贴库(1.96GB, GBK) → 早年归一化管线 → 全量 866 万行聚合
 * （build_valuation_intelligence.py --mode full）→ valuation_intelligence.json。
 */

// 用 require 而非 import：避免 tsc 对 5.4MB JSON 字面量做深层类型推导（构建更稳）；
// webpack/Next 对静态 require("*.json") 仍可可靠追踪并纳入服务端 bundle。
// eslint-disable-next-line @typescript-eslint/no-var-requires
const intelligenceData = require("./data/valuation_intelligence.json");

const data = intelligenceData as unknown as {
  global: {
    total_records: number;
    n_brands: number;
    n_categories: number;
    n_provinces: number;
    top_brands: { brand: string; n: number }[];
  };
  by_model: Record<string, ModelRaw>;
  by_brand_cat: Record<string, ModelRaw>;
  depreciation: Record<string, DepreciationRaw>;
  regional: Record<string, RegionalRaw>;
  confidence: Record<string, { n: number; cv: number }>;
};

interface ModelRaw {
  n: number;
  median: number;
  p25: number;
  p75: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  medCentral: number;
  medTotal: number;
  netMedian: number;
}

interface DepreciationRaw {
  ref_new_median: number;
  curve: Record<string, number>;
}

interface RegionalRaw {
  n: number;
  median: number;
  index: number;
}

export interface ModelStat {
  key: string;
  level: "model" | "brand_category";
  n: number;
  median: number;
  p25: number;
  p75: number;
  mean: number;
  min: number;
  max: number;
  netMedian: number;
  medCentral: number;
  medTotal: number;
}

export interface RegionalStat {
  province: string;
  n: number;
  median: number;
  index: number;
}

export interface BrandRankItem {
  brand: string;
  n: number;
  median: number;
  netMedian: number;
}

export interface DepreciationPoint {
  age: number;
  residual: number;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ValuationIntelligence {
  available: boolean;
  brand: string;
  category: string;
  modelName?: string;
  model?: ModelStat;
  brandCat?: ModelStat;
  regional?: {
    current?: RegionalStat;
    currentIndex: number | null;
    list: RegionalStat[];
  };
  depreciation?: {
    category: string;
    refNewMedian: number;
    curve: DepreciationPoint[];
  };
  brandRanking?: {
    category: string;
    top: BrandRankItem[];
    current?: BrandRankItem;
    currentRank?: number;
    total: number;
  };
  confidence?: {
    n: number;
    cv: number;
    level: ConfidenceLevel;
  };
  global: {
    totalRecords: number;
    nBrands: number;
    nCategories: number;
    nProvinces: number;
    topBrands: { brand: string; n: number }[];
  };
}

// ── 归一化辅助 ──────────────────────────────────────────────
const REGION_STRIP = /[省市自治区农垦集团]/g;

function normBrand(b: string): string {
  return (b || "").replace(/\s+/g, "").replace(/[（）()]/g, "");
}

function normCat(c: string): string {
  return (c || "").trim();
}

/** 在 dict 中按 品牌||品类 模糊查找（处理 潍柴雷沃/雷沃、空格、括号等） */
function findBrandCat(dict: Record<string, ModelRaw>, brand: string, category: string): [string, ModelRaw] | null {
  const nb = normBrand(brand);
  const nc = normCat(category);
  const exact = `${brand}||${category}`;
  if (dict[exact]) return [exact, dict[exact]];
  for (const key of Object.keys(dict)) {
    const parts = key.split("||");
    const b = parts[0];
    const c = parts[1];
    if (b && c && normBrand(b) === nb && normCat(c) === nc) return [key, dict[key]];
  }
  return null;
}

/** 在 by_model 中按 品牌||品类||型号 模糊查找 */
function findModel(
  dict: Record<string, ModelRaw>,
  brand: string,
  category: string,
  modelName: string,
): [string, ModelRaw] | null {
  const nm = (modelName || "").replace(/\s+/g, "");
  if (!nm) return null;
  const exact = `${brand}||${category}||${modelName}`;
  if (dict[exact]) return [exact, dict[exact]];
  const nb = normBrand(brand);
  const nc = normCat(category);
  for (const key of Object.keys(dict)) {
    const parts = key.split("||");
    const b = parts[0];
    const c = parts[1];
    const m = (parts[2] || "").replace(/\s+/g, "");
    if (b && c && m && normBrand(b) === nb && normCat(c) === nc && m === nm) {
      return [key, dict[key]];
    }
  }
  return null;
}

/** 匹配用户所选省份到 regional 表中的最佳条目 */
function matchRegion(region: string | undefined): RegionalStat | null {
  if (!region) return null;
  const target = region.replace(REGION_STRIP, "");
  let fallback: { key: string; stat: RegionalRaw } | null = null;
  for (const [key, stat] of Object.entries(data.regional)) {
    const norm = key.replace(REGION_STRIP, "");
    if (norm.includes(target) || target.includes(norm)) {
      const stripped = key.replace(region, "");
      const isProvince =
        stripped === "" || /^(省|市|自治区|农垦集团|壮族自治区|回族自治区|维吾尔自治区)$/.test(stripped);
      if (isProvince) return { province: key, ...stat };
      if (!fallback) fallback = { key, stat };
    }
  }
  return fallback ? { province: fallback.key, ...fallback.stat } : null;
}

function mapModelStat(key: string, raw: ModelRaw, level: "model" | "brand_category"): ModelStat {
  return {
    key,
    level,
    n: raw.n,
    median: raw.median,
    p25: raw.p25,
    p75: raw.p75,
    mean: raw.mean,
    min: raw.min,
    max: raw.max,
    netMedian: raw.netMedian,
    medCentral: raw.medCentral,
    medTotal: raw.medTotal,
  };
}

/**
 * 按 (品牌, 品类, 型号, 省份) 切片真实交易情报，构造顶级数据报告所需的全部片段。
 * 任一维度缺失/未命中时优雅降级（available 仍可为真，对应子字段为 undefined）。
 */
export function getValuationIntelligence(
  brand?: string,
  category?: string,
  modelName?: string,
  region?: string,
): ValuationIntelligence {
  const base: ValuationIntelligence = {
    available: false,
    brand: brand || "",
    category: category || "",
    global: {
      totalRecords: data.global.total_records,
      nBrands: data.global.n_brands,
      nCategories: data.global.n_categories,
      nProvinces: data.global.n_provinces,
      topBrands: data.global.top_brands,
    },
  };

  if (!brand || !category) return base;

  base.available = true;
  base.modelName = modelName || undefined;

  // 1) 同款 / 同品牌同品类
  const modelHit = findModel(data.by_model, brand, category, modelName || "");
  if (modelHit) {
    base.model = mapModelStat(modelHit[0], modelHit[1], "model");
  }
  const bcHit = findBrandCat(data.by_brand_cat, brand, category);
  if (bcHit) {
    base.brandCat = mapModelStat(bcHit[0], bcHit[1], "brand_category");
  }

  // 2) 区域比价
  const current = matchRegion(region) || undefined;
  const regionalList = Object.entries(data.regional)
    .map(([k, v]) => ({ province: k, ...v }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);
  // 保证当前省份一定出现
  if (current && !regionalList.some((r) => r.province === current.province)) {
    regionalList.push(current);
  }
  base.regional = {
    current,
    currentIndex: current ? current.index : null,
    list: regionalList,
  };

  // 3) 折旧曲线（按品类）
  const depRaw = data.depreciation[category];
  if (depRaw) {
    const curve: DepreciationPoint[] = Object.entries(depRaw.curve)
      .map(([ageStr, residual]) => ({ age: parseInt(ageStr, 10), residual }))
      .filter((p) => Number.isFinite(p.age) && p.age >= 1 && p.age <= 20 && p.residual > 0.2 && p.residual <= 1.3)
      .sort((a, b) => a.age - b.age);
    base.depreciation = {
      category,
      refNewMedian: depRaw.ref_new_median,
      curve,
    };
  }

  // 4) 品牌残值率排行（同品类内）
  const catSuffix = `||${category}`;
  const catEntries = Object.entries(data.by_brand_cat)
    .filter(([k]) => k.endsWith(catSuffix))
    .map(([k, v]) => ({ brand: k.split("||")[0], n: v.n, median: v.median, netMedian: v.netMedian }))
    .filter((e) => e.n >= 20);
  catEntries.sort((a, b) => b.netMedian - a.netMedian);
  const top = catEntries.slice(0, 8);
  const currentBrandEntry = catEntries.find((e) => normBrand(e.brand) === normBrand(brand));
  base.brandRanking = {
    category,
    top,
    current: currentBrandEntry,
    currentRank: currentBrandEntry ? catEntries.indexOf(currentBrandEntry) + 1 : undefined,
    total: catEntries.length,
  };

  // 5) 置信度（以样本量为主，变异系数为辅：样本足则统计显著，价差宽是品类固有属性）
  const cfHit = findBrandCat(data.confidence as unknown as Record<string, ModelRaw>, brand, category);
  if (cfHit) {
    const cv = (cfHit[1] as unknown as { cv: number }).cv;
    const n = cfHit[1].n;
    const level: ConfidenceLevel = n >= 20000 ? "high" : n >= 2000 ? "medium" : "low";
    base.confidence = { n, cv, level };
  }

  return base;
}
