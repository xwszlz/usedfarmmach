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
  tags: string | null;
  publishedAt: string | null;
  viewCount: number;
}

const RESEARCH_TABS = [
  'all',
  'research-industry-report',
  'research-tech-frontier',
  'research-policy-tracking',
  'research-company-map',
];

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

function getTitle(article: Article, locale: string): string {
  const field = `title${locale.charAt(0).toUpperCase()}${locale.slice(1)}` as keyof Article;
  const val = article[field];
  if (typeof val === 'string' && val) return val;
  return article.titleZh;
}

function getExcerpt(article: Article, locale: string): string {
  const field = `excerpt${locale.charAt(0).toUpperCase()}${locale.slice(1)}` as keyof Article;
  const val = article[field];
  if (typeof val === 'string' && val) return val;
  return article.excerptZh || '';
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

interface Props {
  locale: string;
  initialCategory?: string;
  initialArticles?: Article[];
  initialTotal?: number;
  initialTotalPages?: number;
}

export default function ResearchListClient({
  locale,
  initialCategory,
  initialArticles = [],
  initialTotal = 0,
  initialTotalPages = 1,
}: Props) {
  const t = useTranslations('research');
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [loading, setLoading] = useState(initialArticles.length === 0);
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [total, setTotal] = useState(initialTotal);
  const [seoHydrated, setSeoHydrated] = useState(initialArticles.length > 0);

  useEffect(() => {
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
        else params.set('category', 'research-');

        const res = await fetch(`/api/articles?${params}`);
        const data = await res.json();
        // For "all" tab, filter to only research- categories client-side
        if (activeCategory === 'all') {
          const filtered = (data.articles || []).filter(
            (a: Article) => a.category && a.category.startsWith('research-')
          );
          setArticles(filtered);
        } else {
          setArticles(data.articles || []);
        }
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        console.error('Failed to fetch research articles:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [activeCategory, page, locale, initialCategory, seoHydrated]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-sm font-medium text-blue-300 uppercase tracking-wider">{t('description')}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl text-slate-300">{t('subtitle')}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Research Dimension Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {RESEARCH_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveCategory(tab); setPage(1); setSeoHydrated(false); }}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeCategory === tab
                  ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-md'
                  : 'bg-card text-card-foreground hover:bg-slate-100 dark:hover:bg-slate-800 border border-border'
              }`}
            >
              {t(`categories.${tab}`)}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-muted-foreground mb-6 text-sm">
          {t('reportCount', { count: total })}
        </p>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card rounded-xl shadow-lg animate-pulse overflow-hidden border border-border">
                <div className="h-56 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800" />
                <div className="p-5">
                  <div className="h-3 bg-muted rounded w-20 mb-3" />
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-full mb-1" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Research Report Grid */}
        {!loading && articles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/${locale}/research/${article.slug}`}
                className="bg-card text-card-foreground rounded-xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group border border-border"
              >
                {/* Cover Image / Gradient Placeholder */}
                <div className="h-56 relative overflow-hidden">
                  {article.coverImage ? (
                    <img
                      src={article.coverImage}
                      alt={getTitle(article, locale)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex items-center justify-center">
                      <svg className="w-16 h-16 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Research Dimension Badge */}
                  {article.category && (
                    <span className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-medium">
                      {t(`categories.${article.category}`)}
                    </span>
                  )}
                </div>
                {/* Content */}
                <div className="p-5">
                  <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {getTitle(article, locale)}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {getExcerpt(article, locale)}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(article.publishedAt, locale)}</span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {t('viewCount', { count: article.viewCount })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && articles.length === 0 && (
          <div className="text-center py-24">
            <svg className="w-20 h-20 text-muted-foreground/50 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-muted-foreground text-lg">{t('noReports')}</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-10">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-card border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
            >
              ←
            </button>
            <span className="text-muted-foreground font-medium">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-card border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
