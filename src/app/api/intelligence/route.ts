/**
 * 市场情报速递 API
 * GET /api/intelligence?date=2026-06-01&locale=zh
 * 返回指定日期的情报数据，默认返回最近一日
 * locale参数控制返回哪个语言的内容 (zh/en/ru)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

// 安全解析 JSON 字段：单条脏文本（非合法 JSON）不再抛异常，
// 失败时保留原始文本/返回兜底值，保证整页不 500。
function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== "string") return raw as T;
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return raw as unknown as T; // 解析失败：保留原始文本，不抛异常
  }
}

export async function GET(request: NextRequest) {
  try {
    const dateStr = request.nextUrl.searchParams.get("date");
    const locale = request.nextUrl.searchParams.get("locale") || "zh";

    let dateFilter: Date;
    if (dateStr) {
      dateFilter = new Date(dateStr);
    } else {
      // 默认取最近一天（用 aggregate 取 MAX(date)，避免 findFirst+orderBy 在 Neon 上的异常）
      const agg = await prisma.marketIntel.aggregate({
        where: { isActive: true },
        _max: { date: true },
      });
      const latestDate = agg._max.date;
      if (!latestDate) {
        return NextResponse.json({ success: true, data: [] });
      }
      dateFilter = latestDate;
    }

    // 获取该日所有情报（按 sortOrder 排序）
    const dayStart = new Date(dateFilter);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateFilter);
    dayEnd.setHours(23, 59, 59, 999);

    const items = await prisma.marketIntel.findMany({
      where: {
        isActive: true,
        date: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { sortOrder: "asc" },
    });

    // 根据locale选择对应语言字段
    const getField = (item: any, fieldZh: string, fieldEn: string | null, fieldRu: string | null) => {
      if (locale === "en" && fieldEn) return fieldEn;
      if (locale === "ru" && fieldRu) return fieldRu;
      return item[fieldZh];
    };

    // 解析 JSON 字段（单条脏文本不再抛异常，兜底类型与前端期望一致）
    const parsed = items.map((item) => {
      // tags：前端按 string[] 渲染（.map），失败兜底为 [原始文本] 数组
      const tagsField = getField(item, "tags", item.tagsEn, item.tagsRu);
      const parsedTags = safeJsonParse<unknown>(tagsField, []);
      const tags = Array.isArray(parsedTags)
        ? parsedTags.map((t) => String(t))
        : [String(tagsField ?? "")];

      // dataSummary：前端未渲染，失败保留原始文本字符串（不抛异常）
      const dsVal = safeJsonParse<unknown>(item.dataSummary, undefined);
      const dataSummary = typeof dsVal === "string" ? item.dataSummary ?? undefined : dsVal;

      // actionTips：前端按 string[] 渲染（.map），失败兜底为 [原始文本] 数组
      const atVal = safeJsonParse<unknown>(item.actionTips, undefined);
      const actionTips = atVal == null
        ? undefined
        : Array.isArray(atVal)
          ? atVal.map((t) => String(t))
          : [String(atVal)];

      return {
        id: item.id,
        icon: item.icon,
        region: getField(item, "region", item.regionEn, item.regionRu),
        tags,
        text: getField(item, "text", item.textEn, item.textRu),
        url: item.url,
        detailedContent: getField(item, "detailedContent", item.detailedContentEn, item.detailedContentRu),
        dataSummary,
        actionTips,
        sortOrder: item.sortOrder,
      };
    });

    return NextResponse.json({
      success: true,
      data: parsed,
      date: dateFilter.toISOString().split("T")[0],
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("获取市场情报失败:", error);
    return NextResponse.json(
      { success: false, error: "获取市场情报失败", detail: message },
      { status: 500 }
    );
  }
}
