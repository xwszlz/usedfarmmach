/**
 * 专家校准样本库（Expert Calibration Sample Library）
 *
 * 目的：把外部专家 / 外部模型（如豆包）给出的**结构化估值结论**沉淀为可追溯样本，
 * 反向校准我们估值引擎的四类系数：品牌溢价、渠道折算、工时折旧曲线、发动机溢价。
 *
 * 设计原则（增量扩展，严禁破坏既有逻辑）：
 *  1. 本模块**只读**，不修改任何现有系数；只产出「当前值 vs 专家隐含值」的偏差与调优建议。
 *  2. 每条样本必须带 sourceRef（可追溯来源），禁止无来源臆造。
 *  3. 数据用 require 而非 import 加载：与 intelligence.ts 保持一致，避免 tsc 对 JSON 字面量
 *     做深层类型推导（构建更稳），且 webpack/Next 对静态 require("*.json") 可可靠追踪。
 *
 * 数据来源：src/lib/valuation/data/expert-calibration-samples.json
 */

import {
  HOURS_DEPRECIATION_CURVE,
  TRADE_CHANNEL_FACTORS,
  DOMESTIC_SUBSIDY_TO_HAND,
  DOMESTIC_BRAND_PREMIUM,
  getEngineBrandPremium,
  getCategoryAnnualHours,
  getCategoryAsabeParams,
  calcAsabeResidual,
  calcAgeTableResidual,
} from "./brand-data";
import type { ValuationInput } from "./formulas";

// ============================================================
// 类型定义（与 JSON schema 严格对应）
// ============================================================

export type NumRange = [number, number];

export interface ExpertAsset {
  brand: string;
  brandKey: string;
  model: string;
  category: string;
  powerHp: number;
  drive: string;
  engine: string;
  engineBrand: string;
  prodYear: number;
  region: string;
  emission: string;
  /** 该样本实测/采用的年均工时（h/yr），仅作标注，计算以 CATEGORY_ANNUAL_HOURS 为准 */
  annualHours?: number | null;
}

/** 样本类型：expert-machine = 外部专家单机报告；market-curve = 市场挂牌/成交曲线聚合 */
export type SampleType = "expert-machine" | "market-curve";

/** 样本置信度 */
export type SampleConfidence = "high" | "medium" | "low";

/** 机龄-残值锚点（按机龄分桶的市场观测值） */
export interface AgeResidualAnchor {
  ageYears: number;
  residualRatio: number;
  note?: string;
}

export interface ExpertNewPrice {
  listPrice: number;
  listRange?: NumRange;
  dealerBareRange?: NumRange;
  subsidyRange?: NumRange;
  afterSubsidyMid: number;
  afterSubsidyRange?: NumRange;
  competitorNote?: string;
}

export interface ExpertConditionTier {
  tier: string;
  hoursMin?: number | null;
  hoursMax?: number | null;
  hoursMid?: number | null;
  retailLow?: number | null;
  retailHigh?: number | null;
  retailMid?: number | null;
  desc?: string;
  note?: string;
}

export interface ExpertChannels {
  retailMid: number;
  dealerBuy?: NumRange;
  dealerBuyMid?: number;
  dealerBuyFactorRange?: NumRange;
  consignmentFeeRate?: NumRange;
  auctionFactor?: NumRange;
}

export interface ExpertExportFob {
  market: string;
  fob?: NumRange;
  fobMid?: number;
  newPriceLocal?: NumRange;
  emissionDiscount?: NumRange;
  note?: string;
}

export interface ExpertSample {
  id: string;
  source: string;
  sourceRef: string;
  asset: ExpertAsset;
  // ↓↓ market-curve 类样本（挂牌数据聚合）没有单机新机价/成色档/渠道/基准价，
  //    这些字段为可选；消费方必须能安全跳过缺字段的样本，不得抛错。
  newPrice?: ExpertNewPrice;
  conditionTiers?: ExpertConditionTier[];
  channels?: ExpertChannels;
  exportFob?: ExpertExportFob;
  addonPremium?: number;
  enginePremiumRange?: NumRange;
  brandDiscountRange?: NumRange;
  enginePremiumNote?: string;
  brandDiscountNote?: string;
  benchmark?: {
    conditionTier?: string;
    retailMid?: number;
    retailRange?: NumRange;
    dealerBuyMid?: number;
    fobMid?: number;
    listAdvice?: NumRange;
    exportFloor?: number;
  };
  /** 样本类型，缺省按 expert-machine（外部专家单机报告）处理 */
  sampleType?: SampleType;
  /** 置信度：market-curve（挂牌价聚合）通常为 low */
  confidence?: SampleConfidence;
  /** 机龄-残值锚点序列（挂牌/成交价 ÷ 新机价 按机龄分桶） */
  ageResidualAnchors?: AgeResidualAnchor[];
  missingVerification?: string[];
  methodology?: string;
}

