"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Trophy, MapPin, Calendar, Gauge, Zap, ExternalLink, MessageSquare, Sparkles, Globe, Recycle } from "lucide-react";
import type { ArenaCandidate, SixDimScore } from "@/lib/arena/types";

interface CandidateCardProps {
  candidate: ArenaCandidate;
  locale: string;
  isActive?: boolean;
  onClick?: () => void;
}

const DIM_KEYS: { key: keyof SixDimScore; color: string }[] = [
  { key: "costPerformance", color: "bg-indigo-500" },
  { key: "performanceMatch", color: "bg-emerald-500" },
  { key: "brandReputation", color: "bg-amber-500" },
  { key: "partsAvailability", color: "bg-cyan-500" },
  { key: "residualValue", color: "bg-purple-500" },
  { key: "crossBorderFit", color: "bg-rose-500" },
];

// 来源标签配置
const SOURCE_CONFIG: Record<string, { labelKey: string; icon: typeof Recycle; className: string }> = {
  "used": {
    labelKey: "sourceUsed",
    icon: Recycle,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  "showcase-new": {
    labelKey: "sourceNew",
    icon: Sparkles,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  "showcase-used": {
    labelKey: "sourceShowcase",
    icon: Globe,
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

export function CandidateCard({ candidate, locale, isActive, onClick }: CandidateCardProps) {
  const t = useTranslations("arena");
  const { product, scores, rank, source } = candidate;

  const isChampion = rank === 1;
  const rankBg = isChampion
    ? "bg-gradient-to-br from-amber-400 to-yellow-600 text-white"
    : rank === 2
    ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white"
    : rank === 3
    ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white"
    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";

  const imageUrl = product.images?.[0]?.url || "/images/placeholders/tractor.svg";
  const brandName = locale === "zh" ? product.brand?.nameZh : product.brand?.nameEn;
  const categoryName = locale === "zh" ? product.category?.nameZh : product.category?.nameEn;

  const sourceConfig = SOURCE_CONFIG[source] || SOURCE_CONFIG["used"];
  const SourceIcon = sourceConfig.icon;

  // 详情页链接：二手农机→产品页，展品→博览馆
  const detailHref =
    source === "used"
      ? `/${locale}/products/${product.id}`
      : `/${locale}/expo/showroom`;

  const contactHref =
    source === "used"
      ? `/${locale}/products/${product.id}#contact`
      : `/${locale}/expo/showroom`;

  const formatPrice = (price: number) => {
    if (locale === "zh") {
      return `¥${(price / 10000).toFixed(1)}万`;
    }
    return `$${(price / 7.2).toFixed(0)}`;
  };

  // 新机不显示工时
  const showWorkingHours = source !== "showcase-new" && product.workingHours != null;

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:bg-gray-800 ${
        isActive
          ? "border-primary-500 ring-2 ring-primary-500/20"
          : "border-gray-200 dark:border-gray-700"
      } ${onClick ? "cursor-pointer" : ""}`}
    >
      {/* 排名徽章 */}
      <div
        className={`absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-md ${rankBg}`}
      >
        {isChampion ? <Trophy className="h-5 w-5" /> : rank}
      </div>

      {/* 来源标签 */}
      <div className={`absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceConfig.className}`}>
        <SourceIcon className="h-2.5 w-2.5" />
        {t(sourceConfig.labelKey)}
      </div>

      <div className="flex gap-4 pt-7">
        {/* 左侧图片 */}
        <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`${brandName} ${product.modelName}`}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </div>

        {/* 中间信息 */}
        <div className="flex min-w-0 flex-1 flex-col justify-between pr-8">
          <div>
            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {brandName} {product.modelName}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {categoryName}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {product.year}
              </span>
              {showWorkingHours && (
                <span className="flex items-center gap-1">
                  <Gauge className="h-3 w-3" />
                  {product.workingHours.toLocaleString()}h
                </span>
              )}
              {product.enginePower != null && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {product.enginePower}HP
                </span>
              )}
              {product.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {product.location}
                </span>
              )}
            </div>
          </div>

          {/* 价格 */}
          <div className="mt-1 text-base font-bold text-primary-600 dark:text-primary-400">
            {formatPrice(product.priceCny)}
          </div>
        </div>
      </div>

      {/* 底部六维迷你条 */}
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {DIM_KEYS.map(({ key, color }) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${scores[key]}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400">{scores[key]}</span>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="mt-3 flex gap-2">
        <Link
          href={detailHref}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ExternalLink className="h-3 w-3" />
          {t("viewDetail")}
        </Link>
        <Link
          href={contactHref}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
        >
          <MessageSquare className="h-3 w-3" />
          {t("contactSeller")}
        </Link>
      </div>
    </div>
  );
}
