"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, Package, Layers, Play, RefreshCw, BarChart3, Store, Globe } from "lucide-react";
import type {
  ViewsAnalyticsData,
  VideoRankingFilter,
  VideoRankType,
} from "@/types/stats";

interface ViewsAnalyticsClientProps {
  role: string;
  variant?: "admin" | "seller";
}

const POLL_INTERVAL_MS = 30_000;

const VIDEO_TYPE_LABEL: Record<VideoRankType, string> = {
  product: "产品视频",
  field: "地头展现场作业",
};

/**
 * 浏览量看板（客户端）：每 30s 轮询 GET /api/admin/analytics/views。
 * 顶部 4 数字卡（总 PV / 产品总浏览 / 栏目总浏览 / 视频总播放），
 * 中部栏目排行表（含占比），下部视频排行表（全部/产品视频/地头展现场切换）。
 * 风格对齐既有 seller/booth/analytics（Tailwind Card/Table）。
 */
export default function ViewsAnalyticsClient({
  role,
  variant = "admin",
}: ViewsAnalyticsClientProps) {
  const [data, setData] = useState<ViewsAnalyticsData | null>(null);
  const [type, setType] = useState<VideoRankingFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/analytics/views?type=${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data as ViewsAnalyticsData);
        setError("");
      } else {
        setError(json.error || "加载失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLastUpdated(new Date());
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [fetchData]);

  const title =
    variant === "seller" ? "我的浏览量数据" : "网站浏览量总览";
  const subtitle =
    variant === "seller"
      ? "仅展示您自有产品与视频的浏览/播放数据"
      : "全站产品、栏目与视频的浏览/播放累计（每 30 秒自动刷新）";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            {variant === "seller" ? (
              <Store className="h-6 w-6 text-green-600" />
            ) : (
              <Globe className="h-6 w-6 text-blue-600" />
            )}
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          {lastUpdated
            ? `最近更新 ${lastUpdated.toLocaleTimeString("zh-CN")}`
            : "加载中..."}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="py-20 text-center text-gray-400">加载中...</div>
      ) : !data ? (
        <div className="py-20 text-center text-gray-500">暂无数据</div>
      ) : (
        <>
          {/* 4 数字卡 */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={Eye}
              label="总浏览量 (PV)"
              value={data.overview.totalPageViews}
              color="blue"
            />
            <StatCard
              icon={Package}
              label="产品总浏览"
              value={data.overview.totalProductViews}
              color="green"
            />
            <StatCard
              icon={Layers}
              label="栏目总浏览"
              value={data.overview.totalCategoryViews}
              color="purple"
            />
            <StatCard
              icon={Play}
              label="视频总播放"
              value={data.overview.totalVideoPlays}
              color="orange"
            />
          </div>

          {/* 栏目排行 */}
          <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              按栏目排行（Top 10）
              {data.scope === "mine" && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-normal text-green-700">
                  仅我的
                </span>
              )}
            </h2>
            {data.categoryRanking.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">暂无栏目浏览数据</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">栏目</th>
                      <th className="px-3 py-2 text-right font-medium">浏览量</th>
                      <th className="px-3 py-2 font-medium">占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categoryRanking.map((c, idx) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {c.name || "未命名栏目"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                          {c.viewCount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-2 rounded-full bg-blue-500"
                                style={{ width: `${c.ratio}%` }}
                              />
                            </div>
                            <span className="w-10 text-xs text-gray-500">
                              {c.ratio}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 视频排行（类型切换） */}
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-bold text-gray-900">
                <Play className="h-5 w-5 text-orange-500" />
                按视频排行（Top 20）
              </h2>
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
                {(
                  [
                    { key: "all", label: "全部" },
                    { key: "product", label: "产品视频" },
                    { key: "field", label: "地头展现场作业" },
                  ] as { key: VideoRankingFilter; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setType(tab.key)}
                    className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                      type === tab.key
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {data.videoRanking.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">暂无视频播放数据</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">视频标题</th>
                      <th className="px-3 py-2 font-medium">类型</th>
                      <th className="px-3 py-2 text-right font-medium">播放量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.videoRanking.map((v, idx) => (
                      <tr key={`${v.type}-${v.id}`} className="border-b last:border-0">
                        <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {v.title}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              v.type === "product"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-orange-50 text-orange-600"
                            }`}
                          >
                            {VIDEO_TYPE_LABEL[v.type]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                          {v.playCount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className={`mb-2 inline-flex rounded-lg p-2 ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold tabular-nums text-gray-900">
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
