/**
 * 海外仓信息 API
 *
 * GET /api/warehouses?country=xxx&type=xxx&page=1&pageSize=20
 * GET /api/warehouses/:id — 获取仓库详情
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const country = searchParams.get("country") || undefined;
    const warehouseType = searchParams.get("type") || undefined;
    const status = searchParams.get("status") || "active";

    const where: Record<string, unknown> = { status };
    if (country) where.country = { contains: country };
    if (warehouseType) where.warehouseType = warehouseType;

    const [warehouses, total] = await Promise.all([
      prisma.overseasWarehouse.findMany({
        where,
        orderBy: { country: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.overseasWarehouse.count({ where }),
    ]);

    return NextResponse.json({
      warehouses,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Warehouses GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
