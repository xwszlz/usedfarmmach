"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ArrowRight, Play, Flame } from "lucide-react";
import { useState } from "react";
import { getImageUrl } from "@/lib/image-url";
import type { Product } from "@/types";

interface HeroSectionProps {
  locale: string;
  topProduct: Product | null;
  topReportData: { id: string; rank: number; model: string; price: number; foreignPriceDesc: string; profit: string; margin: string; };
  heroCoverImage?: string;
}

const TOP1_LABELS: Record<string, string> = {
  zh: "日报 TOP 1",
  en: "Daily Top 1",
  ru: "ТОП 1 дня",
};

const CLOSE_LABELS: Record<string, string> = {
  zh: "关闭",
  en: "Close",
  ru: "Закрыть",
};

const VIDEO_ERROR_LABELS: Record<string, string> = {
  zh: "您的浏览器不支持视频播放。",
  en: "Your browser does not support video playback.",
  ru: "Ваш браузер не поддерживает воспроизведение видео.",
};

export function HeroSection({ locale, topProduct, topReportData, heroCoverImage }: HeroSectionProps) {
  const t = useTranslations("home");
  const [showVideo, setShowVideo] = useState(false);

  // 从 topProduct 获取展示数据
  const productName = topProduct
    ? (locale === "zh" ? topProduct.brand?.nameZh : locale === "ru" ? (topProduct.brand as any)?.nameRu || topProduct.brand?.nameEn : topProduct.brand?.nameEn) + " " + topProduct.modelName
    : topReportData.model;
  const productYear = topProduct?.year || null;
  const productImage = heroCoverImage
    || (topProduct?.images?.[0]?.url ? getImageUrl(topProduct.images[0].url) : null);
  const productId = topProduct?.id || topReportData.id;
  const intlPrice = (topProduct as any)?.internationalPrices?.[0] || null;
  const foreignDisplayPrice = intlPrice?.priceForeignCny
    ? `≈¥${Math.round(intlPrice.priceForeignCny / 10000)}万`
    : topReportData.foreignPriceDesc;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-16 sm:px-6 md:flex-row md:py-24 lg:px-8">
        {/* Left: Text + CTA */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mb-8 max-w-xl text-lg text-gray-600">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Link href={`/${locale}/products`}>
              <Button size="lg" className="w-full sm:w-auto">
                {t("heroCta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => setShowVideo(true)}
            >
              <Play className="mr-2 h-4 w-4" />
              {t("heroVideoCta") || "观看介绍视频"}
            </Button>
          </div>
        </div>

        {/* Right: Hero image + Arbitrage card */}
        <div className="flex-1">
          <div className="relative">
            <Link href={`/${locale}/products/${productId}`}>
              <div className="h-72 w-full overflow-hidden rounded-2xl bg-gray-100 sm:h-80">
                {productImage ? (
                  <img
                    src={productImage}
                    alt={productName}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
                    <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {/* TOP 1 badge */}
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                  <Flame className="h-3 w-3" />
                  {TOP1_LABELS[locale] || TOP1_LABELS.en}
                </div>
                {/* Product info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-sm font-semibold text-white">{productName}</p>
                  <p className="text-xs text-white/80">
                    {productYear && `${productYear}${locale === "zh" ? "年" : locale === "ru" ? " г." : ""}`}
                  </p>
                </div>
              </div>
            </Link>
            {/* Floating arbitrage card with real data */}
            <Card className="absolute -bottom-4 -right-4 w-72 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-accent-600">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm font-semibold">
                    {t("arbitrageCardTitle")}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{locale === "zh" ? "神雕报价" : locale === "ru" ? "Цена Shendiao" : "Shendiao Price"}</span>
                    <span className="font-semibold text-gray-900">¥{Math.round(topReportData.price / 10000)}万</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{locale === "zh" ? "国外市场价" : locale === "ru" ? "Зарубежная цена" : "Intl. Market"}</span>
                    <span className="font-semibold text-blue-700">{foreignDisplayPrice}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{locale === "zh" ? "预估毛利" : locale === "ru" ? "Прибыль" : "Est. Profit"}</span>
                    <span className="font-semibold text-green-600">¥{topReportData.profit}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{locale === "zh" ? "毛利率" : locale === "ru" ? "Маржа" : "Margin"}</span>
                    <span className="font-semibold text-green-600">{topReportData.margin}</span>
                  </div>
                </div>
                <Link href={`/${locale}/products/${productId}`}>
                  <span className="mt-2 inline-block text-xs font-medium text-primary-600 hover:underline">
                    {locale === "zh" ? "查看详情" : locale === "ru" ? "Подробнее" : "View Details"} →
                  </span>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {showVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowVideo(false)}
        >
          <div className="relative w-full max-w-4xl">
            <button
              onClick={() => setShowVideo(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              ✕ {CLOSE_LABELS[locale] || CLOSE_LABELS.en}
            </button>
            <video
              controls
              autoPlay
              className="w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <source src="/videos/intro.mp4" type="video/mp4" />
              {VIDEO_ERROR_LABELS[locale] || VIDEO_ERROR_LABELS.en}
            </video>
          </div>
        </div>
      )}
    </section>
  );
}
