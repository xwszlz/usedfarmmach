/**
 * 国际价格采集 Agent（#3）— 数据源采集器
 *
 * 4 个数据源的归一化采集：snapshot / brief / daily_md / manual
 * 每个函数返回 CollectedPrice[]，不做产品匹配、不写库
 */
import * as fs from "fs";
import * as path from "path";
import type { CollectedPrice, PriceSource } from "./types";

const ARBITRAGE_DIR = "D:/神雕农机/套利报告";
const DAILY_DIR = "D:/神雕农机/神雕日报";
const DEFAULT_EUR_CNY = 7.91;
const DEFAULT_USD_CNY = 7.25;

// ==================== 工具函数 ====================

/** 关键词 → 数据源名称映射 */
function normalizeSourceName(raw: string | undefined | null): string {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  if (s.includes("agroline")) return "Agroline";
  if (s.includes("tractorhouse")) return "TractorHouse";
  if (s.includes("machinerypete")) return "MachineryPete";
  if (s.includes("e-farm") || s.includes("efarm")) return "e-farm";
  if (s.includes("agriaffaires")) return "Agriaffaires";
  if (s.includes("mascus")) return "Mascus";
  return raw;
}

/** 从 raw 推断币种 */
function detectCurrency(source: string, hint?: string): "EUR" | "USD" {
  if (hint) {
    const h = hint.toUpperCase();
    if (h === "EUR" || h === "€") return "EUR";
    if (h === "USD" || h === "$") return "USD";
  }
  const s = source.toLowerCase();
  // 北美平台默认 USD
  if (s.includes("tractorhouse") || s.includes("machinerypete")) return "USD";
  return "EUR";
}

// ==================== 1. Snapshot JSON ====================

interface SnapshotItem {
  serial: string;
  machine_type: string;
  brand: string;
  model: string;
  year: number | null;
  domestic_price: number | null;       // 万元
  best_foreign_price_cny: number | null;  // 万元
  best_foreign_source: string;
  best_foreign_url: string;
  best_foreign_title: string;
  gross_margin_pct: number | null;
  opportunity_level: string;
}

export async function collectFromSnapshot(
  maxFiles: number,
  targetDate?: string
): Promise<CollectedPrice[]> {
  if (!fs.existsSync(ARBITRAGE_DIR)) return [];
  const files = fs.readdirSync(ARBITRAGE_DIR)
    .filter(f => f.startsWith("snapshot_") && f.endsWith(".json") && !f.includes("dryrun"))
    .sort()
    .reverse();
  const filtered = targetDate ? files.filter(f => f.includes(targetDate)) : files;
  const out: CollectedPrice[] = [];
  for (const file of filtered.slice(0, maxFiles)) {
    const fp = path.join(ARBITRAGE_DIR, file);
    try {
      const items: SnapshotItem[] = JSON.parse(fs.readFileSync(fp, "utf-8"));
      const date = file.match(/(\d{8})/)?.[1] || "";
      for (const it of items) {
        if (!it.best_foreign_price_cny || it.best_foreign_price_cny <= 0) continue;
        const source = normalizeSourceName(it.best_foreign_source);
        const currency = detectCurrency(source);
        const rate = currency === "EUR" ? DEFAULT_EUR_CNY : DEFAULT_USD_CNY;
        // snapshot.best_foreign_price_cny 同样是人民币（万元），直接 wan*10000
        const priceForeignCny = Math.round(it.best_foreign_price_cny * 10000);
        const priceRaw = Math.round(priceForeignCny / rate);
        out.push({
          source,
          brandNameZh: it.brand,
          modelName: it.model.replace(/[（(].*?[)）]/g, "").trim(),
          year: it.year,
          domesticPriceWan: it.domestic_price,
          priceEur: currency === "EUR" ? priceRaw : null,
          priceUsd: currency === "USD" ? priceRaw : null,
          exchangeRate: rate,
          sourceUrl: it.best_foreign_url || null,
          sourceTitle: it.best_foreign_title || null,
          sourceDate: date,
          country: source === "Agroline" ? "DE" : source === "TractorHouse" ? "US" : null,
          opportunityLevel: it.opportunity_level || "unknown",
          grossMarginPct: it.gross_margin_pct,
          note: `snapshot:${path.basename(file)}`,
        });
      }
    } catch (e) {
      console.warn(`[snapshot] ${file} 解析失败:`, e);
    }
  }
  return out;
}

