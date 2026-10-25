/**
 * POST /api/agents/seller-helper/sales-strategy/export/excel
 * AI 销售策略 · 导出经销商联系表（T3，含 PII 门禁）
 *
 * 流程：登录校验 → 余额预检（名义）→ retrieveDealers(partition) 取脱敏经销商 →
 *       按当前用户 PiiAuditLog(unlock:dealer_*) 构建 unlockedSet →
 *       buildExcel（unlockedSet 内写明文，否则 maskPhone/maskEmail）→ 扣费（NOMINAL）→ 返回 xlsx。
 *
 * 计费顺序（关键）：先 build 成功再 deductAiUsage —— 渲染失败直接 500 且不扣费。
 * 合规（#1 数据不出境 / PII 最小化）：
 *   - 明文联系方式仅在「用户曾付费解锁该经销商」时写出；
 *   - 未解锁行一律脱敏（微信无公网标准 → 统一占位）；
 *   - 本路由只读「当前站点 prisma」，不触达 .com / ARK。
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { estimateAiCost, deductAiUsage, EXPORT_ESTIMATED_TOKENS } from "@/lib/credits/deduct";
import { retrieveDealers } from "@/lib/sales-strategy/dealers";
import { buildExcel, type ExcelDealerInput } from "@/lib/sales-strategy/export";
import type { DealerPartitionQuery } from "@/lib/sales-strategy/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getLocaleFromRequest(request: NextRequest): "zh" | "en" {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) return m[1] as "zh" | "en";
  return "zh";
}

const PARTITIONS = new Set<DealerPartitionQuery>(["all", "cn", "intl"]);

/** 由 PiiAuditLog 的 field(unlock:dealer_<id>) 提取已解锁经销商 id 集合 */
function buildUnlockedSet(fields: Array<{ field: string }>): Set<string> {
  const set = new Set<string>();
  for (const f of fields) {
    if (f.field.startsWith("unlock:dealer_")) {
      set.add(f.field.slice("unlock:dealer_".length));
    }
  }
  return set;
}

/** 扣费失败统一响应（402 余额不足 / 429 护栏熔断） */
function billingFailResponse(
  locale: "zh" | "en",
  deduction: { code?: string; cost: number; balance: number }
) {
  const zh = locale === "zh";
  if (deduction.code === "GUARDRAIL") {
    return NextResponse.json(
      {
        success: false,
        error: zh ? "本次导出成本超出单次上限，已熔断（未扣费）" : "Export cost exceeded cap; circuit-broken (no charge).",
        code: "GUARDRAIL",
        balance: deduction.balance,
      },
      { status: 429 }
    );
  }
  return NextResponse.json(
    {
      success: false,
      error: zh ? "积分不足，请先充值后再导出" : "Insufficient credits.",
      code: "INSUFFICIENT_CREDITS",
      rechargeUrl: `/${locale}/credits`,
      required: deduction.cost,
      balance: deduction.balance,
    },
    { status: 402 }
  );
}

export async function POST(request: NextRequest) {
  const locale = getLocaleFromRequest(request);
  const zh = locale === "zh";
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: zh ? "请先登录后再导出" : "Please sign in to export.",
          code: "LOGIN_REQUIRED",
          loginUrl: `/${locale}/auth/login`,
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { partition?: string; locale?: string };
    const partition: DealerPartitionQuery =
      typeof body.partition === "string" && PARTITIONS.has(body.partition as DealerPartitionQuery)
        ? (body.partition as DealerPartitionQuery)
        : "all";

    // ── 余额预检（名义）──
    const est = await estimateAiCost(EXPORT_ESTIMATED_TOKENS);
    if (user.credits < est) {
      return NextResponse.json(
        {
          success: false,
          error: zh ? "积分不足，请先充值后再导出" : "Insufficient credits. Please recharge first.",
          code: "INSUFFICIENT_CREDITS",
          rechargeUrl: `/${locale}/credits`,
          required: est,
          balance: user.credits,
        },
        { status: 402 }
      );
    }

    // ── 取脱敏经销商（遵循 T4 分区契约，只读当前站点 prisma）──
    const { domestic, international } = await retrieveDealers(partition);
    const allDealers = [...domestic, ...international];

    // ── 安全读取明文联系方式（仅用于「已解锁」门禁判定后的按需展示）──
    const ids = allDealers.map((d) => d.id);
    const plainRows =
      ids.length > 0
        ? await prisma.dealer.findMany({
            where: { id: { in: ids } },
            select: { id: true, phone: true, wechat: true, email: true },
          })
        : [];
    const plainMap = new Map(plainRows.map((r) => [r.id, r]));

    // ── PII 审计：本用户已解锁的经销商集合 ──
    const auditLogs = await prisma.piiAuditLog.findMany({
      where: { actorId: user.id, field: { startsWith: "unlock:dealer_" } },
      select: { field: true },
    });
    const unlockedSet = buildUnlockedSet(auditLogs);

    // ── 组装 Excel 输入（带明文，由 buildExcel 按门禁脱敏）──
    const inputs: ExcelDealerInput[] = allDealers.map((d) => {
      const plain = plainMap.get(d.id);
      return {
        id: d.id,
        partition: d.partition,
        grade: d.grade,
        brands: d.brands,
        models: d.models,
        regions: d.regions,
        nature: d.nature,
        name: d.name,
        phone: plain?.phone ?? null,
        wechat: plain?.wechat ?? null,
        email: plain?.email ?? null,
        sourceUrl: d.sourceUrl,
      };
    });

    // ── 先 build 成功再扣费（build 失败 → 500 且不扣费）──
    const buf = await buildExcel(inputs, unlockedSet, locale);

    const deduction = await deductAiUsage({
      userId: user.id,
      action: "exportManual",
      estimatedTokens: EXPORT_ESTIMATED_TOKENS,
      reason: "导出经销商联系表",
      breakdown: { locale, partition },
    });
    if (!deduction.ok) {
      // 扣费失败：丢弃产物，返回对应错误
      return billingFailResponse(locale, deduction);
    }

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dealers-${partition}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[ExportExcel] 未处理异常:", error?.message);
    return NextResponse.json(
      {
        success: false,
        error: zh ? "导出失败，请稍后重试" : "Export failed, please retry.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
