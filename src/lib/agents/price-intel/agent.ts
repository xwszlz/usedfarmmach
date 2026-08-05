/**
 * 国际价格采集 Agent（#3）— 核心 Agent
 *
 * 职责：
 *   1. 接收 PriceIntelInput
 *   2. 调度 4 个数据源采集器
 *   3. 品牌+型号 → 站内 Product 匹配
 *   4. 比价/去重 → 写入 InternationalPrice
 *   5. 触发套利榜单缓存刷新
 *   6. 返回 PriceIntelResult（带日志）
 */
import { prisma } from "@/lib/db";
import {
  PRICE_SOURCES,
  type CollectedPrice,
  type MatchedPrice,
  type PriceIntelInput,
  type PriceSource,
  type PriceIntelResult,
  type PriceIntelStatus,
  type SourceRunResult,
} from "./types";
import { collectFromSource } from "./sources";

export const AGENT_NAME = "price-intel";
export const AGENT_VERSION = "0.1.0";

// ==================== 品牌映射（中文名 → brandId） ====================

const BRAND_MAP: Record<string, string> = {
  "克拉斯": "claas",
  "claas": "claas",
  "克罗尼": "krone",
  "krone": "krone",
  "纽荷兰": "new-holland",
  "new holland": "new-holland",
  "new-holland": "new-holland",
  "迪尔": "john-deere",
  "约翰迪尔": "john-deere",
  "john deere": "john-deere",
  "john-deere": "john-deere",
  "凯斯": "case-ih",
  "case ih": "case-ih",
  "case-ih": "case-ih",
  "库恩": "kuhn",
  "kuhn": "kuhn",
  "格兰": "grain",
  "奥库": "orke",
  "格立莫": "grimme",
  "grimme": "grimme",
  "康斯凯尔": "kongskilde",
  "kongskilde": "kongskilde",
  "都麦": "dormoy",
  "arcusin": "arcusin",
  "麦赛弗格森": "massey-ferguson",
  "爱科": "massey-ferguson",
  "massey ferguson": "massey-ferguson",
  "massey-ferguson": "massey-ferguson",
  "东洋": "toyo",
  "马赛": "massey",
};

// ==================== Agent 主体 ====================

export class PriceIntelAgent {
  private logs: string[] = [];

