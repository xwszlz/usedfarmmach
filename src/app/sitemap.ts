import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { toSlug } from "@/lib/slug";

// ISR: 每天重新生成站点地图
export const revalidate = 86400;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";
const locales = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all data in parallel
  const [products, articles, brands, categories] = await Promise.all([
    prisma.product.findMany({
      where: { status: "active" },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.article.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.brand.findMany({
      select: { nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.category.findMany({
      select: { nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  // Static pages for each locale
  const staticPages = [
    { path: "", priority: 1.0, freq: "daily" as const },
    { path: "/products", priority: 0.9, freq: "weekly" as const },
    { path: "/blog", priority: 0.7, freq: "weekly" as const },
    { path: "/about", priority: 0.5, freq: "monthly" as const },
    { path: "/arbitrage-top", priority: 0.8, freq: "daily" as const },
    { path: "/arbitrage-calculator", priority: 0.7, freq: "weekly" as const },
    { path: "/intelligence", priority: 0.7, freq: "daily" as const },
    { path: "/logistics", priority: 0.6, freq: "monthly" as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    // Static pages
    for (const page of staticPages) {
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.freq,
        priority: page.priority,
      });
    }

    // Product detail pages
    for (const product of products) {
      entries.push({
        url: `${BASE_URL}/${locale}/products/${product.id}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Blog article pages
    for (const article of articles) {
      entries.push({
        url: `${BASE_URL}/${locale}/blog/${article.slug}`,
        lastModified: article.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }

    // Brand pages
    for (const brand of brands) {
      entries.push({
        url: `${BASE_URL}/${locale}/brand/${toSlug(brand.nameEn)}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    // Category pages
    for (const category of categories) {
      entries.push({
        url: `${BASE_URL}/${locale}/category/${toSlug(category.nameEn)}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  return entries;
}
