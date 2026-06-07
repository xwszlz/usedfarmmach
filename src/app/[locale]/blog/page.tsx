import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import BlogListClient from './BlogListClient';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const brand = locale === 'ru' ? 'UsedFarmMach' : locale === 'en' ? 'UsedFarmMach' : '神雕农机';
  return {
    title: `${t('title')} | ${brand} | UsedFarmMach`,
    description: t('subtitle'),
  };
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  return <BlogListClient locale={locale} initialCategory={sp.category} />;
}
