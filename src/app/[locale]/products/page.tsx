import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import ProductsClient from "./ProductsClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("products", locale, {
    alternates: {
      canonical: `${BASE_URL}/${locale}/products`,
    },
  });
}

export default function ProductsPage() {
  return <ProductsClient />;
}
