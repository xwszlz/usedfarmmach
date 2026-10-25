/**
 * AI 销售策略 — 检索层（内部实时 + 外部快照）
 * ─────────────────────────────────────────────────────────
 * 决策 A/B 落地：为「AI 销售策略」第四个 AI 能力模块提供检索上下文。
 *
 * 内部实时（直连 DB）：
 *   - 本品 Product（品牌/型号/年份/品类/售价/地区/成色/工时/是否国产）
 *   - 同品类在售 Product（行情参考）
 *   - 全球基准价 BrandBenchmark
 *   - 市场情报 MarketIntel
 *   - Lead / Dealer 线索池候选（按品牌/型号/地区匹配，仅返回公开属性，不含明文 PII）
 *
 * 外部快照（文件 / 轻量）：
 *   - 神雕日报 getDailyReportData(brand, model)（国际报价 / 趋势 / 即时事件）
 *   - matchPortByLocation(location)（建议出口港口）
 *
 * 合规红线：
 *   - .cn 数据不出境：本层不向任何境外服务发送数据；仅读取境内 DB 与本地日报快照。
 *   - Lead / Dealer 为新增表，可能尚未 db push；用 $queryRawUnsafe 并 try/catch 兜底，
 *     表不存在时返回空候选，绝不阻断主链路。
 */
import { prisma } from "@/lib/db";
import { getDailyReportData, type DailyReportData } from "@/lib/daily-report-parser";
import { matchPortByLocation } from "@/lib/port-matcher";

export interface StrategyRetrievalInput {
  productId?: string;
  brandName?: string;
  modelName?: string;
  categoryName?: string;
  year?: number;
  location?: string;
  isChineseBrand?: boolean;
}

/** 线索/经销商候选（脱敏：仅公开属性，不含 phone/wechat/email 明文） */
export interface LeadCandidate {
  id: string; // 形如 "lead_<cuid>" / "dealer_<cuid>"，便于解锁路由解析
  type: "lead" | "dealer";
  name: string;
  brand: string | null;
  model: string | null;
  region: string | null;
  source: string;
}

export interface StrategyProductInfo {
  productId: string | null;
  brandName: string;
  modelName: string;
  year: number | null;
  categoryName: string;
  priceCny: number | null;
  location: string | null;
  condition: string | null;
  workingHours: number | null;
  isChineseBrand: boolean;
}

export interface StrategyContext {
  product: StrategyProductInfo | null;
  candidates: LeadCandidate[];
  similarProducts: Array<{
    brandName: string;
    modelName: string;
    year: number | null;
    priceCny: number | null;
    location: string | null;
  }>;
  benchmarks: Array<{
    brand: string;
    model: string;
    priceCny: number | null;
    region: string | null;
    sourceSite: string | null;
  }>;
  dailyReport: DailyReportData | null;
  portSuggestion: string;
  marketIntel: Array<{ title: string; content: string; region: string; priority: string }>;
  /** 外部快照是否真实命中（日报存在即为 true） */
  realtimeExternal: boolean;
}

