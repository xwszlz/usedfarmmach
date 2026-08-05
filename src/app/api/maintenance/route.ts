/**
 * 维保记录 API
 *
 * GET  /api/maintenance              — 获取维保记录列表
 * POST /api/maintenance              — 创建维保记录/预约维修
 * GET  /api/maintenance/[id]         — 获取维保详情
 * PATCH /api/maintenance/[id]        — 更新维保状态
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const status = searchParams.get("status");

    // 获取用户拥有的产品ID列表
    const userProducts = await prisma.product.findMany({
      where: { sellerId: user.id },
      select: { id: true },
    });
    const productIds = userProducts.map((p) => p.id);

    const whereClause: Record<string, unknown> = {
      productId: { in: productIds },
    };

    if (productId) {
      whereClause.productId = productId;
    }
    if (status) {
      whereClause.status = status;
    }

    const records = await prisma.maintenanceRecord.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
            brand: { select: { nameZh: true, nameEn: true } },
          },
        },
        warranty: { select: { id: true, warrantyType: true, endDate: true } },
        serviceCenter: { select: { id: true, name: true, province: true, city: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Maintenance GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch maintenance records" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const {
      productId,
      warrantyId,
      serviceCenterId,
      maintenanceType,
      title,
      description,
      scheduledDate,
    } = body;

    if (!productId || !maintenanceType || !title) {
      return NextResponse.json(
        { error: "Missing required fields: productId, maintenanceType, title" },
        { status: 400 }
      );
    }

    // 验证产品属于该用户
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { sellerId: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.sellerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const record = await prisma.maintenanceRecord.create({
      data: {
        productId,
        warrantyId: warrantyId || null,
        serviceCenterId: serviceCenterId || null,
        maintenanceType,
        title,
        description,
        status: "scheduled",
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: record,
      message: "Maintenance scheduled successfully",
    });
  } catch (error) {
    console.error("Maintenance POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create maintenance record" },
      { status: 500 }
    );
  }
}
