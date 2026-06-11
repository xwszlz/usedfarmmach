import type { Metadata } from 'next';
import { PrismaClient } from '@prisma/client';
import { generatePageMetadata } from '@/lib/seo-metadata';
import { BreadcrumbStructuredData, ItemListStructuredData } from '@/components/seo/structured-data';
import BlogListClient from './BlogListClient';

const prisma = new PrismaClient();
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("blog", locale, "/blog");
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;

  // Server-side fetch: 搜索引擎可直接看到文章列表
  const where: any = { status: 'published' };
  if (sp.category && sp.category !== 'all') where.category = sp.category;

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: 12,
      select: {
        id: true,
        slug: true,
        titleZh: true,
        titleEn: true,
        titleRu: true,
        excerptZh: true,
        excerptEn: true,
        excerptRu: true,
        coverImage: true,
        category: true,
        tags: true,
        publishedAt: true,
        viewCount: true,
      },
    }),
    prisma.article.count({ where }),
  ]);

  const totalPages = Math.ceil(total / 12);

  // Build ItemList structured data for search engines
  const listItems = articles.map((a) => ({
    id: a.id,
    name: locale === 'en' && a.titleEn ? a.titleEn
      : locale === 'ru' && a.titleRu ? a.titleRu
      : a.titleZh,
    url: `${BASE_URL}/${locale}/blog/${a.slug}`,
    imageUrl: a.coverImage || undefined,
  }));

  const serializedArticles = articles.map((a) => ({
    ...a,
    publishedAt: a.publishedAt?.toISOString() || null,
  }));

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "行业资讯" : "Blog", url: `${BASE_URL}/${locale}/blog` },
        ]}
      />
      <ItemListStructuredData
        locale={locale}
        items={listItems}
        listName={locale === "zh" ? "行业资讯" : "Blog Articles"}
      />
      <BlogListClient
        locale={locale}
        initialCategory={sp.category}
        initialArticles={serializedArticles}
        initialTotal={total}
        initialTotalPages={totalPages}
      />
    </>
  );
}
