import { ArenaPageClient } from "@/components/arena/arena-page-client";

export default async function ArenaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const crop = typeof sp.crop === "string" ? sp.crop : "wheat";
  const machineType = typeof sp.type === "string" ? sp.type : "tractor";
  const budgetStr = typeof sp.budget === "string" ? sp.budget : "30";
  const budget = Math.min(100, Math.max(5, Number(budgetStr) || 30));

  return (
    <ArenaPageClient
      locale={locale}
      initialCrop={crop}
      initialMachineType={machineType}
      initialBudget={budget}
    />
  );
}
