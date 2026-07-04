import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import AuctionsClient from "./AuctionsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("auctions", locale, "/auctions");
}

export default async function AuctionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <AuctionsClient />;
}
