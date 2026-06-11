import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import AboutClient from "./AboutClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("about", locale, {
    alternates: {
      canonical: `${BASE_URL}/${locale}/about`,
    },
  });
}

export default function AboutPage() {
  return <AboutClient />;
}
