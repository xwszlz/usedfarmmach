/**
 * 政府农机登记数据 API
 *
 * GET /api/gov-data/machinery?brand=xxx&category=xxx&registrationNo=xxx&page=1&pageSize=20
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const brandName = searchParams.get("brand") || undefined;
    const category = searchParams.get("category") || undefined;
    const registrationNo = searchParams.get("registrationNo") || undefined;

    const where: Record<string, unknown> = {};
    if (brandName) where.brandName = { contains: brandName };
    if (category) where.category = { contains: category };
    if (registrationNo) where.registrationNo = { contains: registrationNo };

    const [records, total] = await Promise.all([
      prisma.govMachineryData.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.govMachineryData.count({ where }),
    ]);

    return NextResponse.json({
      records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Gov machinery data GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