  private log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    this.logs.push(line);
    console.log(line);
  }

  /**
   * 品牌名 → brandId
   */
  private resolveBrandId(nameZh: string): string | null {
    const key = nameZh?.trim();
    if (!key) return null;
    return BRAND_MAP[key] || BRAND_MAP[key.toLowerCase()] || null;
  }

  /**
   * 匹配站内 Product：brandId + (modelName, year) 三元组
   * 策略：精确 → 去 year → 模糊 contains
   */
  private async matchProduct(c: CollectedPrice): Promise<{ productId: string } | null> {
    const brandId = this.resolveBrandId(c.brandNameZh);
    if (!brandId) return null;
    const model = c.modelName?.trim();
    if (!model) return null;

    // 1) 精确：brand + model + year
    if (c.year) {
      const p = await prisma.product.findFirst({
        where: { brandId, modelName: model, year: c.year },
        select: { id: true },
      });
      if (p) return { productId: p.id };
    }
    // 2) 精确：brand + model（去 year）
    const p2 = await prisma.product.findFirst({
      where: { brandId, modelName: model },
      select: { id: true },
    });
    if (p2) return { productId: p2.id };
    // 3) 模糊：brand + model contains
    const p3 = await prisma.product.findFirst({
      where: { brandId, modelName: { contains: model } },
      select: { id: true },
    });
    if (p3) return { productId: p3.id };
    // 4) 反向：product contains brand model
    const p4 = await prisma.product.findFirst({
      where: { brandId, modelName: { contains: model.split(/\s+/)[0] } },
      select: { id: true },
    });
    return p4 ? { productId: p4.id } : null;
  }

  /**
   * 把单条 CollectedPrice 转成 MatchedPrice（含落库决策）
   */
  private async toMatched(c: CollectedPrice, force: boolean): Promise<MatchedPrice> {
    const currency: "EUR" | "USD" = c.priceEur ? "EUR" : c.priceUsd ? "USD" : "EUR";
    const priceRaw = c.priceEur ?? c.priceUsd ?? 0;
    const priceForeignCny = Math.round(priceRaw * c.exchangeRate);

    if (priceRaw <= 0) {
      return { ...c, productId: null, matchStatus: "skipped_no_price", priceForeignCny: 0, currency };
    }
    const match = await this.matchProduct(c);
    if (!match) {
      return { ...c, productId: null, matchStatus: "skipped_no_product", priceForeignCny, currency };
    }
    return { ...c, productId: match.productId, matchStatus: "matched", priceForeignCny, currency };
  }

  /**
   * 把单条 MatchedPrice 写入 InternationalPrice（带去重/更新）
   */
  private async upsertPrice(m: MatchedPrice, force: boolean): Promise<"imported" | "updated" | "skipped"> {
    if (!m.productId || m.matchStatus !== "matched") return "skipped";

    // 找现有同源记录
    const existing = await prisma.internationalPrice.findFirst({
      where: { productId: m.productId, source: m.source },
    });

    const data = {
      productId: m.productId,
      priceForeignCny: m.priceForeignCny,
      priceForeignRaw: m.priceEur ?? m.priceUsd ?? null,
      currency: m.currency,
      exchangeRate: m.exchangeRate,
      source: m.source,
      sourceUrl: m.sourceUrl,
      sourceDate: m.sourceDate,
      country: m.country,
      confidenceScore: 0.85,    // Agent 写入默认高置信
      isActive: true,
      lastVerified: new Date(),
      notes: [
        m.note,
        m.grossMarginPct != null ? `毛利率${(m.grossMarginPct * 100).toFixed(1)}%` : null,
        m.opportunityLevel ? `机会等级:${m.opportunityLevel}` : null,
      ].filter(Boolean).join(" | "),
    };

    if (!existing) {
      await prisma.internationalPrice.create({ data });
      return "imported";
    }
    if (!force && existing.sourceDate && existing.sourceDate >= m.sourceDate) {
      return "skipped";
    }
    await prisma.internationalPrice.update({ where: { id: existing.id }, data });
    return "updated";
  }

  /**
   * 跑单源
   */
  private async runSource(
    source: PriceSource,
    maxFiles: number,
    targetDate: string | undefined,
    force: boolean,
    dryRun: boolean
  ): Promise<SourceRunResult> {
    const start = Date.now();
    const result: SourceRunResult = {
      source,
      processed: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      durationMs: 0,
      errors: [],
      samples: [],
    };
    try {
      this.log(`▶ source=${source} maxFiles=${maxFiles} dryRun=${dryRun}`);
      const items = await collectFromSource(source, maxFiles, targetDate);
      result.processed = items.length;
      for (const c of items) {
        try {
          const m = await this.toMatched(c, force);
          if (dryRun || !m.productId) {
            // 仅记入样本，不写库
            if (result.samples.length < 3) result.samples.push(m);
            result.skipped++;
            continue;
          }
          const action = await this.upsertPrice(m, force);
          if (action === "imported") result.imported++;
          else if (action === "updated") result.updated++;
          else result.skipped++;
          if (result.samples.length < 3) result.samples.push(m);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          result.errors.push(msg);
          result.skipped++;
          if (result.errors.length <= 5) this.log(`  ✗ item error: ${msg}`);
        }
      }
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
    result.durationMs = Date.now() - start;
    this.log(`  ↳ processed=${result.processed} imported=${result.imported} updated=${result.updated} skipped=${result.skipped} ${result.durationMs}ms`);
    return result;
  }

  /**
   * Agent 主入口
   */
  async run(input: PriceIntelInput): Promise<PriceIntelResult> {
    const startedAt = new Date();
    this.logs = [];
    this.log(`🤖 ${AGENT_NAME}@${AGENT_VERSION} 启动`);
    const sources = input.sources && input.sources.length > 0
      ? input.sources
      : [...PRICE_SOURCES];
    const perSource: SourceRunResult[] = [];
    let totalImported = 0, totalUpdated = 0, totalSkipped = 0, totalCollected = 0;
    try {
      for (const s of sources) {
        const r = await this.runSource(s, input.maxFilesPerSource, input.targetDate, input.force, input.dryRun);
        perSource.push(r);
        totalImported += r.imported;
        totalUpdated += r.updated;
        totalSkipped += r.skipped;
        totalCollected += r.processed;
      }
      // 触发套利榜单缓存刷新（仅在有写入时；Neon 冷启动可能 P1001，重试一次）
      if (!input.dryRun && (totalImported + totalUpdated) > 0) {
        const tryRefresh = async (attempt: number): Promise<boolean> => {
          try {
            const { topArbitrageService } = await import("@/lib/services/top-arbitrage-service");
            await topArbitrageService.refreshCache();
            this.log(`🔄 套利榜单缓存已刷新 (attempt ${attempt})`);
            return true;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.log(`⚠️ 套利缓存刷新失败 (attempt ${attempt}): ${msg.slice(0, 200)}`);
            return false;
          }
        };
        if (!(await tryRefresh(1))) {
          await new Promise(r => setTimeout(r, 1500));
          await tryRefresh(2);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log(`❌ Agent 异常: ${msg}`);
      return {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        totalCollected, totalImported, totalUpdated, totalSkipped,
        perSource, log: this.logs, error: msg,
      };
    }
    const finishedAt = new Date();
    const result: PriceIntelResult = {
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      totalCollected, totalImported, totalUpdated, totalSkipped,
      perSource, log: this.logs,
    };
    this.log(`✅ 完成: collected=${totalCollected} imported=${totalImported} updated=${totalUpdated} skipped=${totalSkipped} ${result.durationMs}ms`);
    return result;
  }

  /**
   * 状态查询（不执行）
   */
  async getStatus(lastRun?: PriceIntelResult): Promise<PriceIntelStatus> {
    const rows = await prisma.internationalPrice.findMany({
      select: { source: true, sourceDate: true, productId: true },
    });
    const sourceMap = new Map<string, { count: number; latestDate: string | null }>();
    const productIds = new Set<string>();
    for (const r of rows) {
      const cur = sourceMap.get(r.source) || { count: 0, latestDate: null };
      cur.count++;
      if (r.sourceDate && (!cur.latestDate || r.sourceDate > cur.latestDate)) {
        cur.latestDate = r.sourceDate;
      }
      sourceMap.set(r.source, cur);
      productIds.add(r.productId);
    }
    return {
      ok: true,
      agentName: AGENT_NAME,
      version: AGENT_VERSION,
      lastRun: lastRun ? {
        startedAt: lastRun.startedAt,
        finishedAt: lastRun.finishedAt,
        totalImported: lastRun.totalImported,
        totalUpdated: lastRun.totalUpdated,
        durationMs: lastRun.durationMs,
      } : undefined,
      dbStats: {
        internationalPriceRows: rows.length,
        productsWithIntlPrice: productIds.size,
        sources: Array.from(sourceMap.entries()).map(([source, v]) => ({ source, ...v })),
      },
      sourcesSupported: PRICE_SOURCES,
    };
  }
}

// ==================== 单例 ====================

export const priceIntelAgent = new PriceIntelAgent();
