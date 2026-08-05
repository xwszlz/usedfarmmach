import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import InsightsClient from "./InsightsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("insights", locale, "/insights");
}

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <InsightsClient />;
}
