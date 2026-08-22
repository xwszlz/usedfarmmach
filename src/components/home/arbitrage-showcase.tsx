"use client";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, TrendingUp, Shield, Globe, ChevronDown, Loader2, Calculator } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
interface ValuationResult {
    estimatedValue: number;
    sellerPrice: number;
    priceRange: {
        low: number;
        high: number;
    };
    confidence: number;
    analysis: string;
    details: {
        factor: string;
        impact: string;
        score: number;
    }[];
}
function formatMoney(value: number): string {
    if (value >= 10000)
        return `¥${(value / 10000).toFixed(1)}万`;
    return `¥${value.toLocaleString()}`;
}
const CATEGORIES = ["\u9752\u50A8\u673A", "\u6253\u6346\u673A", "\u62D6\u62C9\u673A", "\u5272\u8349\u673A", "\u64AD\u79CD\u673A", "\u6536\u83B7\u673A", "\u88F9\u5305\u673A", "\u6402\u8349\u673A", "\u6361\u62FE\u673A"];
function getCONDITIONS(tr: (s: string) => string) {
  return [
    { value: "excellent", label: tr("优秀") },
    { value: "good", label: tr("良好") },
    { value: "fair", label: tr("一般") },
    { value: "poor", label: tr("较差") },
];
}
export function ArbitrageShowcase() {
    const t = useTranslations("home");
    const locale = useLocale();
    const navT = useTranslations("nav");
    const [arbitrageExpanded, setArbitrageExpanded] = useState(false);
    const [valuationExpanded, setValuationExpanded] = useState(false);
    // 估值表单
    const [brand, setBrand] = useState("");
    const [modelName, setModelName] = useState("");
    const [category, setCategory] = useState("\u9752\u50A8\u673A");
    const [year, setYear] = useState(2020);
    const [hours, setHours] = useState("");
    const [condition, setCondition] = useState("good");
    const [priceCny, setPriceCny] = useState("");
    const [result, setResult] = useState<ValuationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const doValuation = async () => {
        if (!brand.trim()) {
            setError("\u8BF7\u8F93\u5165\u54C1\u724C");
            return;
        }
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
            if (data.success)
                setResult(data.data);
            else
                setError(data.error || "\u4F30\u503C\u5931\u8D25");
        }
        catch {
            setError("\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5");
        }
        finally {
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
    return (<section id="ai-valuation" className="bg-gray-50 py-16 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("features")}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feat, idx) => {
  const tr = useTr();
            const isArbitrage = idx === 1;
            const isValuation = idx === 0;
            return (<Card key={idx} className={`border-0 shadow-sm transition-shadow hover:shadow-md ${feat.isInteractive ? "cursor-pointer" : ""}`} onClick={feat.isInteractive ? () => {
                    if (isArbitrage)
                        setArbitrageExpanded(!arbitrageExpanded);
                    if (isValuation)
                        setValuationExpanded(!valuationExpanded);
                } : undefined}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`mb-4 inline-flex rounded-lg p-3 ${feat.color}`}>
                      <feat.icon className="h-6 w-6"/>
                    </div>
                    {feat.isInteractive && (<ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${(isArbitrage && arbitrageExpanded) || (isValuation && valuationExpanded) ? "rotate-180" : ""}`}/>)}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-gray-500">{feat.desc}</p>
                  
                  {/* AI估值 - 通用表单 */}
                  {isValuation && valuationExpanded && (<div className="mt-4 space-y-3 border-t pt-4" onClick={(e) => e.stopPropagation()}>
                      {/* 品牌 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{tr("品牌")}</label>
                        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={tr("如: 克拉斯、纽荷兰、约翰迪尔")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"/>
                      </div>
                      {/* 品类 + 年份 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{tr("品类")}</label>
                          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none">
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{tr("年份")}</label>
                          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min={1990} max={2026} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"/>
                        </div>
                      </div>
                      {/* 型号 + 工时 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{tr("型号 (可选)")}</label>
                          <input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder={tr("如: 970、FR450")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"/>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{tr("工时 (可选)")}</label>
                          <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder={tr("如: 5000")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"/>
                        </div>
                      </div>
                      {/* 成色 + 卖家报价 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{tr("成色")}</label>
                          <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none">
                            {getCONDITIONS(tr).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{tr("卖家报价 (可选)")}</label>
                          <input type="number" value={priceCny} onChange={(e) => setPriceCny(e.target.value)} placeholder={tr("单位: 元")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"/>
                        </div>
                      </div>

                      {/* 估价按钮 */}
                      <button onClick={doValuation} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Calculator className="h-4 w-4"/>}
                        {loading ? "\u6B63\u5728\u4F30\u503C..." : "\u5F00\u59CBAI\u4F30\u503C"}
                      </button>

                      {error && (<div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</div>)}

                      {/* 估值结果 */}
                      {result && (<div className="space-y-3 rounded-lg bg-gray-50 p-3">
                          <div className="flex items-center gap-2 rounded-lg bg-primary-50 p-3">
                            <Brain className="h-5 w-5 text-primary-600"/>
                            <div>
                              <div className="text-xs text-primary-600">{tr("AI智能估值")}</div>
                              <div className="text-lg font-bold text-primary-700">{formatMoney(result.estimatedValue)}</div>
                              <div className="text-xs text-primary-500">{tr("合理区间:")}{formatMoney(result.priceRange.low)} ~ {formatMoney(result.priceRange.high)}
                              </div>
                            </div>
                          </div>
                          {result.sellerPrice > 0 && (<div className="flex items-center justify-between rounded-lg bg-white p-3">
                              <span className="text-xs text-gray-500">{tr("卖家报价")}</span>
                              <span className="text-sm font-bold text-gray-700">{formatMoney(result.sellerPrice)}</span>
                            </div>)}
                          <div className="text-xs text-gray-600 leading-relaxed">{result.analysis}</div>
                          <div className="space-y-1">
                            {result.details.slice(0, 4).map((d, i) => (<div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">{d.factor}</span>
                                <span className="font-medium text-gray-700">{d.impact}</span>
                              </div>))}
                          </div>
                        </div>)}
                    </div>)}
                  
                  {/* 跨境套利展开内容 */}
                  {isArbitrage && arbitrageExpanded && (<div className="mt-4 space-y-2 border-t pt-4" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/${locale}/arbitrage-calculator`} className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600">
                        {navT("arbitrageCalculator")}
                      </Link>
                      <Link href={`/${locale}/arbitrage-top`} className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600">
                        {navT("arbitrageTop")}
                      </Link>
                    </div>)}
                </CardContent>
              </Card>);
        })}
        </div>
      </div>
    </section>);
}
