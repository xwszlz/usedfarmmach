/**
 * 租赁信息 API
 *
 * GET  /api/rentals?status=available&type=daily&page=1  — 获取租赁列表
 * POST /api/rentals  — 创建租赁信息 { productId, rentalType, pricePerDay, ... }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const status = searchParams.get("status") || "available";
    const rentalType = searchParams.get("type") || undefined;

    const where: Record<string, unknown> = { status };
    if (rentalType) where.rentalType = rentalType;

    const [rentals, total] = await Promise.all([
      prisma.rentalListing.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              modelName: true,
              year: true,
              workingHours: true,
              condition: true,
              location: true,
              enginePower: true,
              brand: { select: { nameZh: true, nameEn: true } },
              images: {
                select: { url: true },
                take: 1,
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.rentalListing.count({ where }),
    ]);

    return NextResponse.json({
      rentals,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Rentals GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      productId,
      rentalType,
      pricePerDay,
      pricePerMonth,
      pricePerYear,
      deposit,
      minRentalPeriod,
      maxRentalPeriod,
      deliveryAvailable,
      deliveryFee,
    } = body;

    if (!productId || !rentalType) {
      return NextResponse.json({ error: "productId and rentalType are required" }, { status: 400 });
    }

    // 验证产品属于该用户
    const product = await prisma.product.findFirst({
      where: { id: productId, sellerId: user.id },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found or not owned by you" }, { status: 404 });
    }

    // 检查是否已有租赁信息
    const existing = await prisma.rentalListing.findUnique({
      where: { productId },
    });
    if (existing) {
      return NextResponse.json({ error: "Rental listing already exists for this product" }, { status: 400 });
    }

    const rental = await prisma.rentalListing.create({
      data: {
        productId,
        ownerId: user.id,
        rentalType,
        pricePerDay: pricePerDay || null,
        pricePerMonth: pricePerMonth || null,
        pricePerYear: pricePerYear || null,
        deposit: deposit || null,
        minRentalPeriod: minRentalPeriod || null,
        maxRentalPeriod: maxRentalPeriod || null,
        deliveryAvailable: deliveryAvailable || false,
        deliveryFee: deliveryFee || null,
      },
    });

    return NextResponse.json({ rental, message: "Rental listing created" });
  } catch (error) {
    console.error("Rental POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
