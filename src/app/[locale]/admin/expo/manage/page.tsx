import { prisma } from "@/lib/db";
import ManageClient from "./ManageClient";

export const dynamic = "force-dynamic";

export default async function ManageExpoPage() {
  const [brands, booths, items] = await Promise.all([
    prisma.brand.findMany({
      where: {
        OR: [{ isChineseBrand: true }, { brandTier: { not: null } }],
      },
      select: {
        id: true,
        nameZh: true,
        nameEn: true,
        brandTier: true,
        isChineseBrand: true,
        expoSlug: true,
        officialWebsite: true,
        establishedYear: true,
        exportVolume: true,
        expoStory: true,
      },
      orderBy: [{ isChineseBrand: "desc" }, { brandTier: "asc" }, { nameZh: "asc" }],
    }),
    prisma.booth.findMany({
      where: { status: { in: ["published", "configured"] } },
      select: {
        id: true,
        name: true,
        hall: true,
        pavilion: true,
        tier: true,
        status: true,
        sortIndex: true,
        brandId: true,
        brand: { select: { nameZh: true, nameEn: true } },
        _count: { select: { showcaseItems: true } },
      },
      orderBy: [{ pavilion: "asc" }, { sortIndex: "asc" }],
    }),
    prisma.showcaseItem.findMany({
      where: { itemType: "new", status: "published" },
      select: {
        id: true,
        brand: true,
        model: true,
        deviceType: true,
        hotScore: true,
        isFeatured: true,
        isNewLaunch: true,
        machineTier: true,
        msrpUsd: true,
        msrpCny: true,
        sortIndex: true,
        brandRel: { select: { nameZh: true, brandTier: true, isChineseBrand: true } },
      },
      orderBy: [{ hotScore: "desc" }],
    }),
  ]);

  const serializedBrands = brands.map((b: any) => ({
    ...b,
    isChineseBrand: b.isChineseBrand ?? false,
  }));
  const serializedBooths = booths.map((b: any) => ({
    ...b,
    _count: { showcaseItems: b._count?.showcaseItems ?? 0 },
  }));
  const serializedItems = items.map((i: any) => ({ ...i }));

  return <ManageClient brands={serializedBrands} booths={serializedBooths} items={serializedItems} />;
}
