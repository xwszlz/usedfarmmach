/**
 * 配对链路「只读重放」helper（零写入、零副作用）
 *
 * 忠实复刻 agent.matchProduct 的 5 步 + P0-3 校验层，供：
 *   - scripts/dryrun-pairing-diff.ts （T9 前后 diff + 既有配对回归）
 *   - scripts/audit-one-to-many.ts   （AC-5 一对多审计）
 * 共用，避免两处实现漂移。
 *
 * 说明：内存重放 ≠ 100% 等价 Prisma findFirst 的 DB 行序；用于审计/预览足够，
 *       生产匹配仍以 agent.ts 为准。
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { resolveModelCandidates, normalizeModel } from "../../src/lib/model-alias";
import {
  validateMatch,
  type OneToManyState,
} from "../../src/lib/agents/price-intel/match-validation";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

interface Prod {
  id: string;
  modelName: string;
}

export interface ReplayRow {
  brandNameZh: string;
  rawModel: string;
  sourceSite: string;
  /** 旧口径品牌解析（BRAND_MAP） */
  beforeBrandId: string | null;
  /** 新口径品牌解析（DB 索引 → BRAND_MAP 兜底） */
  afterBrandId: string | null;
  /** afterBrandId 名下 active 产品数（用于区分 B 类"品牌有货但无该型号/无货"） */
  afterBrandProductCount: number;
  /** before：BRAND_MAP + 无校验 */
  beforeProductId: string | null;
  /** after 无校验：DB 品牌 + 5 步（复现"8 条"口径） */
  afterNoGateProductId: string | null;
  afterNoGateProductModel: string | null;
  /** after 有校验：DB 品牌 + 5 步 + P0-3 */
  afterProductId: string | null;
  afterProductModel: string | null;
  /** 新链路下被校验层拒绝的规则（去重） */
  afterRejectRules: string[];
}

export interface ReplayData {
  totalProducts: number;
  validBenchmarkCount: number;
  brandsWithProducts: number;
  rows: ReplayRow[];
  brandMapSize: number;
}

/** 从 agent.ts 源码抠出 BRAND_MAP，保证与生产一致 */
function parseBrandMap(): Record<string, string> {
  const src = fs.readFileSync(
    path.resolve(process.cwd(), "src/lib/agents/price-intel/agent.ts"),
    "utf8"
  );
  const m = src.match(/const BRAND_MAP:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\};/);
  const out: Record<string, string> = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const mm = line.match(/"([^"]+)"\s*:\s*"([^"]+)"/);
      if (mm) out[mm[1]] = mm[2];
    }
  }
  return out;
}

