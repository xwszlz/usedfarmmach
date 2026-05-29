'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface Article {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string | null;
  titleRu: string | null;
  contentZh: string;
  contentEn: string | null;
  contentRu: string | null;
  excerptZh: string | null;
  excerptEn: string | null;
  excerptRu: string | null;
  coverImage: string | null;
  category: string | null;
  tags: string | null;
  sourcePlatform: string | null;
  sourceUrl: string | null;
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
  excerptZh: string | null;
  excerptEn: string | null;
  excerptRu: string | null;
  coverImage: string | null;
  category: string | null;
  publishedAt: string | null;
  viewCount: number;
}

function getTitle(article: Article | RelatedArticle, locale: string): string {
  if (locale === 'en' && article.titleEn) return article.titleEn;
  if (locale === 'ru' && article.titleRu) return article.titleRu;
  return article.titleZh;
}

function getExcerpt(article: Article | RelatedArticle, locale: string): string {
  if (locale === 'en' && article.excerptEn) return article.excerptEn;
  if (locale === 'ru' && article.excerptRu) return article.excerptRu;
  return article.excerptZh || '';
}

function getContent(article: Article, locale: string): string {
  if (locale === 'en' && article.contentEn) return article.contentEn;
  if (locale === 'ru' && article.contentRu) return article.contentRu;
  return article.contentZh;
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : locale === 'ru' ? 'ru-RU' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Simple markdown-like rendering
function renderContent(content: string): string {
  return content
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold text-gray-900 mt-8 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-10 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-12 mb-6">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-green-500 pl-4 py-2 my-4 bg-green-50 text-gray-700 italic">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    .replace(/^---$/gm, '<hr class="my-8 border-gray-200" />')
    .replace(/\n\n/g, '</p><p class="text-gray-700 leading-relaxed mb-4">')
    .replace(/\n/g, '<br />');
}

export default function BlogDetailClient({
  locale,
  article,
  relatedArticles,
}: {
  locale: string;
  article: Article;
  relatedArticles: RelatedArticle[];
}) {
  const t = useTranslations('blog');
  const content = getContent(article, locale);
  const tags = article.tags ? (typeof article.tags === 'string' ? JSON.parse(article.tags) : article.tags) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href={`/${locale}`} className="hover:text-green-700">首页</Link>
            <span>/</span>
            <Link href={`/${locale}/blog`} className="hover:text-green-700">{t('title')}</Link>
            <span>/</span>
            <span className="text-gray-900 truncate max-w-xs">{getTitle(article, locale)}</span>
          </div>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          {article.category && (
            <span className="inline-block bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full mb-4">
              {t(`categories.${article.category}`)}
            </span>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {getTitle(article, locale)}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{formatDate(article.publishedAt, locale)}</span>
            <span>{t('viewCount', { count: article.viewCount })}</span>
            {article.sourcePlatform && (
              <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                {t('source')}: {article.sourcePlatform}
              </span>
            )}
          </div>
        </header>

        {/* Cover Image */}
        {article.coverImage && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img src={article.coverImage} alt={getTitle(article, locale)} className="w-full" />
          </div>
        )}

        {/* Content */}
        <div
          className="prose prose-lg max-w-none bg-white rounded-lg shadow p-8"
          dangerouslySetInnerHTML={{ __html: renderContent(content) }}
        />

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="text-sm text-gray-500 mr-2">{t('tags')}:</span>
            {tags.map((tag: string, i: number) => (
              <span key={i} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8">
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 text-green-700 hover:text-green-900 font-medium"
          >
            ← {t('backToList')}
          </Link>
        </div>
      </article>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('relatedPosts')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedArticles.map((related) => (
              <Link
                key={related.id}
                href={`/${locale}/blog/${related.slug}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="h-32 bg-gray-200">
                  {related.coverImage ? (
                    <img src={related.coverImage} alt={getTitle(related, locale)} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-green-50 flex items-center justify-center">
                      <svg className="w-10 h-10 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm text-gray-900 line-clamp-2">{getTitle(related, locale)}</h3>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(related.publishedAt, locale)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
