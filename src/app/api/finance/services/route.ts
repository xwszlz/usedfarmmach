/**
 * 金融产品列表 API
 * GET /api/finance/services — 获取金融产品列表
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get("type") || undefined;

    const whereClause: Record<string, unknown> = { isActive: true };
    if (serviceType) {
      whereClause.serviceType = serviceType;
    }

    const services = await prisma.financialService.findMany({
      where: whereClause,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Finance services GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch financial services" },
      { status: 500 }
    );
  }
}