function normalizeBrandKey(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/** 内存版第 2..5 步（不含校验） */
function matchNoGate(brandId: string, rawModel: string, list: Prod[]): Prod | null {
  if (!rawModel) return null;
  let p = list.find((x) => x.modelName === rawModel);
  if (p) return p;
  p = list.find((x) => x.modelName.includes(rawModel));
  if (p) return p;
  const first = rawModel.split(/\s+/)[0];
  p = list.find((x) => x.modelName.includes(first));
  if (p) return p;
  const normRaw = normalizeModel(rawModel);
  for (const cand of resolveModelCandidates(brandId, rawModel)) {
    if (!cand || cand === normRaw) continue;
    p = list.find((x) => normalizeModel(x.modelName).startsWith(cand));
    if (p) return p;
  }
  return null;
}

/** 内存版第 2..5 步（含 P0-3 校验） */
function matchWithGate(
  brandId: string,
  rawModel: string,
  list: Prod[],
  vstate: OneToManyState
): { prod: Prod | null; rejectRules: string[] } {
  if (!rawModel) return { prod: null, rejectRules: [] };
  const rejectRules: string[] = [];
  const gate = (pm: Prod, step: 3 | 4 | 5): boolean => {
    const r = validateMatch(
      {
        brandSlug: brandId,
        rawListingModel: rawModel,
        productId: pm.id,
        productModelName: pm.modelName,
        viaStep: step,
      },
      vstate
    );
    if (!r.ok) {
      rejectRules.push(r.rejection!.rule);
      return false;
    }
    return true;
  };

  const p2 = list.find((x) => x.modelName === rawModel);
  if (p2) return { prod: p2, rejectRules }; // 精确步不过校验

  const p3 = list.find((x) => x.modelName.includes(rawModel));
  if (p3 && gate(p3, 3)) return { prod: p3, rejectRules };

  const first = rawModel.split(/\s+/)[0];
  const p4 = list.find((x) => x.modelName.includes(first));
  if (p4 && gate(p4, 4)) return { prod: p4, rejectRules };

  const normRaw = normalizeModel(rawModel);
  for (const cand of resolveModelCandidates(brandId, rawModel)) {
    if (!cand || cand === normRaw) continue;
    const p5 = list.find((x) => normalizeModel(x.modelName).startsWith(cand));
    if (p5 && gate(p5, 5)) return { prod: p5, rejectRules };
  }
  return { prod: null, rejectRules };
}

export async function runReplay(): Promise<ReplayData> {
  const { prisma } = await import("../../src/lib/db");
  const BRAND_MAP = parseBrandMap();

  const [brands, products, bench] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, nameZh: true, nameEn: true } }),
    prisma.product.findMany({
      where: { status: "active" },
      select: { id: true, brandId: true, modelName: true },
    }),
    prisma.brandBenchmark.findMany({
      where: { isActive: true, priceForeign: { gt: 0 } },
      select: { brand: true, brandNameZh: true, model: true, sourceSite: true },
    }),
  ]);

  const byNameZh = new Map<string, string>();
  const byNameEn = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const b of brands) {
    byId.set(b.id, b.id);
    const kz = normalizeBrandKey(b.nameZh);
    if (kz && !byNameZh.has(kz)) byNameZh.set(kz, b.id);
    const ke = normalizeBrandKey(b.nameEn);
    if (ke && !byNameEn.has(ke)) byNameEn.set(ke, b.id);
  }

  const productsByBrand = new Map<string, Prod[]>();
  for (const p of products) {
    if (!productsByBrand.has(p.brandId)) productsByBrand.set(p.brandId, []);
    productsByBrand.get(p.brandId)!.push({ id: p.id, modelName: p.modelName || "" });
  }

  const rows: ReplayRow[] = [];
  // 两个独立 state：无校验口径 / 有校验口径，避免相互污染
  const gateState: OneToManyState = { seenByProduct: new Map() };

  for (const r of bench) {
    const zh = (r.brandNameZh || "").trim() || (r.brand || "").trim();
    const rawModel = String(r.model || "").replace(/[（(].*?[)）]/g, "").trim();

    const beforeBrandId = BRAND_MAP[zh] || BRAND_MAP[zh.toLowerCase()] || null;
    const k = normalizeBrandKey(zh);
    const afterBrandId =
      byNameZh.get(k) ?? byNameEn.get(k) ?? byId.get(zh.trim()) ?? beforeBrandId;

    const beforeList = beforeBrandId ? productsByBrand.get(beforeBrandId) || [] : [];
    const afterList = afterBrandId ? productsByBrand.get(afterBrandId) || [] : [];

    const beforeProd = beforeBrandId ? matchNoGate(beforeBrandId, rawModel, beforeList) : null;
    const noGateProd = afterBrandId ? matchNoGate(afterBrandId, rawModel, afterList) : null;
    const gated = afterBrandId
      ? matchWithGate(afterBrandId, rawModel, afterList, gateState)
      : { prod: null as Prod | null, rejectRules: [] as string[] };

    rows.push({
      brandNameZh: zh,
      rawModel,
      sourceSite: r.sourceSite,
      beforeBrandId,
      afterBrandId,
      afterBrandProductCount: afterBrandId ? afterList.length : 0,
      beforeProductId: beforeProd ? beforeProd.id : null,
      afterNoGateProductId: noGateProd ? noGateProd.id : null,
      afterNoGateProductModel: noGateProd ? noGateProd.modelName : null,
      afterProductId: gated.prod ? gated.prod.id : null,
      afterProductModel: gated.prod ? gated.prod.modelName : null,
      afterRejectRules: Array.from(new Set(gated.rejectRules)),
    });
  }

  await prisma.$disconnect();

  return {
    totalProducts: products.length,
    validBenchmarkCount: bench.length,
    brandsWithProducts: productsByBrand.size,
    rows,
    brandMapSize: Object.keys(BRAND_MAP).length,
  };
}