/** 从 Lead / Dealer 表检索与本品匹配的候选（不含明文 PII） */
async function retrieveCandidates(input: StrategyRetrievalInput): Promise<LeadCandidate[]> {
  const brand = (input.brandName || "").trim();
  const model = (input.modelName || "").trim();
  const region = (input.location || "").trim();
  if (!brand && !model && !region) return [];

  const toCandidate = (row: any, type: "lead" | "dealer"): LeadCandidate => {
    if (type === "dealer") {
      const brands = Array.isArray(row.brands) ? (row.brands as string[]) : [];
      const regions = Array.isArray(row.regions) ? (row.regions as string[]) : [];
      return {
        id: `dealer_${row.id}`,
        type: "dealer",
        name: row.name || "渠道经销商",
        // Dealer.brands / Dealer.regions 为数组列，取首个代表；Dealer 无 model 列
        brand: brands[0] ?? null,
        model: "",
        region: regions[0] ?? null,
        source: row.source || "dealer_pool",
      };
    }
    return {
      id: `lead_${row.id}`,
      type: "lead",
      name: row.name || "潜在买家",
      brand: row.brand ?? null,
      model: row.model ?? null,
      region: row.region ?? null,
      source: row.source || "lead_pool",
    };
  };

  try {
    const leads = await prisma
      .$queryRawUnsafe<
        Array<{ id: string; name: string; brand: string | null; model: string | null; region: string | null; source: string | null }>
      >(
        `SELECT id, name, brand, model, region, source
         FROM "Lead"
         WHERE ($1 = '' OR brand ILIKE '%' || $1 || '%'
                OR model ILIKE '%' || $1 || '%'
                OR region ILIKE '%' || $1 || '%')
         ORDER BY "createdAt" DESC
         LIMIT 10`,
        brand
      )
      .catch(() => [] as Array<any>);

    const dealers = await prisma
      .$queryRawUnsafe<
        Array<{ id: string; name: string; brands: string[] | null; regions: string[] | null; source: string | null }>
      >(
        `SELECT id, name, source, brands, regions
         FROM "Dealer"
         WHERE ($1 = '' OR regions::text ILIKE '%' || $1 || '%')
           AND ($2 = '' OR brands::text ILIKE '%' || $2 || '%')
         ORDER BY "createdAt" DESC
         LIMIT 10`,
        region,
        brand
      )
      .catch(() => [] as Array<any>);

    return [
      ...(leads || []).map((r) => toCandidate(r, "lead")),
      ...(dealers || []).map((r) => toCandidate(r, "dealer")),
    ].slice(0, 12);
  } catch {
    return [];
  }
}

/** 加载本品结构化信息（复用产品页同一份字段） */
async function loadProductInfo(productId: string): Promise<StrategyProductInfo | null> {
  try {
    const p = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        modelName: true,
        year: true,
        priceCny: true,
        location: true,
        condition: true,
        workingHours: true,
        brand: { select: { nameZh: true, nameEn: true, isChineseBrand: true } },
        category: { select: { nameZh: true, nameEn: true } },
      },
    });
    if (!p) return null;
    const brandName = p.brand?.nameZh || p.brand?.nameEn || "";
    const categoryName = p.category?.nameZh || p.category?.nameEn || "";
    return {
      productId: p.id,
      brandName,
      modelName: p.modelName,
      year: p.year,
      categoryName,
      priceCny: p.priceCny,
      location: p.location,
      condition: p.condition,
      workingHours: p.workingHours,
      isChineseBrand: !!p.brand?.isChineseBrand,
    };
  } catch {
    return null;
  }
}