export interface ExpertSampleSet {
  schemaVersion: number;
  updatedAt: string;
  description?: string;
  samples: ExpertSample[];
}

// ============================================================
// 加载 / 查询
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawSampleSet = require("./data/expert-calibration-samples.json") as ExpertSampleSet;

/** 加载全部专家校准样本 */
export function loadExpertSamples(): ExpertSample[] {
  return rawSampleSet?.samples ?? [];
}

/** 按品牌/型号/品类模糊检索样本 */
export function findExpertSamples(query: {
  brand?: string;
  model?: string;
  category?: string;
}): ExpertSample[] {
  const { brand, model, category } = query;
  return loadExpertSamples().filter((s) => {
    if (brand) {
      const hit =
        s.asset.brandKey?.includes(brand) ||
        s.asset.brand?.includes(brand) ||
        brand.includes(s.asset.brandKey ?? "");
      if (!hit) return false;
    }
    if (model && !(s.asset.model ?? "").toUpperCase().includes(model.toUpperCase())) return false;
    if (category && !(s.asset.category ?? "").includes(category)) return false;
    return true;
  });
}

/** 取样本集元信息 */
export function getSampleSetMeta(): { schemaVersion: number; updatedAt: string; count: number } {
  return {
    schemaVersion: rawSampleSet?.schemaVersion ?? 0,
    updatedAt: rawSampleSet?.updatedAt ?? "",
    count: loadExpertSamples().length,
  };
}

// ============================================================
// 通用小工具
// ============================================================

/** 区间取中位；无效返回 null */
function mid(r?: NumRange | null): number | null {
  if (!r || r.length !== 2) return null;
  const [a, b] = r;
  if (typeof a !== "number" || typeof b !== "number" || !isFinite(a) || !isFinite(b)) return null;
  return (a + b) / 2;
}

function pct(current: number, expert: number | null): number | null {
  if (expert == null || !isFinite(expert) || expert === 0) return null;
  return ((current - expert) / expert) * 100;
}

export type Verdict = "aligned" | "over" | "under" | "unknown";

/** 偏差判定：默认 ±5% 内视为对齐 */
function verdictOf(dev: number | null, tol = 5): Verdict {
  if (dev == null || !isFinite(dev)) return "unknown";
  if (Math.abs(dev) <= tol) return "aligned";
  return dev > 0 ? "over" : "under";
}

/**
 * 工时折旧曲线线性插值 —— 与 formulas.ts 的 calcHoursDepreciationFactor 同算法，
 * 用于在同口径下对比「我们的曲线」与「专家隐含残值」。
 */
export function interpolateHoursResidual(hours?: number | null): number | null {
  if (!hours || hours <= 0) return null;
  const curve = HOURS_DEPRECIATION_CURVE;
  if (hours <= curve[0].maxHours) return curve[0].residual;
  const last = curve[curve.length - 1];
  if (hours >= last.maxHours) return last.residual;
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (hours >= a.maxHours && hours <= b.maxHours) {
      const t = (hours - a.maxHours) / (b.maxHours - a.maxHours);
      return a.residual + (b.residual - a.residual) * t;
    }
  }
  return last.residual;
}

/** 复刻 DOMESTIC_BRAND_PREMIUM 的查找（精确 → 模糊 → 兜底 1.0） */
function lookupDomesticBrandPremium(brand?: string): number {
  if (!brand) return 1.0;
  const direct = DOMESTIC_BRAND_PREMIUM[brand];
  if (direct) return direct;
  for (const [key, val] of Object.entries(DOMESTIC_BRAND_PREMIUM)) {
    if (brand.includes(key) || key.includes(brand)) return val;
  }
  return 1.0;
}

// ============================================================
// 反推：从专家样本推导隐含系数
// ============================================================

export interface ChannelImplied {
  retail: number;
  dealer: number | null;
  consignment: number | null;
  auction: number | null;
}

/**
 * 反推渠道折算系数：
 *  dealer      = 商贩收购中位 / 零售中位
 *  consignment = 1 - 寄售服务费率中位（专家口径：接近零售，仅扣服务费）
 *  auction     = 拍卖折价系数中位
 */
