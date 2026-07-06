import type { Metadata } from "next";
import { ExpoLanding } from "./ExpoLanding";
import { generatePageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("expo", locale, "/expo");
}

export default async function ExpoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ExpoLanding locale={locale} />;
}
