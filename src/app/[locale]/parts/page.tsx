import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import PartsClient from "./PartsClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("parts", locale, "/parts");
}

export default async function PartsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "零配件专区" : "Parts", url: `${BASE_URL}/${locale}/parts` },
        ]}
      />
      <PartsClient locale={locale} />
    </>
  );
}
