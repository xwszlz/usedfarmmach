import type { Metadata } from "next";
import { SelfBoothLanding } from "./SelfBoothLanding";
import { generatePageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("expo", locale, "/expo/booth");
}

export default async function ExpoBoothPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SelfBoothLanding locale={locale} />;
}
