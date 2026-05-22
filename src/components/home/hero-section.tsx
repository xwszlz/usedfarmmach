"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ArrowRight, Play, Flame } from "lucide-react";
import { useState } from "react";
import { getImageUrl } from "@/lib/image-url";

interface HeroSectionProps {
  locale: string;
}

// 神雕日报 TOP 1 热门设备
const TOP_PRODUCT = {
  id: "cmpdknl8s00e511kwiy4tzjax",
  name: "东洋 Beet Harvester",
  year: 2018,
  image: "/uploads/products/cmpdknl8s00e511kwiy4tzjax/1.jpg",
};

export function HeroSection({ locale }: HeroSectionProps) {
  const t = useTranslations("home");
  const [showVideo, setShowVideo] = useState(false);

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
            <Link href={`/${locale}/products/${TOP_PRODUCT.id}`}>
              <div className="h-72 w-full overflow-hidden rounded-2xl bg-gray-100 sm:h-80">
                <img
                  src={getImageUrl(TOP_PRODUCT.image)}
                  alt={TOP_PRODUCT.name}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
                {/* TOP 1 badge */}
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                  <Flame className="h-3 w-3" />
                  {locale === "zh" ? "日报 TOP 1" : "Daily Top 1"}
                </div>
                {/* Product info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-sm font-semibold text-white">{TOP_PRODUCT.name}</p>
                  <p className="text-xs text-white/80">{TOP_PRODUCT.year}年</p>
                </div>
              </div>
            </Link>
            {/* Floating arbitrage card */}
            <Card className="absolute -bottom-4 -right-4 w-64 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-accent-600">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm font-semibold">
                    {t("arbitrageCardTitle")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {t("arbitrageCardDesc")}
                </p>
                <Link href={`/${locale}/products`}>
                  <span className="mt-2 inline-block text-xs font-medium text-primary-600 hover:underline">
                    {t("arbitrageCardCta")} →
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
              ✕ 关闭
            </button>
            <video
              controls
              autoPlay
              className="w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <source src="/videos/intro.mp4" type="video/mp4" />
              您的浏览器不支持视频播放。
            </video>
          </div>
        </div>
      )}
    </section>
  );
}
