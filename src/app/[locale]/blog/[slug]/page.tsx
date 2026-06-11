import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrismaClient } from '@prisma/client';
import BlogDetailClient from './BlogDetailClient';
import { getHreflangLanguages } from "@/components/seo/hreflang-head";

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
    : locale === 'ru' && article.titleRu ? article.titleRu
    : article.titleZh;

  const description = article.metaDesc || (locale === 'en' && article.excerptEn ? article.excerptEn
    : locale === 'ru' && article.excerptRu ? article.excerptRu
    : article.excerptZh) || '';

  const brand = locale === 'zh' ? '神雕农机' : 'AgriTrade';

  return {
    title: `${title} | ${brand}`,
    description: description?.slice(0, 160),
    keywords: article.keywords || '',
    alternates: {
      canonical: `${BASE_URL}/${locale}/blog/${slug}`,
      languages: getHreflangLanguages(`/blog/${slug}`),
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

export default async function BlogDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const article = await prisma.article.findUnique({ where: { slug } });

  if (!article || (article.status !== 'published')) {
    notFound();
  }

  // Increment view count
  await prisma.article.update({
    where: { id: article.id },
    data: { viewCount: { increment: 1 } },
  });

  // Get related articles
  const relatedArticles = await prisma.article.findMany({
    where: {
      status: 'published',
      category: article.category,
      id: { not: article.id },
    },
    orderBy: { publishedAt: 'desc' },
    take: 3,
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
      publishedAt: true,
      viewCount: true,
    },
  });

  return <BlogDetailClient locale={locale} article={{
    ...article,
    publishedAt: article.publishedAt?.toISOString() || null,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    viewCount: article.viewCount + 1,
  }} relatedArticles={relatedArticles.map(a => ({
    ...a,
    publishedAt: a.publishedAt?.toISOString() || null,
  }))} />;
}
