import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import BargainsClient from "./AuctionsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("auctions", locale, "/auctions");
}

export default async function BargainsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <BargainsClient />;
}
