import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import ProductsClient from "./ProductsClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("products", locale, "/products");
}

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "设备市场" : "Products", url: `${BASE_URL}/${locale}/products` },
        ]}
      />
      <ProductsClient />
    </>
  );
}