export function deriveChannelImplied(ch?: ExpertChannels | null): ChannelImplied {
  // market-curve 类样本没有渠道数据 → 全量返回 null，下游判定为 unknown
  if (!ch) return { retail: 1.0, dealer: null, consignment: null, auction: null };
  let dealer: number | null = null;
  if (ch.retailMid) {
    if (ch.dealerBuyMid) dealer = ch.dealerBuyMid / ch.retailMid;
    if (dealer == null) {
      const dr = mid(ch.dealerBuy);
      if (dr != null) dealer = dr / ch.retailMid;
    }
  }
  if (dealer == null) dealer = mid(ch.dealerBuyFactorRange ?? null);

  const fee = mid(ch.consignmentFeeRate ?? null);
  const consignment = fee != null ? 1 - fee : null;

  return { retail: 1.0, dealer, consignment, auction: mid(ch.auctionFactor ?? null) };
}

export interface HourAnchor {
  tier: string;
  hours: number | null;
  retailMid: number | null;
  /** 专家隐含「毛残值率」= (零售中位 - 加装溢价) / 补贴后到手价（仍含品牌+发动机效应） */
  grossResidual: number | null;
  /** 剥离发动机溢价后的残值率（仍含品牌效应） */
  residualExEngine: number | null;
  /** 我们曲线在该工时的残值率 */
  ourResidual: number | null;
  /** ( ours - exEngine ) / exEngine × 100%  → 正=我们折旧偏慢(高估)，负=我们折旧偏快(低估) */
  deviationPct: number | null;
  verdict: Verdict;
  note?: string;
}

/** 反推工时-残值锚点（跳过缺中位价/工时的档位） */
export function deriveHourAnchors(s: ExpertSample): HourAnchor[] {
  const base = s.newPrice?.afterSubsidyMid;
  const addon = s.addonPremium ?? 0;
  const eng = getEngineBrandPremium(s.asset?.engineBrand);

  return (s.conditionTiers ?? []).map((t) => {
    const hours = t.hoursMid ?? null;
    const retailMid = t.retailMid ?? null;
    const our = interpolateHoursResidual(hours);

    if (hours == null || retailMid == null || !base) {
      return {
        tier: t.tier,
        hours,
        retailMid,
        grossResidual: null,
        residualExEngine: null,
        ourResidual: our,
        deviationPct: null,
        verdict: "unknown" as Verdict,
        note: t.note ?? "缺中位价或工时，不参与曲线校准",
      };
    }

    const gross = (retailMid - addon) / base;
    const exEngine = gross / (eng || 1);
    const dev = pct(our ?? 0, exEngine);
    return {
      tier: t.tier,
      hours,
      retailMid,
      grossResidual: gross,
      residualExEngine: exEngine,
      ourResidual: our,
      deviationPct: dev,
      verdict: verdictOf(dev),
      note: t.note,
    };
  });
}

// ============================================================
// 机龄-残值锚点（我们模型 vs 样本锚点 vs ASABE 参考）
// ============================================================

export interface AgeAnchor {
  ageYears: number;
  /** 合成累计工时 = 机龄 × 品类年均工时；品类无工时表（null）则为 null */
  synthHours: number | null;
  /** 我们工时曲线在该合成工时处的残值率 */
  hoursCurveResidual: number | null;
  /** 我们四段机龄表在该机龄处的残值率 */
  ageTableResidual: number;
  /** 我们引擎实际采用值 = min(工时曲线, 机龄表)（无合成工时则只取机龄表） */
  ourResidual: number;
  /** 样本给出的锚点残值率 */
  anchorResidual: number;
  /** (our − anchor) / anchor × 100 → 正=我们高估（折旧偏慢），负=我们低估 */
  deviationPct: number | null;
  /** ASABE 参考残值率（外部模型，**未接入主链路**，仅作对照列） */
  asabeResidual: number;
  /** (asabe − anchor) / anchor × 100 */
  asabeDeviationPct: number | null;
  verdict: Verdict;
  note?: string;
}

/**
 * 由样本的机龄-残值锚点推导逐点对比。
 * 口径说明：
 *  - 样本通常给不出真实工时，用「机龄 × 品类年均工时」合成（无工时表品类不合成，只走机龄法）；
 *  - 我们的引擎实际取 min(工时曲线, 机龄表)，与 formulas.calcCombinedDepreciation 同口径。
 */
