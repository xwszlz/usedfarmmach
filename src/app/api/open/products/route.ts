/**
 * 开放API — 产品列表
 * GET /api/open/products?page=1&pageSize=20&category=xxx&brand=xxx&country=xxx
 *
 * 需要 API Key: Authorization: Bearer sk_xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "../_middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const categoryId = searchParams.get("category") || undefined;
    const brandId = searchParams.get("brand") || undefined;
    const country = searchParams.get("country") || undefined;
    const status = searchParams.get("status") || "active";

    const where: Record<string, unknown> = { status };
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (country) where.location = { contains: country };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          modelName: true,
          brandId: true,
          categoryId: true,
          year: true,
          workingHours: true,
          condition: true,
          priceCny: true,
          priceUsd: true,
          location: true,
          enginePower: true,
          engineType: true,
          driveSystem: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          brand: { select: { id: true, nameZh: true, nameEn: true, originCountry: true } },
          category: { select: { id: true, nameZh: true, nameEn: true } },
          images: {
            select: { url: true, isPrimary: true },
            take: 1,
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      meta: {
        apiVersion: "v1",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Open API products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
