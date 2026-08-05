import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { generatePageMetadata } from '@/lib/seo-metadata';
import { BreadcrumbStructuredData, ItemListStructuredData } from '@/components/seo/structured-data';
import ResearchListClient from './ResearchListClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

const RESEARCH_CATEGORIES = [
  'research-industry-report',
  'research-tech-frontier',
  'research-policy-tracking',
  'research-company-map',
];

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: { category?: string; page?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("research", locale, "/research");
}

export default async function ResearchHubPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = searchParams;

  // Server-side fetch: get articles with category starting with "research-"
  const where: any = {
    status: 'published',
    category: { startsWith: 'research-' },
  };
  if (sp.category && sp.category !== 'all') {
    where.category = sp.category;
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 12,
      select: {
        id: true,
        slug: true,
        titleZh: true,
        titleEn: true,
        titleRu: true,
        titleEs: true,
        titlePt: true,
        titleAr: true,
        titleFr: true,
        titleHi: true,
        excerptZh: true,
        excerptEn: true,
        excerptRu: true,
        excerptEs: true,
        excerptPt: true,
        excerptAr: true,
        excerptFr: true,
        excerptHi: true,
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
      : a.titleZh,
    url: `${BASE_URL}/${locale}/research/${a.slug}`,
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
          { name: locale === "zh" ? "AI前沿研究Hub" : "Research Hub", url: `${BASE_URL}/${locale}/research` },
        ]}
      />
      <ItemListStructuredData
        locale={locale}
        items={listItems}
        listName={locale === "zh" ? "AI前沿研究报告" : "AI Frontier Research Reports"}
      />
      <ResearchListClient
        locale={locale}
        initialCategory={sp.category}
        initialArticles={serializedArticles}
        initialTotal={total}
        initialTotalPages={totalPages}
      />
    </>
  );
}
