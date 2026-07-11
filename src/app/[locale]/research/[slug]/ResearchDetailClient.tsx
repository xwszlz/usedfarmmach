'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface Article {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string | null;
  titleRu: string | null;
  titleEs: string | null;
  titlePt: string | null;
  titleAr: string | null;
  titleFr: string | null;
  titleHi: string | null;
  contentZh: string;
  contentEn: string | null;
  contentRu: string | null;
  contentEs: string | null;
  contentPt: string | null;
  contentAr: string | null;
  contentFr: string | null;
  contentHi: string | null;
  excerptZh: string | null;
  excerptEn: string | null;
  excerptRu: string | null;
  excerptEs: string | null;
  excerptPt: string | null;
  excerptAr: string | null;
  excerptFr: string | null;
  excerptHi: string | null;
  coverImage: string | null;
  category: string | null;
  tags: string | null;
  metaTitle: string | null;
  metaDesc: string | null;
  keywords: string | null;
  publishedAt: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RelatedArticle {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string | null;
  titleRu: string | null;
  titleEs: string | null;
  titlePt: string | null;
  titleAr: string | null;
  titleFr: string | null;
  titleHi: string | null;
  excerptZh: string | null;
  excerptEn: string | null;
  excerptRu: string | null;
  excerptEs: string | null;
  excerptPt: string | null;
  excerptAr: string | null;
  excerptFr: string | null;
  excerptHi: string | null;
  coverImage: string | null;
  category: string | null;
  publishedAt: string | null;
  viewCount: number;
}

const LOCALE_MAP: Record<string, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  pt: 'pt-BR',
  ar: 'ar-SA',
  fr: 'fr-FR',
  hi: 'hi-IN',
};

function getTitle(article: Article | RelatedArticle, locale: string): string {
  const field = `title${locale.charAt(0).toUpperCase()}${locale.slice(1)}`;
  const val = (article as unknown as Record<string, unknown>)[field];
  if (typeof val === 'string' && val) return val;
  return article.titleZh;
}

function getExcerpt(article: Article | RelatedArticle, locale: string): string {
  const field = `excerpt${locale.charAt(0).toUpperCase()}${locale.slice(1)}`;
  const val = (article as unknown as Record<string, unknown>)[field];
  if (typeof val === 'string' && val) return val;
  return article.excerptZh || '';
}

function getContent(article: Article, locale: string): string {
  const field = `content${locale.charAt(0).toUpperCase()}${locale.slice(1)}`;
  const val = (article as unknown as Record<string, unknown>)[field];
  if (typeof val === 'string' && val) return val;
  return article.contentZh;
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(LOCALE_MAP[locale] || 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ResearchDetailClient({
  locale,
  article,
  relatedArticles,
}: {
  locale: string;
  article: Article;
  relatedArticles: RelatedArticle[];
}) {
  const t = useTranslations('research');
  const tn = useTranslations('nav');
  const content = getContent(article, locale);

  const tags = (() => {
    const parsed = article.tags ? JSON.parse(article.tags) : [];
    return Array.isArray(parsed) ? parsed : [];
  })();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Breadcrumb */}
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/${locale}`} className="hover:text-blue-600 dark:hover:text-blue-400">{tn('home')}</Link>
            <span>/</span>
            <Link href={`/${locale}/research`} className="hover:text-blue-600 dark:hover:text-blue-400">{t('title')}</Link>
            <span>/</span>
            <span className="text-foreground truncate max-w-xs">{getTitle(article, locale)}</span>
          </div>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <header className="mb-8">
          {article.category && (
            <span className="inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-sm px-3 py-1 rounded-full mb-4 font-medium">
              {t(`categories.${article.category}`)}
            </span>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {getTitle(article, locale)}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{t('publishedOn', { date: formatDate(article.publishedAt, locale) })}</span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {t('viewCount', { count: article.viewCount })}
            </span>
          </div>
        </header>

        {/* Cover Image */}
        {article.coverImage && (
          <div className="mb-8 rounded-xl overflow-hidden">
            <img src={article.coverImage} alt={getTitle(article, locale)} className="w-full h-auto max-h-96 object-cover" />
          </div>
        )}

        {/* Content - HTML rendered directly */}
        <div
          className="prose prose-lg max-w-none bg-card text-card-foreground rounded-xl shadow-lg p-8 md:p-10 dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-foreground prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-950/30"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground mr-2">Tags:</span>
            {tags.map((tag: string, i: number) => (
              <span key={i} className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Back to Hub */}
        <div className="mt-8">
          <Link
            href={`/${locale}/research`}
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
          >
            {t('backToHub')}
          </Link>
        </div>

        {/* CTA: AI Arena */}
        <div className="mt-10 p-6 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black rounded-xl text-white text-center">
          <p className="text-lg font-medium">
            <Link href={`/${locale}/arena`} className="hover:underline">
              {t('tryArena')}
            </Link>
          </p>
        </div>
      </article>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">{t('relatedReports')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedArticles.map((related) => (
              <Link
                key={related.id}
                href={`/${locale}/research/${related.slug}`}
                className="bg-card text-card-foreground rounded-xl shadow hover:shadow-lg transition-shadow overflow-hidden border border-border"
              >
                <div className="h-36 relative">
                  {related.coverImage ? (
                    <img src={related.coverImage} alt={getTitle(related, locale)} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                      <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  {related.category && (
                    <span className="absolute top-2 left-2 bg-blue-600/90 text-white text-xs px-2 py-0.5 rounded-full">
                      {t(`categories.${related.category}`)}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-sm text-foreground line-clamp-2">{getTitle(related, locale)}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(related.publishedAt, locale)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
