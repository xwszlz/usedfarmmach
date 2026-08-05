import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import RentalsClient from "./RentalsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("rentals", locale, "/rentals");
}

export default async function RentalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <RentalsClient />;
}