/** 同品类在售（行情参考） */
async function retrieveSimilarProducts(
  brandName: string,
  categoryName: string,
  excludeProductId?: string
): Promise<StrategyContext["similarProducts"]> {
  if (!brandName && !categoryName) return [];
  try {
    const rows = await prisma.product.findMany({
      where: {
        status: "active",
        ...(excludeProductId ? { NOT: { id: excludeProductId } } : {}),
        ...(brandName
          ? { OR: [{ brand: { nameZh: brandName } }, { brand: { nameEn: brandName } }] }
          : {}),
      },
      select: {
        modelName: true,
        year: true,
        priceCny: true,
        location: true,
        brand: { select: { nameZh: true, nameEn: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const out = rows
      .map((r) => ({
        brandName: r.brand?.nameZh || r.brand?.nameEn || "",
        modelName: r.modelName,
        year: r.year,
        priceCny: r.priceCny,
        location: r.location,
      }));
    // 品类过滤延后到 prompt 软匹配，此处不再做恒真 filter
    return out.slice(0, 12);
  } catch {
    return [];
  }
}

/** 全球基准价 BrandBenchmark */
async function retrieveBenchmarks(brandName: string, modelName: string): Promise<StrategyContext["benchmarks"]> {
  if (!brandName && !modelName) return [];
  try {
    const rows = await prisma.brandBenchmark.findMany({
      where: {
        isActive: true,
        ...(brandName
          ? { OR: [{ brand: brandName.toLowerCase() }, { brandNameZh: brandName }] }
          : {}),
      },
      select: { brand: true, model: true, priceCny: true, region: true, sourceSite: true },
      orderBy: { priceCny: "desc" },
      take: 12,
    });
    return rows.map((r) => ({
      brand: r.brand,
      model: r.model,
      priceCny: r.priceCny,
      region: r.region,
      sourceSite: r.sourceSite,
    }));
  } catch {
    return [];
  }
}

/** 市场情报（取最新活跃，调用方按品牌/品类/地区软过滤） */
async function retrieveMarketIntel(): Promise<StrategyContext["marketIntel"]> {
  try {
    const rows = await prisma.marketIntel.findMany({
      where: { isActive: true },
      // MarketIntel 模型没有 title 字段（只有 text/region/tags），标题由正文首行派生
      select: { text: true, region: true, tags: true },
      orderBy: { date: "desc" },
      take: 20,
    });
    return rows.map((r) => ({
      title: (r.text ?? "").split("\n")[0].slice(0, 40),
      content: r.text,
      region: r.region,
      priority: r.tags?.includes("高") ? "高" : r.tags?.includes("低") ? "低" : "中",
    }));
  } catch {
    return [];
  }
}

/**
 * 组装销售策略检索上下文。
 * 任何子查询失败都被 try/catch 兜成空，主链路永不中断。
 */
export async function retrieveStrategyContext(input: StrategyRetrievalInput): Promise<StrategyContext> {
  const product = input.productId ? await loadProductInfo(input.productId) : null;
  const brandName = product?.brandName || input.brandName || "";
  const modelName = product?.modelName || input.modelName || "";
  const categoryName = product?.categoryName || input.categoryName || "";
  const location = product?.location || input.location || "";

  const [candidates, similarProducts, benchmarks, marketIntel] = await Promise.all([
    retrieveCandidates({ ...input, brandName, modelName, location }),
    retrieveSimilarProducts(brandName, categoryName, input.productId),
    retrieveBenchmarks(brandName, modelName),
    retrieveMarketIntel(),
  ]);

  const dailyReport = getDailyReportData(brandName || undefined, modelName || undefined);
  const portSuggestion = matchPortByLocation(location);

  return {
    product,
    candidates,
    similarProducts,
    benchmarks,
    dailyReport,
    portSuggestion,
    marketIntel,
    realtimeExternal: !!dailyReport,
  };
}

/** 解锁用：按 candidateId（lead_/dealer_ 前缀）取明文联系方式（仅服务端使用，绝不进前端明文） */
export interface LeadDealerContact {
  candidateId: string;
  type: "lead" | "dealer";
  name: string;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  productId: string | null;
}

export async function fetchLeadDealerContact(candidateId: string): Promise<LeadDealerContact | null> {
  const m = /^(lead|dealer)_(.+)$/.exec(candidateId || "");
  if (!m) return null;
  const type = m[1] === "dealer" ? "dealer" : "lead";
  const rawId = m[2];
  const table = type === "dealer" ? "Dealer" : "Lead";
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; name: string; phone: string | null; wechat: string | null; email: string | null; productId: string | null }>
    >(
      `SELECT id, name, phone, wechat, email, "productId" FROM "${table}" WHERE id = $1 LIMIT 1`,
      rawId
    );
    const r = rows?.[0];
    if (!r) return null;
    return {
      candidateId,
      type,
      name: r.name || "",
      phone: r.phone ?? null,
      wechat: r.wechat ?? null,
      email: r.email ?? null,
      productId: r.productId ?? null,
    };
  } catch {
    return null;
  }
}
