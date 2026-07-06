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

  const booth = await prisma.booth.findUnique({
    where: { id: boothId },
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
