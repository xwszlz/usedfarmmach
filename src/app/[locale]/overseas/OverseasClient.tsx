"use client";

/**
 * /overseas 客户端组件 —— 去交易化只读「海外车源 / 急需车源」
 *
 * 复用 benchmark ③ 只读表格形态（品牌 / 机型 / 年份 / 价格 / 地区 / 来源 / 抓取 / 外链）。
 * 严格遵循方案 §3.3 去交易化硬口径：
 *  - 顶部显式标注「第三方在售信息，非本平台库存」；
 *  - 展示第三方挂牌价（原币 + 折算），标注「仅供参考」，**不做平台报价**；
 *  - 每行标注来源站点 + 抓取日期，外链原站（rel="nofollow noopener"）；
 *  - **不含任何卖家联系方式（PII）**；
 *  - 置顶「客户急需车源」区（categorySlug ∈ 急需标签 OR modelName 命中急需关键词）。
 */
import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, RefreshCw, Search, AlertCircle, ExternalLink, Flame } from "lucide-react";

interface SourcedItem {
  id: string;
  source: string;
  sourceUrl: string;
  brandName: string;
  modelName: string;
  displayTitle: string | null;
  brandKey: string | null;
  categorySlug: string | null;
  year: number | null;
  priceRaw: number | null;
  currency: string | null;
  priceCny: number | null;
  location: string;
  scrapedAt: string;
  publishedAt: string | null;
}

interface SourcedResponse {
  ok: boolean;
  error?: string;
  data: {
    items: SourcedItem[];
    urgentItems: SourcedItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    site: string;
    sources: string[];
  };
}

function fmtCny(n: number | null | undefined): string {
  if (n == null) return "—";
  return "¥" + Math.round(n).toLocaleString("zh-CN");
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function FreshBadge({ iso }: { iso: string | null }) {
  const d = daysSince(iso);
  if (d == null) return <span className="text-xs text-gray-400">—</span>;
  if (d <= 7)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
        {Math.round(d)}天前
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
      {Math.round(d)}天前
    </span>
  );
}

function sourceLabel(source: string): string {
  return source.startsWith("domestic") ? source.replace("domestic_", "") : source;
}

/** 只读表格（品牌/机型/年份/价格/地区/来源/抓取/外链）—— 复用 benchmark ③ 形态 */
function ListingTable({
  items,
  t,
}: {
  items: SourcedItem[];
  t: (key: string) => string;
}) {
  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">{t("brand")}</th>
              <th className="px-4 py-3 text-left">{t("model")}</th>
              <th className="px-4 py-3 text-left">{t("year")}</th>
              <th className="px-4 py-3 text-right">{t("priceLabel")}</th>
              <th className="px-4 py-3 text-left">{t("location")}</th>
              <th className="px-4 py-3 text-left">{t("source")}</th>
              <th className="px-4 py-3 text-center">{t("scrapedAt")}</th>
              <th className="px-4 py-3 text-center">{t("viewOriginal")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {it.brandName}
                  {it.brandKey && it.brandKey !== it.brandName.toLowerCase() && (
                    <span className="ml-1 text-xs text-gray-400">{it.brandKey}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate" title={it.displayTitle || it.modelName}>
                  {it.displayTitle || it.modelName}
                </td>
                <td className="px-4 py-3 text-gray-600">{it.year || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-gray-900">{fmtCny(it.priceCny)}</span>
                  {it.currency && it.priceRaw != null && (
                    <span className="ml-1 text-xs text-gray-400">
                      ({it.priceRaw}
                      {it.currency})
                    </span>
                  )}
                  <span className="block text-[11px] text-gray-400">{t("thirdPartyPriceNote")}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{it.location || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{sourceLabel(it.source)}</td>
                <td className="px-4 py-3 text-center">
                  <FreshBadge iso={it.publishedAt || it.scrapedAt} />
                </td>
                <td className="px-4 py-3 text-center">
                  {/^https?:\/\//i.test(it.sourceUrl) ? (
                    <a
                      href={it.sourceUrl}
                      target="_blank"
                      rel="nofollow noopener"
                      className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                      title={it.sourceUrl}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  {t("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OverseasClient({
  initialData,
}: {
  initialData: (SourcedResponse["data"] & { sources: string[] }) | null;
}) {
  const locale = useLocale();
  const t = useTranslations("overseas");

  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SourcedResponse["data"] | null>(initialData);
  const [sources, setSources] = useState<string[]>(initialData?.sources ?? []);

  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (nextPage: number, search: string, src: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", "30");
      if (search) params.set("q", search);
      if (src) params.set("source", src);
      const res = await fetch(`/api/sourced-listings?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("无法获取数据");
      const json = (await res.json()) as SourcedResponse;
      if (!json.ok) throw new Error(json.error || "数据异常");
      setData(json.data);
      setSources(json.data.sources ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      load(1, "", "");
    }
    // 仅首屏：若已有 SSR 数据则不自动拉取；后续由筛选/分页触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearch() {
    setPage(1);
    load(1, q, source);
  }

  function onSourceChange(s: string) {
    setSource(s);
    setPage(1);
    load(1, q, s);
  }

  function onPageChange(p: number) {
    setPage(p);
    load(p, q, source);
  }

  return (
    <div className="space-y-8">
      {/* 标题 + 去交易化口径横幅 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("title")}</h1>
        <p className="text-gray-600 mb-3">{t("subtitle")}</p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{t("disclaimer")}</span>
        </div>
      </div>

      {loading && !data && (
        <div className="border rounded-lg p-8 bg-white shadow-sm text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">正在读取实时数据…</p>
        </div>
      )}

      {error && (
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => onSearch()}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              {t("retry")}
            </button>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* 筛选条 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                placeholder={t("searchPlaceholder")}
                className="w-64 rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={source}
              onChange={(e) => onSourceChange(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">{t("filterAllSources")}</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel(s)}
                </option>
              ))}
            </select>
            <button
              onClick={onSearch}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-md flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t("filter")}
            </button>
          </div>

          {/* 置顶：客户急需车源 */}
          {data.urgentItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Flame className="h-5 w-5 text-red-600" />
                <h2 className="text-xl font-semibold text-gray-900">{t("urgentTitle")}</h2>
                <span className="text-sm text-gray-500">{t("urgentSubtitle")}</span>
              </div>
              <ListingTable items={data.urgentItems} t={t} />
            </section>
          )}

          {/* 常规列表 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{t("title")}</h2>
              <span className="text-sm text-gray-500">
                {t("showing", { count: data.total })}
              </span>
            </div>
            <ListingTable items={data.items} t={t} />
          </section>

          {/* 分页 */}
          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`rounded px-3 py-1 text-sm font-medium ${
                    p === data.page ? "bg-primary-600 text-white" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-gray-400 text-center">
        {locale === "zh"
          ? "数据来源：第三方平台公开挂牌（爬虫采集），实时读取，仅供参考。"
          : "Data source: third-party public listings (crawler-collected), read live, for reference only."}
      </p>
    </div>
  );
}
