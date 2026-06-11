import type { Metadata } from 'next';
import { generatePageMetadata } from '@/lib/seo-metadata';
import BlogListClient from './BlogListClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("blog", locale, {
    alternates: {
      canonical: `${BASE_URL}/${locale}/blog`,
    },
  });
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  return <BlogListClient locale={locale} initialCategory={sp.category} />;
}
