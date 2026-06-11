import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { generatePageMetadata } from "@/lib/seo-metadata";
import IntelligencePageClient from "./page-client";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("intelligence", locale, {
    alternates: {
      canonical: `${BASE_URL}/${locale}/intelligence`,
    },
  });
}

export default async function IntelligencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <IntelligencePageClient locale={locale} />;
}
