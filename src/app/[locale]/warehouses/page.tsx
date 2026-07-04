import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import WarehousesClient from "./WarehousesClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("warehouses", locale, "/warehouses");
}

export default async function WarehousesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <WarehousesClient />;
}