export function deriveAgeAnchors(s: ExpertSample): AgeAnchor[] {
  const anchors = s.ageResidualAnchors ?? [];
  const annual = getCategoryAnnualHours(s.asset?.category);
  const asabeParams = getCategoryAsabeParams(s.asset?.category);

  return anchors.map((a) => {
    const synthHours = annual != null ? Math.round(a.ageYears * annual) : null;
    const hoursCurveResidual = synthHours != null ? interpolateHoursResidual(synthHours) : null;
    const ageTableResidual = calcAgeTableResidual(a.ageYears, s.asset?.category);
    const ourResidual =
      hoursCurveResidual != null ? Math.min(hoursCurveResidual, ageTableResidual) : ageTableResidual;
    const deviationPct = pct(ourResidual, a.residualRatio);
    const asabeResidual = calcAsabeResidual(asabeParams, a.ageYears, annual);
    const asabeDeviationPct = pct(asabeResidual, a.residualRatio);

    return {
      ageYears: a.ageYears,
      synthHours,
      hoursCurveResidual,
      ageTableResidual,
      ourResidual,
      anchorResidual: a.residualRatio,
      deviationPct,
      asabeResidual,
      asabeDeviationPct,
      verdict: verdictOf(deviationPct),
      note: a.note,
    };
  });
}

// ============================================================
// 对比：当前系数 vs 专家隐含系数
// ============================================================

export interface CalibrationFinding {
  dimension: string;
  label: string;
  current: number | null;
  expert: number | null;
  deviationPct: number | null;
  verdict: Verdict;
  detail: string;
  suggestion: string;
}

export interface CalibrationReport {
  sampleId: string;
  sourceRef: string;
  generatedAt: string;
  findings: CalibrationFinding[];
  hourAnchors: HourAnchor[];
  /** 命中「超出容差」的维度数 */
  misalignedCount: number;
}

const f2 = (n: number | null): string => (n == null ? "—" : n.toFixed(2));
const f3 = (n: number | null): string => (n == null ? "—" : n.toFixed(3));
const fp = (n: number | null): string => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

