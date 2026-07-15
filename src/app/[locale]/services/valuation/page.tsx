"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Brain, Loader2, Calculator, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";

interface ValuationResult {
  estimatedValue: number;
  sellerPrice: number;
  priceRange: { low: number; high: number };
  confidence: number;
  analysis: string;
  details: { factor: string; impact: string; score: number }[];
}

function formatMoney(value: number): string {
  if (value >= 10000) return `¥${(value / 10000).toFixed(1)}万`;
  return `¥${value.toLocaleString()}`;
}

const CATEGORIES = ["青储机", "打捆机", "拖拉机", "割草机", "播种机", "收获机", "裹包机", "搂草机", "捡拾机"];

const CONDITIONS = [
  { value: "excellent", label: "优秀" },
  { value: "good", label: "良好" },
  { value: "fair", label: "一般" },
  { value: "poor", label: "较差" },
];

export default function ValuationPage() {
  const t = useTranslations("home");
  const locale = useLocale();
  const [brand, setBrand] = useState("");
  const [modelName, setModelName] = useState("");
  const [category, setCategory] = useState("青储机");
  const [year, setYear] = useState(2020);
  const [hours, setHours] = useState("");
  const [condition, setCondition] = useState("good");
  const [priceCny, setPriceCny] = useState("");
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const doValuation = async () => {
    if (!brand.trim()) { setError("请输入品牌"); return; }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: brand.trim(),
          modelName: modelName.trim() || undefined,
          category,
          year: Number(year),
          workingHours: hours ? Number(hours) : undefined,
          condition,
          priceCny: priceCny ? Number(priceCny) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) setResult(data.data);
      else setError(data.error || "估值失败");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href={`/${locale}/services`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        返回服务首页
      </Link>

      <div className="mb-8">
        <div className="mb-4 inline-flex rounded-lg bg-primary-100 p-3 text-primary-600">
          <Brain className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          AI智能估价
        </h1>
        <p className="mt-2 text-gray-500">
          基于品牌、年份、工时等多维度精准估价，让每一笔交易都有据可依
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
            <input
              value={brand} onChange={(e) => setBrand(e.target.value)}
              placeholder="如: 克拉斯、纽荷兰、约翰迪尔"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">品类</label>
              <select
                value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年份</label>
              <input
                type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
                min={1990} max={2026}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">型号 (可选)</label>
              <input
                value={modelName} onChange={(e) => setModelName(e.target.value)}
                placeholder="如: 970、FR450"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">工时 (可选)</label>
              <input
                type="number" value={hours} onChange={(e) => setHours(e.target.value)}
                placeholder="如: 5000"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">成色</label>
              <select
                value={condition} onChange={(e) => setCondition(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              >
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">卖家报价 (可选)</label>
              <input
                type="number" value={priceCny} onChange={(e) => setPriceCny(e.target.value)}
                placeholder="单位: 元"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={doValuation}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            {loading ? "正在估值..." : "开始AI估价"}
          </button>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 rounded-lg bg-primary-50 p-4">
            <Brain className="h-6 w-6 text-primary-600" />
            <div>
              <div className="text-sm text-primary-600">AI智能估价结果</div>
              <div className="text-xl font-bold text-primary-700">{formatMoney(result.estimatedValue)}</div>
              <div className="text-xs text-primary-500">
                合理区间: {formatMoney(result.priceRange.low)} ~ {formatMoney(result.priceRange.high)}
              </div>
            </div>
          </div>
          {result.sellerPrice > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <span className="text-sm text-gray-500">卖家报价</span>
              <span className="text-sm font-bold text-gray-700">{formatMoney(result.sellerPrice)}</span>
            </div>
          )}
          <div className="text-sm text-gray-600 leading-relaxed">{result.analysis}</div>
          <div className="space-y-2">
            {result.details.slice(0, 4).map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{d.factor}</span>
                <span className="font-medium text-gray-700">{d.impact}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
