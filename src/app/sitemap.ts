import { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { SITE_ORIGIN } from "@/lib/site-url";
import { prisma } from "@/lib/db";
import { toSlug } from "@/lib/slug";

// 动态生成站点地图（force-dynamic）：每次请求读真实 DB，避免构建期空库快照被缓存。
export const dynamic = "force-dynamic";

const BASE_URL = SITE_ORIGIN;
const locales = siteConfig.locales;

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
    { path: "/expo/tianjin-2026", priority: 0.8, freq: "weekly" as const },
    { path: "/expo/field-videos", priority: 0.7, freq: "weekly" as const },
    { path: "/solutions", priority: 0.6, freq: "monthly" as const },
    { path: "/services", priority: 0.7, freq: "monthly" as const },
    { path: "/services/valuation", priority: 0.8, freq: "monthly" as const },
    { path: "/membership", priority: 0.8, freq: "weekly" as const },
    { path: "/arena", priority: 0.6, freq: "weekly" as const },
    { path: "/benchmark", priority: 0.7, freq: "weekly" as const },
    { path: "/credits", priority: 0.5, freq: "monthly" as const },
    { path: "/escrow", priority: 0.5, freq: "monthly" as const },
    { path: "/service-network", priority: 0.6, freq: "monthly" as const },
    { path: "/auctions/rules", priority: 0.5, freq: "monthly" as const },
    { path: "/arbitrage-top", priority: 0.8, freq: "daily" as const },
    { path: "/arbitrage-calculator", priority: 0.7, freq: "weekly" as const },
    { path: "/intelligence", priority: 0.7, freq: "daily" as const },
    { path: "/insights", priority: 0.6, freq: "weekly" as const },
    { path: "/auctions", priority: 0.6, freq: "weekly" as const },
    { path: "/rentals", priority: 0.6, freq: "weekly" as const },
    { path: "/finance", priority: 0.6, freq: "monthly" as const },
    { path: "/logistics", priority: 0.6, freq: "monthly" as const },
    { path: "/standards", priority: 0.5, freq: "monthly" as const },
    { path: "/warehouses", priority: 0.5, freq: "monthly" as const },
    { path: "/api-docs", priority: 0.4, freq: "monthly" as const },
    { path: "/about", priority: 0.5, freq: "monthly" as const },
    { path: "/privacy", priority: 0.3, freq: "yearly" as const },
    { path: "/terms", priority: 0.3, freq: "yearly" as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  // 站点地图去重：多个 nameEn 可能塌缩为同一 slug（含空串），避免向搜索引擎提交重复 URL。
  const seen = new Set<string>();
  const push = (entry: MetadataRoute.Sitemap[number]) => {
    if (seen.has(entry.url)) return;
    seen.add(entry.url);
    entries.push(entry);
  };

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

    // Brand pages（跳过 slug 为空串的 nameEn，避免生成 /brand/ 空路径 404）
    for (const brand of brands) {
      const slug = toSlug(brand.nameEn);
      if (!slug) continue;
      push({
        url: `${BASE_URL}/${locale}/brand/${slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    // Category pages（跳过 slug 为空串的 nameEn，避免生成 /category/ 空路径 404）
    for (const category of categories) {
      const slug = toSlug(category.nameEn);
      if (!slug) continue;
      push({
        url: `${BASE_URL}/${locale}/category/${slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  return entries;
}
