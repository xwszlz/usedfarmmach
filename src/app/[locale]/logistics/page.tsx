import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import LogisticsClient from "./LogisticsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("logistics", locale, "/logistics");
}

export default function LogisticsPage() {
  return <LogisticsClient />;
}
