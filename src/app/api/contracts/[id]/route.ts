/**
 * 合同详情 API
 *
 * GET    /api/contracts/[id]  — 获取合同详情
 * PATCH  /api/contracts/[id]  — 更新合同（仅draft状态）
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

    const contract = await prisma.electronicContract.findUnique({
      where: { id: params.id },
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
            priceCny: true,
            condition: true,
            location: true,
            brand: { select: { nameZh: true, nameEn: true } },
            images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
          },
        },
        seller: {
          select: { id: true, companyName: true, username: true, phone: true, country: true },
        },
        buyer: {
          select: { id: true, companyName: true, username: true, phone: true, country: true },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // 权限验证：只有合同相关方或管理员可以查看
    if (
      user.id !== contract.sellerId &&
      user.id !== contract.buyerId &&
      user.role !== "admin" &&
      user.role !== "super_admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error("Contract detail GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contract" },
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

    const contract = await prisma.electronicContract.findUnique({
      where: { id: params.id },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // 权限验证
    if (
      user.id !== contract.sellerId &&
      user.id !== contract.buyerId &&
      user.role !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 只有draft状态可以修改
    if (contract.status !== "draft") {
      return NextResponse.json(
        { error: "Contract can only be edited in draft status" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      "title",
      "tradeTerm",
      "priceCny",
      "priceUsd",
      "currency",
      "paymentMethod",
      "deliveryDate",
      "deliveryAddress",
      "terms",
      "attachments",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "priceCny" || field === "priceUsd") {
          updateData[field] = parseFloat(body[field]);
        } else if (field === "deliveryDate") {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await prisma.electronicContract.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Contract PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update contract" },
      { status: 500 }
    );
  }
}
