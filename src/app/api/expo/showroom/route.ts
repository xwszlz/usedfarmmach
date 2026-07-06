import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "24");
  const hall = searchParams.get("hall") || "";
  const brand = searchParams.get("brand") || "";
  const q = searchParams.get("q") || "";

  const where: any = { status: "published" };

  if (hall) {
    where.booth = { hall };
  }
  if (brand) {
    where.brand = brand;
  }
  if (q) {
    where.OR = [
      { model: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { deviceType: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rawItems, total] = await Promise.all([
    prisma.showcaseItem.findMany({
      where,
      orderBy: [{ sortIndex: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        booth: { select: { id: true, name: true, hall: true } },
      },
    }),
    prisma.showcaseItem.count({ where }),
  ]);

  const items = rawItems.map((item: any) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    coverImage: item.images?.[0] ? getImageUrl(item.images[0]) : null,
  }));

  return NextResponse.json({ items, total, page, limit });
}
