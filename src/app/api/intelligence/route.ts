/**
 * 市场情报速递 API
 * GET /api/intelligence?date=2026-06-01
 * 返回指定日期的情报数据，默认返回最近一日
 */
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const dateStr = request.nextUrl.searchParams.get("date");

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

    // 解析 JSON 字段
    const parsed = items.map((item) => ({
      id: item.id,
      icon: item.icon,
      region: item.region,
      tags: JSON.parse(item.tags || "[]"),
      text: item.text,
      url: item.url,
      detailedContent: item.detailedContent,
      dataSummary: item.dataSummary ? JSON.parse(item.dataSummary) : undefined,
      actionTips: item.actionTips ? JSON.parse(item.actionTips) : undefined,
      sortOrder: item.sortOrder,
    }));

    return NextResponse.json({
      success: true,
      data: parsed,
      date: dateFilter.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("获取市场情报失败:", error);
    return NextResponse.json(
      { success: false, error: "获取市场情报失败" },
      { status: 500 }
    );
  }
}
