/**
 * 租赁详情/更新 API
 *
 * GET    /api/rentals/:id — 获取租赁详情
 * PATCH  /api/rentals/:id — 更新租赁信息
 * DELETE /api/rentals/:id — 删除租赁信息
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rental = await prisma.rentalListing.findUnique({
      where: { id },
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
              select: { url: true, isPrimary: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!rental) {
      return NextResponse.json({ error: "Rental listing not found" }, { status: 404 });
    }

    return NextResponse.json({ rental });
  } catch (error) {
    console.error("Rental detail GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const rental = await prisma.rentalListing.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!rental) {
      return NextResponse.json({ error: "Rental listing not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      rentalType,
      pricePerDay,
      pricePerMonth,
      pricePerYear,
      deposit,
      minRentalPeriod,
      maxRentalPeriod,
      deliveryAvailable,
      deliveryFee,
      status,
    } = body;

    const updated = await prisma.rentalListing.update({
      where: { id },
      data: {
        rentalType: rentalType || undefined,
        pricePerDay: pricePerDay !== undefined ? pricePerDay : undefined,
        pricePerMonth: pricePerMonth !== undefined ? pricePerMonth : undefined,
        pricePerYear: pricePerYear !== undefined ? pricePerYear : undefined,
        deposit: deposit !== undefined ? deposit : undefined,
        minRentalPeriod: minRentalPeriod !== undefined ? minRentalPeriod : undefined,
        maxRentalPeriod: maxRentalPeriod !== undefined ? maxRentalPeriod : undefined,
        deliveryAvailable: deliveryAvailable !== undefined ? deliveryAvailable : undefined,
        deliveryFee: deliveryFee !== undefined ? deliveryFee : undefined,
        status: status || undefined,
      },
    });

    return NextResponse.json({ rental: updated, message: "Rental listing updated" });
  } catch (error) {
    console.error("Rental PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const rental = await prisma.rentalListing.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!rental) {
      return NextResponse.json({ error: "Rental listing not found" }, { status: 404 });
    }

    await prisma.rentalListing.delete({ where: { id } });

    return NextResponse.json({ message: "Rental listing deleted" });
  } catch (error) {
    console.error("Rental DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
