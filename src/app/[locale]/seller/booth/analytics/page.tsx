"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Eye, MessageSquare, Package, BarChart3, ArrowLeft, Star } from "lucide-react";
import Link from "next/link";

interface AnalyticsData {
  booths: { id: string; name: string; hall: string }[];
  totalItems: number;
  totalViews: number;
  totalInquiries: number;
  conversionRate: string;
  topItems: {
    id: string;
    deviceType: string;
    brand: string | null;
    model: string | null;
    viewCount: number;
    inquiryCount: number;
    images: string[];
    conversionRate: string;
  }[];
  inquiryTrend: { date: string; count: number; new: number; contacted: number }[];
  intentStats: Record<string, number>;
  statusStats: Record<string, number>;
  recentInquiries: { createdAt: string; status: string; intent: string | null }[];
}

export default function BoothAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/seller/booth/analytics", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20 text-gray-400">加载中...</div>;
  if (!data) return <div className="py-20 text-center text-gray-500">暂无数据</div>;

  const intentLabels: Record<string, string> = {
    inquiry: "信息咨询",
    purchase: "采购意向",
    agent: "代理合作",
  };

  const statusLabels: Record<string, string> = {
    new: "新询盘",
    contacted: "已联系",
    closed: "已关闭",
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/zh/seller/booth" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />返回展位管理
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          展位数据看板
        </h1>
      </div>

      {/* Stat Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Eye} label="总浏览量" value={data.totalViews} color="blue" />
        <StatCard icon={MessageSquare} label="总询盘数" value={data.totalInquiries} color="green" />
        <StatCard icon={Package} label="展品数量" value={data.totalItems} color="purple" />
        <StatCard icon={TrendingUp} label="询盘转化率" value={`${data.conversionRate}%`} color="orange" />
      </div>

      {/* Top 5 Items */}
      <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <Star className="h-5 w-5 text-yellow-500" />浏览TOP 5 设备
        </h2>
        {data.topItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">暂无数据</p>
        ) : (
          <div className="space-y-3">
            {data.topItems.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-4 rounded-lg border p-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                  {idx + 1}
                </span>
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {item.images?.[0] && <img src={item.images[0]} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {item.brand} {item.model || item.deviceType}
                  </p>
                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{item.viewCount}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{item.inquiryCount}</span>
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />转化率 {item.conversionRate}%</span>
                  </div>
                </div>
                {/* Bar chart visual */}
                <div className="hidden h-8 w-32 items-end gap-0.5 sm:flex">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i}
                      className="flex-1 rounded-t bg-blue-200"
                      style={{ height: `${Math.min(100, (item.viewCount / Math.max(...data.topItems.map(t => t.viewCount), 1)) * (i < (item.viewCount / Math.max(...data.topItems.map(t => t.viewCount), 1) * 20) ? 100 : 0))}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Inquiry Trend */}
      <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold text-gray-900">询盘趋势（近30天）</h2>
        {data.inquiryTrend.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">暂无询盘数据</p>
        ) : (
          <>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {data.inquiryTrend.map(d => {
                const maxCount = Math.max(...data.inquiryTrend.map(t => t.count), 1);
                return (
                  <div key={d.date} className="group relative flex-1" style={{ minWidth: 4 }}>
                    <div className="absolute bottom-0 w-full rounded-t bg-blue-500 transition group-hover:bg-blue-600"
                      style={{ height: `${(d.count / maxCount) * 100}%` }} />
                    <div className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-xs text-white group-hover:block">
                      {d.date}: {d.count}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-400">
              <span>{data.inquiryTrend[0]?.date}</span>
              <span>{data.inquiryTrend[data.inquiryTrend.length - 1]?.date}</span>
            </div>
          </>
        )}
      </section>

      {/* Intent & Status Distribution */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-gray-900">询盘意向分布</h2>
          {Object.keys(data.intentStats).length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.intentStats).map(([intent, count]) => {
                const total = Object.values(data.intentStats).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (count / total * 100).toFixed(0) : 0;
                return (
                  <div key={intent}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">{intentLabels[intent] || intent}</span>
                      <span className="font-medium text-gray-900">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-gray-900">询盘状态分布</h2>
          {Object.keys(data.statusStats).length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.statusStats).map(([status, count]) => {
                const total = Object.values(data.statusStats).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (count / total * 100).toFixed(0) : 0;
                const color = status === "new" ? "bg-green-500" : status === "contacted" ? "bg-blue-500" : "bg-gray-400";
                return (
                  <div key={status}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">{statusLabels[status] || status}</span>
                      <span className="font-medium text-gray-900">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
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
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
