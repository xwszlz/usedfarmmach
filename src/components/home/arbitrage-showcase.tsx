"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, TrendingUp, Shield, Globe, ChevronDown, Loader2, Calculator } from "lucide-react";

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

export function ArbitrageShowcase() {
  const t = useTranslations("home");
  const locale = useLocale();
  const navT = useTranslations("nav");
  const [arbitrageExpanded, setArbitrageExpanded] = useState(false);
  const [valuationExpanded, setValuationExpanded] = useState(false);

  // 估值表单
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

  const features = [
    {
      icon: Brain,
      title: t("feature1Title"),
      desc: t("feature1Desc"),
      color: "text-primary-600 bg-primary-100",
      isInteractive: true,
    },
    {
      icon: TrendingUp,
      title: t("feature2Title"),
      desc: t("feature2Desc"),
      color: "text-accent-600 bg-accent-100",
      isInteractive: true,
    },
    {
      icon: Shield,
      title: t("feature3Title"),
      desc: t("feature3Desc"),
      color: "text-green-600 bg-green-100",
      isInteractive: false,
    },
    {
      icon: Globe,
      title: t("feature4Title"),
      desc: t("feature4Desc"),
      color: "text-blue-600 bg-blue-100",
      isInteractive: false,
    },
  ];

  return (
    <section id="ai-valuation" className="bg-gray-50 py-16 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("features")}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feat, idx) => {
            const isArbitrage = idx === 1;
            const isValuation = idx === 0;

            return (
              <Card 
                key={idx} 
                className={`border-0 shadow-sm transition-shadow hover:shadow-md ${feat.isInteractive ? 'cursor-pointer' : ''}`}
                onClick={feat.isInteractive ? () => {
                  if (isArbitrage) setArbitrageExpanded(!arbitrageExpanded);
                  if (isValuation) setValuationExpanded(!valuationExpanded);
                } : undefined}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`mb-4 inline-flex rounded-lg p-3 ${feat.color}`}>
                      <feat.icon className="h-6 w-6" />
                    </div>
                    {feat.isInteractive && (
                      <ChevronDown 
                        className={`h-5 w-5 text-gray-400 transition-transform ${
                          (isArbitrage && arbitrageExpanded) || (isValuation && valuationExpanded) ? 'rotate-180' : ''
                        }`} 
                      />
                    )}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-gray-500">{feat.desc}</p>
                  
                  {/* AI估值 - 通用表单 */}
                  {isValuation && valuationExpanded && (
                    <div className="mt-4 space-y-3 border-t pt-4" onClick={(e) => e.stopPropagation()}>
                      {/* 品牌 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">品牌</label>
                        <input
                          value={brand} onChange={(e) => setBrand(e.target.value)}
                          placeholder="如: 克拉斯、纽荷兰、约翰迪尔"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      {/* 品类 + 年份 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">品类</label>
                          <select
                            value={category} onChange={(e) => setCategory(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">年份</label>
                          <input
                            type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
                            min={1990} max={2026}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      {/* 型号 + 工时 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">型号 (可选)</label>
                          <input
                            value={modelName} onChange={(e) => setModelName(e.target.value)}
                            placeholder="如: 970、FR450"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">工时 (可选)</label>
                          <input
                            type="number" value={hours} onChange={(e) => setHours(e.target.value)}
                            placeholder="如: 5000"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      {/* 成色 + 卖家报价 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">成色</label>
                          <select
                            value={condition} onChange={(e) => setCondition(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                          >
                            {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">卖家报价 (可选)</label>
                          <input
                            type="number" value={priceCny} onChange={(e) => setPriceCny(e.target.value)}
                            placeholder="单位: 元"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* 估价按钮 */}
                      <button
                        onClick={doValuation}
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                        {loading ? "正在估值..." : "开始AI估值"}
                      </button>

                      {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</div>
                      )}

                      {/* 估值结果 */}
                      {result && (
                        <div className="space-y-3 rounded-lg bg-gray-50 p-3">
                          <div className="flex items-center gap-2 rounded-lg bg-primary-50 p-3">
                            <Brain className="h-5 w-5 text-primary-600" />
                            <div>
                              <div className="text-xs text-primary-600">AI智能估值</div>
                              <div className="text-lg font-bold text-primary-700">{formatMoney(result.estimatedValue)}</div>
                              <div className="text-xs text-primary-500">
                                合理区间: {formatMoney(result.priceRange.low)} ~ {formatMoney(result.priceRange.high)}
                              </div>
                            </div>
                          </div>
                          {result.sellerPrice > 0 && (
                            <div className="flex items-center justify-between rounded-lg bg-white p-3">
                              <span className="text-xs text-gray-500">卖家报价</span>
                              <span className="text-sm font-bold text-gray-700">{formatMoney(result.sellerPrice)}</span>
                            </div>
                          )}
                          <div className="text-xs text-gray-600 leading-relaxed">{result.analysis}</div>
                          <div className="space-y-1">
                            {result.details.slice(0, 4).map((d, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">{d.factor}</span>
                                <span className="font-medium text-gray-700">{d.impact}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 跨境套利展开内容 */}
                  {isArbitrage && arbitrageExpanded && (
                    <div className="mt-4 space-y-2 border-t pt-4" onClick={(e) => e.stopPropagation()}>
                      <Link 
                        href={`/${locale}/arbitrage-calculator`}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600"
                      >
                        {navT("arbitrageCalculator")}
                      </Link>
                      <Link 
                        href={`/${locale}/arbitrage-top`}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600"
                      >
                        {navT("arbitrageTop")}
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