// ==================== 2. 智能体简报 JSON ====================

interface BriefTopOpportunity {
  machine_type: string;
  brand: string;
  model: string;
  year: number;
  domestic_price_wan: number;
  best_foreign_price_wan: number;
  gross_profit_wan: number;
  gross_margin_pct: number;
  source: string;
  url: string;
  opportunity_level?: string;
}

export async function collectFromBrief(
  maxFiles: number,
  targetDate?: string
): Promise<CollectedPrice[]> {
  if (!fs.existsSync(ARBITRAGE_DIR)) return [];
  const files = fs.readdirSync(ARBITRAGE_DIR)
    .filter(f => f.startsWith("智能体简报_") && f.endsWith(".json") && !f.includes("dryrun"))
    .sort()
    .reverse();
  const filtered = targetDate ? files.filter(f => f.includes(targetDate)) : files;
  const out: CollectedPrice[] = [];
  for (const file of filtered.slice(0, maxFiles)) {
    const fp = path.join(ARBITRAGE_DIR, file);
    try {
      const brief = JSON.parse(fs.readFileSync(fp, "utf-8"));
      const items: BriefTopOpportunity[] = brief.top_arbitrage_opportunities || [];
      const date = brief.generated_at?.slice(0, 10).replace(/-/g, "") || "";
      for (const it of items) {
        if (!it.best_foreign_price_wan || it.best_foreign_price_wan <= 0) continue;
        const source = normalizeSourceName(it.source);
        const currency = detectCurrency(source);
        const rate = currency === "EUR" ? DEFAULT_EUR_CNY : DEFAULT_USD_CNY;
        // brief.best_foreign_price_wan 是人民币（万元），不是原始币种！
        // 所以 priceForeignCny 字段直接用 wan*10000，不要再除汇率
        const priceForeignCny = Math.round(it.best_foreign_price_wan * 10000);
        const priceRaw = Math.round(priceForeignCny / rate);
        out.push({
          source,
          brandNameZh: it.brand,
          modelName: it.model.replace(/[（(].*?[)）]/g, "").trim(),
          year: it.year,
          domesticPriceWan: it.domestic_price_wan,
          priceEur: currency === "EUR" ? priceRaw : null,
          priceUsd: currency === "USD" ? priceRaw : null,
          exchangeRate: rate,
          sourceUrl: it.url || null,
          sourceTitle: null,
          sourceDate: date,
          country: source === "Agroline" ? "DE" : source === "TractorHouse" ? "US" : null,
          opportunityLevel: it.opportunity_level || "unknown",
          grossMarginPct: it.gross_margin_pct / 100,  // brief 是百分比数值
          note: `brief:${path.basename(file)} | 毛利${it.gross_profit_wan?.toFixed(1)}万`,
        });
      }
    } catch (e) {
      console.warn(`[brief] ${file} 解析失败:`, e);
    }
  }
  return out;
}

// ==================== 3. 神雕日报 Markdown ====================

/** 从日报 MD 抓克拉斯/其他品牌的欧元价格（启发式） */
export async function collectFromDailyMd(
  maxFiles: number,
  targetDate?: string
): Promise<CollectedPrice[]> {
  if (!fs.existsSync(DAILY_DIR)) return [];
  const files = fs.readdirSync(DAILY_DIR)
    .filter(f => f.endsWith("_跨境套利日报.md"))
    .sort()
    .reverse();
  const filtered = targetDate
    ? files.filter(f => f.replace(/-/g, "").includes(targetDate))
    : files;
  const out: CollectedPrice[] = [];
  // 抓克拉斯 / CLAAS 系列
  const claasRe = /克拉斯\s+Jaguar\s+(\d{3})[^€]*€([\d,]+)/g;
  // 抓其他品牌 € 价格
  const genericRe = /([\u4e00-\u9fa5]{2,4})\s+([A-Za-z0-9\- ]{2,12})\s+\((\d{4})\)[^€]*€([\d,]+)/g;
  for (const file of filtered.slice(0, maxFiles)) {
    const fp = path.join(DAILY_DIR, file);
    const date = file.match(/(\d{4}-\d{2}-\d{2})/)?.[1]?.replace(/-/g, "") || "";
    try {
      const text = fs.readFileSync(fp, "utf-8");
      // CLAAS Jaguar
      for (const m of text.matchAll(claasRe)) {
        const model = m[1];
        const priceEur = parseInt(m[2].replace(/,/g, ""), 10);
        if (!priceEur) continue;
        out.push({
          source: "Agroline",
          brandNameZh: "克拉斯",
          modelName: model,
          year: null,
          domesticPriceWan: null,
          priceEur,
          priceUsd: null,
          exchangeRate: DEFAULT_EUR_CNY,
          sourceUrl: null,
          sourceTitle: null,
          sourceDate: date,
          country: "DE",
          opportunityLevel: "Agroline日报",
          grossMarginPct: null,
          note: `daily_md:${path.basename(file)}`,
        });
      }
    } catch (e) {
      console.warn(`[daily_md] ${file} 读取失败:`, e);
    }
  }
  return out;
}

