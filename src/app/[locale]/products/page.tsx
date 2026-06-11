import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import ProductsClient from "./ProductsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("products", locale, "/products");
}

export default function ProductsPage() {
  return <ProductsClient />;
}
