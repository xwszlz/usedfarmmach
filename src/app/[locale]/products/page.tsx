import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, ItemListStructuredData } from "@/components/seo/structured-data";
import { getImageUrl } from "@/lib/image-url";
import { toSlug } from "@/lib/slug";
import ProductsClient from "./ProductsClient";
import type { Product } from "@/types";

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

  // Server-side fetch: 搜索引擎可直接看到83台设备
  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        brand: { select: { nameZh: true, nameEn: true, nameRu: true } },
        category: { select: { nameZh: true, nameEn: true, nameRu: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
        seller: { select: { id: true, companyName: true, country: true } },
      },
    }),
    prisma.product.count({ where: { status: "active" } }),
  ]);

  const totalPages = Math.ceil(total / 12);

  // Serialize for client component (Date → string)
  const products = rawProducts.map((p: any) => ({
    ...p,
    condition: p.condition as Product["condition"],
    status: p.status as Product["status"],
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  // Build ItemList structured data
  const listItems = products.map((p: any) => {
    const brandName = locale === "zh" ? p.brand?.nameZh : locale === "ru" ? p.brand?.nameRu || p.brand?.nameEn : p.brand?.nameEn;
    return {
      id: p.id,
      name: `${brandName} ${p.modelName}`,
      url: `${BASE_URL}/${locale}/products/${p.id}`,
      imageUrl: p.images?.[0] ? getImageUrl(p.images[0].url) : undefined,
      priceCny: p.priceCny,
      brand: brandName,
    };
  });

  // Fetch filter options server-side
  const brands = await prisma.brand.findMany({ select: { nameZh: true, nameEn: true, nameRu: true }, orderBy: { nameEn: "asc" } });
  const categories = await prisma.category.findMany({ select: { nameZh: true, nameEn: true, nameRu: true }, orderBy: { nameEn: "asc" } });
  const locations = await prisma.product.findMany({ where: { status: "active" }, select: { location: true }, distinct: ["location"] });

  const getLabel = (item: any) => {
    if (locale === "en") return item.nameEn;
    if (locale === "ru" && item.nameRu) return item.nameRu;
    return item.nameZh;
  };

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "设备市场" : "Products", url: `${BASE_URL}/${locale}/products` },
        ]}
      />
      <ItemListStructuredData
        locale={locale}
        items={listItems}
        listName={locale === "zh" ? "二手农机设备市场" : "Used Farm Machinery Market"}
      />
      <ProductsClient
        initialProducts={products}
        initialTotal={total}
        initialTotalPages={totalPages}
        initialBrands={brands.map((b: any) => ({ value: toSlug(b.nameEn), label: getLabel(b) }))}
        initialCategories={categories.map((c: any) => ({ value: toSlug(c.nameEn), label: getLabel(c) }))}
        initialLocations={locations.filter((l: any) => l.location).map((l: any) => ({ value: l.location, label: l.location }))}
      />
    </>
  );
}
