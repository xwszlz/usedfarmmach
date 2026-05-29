import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrismaClient } from '@prisma/client';
import { Locale } from '../../../../../i18n';
import BlogDetailClient from './BlogDetailClient';

const prisma = new PrismaClient();

interface Props {
  params: { locale: Locale; slug: string };
}

export async function generateMetadata({ params: { locale, slug } }: Props): Promise<Metadata> {
  const article = await prisma.article.findUnique({ where: { slug } });
  if (!article) return { title: 'Article Not Found' };

  const title = locale === 'en' && article.titleEn ? article.titleEn
    : locale === 'ru' && article.titleRu ? article.titleRu
    : article.titleZh;

  return {
    title: `${title} | 神雕农机 | UsedFarmMach`,
    description: article.metaDesc || (locale === 'en' && article.excerptEn ? article.excerptEn
      : locale === 'ru' && article.excerptRu ? article.excerptRu
      : article.excerptZh) || '',
    keywords: article.keywords || '',
  };
}

export default async function BlogDetailPage({ params: { locale, slug } }: Props) {
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
