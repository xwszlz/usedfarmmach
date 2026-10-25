/**
 * POST /api/agents/seller-helper/sales-strategy/export/pdf
 * AI 销售策略 · 导出《作战手册》PDF（T2）
 *
 * 流程：登录校验 → 余额预检（名义）→ 渲染 PDF → 扣费（NOMINAL，决策 B 计费原语，不重跑 LLM）
 *       → 返回 application/pdf（Content-Disposition: attachment; filename="ai-sales-strategy-<id>.pdf"）。
 *
 * 计费顺序（关键）：先 build 成功再 deductAiUsage —— 若渲染失败（字体缺/异常）直接 500 且不扣费，
 *   避免「钱扣了却拿不到文件」。导出无 LLM 调用，仅按固定名义 token 计费（no real double-charge）。
 * 合规：PDF 仅渲染系统脱敏后的联系方式，绝不含明文 PII。
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { estimateAiCost, deductAiUsage, EXPORT_ESTIMATED_TOKENS } from "@/lib/credits/deduct";
import { buildPdf, type StrategyExportPayload } from "@/lib/sales-strategy/export";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getLocaleFromRequest(request: NextRequest): "zh" | "en" {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) return m[1] as "zh" | "en";
  return "zh";
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

    const body = (await request.json().catch(() => ({}))) as StrategyExportPayload & { partition?: string };

    // ── 余额预检（名义，避免白跑渲染）──
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

    // ── 先渲染 PDF（不重跑 LLM；strategy 由客户端透传）；渲染失败直接 500 不扣费 ──
    const payload: StrategyExportPayload = {
      strategy: body.strategy ?? {},
      product: body.product ?? null,
      channels: Array.isArray(body.channels) ? body.channels : [],
      locale,
    };
    const pdfBytes = await buildPdf(payload);

    // ── 渲染成功后再扣费（名义 token，不重复收取生成成本）──
    const deduction = await deductAiUsage({
      userId: user.id,
      action: "exportManual",
      estimatedTokens: EXPORT_ESTIMATED_TOKENS,
      reason: "导出AI销售策略PDF作战手册",
      breakdown: { locale, partition: body.partition },
    });
    if (!deduction.ok) {
      // 扣费失败：丢弃已生成产物，返回对应错误（不产生文件）
      return billingFailResponse(locale, deduction);
    }

    const fileId = Date.now().toString(36);
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ai-sales-strategy-${fileId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[ExportPDF] 未处理异常:", error?.message);
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
