import { MetadataRoute } from "next";
import { PrismaClient } from "@prisma/client";

// ISR: 每天重新生成站点地图
export const revalidate = 86400;

const BASE_URL = "https://usedfarmmach.com";
const locales = ["zh", "en", "ru"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const prisma = new PrismaClient();

  try {
    // Fetch all published products and articles from DB
    const [products, articles] = await Promise.all([
      prisma.product.findMany({
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.article.findMany({
        where: { status: "published" },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    // Static pages for each locale
    const staticPages = [
      "", // homepage
      "/products",
      "/blog",
      "/about",
      "/arbitrage-top",
      "/arbitrage-calculator",
      "/intelligence",
      "/logistics",
    ];

    const staticEntries: MetadataRoute.Sitemap = [];
    for (const locale of locales) {
      for (const page of staticPages) {
        staticEntries.push({
          url: `${BASE_URL}/${locale}${page}`,
          lastModified: new Date(),
          changeFrequency: page === "" ? "daily" : "weekly",
          priority: page === "" ? 1.0 : page === "/products" ? 0.9 : 0.7,
        });
      }
    }

    // Product detail pages for each locale
    const productEntries: MetadataRoute.Sitemap = [];
    for (const locale of locales) {
      for (const product of products) {
        productEntries.push({
          url: `${BASE_URL}/${locale}/products/${product.id}`,
          lastModified: product.updatedAt,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }

    // Blog article pages for each locale
    const articleEntries: MetadataRoute.Sitemap = [];
    for (const locale of locales) {
      for (const article of articles) {
        articleEntries.push({
          url: `${BASE_URL}/${locale}/blog/${article.slug}`,
          lastModified: article.updatedAt,
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }

    return [...staticEntries, ...productEntries, ...articleEntries];
  } finally {
    await prisma.$disconnect();
  }
}
