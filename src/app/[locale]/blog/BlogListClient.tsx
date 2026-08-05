'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface Article {
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
  tags: string | null;
  sourcePlatform?: string | null;
  publishedAt: string | null;
  viewCount: number;
}

const CATEGORIES = ['all', 'market-analysis', 'price-guide', 'brand-review', 'industry-news', 'buying-guide'];

function getTitle(article: Article, locale: string): string {
  if (locale === 'en' && article.titleEn) return article.titleEn;
  if (locale === 'ru' && article.titleRu) return article.titleRu;
  return article.titleZh;
}

function getExcerpt(article: Article, locale: string): string {
  if (locale === 'en' && article.excerptEn) return article.excerptEn;
  if (locale === 'ru' && article.excerptRu) return article.excerptRu;
  return article.excerptZh || '';
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

interface Props {
  locale: string;
  initialCategory?: string;
  initialArticles?: Article[];
  initialTotal?: number;
  initialTotalPages?: number;
}

export default function BlogListClient({
  locale,
  initialCategory,
  initialArticles = [],
  initialTotal = 0,
  initialTotalPages = 1,
}: Props) {
  const t = useTranslations('blog');
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [loading, setLoading] = useState(initialArticles.length === 0);
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [total, setTotal] = useState(initialTotal);
  const [seoHydrated, setSeoHydrated] = useState(initialArticles.length > 0);

  // Client-side fetch for filtering/pagination (supplements SSR initial data)
  useEffect(() => {
    // Skip first render if we already have SSR data for the current filter
    if (seoHydrated && page === 1 && activeCategory === (initialCategory || 'all')) {
      return;
    }

    async function fetchArticles() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: 'published',
          page: page.toString(),
          limit: '12',
          lang: locale,
        });
        if (activeCategory !== 'all') params.set('category', activeCategory);

        const res = await fetch(`/api/articles?${params}`);
        const data = await res.json();
        setArticles(data.articles || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        console.error('Failed to fetch articles:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [activeCategory, page, locale, initialCategory, seoHydrated]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl text-green-100">{t('subtitle')}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setPage(1); setSeoHydrated(false); }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-green-700 text-white'
                  : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200'
              }`}
            >
              {t(`categories.${cat}`)}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-gray-500 mb-6">{t('recentPosts')} ({total})</p>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow animate-pulse">
                <div className="h-48 bg-gray-200 rounded-t-lg" />
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Article Grid */}
        {!loading && articles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/${locale}/blog/${article.slug}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden group"
              >
                {/* Cover Image */}
                <div className="h-48 bg-gray-200 relative overflow-hidden">
                  {article.coverImage ? (
                    <img
                      src={article.coverImage}
                      alt={getTitle(article, locale)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-green-50">
                      <svg className="w-16 h-16 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                  )}
                  {/* Category Badge */}
                  {article.category && (
                    <span className="absolute top-3 left-3 bg-green-700 text-white text-xs px-2 py-1 rounded-full">
                      {t(`categories.${article.category}`)}
                    </span>
                  )}
                </div>
                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-green-700 transition-colors">
                    {getTitle(article, locale)}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {getExcerpt(article, locale)}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{formatDate(article.publishedAt, locale)}</span>
                    <span>{t('viewCount', { count: article.viewCount })}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && articles.length === 0 && (
          <div className="text-center py-20">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <p className="text-gray-400 text-lg">{t('noPosts')}</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              ←
            </button>
            <span className="text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
