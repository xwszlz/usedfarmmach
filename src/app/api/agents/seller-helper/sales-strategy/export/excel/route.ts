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
import { splitCountryCity } from "@/lib/sales-strategy/derive";
import type { StrategyLlmResult } from "@/lib/sales-strategy/prompt";
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

    const body = (await request.json().catch(() => ({}))) as {
      partition?: string;
      locale?: string;
      /**
       * 版式开关（T11）：`"v2"` / `2` / `"2"` ⇒ 三 Sheet（渠道联系总表 14 列 /
       * 机型价格速查 7 列 / 必办清单 5 列）；其余任何值（含缺省）⇒ legacy 11 列单 Sheet。
       *
       * 前端线上发的是**字符串** `"v2"`（`sales-strategy-export-buttons.tsx` 的
       * `EXCEL_LAYOUT_V2 = "v2"`），但手搓 body 的调用方可能传数字 ⇒ 三种写法一律容忍，
       * 避免「传数字就静默降级」这种最难排查的故障。
       */
      layout?: string | number;
      /** 策略对象（Sheet2/Sheet3 的唯一数据源）；缺省则两 Sheet 走降级文案 */
      strategy?: StrategyLlmResult | null;
      /** 外部检索状态；非 `ok` 时 Sheet2「备注」标注「外部检索未接入」 */
      webStatus?: string;
    };
    const partition: DealerPartitionQuery =
      typeof body.partition === "string" && PARTITIONS.has(body.partition as DealerPartitionQuery)
        ? (body.partition as DealerPartitionQuery)
        : "all";

    /** 版式归一：`"v2"` / `2` / `"2"` → `2`；其余（含缺省、`"1"`、垃圾值）→ `1` */
    const layoutOpt: 1 | 2 =
      body.layout === "v2" || body.layout === 2 || body.layout === "2" ? 2 : 1;
    const strategy =
      body.strategy && typeof body.strategy === "object" ? (body.strategy as StrategyLlmResult) : null;
    const webStatus = typeof body.webStatus === "string" ? body.webStatus : undefined;

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
            select: {
              id: true,
              phone: true,
              wechat: true,
              email: true,
              // ── T11：14 列版式所需的 additive 列（T06 已建列；老库 null ⇒ 渲染层统一 —）──
              location: true,
              country: true,
              city: true,
              contactPerson: true,
              role: true,
              priority: true,
              suggestedPrice: true,
              followStatus: true,
              sourcePage: true,
            },
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
      const part = d.partition === "cn" ? "cn" : "intl";
      // 国家/城市：`Dealer.country/city` → 回落 `location` 解析 → 渲染层统一 `—`（PRD §4.1 第 4/5 列）
      const fromLocation = splitCountryCity(plain?.location ?? null, part);
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
        // ── 14 列版式新增字段（additive；缺失一律 null，渲染层统一 —）──
        country: plain?.country ?? fromLocation.country,
        city: plain?.city ?? fromLocation.city,
        contactPerson: plain?.contactPerson ?? null,
        role: plain?.role ?? null,
        priority: plain?.priority ?? null,
        suggestedPrice: plain?.suggestedPrice ?? null,
        followStatus: plain?.followStatus ?? null,
        sourcePage: plain?.sourcePage ?? null,
      };
    });

    // ── 先 build 成功再扣费（build 失败 → 500 且不扣费）──
    // layout 1 时传 `undefined`（而非 `{ layout: 1 }`）：与改造前的三参调用逐字等价，
    // 保证 legacy 路径连「多传一个参数」这种差异都不引入。
    const buf = await buildExcel(
      inputs,
      unlockedSet,
      locale,
      layoutOpt === 2 ? { layout: 2, strategy, webStatus } : undefined
    );

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
