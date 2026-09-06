import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  calculateValuationV4,
  type ValuationInput,
  type ValuationResult,
} from "@/lib/valuation/formulas";

export const dynamic = "force-dynamic";

// ============================================================
// P0 留资引擎：游客邮箱解锁精确估值
//
// POST /api/valuation/unlock
// Request:  { email, locale, valuationParams, estimate }
// Response: { ok: true, precise: <ValuationResult JSON>, cached?: true }
// 错误：400 INVALID_EMAIL / 400 MISSING_ESTIMATE / 500 UNLOCK_FAILED
//
// 行为：
//   1. 校验邮箱格式
//   2. 同邮箱 + 同参数哈希（ValuationLead 唯一约束）→ 直接返回缓存结果
//   3. 服务端用 valuationParams 重算精确估值（游客侧从未拿到精确值，防伪造）
//   4. 写入 ValuationLead 留资表
// ============================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 稳定序列化（key 排序），保证同一参数对象哈希一致 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

function getClientIpHash(headers: Headers): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown";
  return createHash("sha256").update(`valuation-gate:${ip}`).digest("hex");
}

/** 用估值参数在服务端重算精确估值（跳过图片/视频分析，避免游客侧等待） */
async function recomputePrecise(valuationParams: Record<string, unknown>): Promise<ValuationResult | null> {
  const p = valuationParams;
  if (!p.brand || !p.category || !p.year) return null;
  const input: ValuationInput = {
    brand: String(p.brand),
    modelName: p.modelName ? String(p.modelName) : "",
    category: String(p.category),
    year: Number(p.year) || 2020,
    workingHours: p.workingHours != null ? Number(p.workingHours) : undefined,
    condition: p.condition ? String(p.condition) : "good",
    priceCny: p.priceCny != null ? Number(p.priceCny) : undefined,
    enginePower: p.enginePower != null ? Number(p.enginePower) : undefined,
    imageUrls: [],
    videoUrls: [],
  };
  return await calculateValuationV4(input, undefined);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const locale = typeof body.locale === "string" ? body.locale.slice(0, 8) : "zh";
    const valuationParams: Record<string, unknown> =
      body.valuationParams && typeof body.valuationParams === "object" ? body.valuationParams : {};
    const estimate = body.estimate ?? null;

    // 1. 邮箱格式校验
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
    }

    // 2. 同邮箱 + 同参数去重：直接返回缓存结果（不重复落库）
    const paramsHash = createHash("sha256")
      .update(stableStringify(valuationParams))
      .digest("hex");
    const existing = await prisma.valuationLead.findUnique({
      where: { email_paramsHash: { email, paramsHash } },
    });
    if (existing) {
      return NextResponse.json({ ok: true, precise: existing.estimate, cached: true });
    }

    // 3. 服务端重算精确估值（失败则回退到请求携带的 estimate）
    let precise: unknown = null;
    try {
      precise = await recomputePrecise(valuationParams);
    } catch (e) {
      console.warn("[ValuationUnlock] 服务端重算失败，回退 estimate:", e);
    }
    if (!precise) precise = estimate;
    if (!precise) {
      return NextResponse.json({ ok: false, error: "MISSING_ESTIMATE" }, { status: 400 });
    }

    // 4. 写入留资表（并发重复时 P2002 → 视为缓存命中）
    try {
      await prisma.valuationLead.create({
        data: {
          email,
          locale,
          valuationParams: valuationParams as Prisma.InputJsonValue,
          estimate: precise as Prisma.InputJsonValue,
          paramsHash,
          ipHash: getClientIpHash(request.headers),
          source: "valuation",
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        const dup = await prisma.valuationLead.findUnique({
          where: { email_paramsHash: { email, paramsHash } },
        });
        return NextResponse.json({ ok: true, precise: dup?.estimate ?? precise, cached: true });
      }
      throw e;
    }

    return NextResponse.json({ ok: true, precise });
  } catch (error) {
    console.error("[ValuationUnlock] error:", error);
    return NextResponse.json({ ok: false, error: "UNLOCK_FAILED" }, { status: 500 });
  }
}
