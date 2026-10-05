import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, ItemListStructuredData } from "@/components/seo/structured-data";
import { getImageUrl } from "@/lib/image-url";
import { toSlug } from "@/lib/slug";
import ProductsClient from "./ProductsClient";
import type { Product } from "@/types";
import { MINIAPP_SELLER_EMAIL, buildWebsiteVisibleWhere } from "@/lib/product-visibility";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export const revalidate = 300;

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

  // 网站端可见性口径（与 /api/products 网站分支完全一致；单一事实来源 @/lib/product-visibility）：
  //   status='active' 且 非(小程序账号 ∧ 国产品牌)；用 sellerId 标量比较，规避 User.email 可空导致的 SQL 三值逻辑丢行；
  //   查不到小程序账号则安全退化为「不排除任何人」。
  const miniappSeller = await prisma.user.findUnique({
    where: { email: MINIAPP_SELLER_EMAIL },
    select: { id: true },
  });
  const visibleWhere = buildWebsiteVisibleWhere(miniappSeller?.id ?? null);

  // Server-side fetch: 搜索引擎可直接看到83台设备
  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      where: visibleWhere,
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        brand: { select: { nameZh: true, nameEn: true, nameRu: true, nameEs: true, namePt: true, nameAr: true, nameFr: true, nameHi: true } },
        category: { select: { nameZh: true, nameEn: true, nameRu: true, nameEs: true, namePt: true, nameAr: true, nameFr: true, nameHi: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
        seller: { select: { id: true, companyName: true, country: true } },
        // 关联活跃询价
        auctions: {
          where: { status: "active" },
          select: { id: true, totalBids: true },
          take: 1,
        },
      },
    }),
    prisma.product.count({ where: visibleWhere }),
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
    const langKey = `name${locale.charAt(0).toUpperCase()}${locale.slice(1)}` as keyof typeof p.brand;
    const brandName = p.brand ? (p.brand as any)[langKey] || p.brand?.nameEn || p.brand?.nameZh : "";
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
  const brands = await prisma.brand.findMany({ select: { nameZh: true, nameEn: true, nameRu: true, nameEs: true, namePt: true, nameAr: true, nameFr: true, nameHi: true }, orderBy: { nameEn: "asc" } });
  const categories = await prisma.category.findMany({ select: { nameZh: true, nameEn: true, nameRu: true, nameEs: true, namePt: true, nameAr: true, nameFr: true, nameHi: true }, orderBy: { nameEn: "asc" } });
  // 地区下拉须与 findMany/count 共用同一可见性口径，否则下拉会列出不可见产品的地区
  const locations = await prisma.product.findMany({ where: visibleWhere, select: { location: true }, distinct: ["location"] });

  const getLabel = (item: any) => {
    const langKey = `name${locale.charAt(0).toUpperCase()}${locale.slice(1)}` as keyof typeof item;
    return item[langKey] || item.nameEn || item.nameZh;
  };

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "农机市场" : "Products", url: `${BASE_URL}/${locale}/products` },
        ]}
      />
      <ItemListStructuredData
        locale={locale}
        items={listItems}
        listName={locale === "zh" ? "二手农机市场" : "Used Farm Machinery Market"}
      />
      <ProductsClient
        initialProducts={products}
        initialTotal={total}
        initialTotalPages={totalPages}
        initialBrands={brands.map((b: any) => ({ value: toSlug(b.nameEn), label: getLabel(b) }))}
        initialCategories={categories.map((c: any) => ({ value: toSlug(c.nameEn), label: getLabel(c), id: c.id }))}
        initialLocations={locations.filter((l: any) => l.location).map((l: any) => ({ value: l.location, label: l.location }))}
      />
    </>
  );
}
