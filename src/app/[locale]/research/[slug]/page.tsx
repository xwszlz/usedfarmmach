import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrismaClient } from '@prisma/client';
import ResearchDetailClient from './ResearchDetailClient';
import { getHreflangLanguages } from "@/components/seo/hreflang-head";
import { ArticleStructuredData, BreadcrumbStructuredData } from "@/components/seo/structured-data";

const prisma = new PrismaClient();
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await prisma.article.findUnique({ where: { slug } });
  if (!article) return { title: 'Article Not Found' };

  const title = locale === 'en' && article.titleEn ? article.titleEn
    : article.titleZh;

  const description = article.metaDesc || (locale === 'en' && article.excerptEn ? article.excerptEn
    : article.excerptZh) || '';

  const brand = locale === 'zh' ? '神雕农机研究Hub' : 'Research Hub';

  return {
    title: `${title} | ${brand}`,
    description: description?.slice(0, 160),
    keywords: article.keywords || '',
    alternates: {
      canonical: `${BASE_URL}/${locale}/research/${slug}`,
      languages: getHreflangLanguages(`/research/${slug}`),
    },
    openGraph: {
      title: `${title} | ${brand}`,
      description: description?.slice(0, 160),
      type: 'article',
      publishedTime: article.publishedAt?.toISOString(),
      ...(article.coverImage ? { images: [{ url: article.coverImage }] } : {}),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function ResearchDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const article = await prisma.article.findUnique({ where: { slug } });

  if (!article || article.status !== 'published' || !article.category?.startsWith('research-')) {
    notFound();
  }

  // Increment view count
  await prisma.article.update({
    where: { id: article.id },
    data: { viewCount: { increment: 1 } },
  });

  // Get related articles (same research category)
  const relatedArticles = await prisma.article.findMany({
    where: {
      status: 'published',
      category: article.category,
      id: { not: article.id },
    },
    orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
    take: 3,
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
      publishedAt: true,
      viewCount: true,
    },
  });

  const articleTitle = locale === 'en' && article.titleEn ? article.titleEn
    : article.titleZh;
  const articleDesc = locale === 'en' && article.excerptEn ? article.excerptEn
    : article.excerptZh || '';

  return (
    <>
      <ArticleStructuredData
        title={articleTitle}
        description={articleDesc.slice(0, 200)}
        url={`${BASE_URL}/${locale}/research/${slug}`}
        datePublished={article.publishedAt?.toISOString() || article.createdAt.toISOString()}
        dateModified={article.updatedAt.toISOString()}
        imageUrl={article.coverImage || undefined}
        keywords={article.keywords ? article.keywords.split(/[,， ]+/) : undefined}
      />
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "AI前沿研究Hub" : "Research Hub", url: `${BASE_URL}/${locale}/research` },
          { name: articleTitle, url: `${BASE_URL}/${locale}/research/${slug}` },
        ]}
      />
      <ResearchDetailClient
        locale={locale}
        article={{
          ...article,
          publishedAt: article.publishedAt?.toISOString() || null,
          createdAt: article.createdAt.toISOString(),
          updatedAt: article.updatedAt.toISOString(),
          viewCount: article.viewCount + 1,
        }}
        relatedArticles={relatedArticles.map(a => ({
          ...a,
          publishedAt: a.publishedAt?.toISOString() || null,
        }))}
      />
    </>
  );
}
