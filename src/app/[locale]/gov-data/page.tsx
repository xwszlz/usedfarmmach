import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import GovDataClient from "./GovDataClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("gov-data", locale, "/gov-data");
}

export default async function GovDataPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <GovDataClient />;
}
