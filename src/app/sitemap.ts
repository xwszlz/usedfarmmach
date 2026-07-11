import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { toSlug } from "@/lib/slug";

// ISR: 每天重新生成站点地图
export const revalidate = 86400;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";
const locales = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all data in parallel
  const [products, articles, researchArticles, brands, categories] = await Promise.all([
    prisma.product.findMany({
      where: { status: "active" },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.article.findMany({
      where: { status: "published", NOT: { category: { startsWith: "research-" } } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.article.findMany({
      where: { status: "published", category: { startsWith: "research-" } },
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

  // Static pages for each locale — full coverage
  const staticPages = [
    { path: "", priority: 1.0, freq: "daily" as const },
    { path: "/products", priority: 0.9, freq: "weekly" as const },
    { path: "/blog", priority: 0.7, freq: "weekly" as const },
    { path: "/research", priority: 0.8, freq: "weekly" as const },
    { path: "/engineer", priority: 0.8, freq: "monthly" as const },
    { path: "/parts", priority: 0.7, freq: "weekly" as const },
    { path: "/expo", priority: 0.8, freq: "weekly" as const },
    { path: "/expo/global-brands", priority: 0.7, freq: "weekly" as const },
    { path: "/expo/china-brands", priority: 0.7, freq: "weekly" as const },
    { path: "/expo/compare", priority: 0.6, freq: "weekly" as const },
    { path: "/expo/showroom", priority: 0.7, freq: "weekly" as const },
    { path: "/solutions", priority: 0.6, freq: "monthly" as const },
    { path: "/arbitrage-top", priority: 0.8, freq: "daily" as const },
    { path: "/arbitrage-calculator", priority: 0.7, freq: "weekly" as const },
    { path: "/intelligence", priority: 0.7, freq: "daily" as const },
    { path: "/insights", priority: 0.6, freq: "weekly" as const },
    { path: "/auctions", priority: 0.6, freq: "weekly" as const },
    { path: "/rentals", priority: 0.6, freq: "weekly" as const },
    { path: "/finance", priority: 0.6, freq: "monthly" as const },
    { path: "/logistics", priority: 0.6, freq: "monthly" as const },
    { path: "/standards", priority: 0.5, freq: "monthly" as const },
    { path: "/gov-data", priority: 0.5, freq: "monthly" as const },
    { path: "/warehouses", priority: 0.5, freq: "monthly" as const },
    { path: "/api-docs", priority: 0.4, freq: "monthly" as const },
    { path: "/about", priority: 0.5, freq: "monthly" as const },
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

    // Research article pages
    for (const article of researchArticles) {
      entries.push({
        url: `${BASE_URL}/${locale}/research/${article.slug}`,
        lastModified: article.updatedAt,
        changeFrequency: "monthly",
        priority: 0.7,
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
