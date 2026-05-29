import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Locale } from '../../../../../i18n';
import BlogListClient from './BlogListClient';

interface Props {
  params: { locale: Locale };
  searchParams: { category?: string; page?: string };
}

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'blog' });
  return {
    title: `${t('title')} | 神雕农机 | UsedFarmMach`,
    description: t('subtitle'),
  };
}

export default async function BlogPage({ params: { locale }, searchParams }: Props) {
  return <BlogListClient locale={locale} initialCategory={searchParams.category} />;
}
