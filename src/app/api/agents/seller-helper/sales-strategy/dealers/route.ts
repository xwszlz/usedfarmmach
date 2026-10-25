/**
 * POST /api/agents/seller-helper/sales-strategy/dealers
 * AI 销售策略 · 双站分区经销商列表（T4）
 *
 * 返回当前站点「境内 / 跨境候选」两分区经销商（联系方式默认脱敏）。
 *
 * Body: { partition?: "all" | "cn" | "intl", locale?: "zh" | "en" }
 *
 * 合规红线（#1 数据不出境）：
 *   - 本路由只调用 retrieveDealers()，其底层仅读取「当前站点 prisma 实例」，
 *     不 import / 不请求 ark-client、不连接 .com / ARK_PROXY_URL；
 *   - .cn 站读自己库（含 intl 快照）即可同时返回两分区，全程零出境请求；
 *   - .com 站 domestic 恒为 []（库不持境内 PII）。
 *
 * 说明：经销商池为公开渠道参考信息且已脱敏，故本接口不强制登录即可访问
 *       （与「登录即可用」哲学一致，且不暴露任何明文 PII）。
 */
import { NextRequest, NextResponse } from "next/server";
import { retrieveDealers } from "@/lib/sales-strategy/dealers";
import type { DealerPartitionQuery } from "@/lib/sales-strategy/types";

export const dynamic = "force-dynamic";

const PARTITIONS = new Set<DealerPartitionQuery>(["all", "cn", "intl"]);

function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) return m[1];
  return "zh";
}

export async function POST(request: NextRequest) {
  const locale = getLocaleFromRequest(request);
  try {
    const body = (await request.json().catch(() => ({}))) as {
      partition?: string;
      locale?: string;
    };

    const partition: DealerPartitionQuery =
      typeof body.partition === "string" && PARTITIONS.has(body.partition as DealerPartitionQuery)
        ? (body.partition as DealerPartitionQuery)
        : "all";

    const data = await retrieveDealers(partition);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("[Dealers] 分区列表加载失败:", (error as Error)?.message);
    return NextResponse.json(
      {
        success: false,
        error:
          locale === "zh"
            ? "经销商分区列表加载失败，请稍后重试"
            : "Failed to load dealer partitions.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
