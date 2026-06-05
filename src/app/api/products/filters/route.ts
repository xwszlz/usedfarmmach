import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [brands, categories, locations] = await Promise.all([
      prisma.brand.findMany({
        where: {
          products: { some: { status: "active" } }
        },
        select: { id: true, nameZh: true, nameEn: true, nameRu: true },
        orderBy: { nameZh: "asc" },
      }),
      prisma.category.findMany({
        where: {
          products: { some: { status: "active" } }
        },
        select: { id: true, nameZh: true, nameEn: true, nameRu: true },
        orderBy: { nameZh: "asc" },
      }),
      prisma.product.findMany({
        where: { status: "active", location: { not: null } },
        select: { location: true },
        distinct: ["location"],
        orderBy: { location: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        brands: brands.map(b => ({
          value: b.id,
          labelZh: b.nameZh,
          labelEn: b.nameEn,
          labelRu: b.nameRu,
        })),
        categories: categories.map(c => ({
          value: c.id,
          labelZh: c.nameZh,
          labelEn: c.nameEn,
          labelRu: c.nameRu,
        })),
        locations: locations
          .map(l => l.location)
          .filter((l): l is string => !!l)
          .map(l => ({
            value: l,
            labelZh: l,
            labelEn: l,
            labelRu: l,
          })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch filter options:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
