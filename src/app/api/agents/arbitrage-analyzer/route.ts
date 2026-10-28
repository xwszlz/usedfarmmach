import { NextRequest, NextResponse } from "next/server";
import { ArbitrageInputSchema } from "@/lib/agents/arbitrage-analyzer/types";
import { arbitrageAnalyzerAgent } from "@/lib/agents/arbitrage-analyzer/agent";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { computeAiCost, deductCredits } from "@/lib/credits/spend";
import { getBillingCountry } from "@/lib/credits/fx";

export const dynamic = "force-dynamic";

/** 套利分析固定名义输入 token 数（无 LLM，纯数据库计算），按模型成本乘以运营定价倍率反算积分 */
const ARBITRAGE_NOMINAL_INPUT_TOKENS = 1000;

/** 从 referer / 路径推断 locale（与 quota guard / 各 AI 路由保持一致） */
function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) {
    return m[1];
  }
  return "zh";
}
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let body: unknown = {};
  try { const text = await request.text(); body = text ? JSON.parse(text) : {}; }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = ArbitrageInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  // ── 积分计费开关：仅带 bill:true 的真人请求才扣积分；系统 cron / 编排器自动化不扣 ──
  if (parsed.data.bill) {
    const locale = getLocaleFromRequest(request);
    const token = getTokenFromHeaders(request.headers);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "请登录后使用", code: "AUTH_REQUIRED", rechargeUrl: `/${locale}/credits` },
        { status: 401 }
      );
    }
    // ⚠️ 无 LLM 调用：本路由是纯数据库/规则计算（跨境价差对比），没有任何 provider usage 可计量。
    //    因此这里走【名义 token 计费】——用固定名义 token 数反算积分，仅供计费链路占位。
    //    真实定价待老板拍板；一旦认定应免费，直接把下面的 bill 分支删掉即可，不影响其它链路。
    const cost = computeAiCost({
      model: "doubao-seed-2-1-pro-260915",
      inputTokens: ARBITRAGE_NOMINAL_INPUT_TOKENS,
      outputTokens: 0,
      billingCountry: await getBillingCountry(payload.userId),
    });
    const deduction = await deductCredits(
      payload.userId,
      cost.points,
      "跨境套利分析",
      // nominal=true 便于事后从 breakdown 里筛出"没有真实 LLM 用量、按名义计费"的流水
      {
        ...(cost as unknown as Record<string, unknown>),
        nominal: true,
        note: "no LLM call, nominal token billing",
      }
    );
    if (!deduction.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "积分不足，请先充值",
          code: "INSUFFICIENT_CREDITS",
          rechargeUrl: `/${locale}/credits`,
          required: deduction.required,
          balance: deduction.credits,
        },
        { status: 402 }
      );
    }
  }

  const result = await arbitrageAnalyzerAgent.run(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET() {
  const status = await arbitrageAnalyzerAgent.getStatus();
  return NextResponse.json(status);
}
