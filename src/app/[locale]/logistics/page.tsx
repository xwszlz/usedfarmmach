import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import LogisticsClient from "./LogisticsClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("logistics", locale, {
    alternates: {
      canonical: `${BASE_URL}/${locale}/logistics`,
    },
  });
}

export default function LogisticsPage() {
  return <LogisticsClient />;
}
