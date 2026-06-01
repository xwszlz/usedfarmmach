"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, TrendingUp, Shield, Globe, ChevronDown, Loader2 } from "lucide-react";
import { DAILY_REPORT_RANKING } from "@/config/daily-report-ranking";

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

export function ArbitrageShowcase() {
  const t = useTranslations("home");
  const locale = useLocale();
  const navT = useTranslations("nav");
  const [arbitrageExpanded, setArbitrageExpanded] = useState(false);
  const [valuationExpanded, setValuationExpanded] = useState(false);
  const [valuationData, setValuationData] = useState<ValuationResult | null>(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState("");

  // 获取TOP1产品ID用于AI估值演示
  const topProduct = DAILY_REPORT_RANKING[0];

  const fetchValuation = async () => {
    if (!topProduct) return;
    setValuationLoading(true);
    setValuationError("");
    try {
      const res = await fetch(`/api/valuation?productId=${topProduct.id}`);
      const data = await res.json();
      if (data.success) {
        setValuationData(data.data);
      } else {
        setValuationError(data.error || "估值失败");
      }
    } catch {
      setValuationError("网络错误");
    } finally {
      setValuationLoading(false);
    }
  };

  useEffect(() => {
    if (valuationExpanded && !valuationData && !valuationLoading) {
      fetchValuation();
    }
  }, [valuationExpanded]);

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
    <section className="bg-gray-50 py-16">
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
                  
                  {/* AI估值展开内容 */}
                  {isValuation && valuationExpanded && (
                    <div className="mt-4 space-y-3 border-t pt-4">
                      {valuationLoading ? (
                        <div className="flex items-center justify-center py-4 text-sm text-gray-400">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          正在估值...
                        </div>
                      ) : valuationError ? (
                        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
                          {valuationError}
                        </div>
                      ) : valuationData ? (
                        <div className="space-y-3">
                          {/* AI估值核心数据 */}
                          <div className="rounded-lg bg-primary-50 p-3">
                            <div className="text-xs text-primary-600">AI智能估值</div>
                            <div className="text-lg font-bold text-primary-700">
                              {formatMoney(valuationData.estimatedValue)}
                            </div>
                            <div className="mt-1 text-xs text-primary-500">
                              合理区间: {formatMoney(valuationData.priceRange.low)} ~ {formatMoney(valuationData.priceRange.high)}
                            </div>
                          </div>
                          {/* 卖家报价对比 */}
                          <div className="rounded-lg bg-gray-50 p-3">
                            <div className="text-xs text-gray-500">卖家报价</div>
                            <div className="text-lg font-bold text-gray-700">
                              {formatMoney(valuationData.sellerPrice)}
                            </div>
                          </div>
                          {/* 估值分析 */}
                          <div className="text-xs text-gray-600 leading-relaxed">
                            {valuationData.analysis}
                          </div>
                          {/* 估值详情 */}
                          <div className="space-y-1">
                            {valuationData.details.slice(0, 3).map((d, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">{d.factor}</span>
                                <span className="font-medium text-gray-700">{d.impact}</span>
                              </div>
                            ))}
                          </div>
                          <Link
                            href={`/${locale}/products/${topProduct?.id}`}
                            className="block rounded-lg bg-primary-600 px-3 py-2 text-center text-xs font-medium text-white transition-colors hover:bg-primary-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            查看完整估价详情 →
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  )}
                  
                  {/* 跨境套利展开内容 */}
                  {isArbitrage && arbitrageExpanded && (
                    <div className="mt-4 space-y-2 border-t pt-4">
                      <Link 
                        href={`/${locale}/arbitrage-calculator`}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {navT("arbitrageCalculator")}
                      </Link>
                      <Link 
                        href={`/${locale}/arbitrage-top`}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600"
                        onClick={(e) => e.stopPropagation()}
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
