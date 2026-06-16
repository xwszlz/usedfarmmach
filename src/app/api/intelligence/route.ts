/**
 * 市场情报速递 API
 * GET /api/intelligence?date=2026-06-01&locale=zh
 * 返回指定日期的情报数据，默认返回最近一日
 * locale参数控制返回哪个语言的内容 (zh/en/ru)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const dateStr = request.nextUrl.searchParams.get("date");
    const locale = request.nextUrl.searchParams.get("locale") || "zh";

    let dateFilter: Date;
    if (dateStr) {
      dateFilter = new Date(dateStr);
    } else {
      // 默认取最近一天
      const latest = await prisma.marketIntel.findFirst({
        where: { isActive: true },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      if (!latest) {
        return NextResponse.json({ success: true, data: [] });
      }
      dateFilter = latest.date;
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

    // 解析 JSON 字段
    const parsed = items.map((item) => ({
      id: item.id,
      icon: item.icon,
      region: getField(item, "region", item.regionEn, item.regionRu),
      tags: JSON.parse(getField(item, "tags", item.tagsEn, item.tagsRu) || "[]"),
      text: getField(item, "text", item.textEn, item.textRu),
      url: item.url,
      detailedContent: getField(item, "detailedContent", item.detailedContentEn, item.detailedContentRu),
      dataSummary: item.dataSummary ? JSON.parse(item.dataSummary) : undefined,
      actionTips: item.actionTips ? JSON.parse(item.actionTips) : undefined,
      sortOrder: item.sortOrder,
    }));

    return NextResponse.json({
      success: true,
      data: parsed,
      date: dateFilter.toISOString().split("T")[0],
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("获取市场情报失败:", error);
    return NextResponse.json(
      { success: false, error: "获取市场情报失败" },
      { status: 500 }
    );
  }
}
