/**
 * 维保记录详情/更新 API
 * GET   /api/maintenance/[id]  — 获取详情
 * PATCH /api/maintenance/[id]  — 更新状态
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const record = await prisma.maintenanceRecord.findUnique({
      where: { id: params.id },
      include: {
        product: {
          select: { id: true, modelName: true, year: true, sellerId: true, brand: { select: { nameZh: true } } },
        },
        warranty: true,
        serviceCenter: true,
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // 权限验证
    if (record.product.sellerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Maintenance detail error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch record" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const record = await prisma.maintenanceRecord.findUnique({
      where: { id: params.id },
      include: { product: { select: { sellerId: true } } },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    if (record.product.sellerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = [
      "status",
      "cost",
      "technician",
      "partsReplaced",
      "photos",
      "notes",
      "completedDate",
      "rating",
      "ratingComment",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "cost") {
          updateData[field] = parseFloat(body[field]);
        } else if (field === "completedDate") {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else if (field === "rating") {
          updateData[field] = parseInt(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await prisma.maintenanceRecord.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Maintenance PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update record" },
      { status: 500 }
    );
  }
}
