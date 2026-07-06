/**
 * 零配件列表 API
 *
 * GET /api/parts?category=xxx&keyword=xxx&page=1&pageSize=50
 * 支持 category 筛选和 keyword 搜索
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));
    const category = searchParams.get("category") || undefined;
    const keyword = searchParams.get("keyword") || undefined;

    const where: Record<string, unknown> = { isActive: true };
    if (category && category !== "all") {
      where.category = category;
    }
    if (keyword && keyword.trim()) {
      where.OR = [
        { nameZh: { contains: keyword, mode: "insensitive" } },
        { nameEn: { contains: keyword, mode: "insensitive" } },
        { nameRu: { contains: keyword, mode: "insensitive" } },
        { brand: { contains: keyword, mode: "insensitive" } },
      ];
    }

    const [parts, total] = await Promise.all([
      prisma.part.findMany({
        where,
        orderBy: [{ stockStatus: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.part.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: parts,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Parts GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch parts" },
      { status: 500 }
    );
  }
}
