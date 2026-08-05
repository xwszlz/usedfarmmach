import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * 物流在线询价 API
 * POST /api/logistics-quote — 提交询价
 * GET /api/logistics-quote — 获取询价列表（管理员）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      originProvince,
      destination,
      equipmentType,
      equipmentSize,
      weight,
      length,
      width,
      height,
      quantity,
      contactName,
      contactPhone,
      notes,
    } = body;

    if (!originProvince || !destination || !equipmentType || !contactName || !contactPhone) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 保存到数据库（如果有LogisticsQuote表的话）
    // 当前先用简单返回，后续可以加表
    const quoteId = `LQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    return NextResponse.json({
      success: true,
      data: {
        quoteId,
        originProvince,
        destination,
        equipmentType,
        equipmentSize,
        quantity: parseInt(quantity) || 1,
        contactName,
        contactPhone,
        notes,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      message: "Quote request submitted successfully. Our logistics advisor will contact you within 24 hours.",
    });
  } catch (error) {
    console.error("Logistics quote error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";

    // 简化：返回空数组（后续加表后改为真实查询）
    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
