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
  const pavilion = searchParams.get("pavilion") || "";
  const itemType = searchParams.get("itemType") || "";
  const tier = searchParams.get("tier") || "";

  const where: any = { status: "published" };

  if (hall) {
    where.booth = { hall };
  }
  if (brand) {
    where.brand = brand;
  }
  if (itemType) {
    where.itemType = itemType;
  }
  if (pavilion) {
    where.booth = { ...where.booth, pavilion };
  }
  if (tier) {
    where.booth = { ...where.booth, tier };
  }
  if (q) {
    where.OR = [
      { model: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { deviceType: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  // Brand tier sort order (flagship first, showcase last)
  const tierOrder: Record<string, number> = {
    flagship: 0,
    premium: 1,
    standard: 2,
    showcase: 3,
  };

  // Fetch ALL filtered items for tier-aware sorting, then paginate in JS
  const [allRawItems, total] = await Promise.all([
    prisma.showcaseItem.findMany({
      where,
      orderBy: [{ hotScore: "desc" }, { sortIndex: "asc" }, { createdAt: "desc" }],
      include: {
        booth: {
          select: { id: true, name: true, hall: true, pavilion: true, tier: true },
        },
        brandRel: {
          select: {
            id: true,
            nameZh: true,
            nameEn: true,
            isChineseBrand: true,
            brandTier: true,
            expoLogoUrl: true,
            expoStory: true,
            establishedYear: true,
            exportVolume: true,
          },
        },
      },
    }),
    prisma.showcaseItem.count({ where }),
  ]);

  // Sort by brand tier first, then hotScore, then sortIndex, then createdAt
  const sortedItems = allRawItems.sort((a: any, b: any) => {
    const ta = tierOrder[a.brandRel?.brandTier ?? ""] ?? 9;
    const tb = tierOrder[b.brandRel?.brandTier ?? ""] ?? 9;
    if (ta !== tb) return ta - tb;
    if (a.hotScore !== b.hotScore) return b.hotScore - a.hotScore;
    if ((a.sortIndex ?? 0) !== (b.sortIndex ?? 0)) return (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Paginate after sorting
  const rawItems = sortedItems.slice((page - 1) * limit, page * limit);

  const items = rawItems.map((item: any) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    coverImage: item.images?.[0] ? getImageUrl(item.images[0]) : null,
  }));

  return NextResponse.json({ items, total, page, limit });
}