/** 构建单样本的校准报告 */
export function buildCalibrationReport(s: ExpertSample, tol = 5): CalibrationReport {
  const findings: CalibrationFinding[] = [];
  const cat = s.asset?.category ?? "";
  const engineBrand = s.asset?.engineBrand ?? "";

  // ---- 1. 渠道折算系数 ----
  const imp = deriveChannelImplied(s.channels);
  const chanDefs: Array<{ key: string; label: string; cur: number; exp: number | null; how: string }> = [
    {
      key: "dealer",
      label: "经销商/商贩收购",
      cur: TRADE_CHANNEL_FACTORS.dealer,
      exp: imp.dealer,
      how: "收购中位 ÷ 零售中位",
    },
    {
      key: "consignment",
      label: "寄售/中介代卖",
      cur: TRADE_CHANNEL_FACTORS.consignment,
      exp: imp.consignment,
      how: "1 − 服务费率中位",
    },
    {
      key: "auction",
      label: "拍卖处置",
      cur: TRADE_CHANNEL_FACTORS.auction,
      exp: imp.auction,
      how: "拍卖折价系数中位",
    },
  ];

  for (const c of chanDefs) {
    const dev = pct(c.cur, c.exp);
    const v = verdictOf(dev, tol);
    findings.push({
      dimension: `channel.${c.key}`,
      label: c.label,
      current: c.cur,
      expert: c.exp,
      deviationPct: dev,
      verdict: v,
      detail: `专家隐含=${f3(c.exp)}（${c.how}），当前=${f3(c.cur)}`,
      suggestion:
        v === "aligned"
          ? "口径一致，保持"
          : v === "over"
          ? `当前系数高于专家 ${fp(dev)}，该渠道报价偏高，建议下调至 ${f3(c.exp)}`
          : v === "under"
          ? `当前系数低于专家 ${fp(dev)}，该渠道报价偏低（过度折价），建议上调至 ${f3(c.exp)}`
          : "专家样本未提供该渠道数据，保持",
    });
  }

  // ---- 2. 补贴后到手比率 ----
  const impliedToHand = s.newPrice?.listPrice ? s.newPrice.afterSubsidyMid / s.newPrice.listPrice : null;
  const curToHand = DOMESTIC_SUBSIDY_TO_HAND[cat] ?? DOMESTIC_SUBSIDY_TO_HAND.default;
  {
    const dev = pct(curToHand, impliedToHand);
    const v = verdictOf(dev, tol);
    findings.push({
      dimension: "subsidy.toHand",
      label: "补贴后到手比率",
      current: curToHand,
      expert: impliedToHand,
      deviationPct: dev,
      verdict: v,
      detail: `专家：指导价${s.newPrice?.listPrice} → 补贴后${s.newPrice?.afterSubsidyMid}，隐含${f3(impliedToHand)}；当前${cat || "default"}=${f3(curToHand)}`,
      suggestion:
        v === "aligned"
          ? "口径一致，保持"
          : `建议调整 ${cat || "default"} 到手比率至 ${f3(impliedToHand)}（当前偏离 ${fp(dev)}）`,
    });
  }

  // ---- 3. 发动机品牌溢价 ----
  const engRangeMid = mid(s.enginePremiumRange ?? null);
  const impliedEng = engRangeMid != null ? 1 + engRangeMid : null;
  const curEng = getEngineBrandPremium(engineBrand);
  {
    const dev = pct(curEng, impliedEng);
    const v = verdictOf(dev, tol);
    findings.push({
      dimension: "engine.premium",
      label: `发动机溢价（${engineBrand || "未知"}）`,
      current: curEng,
      expert: impliedEng,
      deviationPct: dev,
      verdict: v,
      detail: `专家口径溢价 ${s.enginePremiumRange ? `${(s.enginePremiumRange[0] * 100).toFixed(0)}%-${(s.enginePremiumRange[1] * 100).toFixed(0)}%` : "—"}，隐含${f3(impliedEng)}；当前=${f3(curEng)}`,
      suggestion: v === "aligned" ? "口径一致，保持" : `建议调整 ${engineBrand} 溢价至 ${f3(impliedEng)}（当前偏离 ${fp(dev)}）`,
    });
  }

  // ---- 4. 品牌折价（口径提示：专家为「相对一线头部」，我们为绝对系数，仅作方向参考） ----
  const bdMid = mid(s.brandDiscountRange ?? null);
  const impliedBrand = bdMid != null ? 1 - bdMid : null;
  const curBrand = lookupDomesticBrandPremium(s.asset?.brandKey || s.asset?.brand);
  {
    const dev = pct(curBrand, impliedBrand);
    const v = verdictOf(dev, tol);
    findings.push({
      dimension: "brand.discount",
      label: `品牌折价（${s.asset?.brandKey || s.asset?.brand}）`,
      current: curBrand,
      expert: impliedBrand,
      deviationPct: dev,
      verdict: v,
      detail: `⚠️口径不同：专家为「相对一线头部折价 ${s.brandDiscountRange ? `${(s.brandDiscountRange[0] * 100).toFixed(0)}%-${(s.brandDiscountRange[1] * 100).toFixed(0)}%` : "—"}」，我们 DOMESTIC_BRAND_PREMIUM 为绝对系数=${f3(curBrand)}，仅作方向参考`,
      suggestion:
        v === "unknown"
          ? "样本未提供，保持"
          : `方向参考：若采信专家，${s.asset?.brandKey} 应优于当前兜底值（当前${f3(curBrand)} vs 专家隐含${f3(impliedBrand)}）`,
    });
  }

  const hourAnchors = deriveHourAnchors(s);

  return {
    sampleId: s.id,
    sourceRef: s.sourceRef,
    generatedAt: new Date().toISOString(),
    findings,
    hourAnchors,
    misalignedCount: findings.filter((f) => f.verdict === "over" || f.verdict === "under").length,
  };
}

/** 构建全部样本的校准报告 */
export function buildAllCalibrationReports(tol = 5): CalibrationReport[] {
  return loadExpertSamples().map((s) => buildCalibrationReport(s, tol));
}

/**
 * 由样本基准工况构造引擎输入，供端到端对比（脚本/API 调用 calculateValuationV4）。
 * 注意：专家样本通常未给出真实工时，这里用基准工况的 hoursMid 作为代理，
 * 因此对比结论须标注「按专家假想工况」。
 */
export function toEngineInput(s: ExpertSample): ValuationInput {
  const tier = (s.conditionTiers ?? []).find((t) => t.tier === s.benchmark?.conditionTier);
  return {
    brand: s.asset?.brandKey || s.asset?.brand,
    modelName: s.asset?.model,
    category: s.asset?.category,
    year: s.asset?.prodYear,
    workingHours: tier?.hoursMid ?? undefined,
    condition: "good",
    location: s.asset?.region,
    enginePower: s.asset?.powerHp,
    driveSystem: s.asset?.drive,
    engineBrand: s.asset?.engineBrand,
    tradeChannel: "retail",
  };
}