// ==================== 4. 人工高置信度（硬编码兜底） ====================

const MANUAL_PRICES: Array<Omit<CollectedPrice, "exchangeRate" | "sourceDate" | "sourceUrl" | "sourceTitle"> & { rateHint?: number }> = [
  { source: "Agroline",   brandNameZh: "克拉斯",    modelName: "970",     year: 2017, priceEur: 320000, priceUsd: null, domesticPriceWan: 163.0, opportunityLevel: "★★★", grossMarginPct: 1.64, country: "DE", note: "2019款 ~253万RMB" },
  { source: "Agroline",   brandNameZh: "克拉斯",    modelName: "980",     year: 2016, priceEur: 461438, priceUsd: null, domesticPriceWan: 143.0, opportunityLevel: "★★★", grossMarginPct: 1.09, country: "DE", note: "2022款 T4/E5 ~365万RMB" },
  { source: "Agroline",   brandNameZh: "克拉斯",    modelName: "980",     year: 2015, priceEur: 220000, priceUsd: null, domesticPriceWan: null,  opportunityLevel: "★★",  grossMarginPct: null,  country: "DE", note: "2014旧款 ~174万RMB" },
  { source: "Agroline",   brandNameZh: "克拉斯",    modelName: "850",     year: 2020, priceEur: 250000, priceUsd: null, domesticPriceWan: null,  opportunityLevel: "★★",  grossMarginPct: null,  country: "DE", note: "准新机 ~197万RMB" },
  { source: "TractorHouse", brandNameZh: "纽荷兰", modelName: "FR450",   year: 2013, priceEur: null,  priceUsd: 30000,  domesticPriceWan: null,  opportunityLevel: "★",   grossMarginPct: null,  country: "US", note: "同类参考 $3-4万" },
  { source: "TractorHouse", brandNameZh: "纽荷兰", modelName: "FR500",   year: 2014, priceEur: null,  priceUsd: 45000,  domesticPriceWan: null,  opportunityLevel: "★",   grossMarginPct: null,  country: "US", note: "同类参考 $4-5万" },
  { source: "TractorHouse", brandNameZh: "纽荷兰", modelName: "9080",    year: null, priceEur: null,  priceUsd: 95000,  domesticPriceWan: null,  opportunityLevel: "★★",  grossMarginPct: null,  country: "US", note: "740马力卡特发动机" },
  { source: "TractorHouse", brandNameZh: "约翰迪尔", modelName: "8400",  year: 2016, priceEur: null,  priceUsd: 90000,  domesticPriceWan: null,  opportunityLevel: "★★",  grossMarginPct: null,  country: "US", note: "中东线主力" },
  { source: "e-farm",     brandNameZh: "克拉斯",    modelName: "5300RC",  year: 2022, priceEur: 75000,  priceUsd: null,  domesticPriceWan: 95.0,  opportunityLevel: "★★",  grossMarginPct: 0.83,  country: "DE", note: "全新大方捆 ~59万RMB" },
];

export function collectFromManual(): CollectedPrice[] {
  return MANUAL_PRICES.map(p => ({
    ...p,
    exchangeRate: p.priceEur ? DEFAULT_EUR_CNY : DEFAULT_USD_CNY,
    sourceDate: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
    sourceUrl: null,
    sourceTitle: null,
  }));
}

// ==================== 统一入口 ====================

export async function collectFromSource(
  source: PriceSource,
  maxFiles: number,
  targetDate?: string
): Promise<CollectedPrice[]> {
  switch (source) {
    case "snapshot": return collectFromSnapshot(maxFiles, targetDate);
    case "brief":    return collectFromBrief(maxFiles, targetDate);
    case "daily_md": return collectFromDailyMd(maxFiles, targetDate);
    case "manual":   return collectFromManual();
  }
}
