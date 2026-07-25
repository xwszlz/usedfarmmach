import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import BoothDetailClient from "./BoothDetailClient";

export const dynamic = "force-dynamic";

export default async function BoothDetailPage({
  params,
}: {
  params: Promise<{ locale: string; boothId: string }>;
}) {
  const { locale, boothId } = await params;

  // 支持两种入参：booth.id（地图/卖家/认领链接）或 brand.expoSlug（品牌馆卡片链接）
  const booth = await prisma.booth.findFirst({
    where: { OR: [{ id: boothId }, { brand: { expoSlug: boothId } }] },
    include: {
      merchant: {
        select: { id: true, username: true, companyName: true, phone: true, email: true, country: true },
      },
      showcaseItems: {
        where: { status: "published" },
        orderBy: { sortIndex: "asc" },
      },
    },
  });

  if (!booth) {
    notFound();
  }

  return <BoothDetailClient booth={JSON.parse(JSON.stringify(booth))} locale={locale} />;
}
