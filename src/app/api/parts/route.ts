/**
 * 零配件列表 API (V2)
 *
 * GET /api/parts?machineType=tractor&subSystem=hydraulic_system&componentGroup=hydraulic_pump&brand=Bosch&keyword=pump&stockStatus=in_stock&page=1&pageSize=12
 *
 * 从新Part模型查询，支持多级筛选、关键词搜索、分页
 * force-dynamic 确保库存状态实时性
 */

import { NextRequest, NextResponse } from "next/server";
import { getParts } from "@/lib/parts-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const machineType = searchParams.get("machineType") || undefined;
    const subSystem = searchParams.get("subSystem") || undefined;
    const componentGroup = searchParams.get("componentGroup") || undefined;
    const brand = searchParams.get("brand") || undefined;
    const keyword = searchParams.get("keyword") || undefined;
    const stockStatus = searchParams.get("stockStatus") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "12")));

    const result = await getParts({
      machineType,
      subSystem,
      componentGroup,
      brand,
      keyword,
      stockStatus,
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result.parts,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      filters: {
        brands: result.brands,
      },
    });
  } catch (error) {
    console.error("Parts list API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch parts" },
      { status: 500 }
    );
  }
}
