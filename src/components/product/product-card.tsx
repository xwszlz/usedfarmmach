"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { MapPin, Clock, Play, ShieldCheck, Ship } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArbitrageBadge } from "./arbitrage-badge";
import { PriceDisplay } from "./price-display";
import { calculateArbitragePercent } from "@/lib/utils";
import { getImageUrl, generateImageAlt } from "@/lib/image-url";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  locale: string;
}

/** Build the card title per locale specification */
function buildCardTitle(product: Product, locale: string): string {
  // Resolve brand name by locale
  const brandName =
    locale === "zh"
      ? product.brand?.nameZh
      : locale === "ru"
        ? (product.brand as any)?.nameRu || product.brand?.nameEn
        : product.brand?.nameEn;

  if (locale === "zh") {
    // Chinese: keep existing format — just show modelName
    return product.modelName;
  }

  // English (and fallback): "Used [Brand] [Model] | [HP] HP | [Year] Year"
  const hpPart = product.enginePower ? `${product.enginePower} HP` : null;
  const yearPart = `${product.year} Year`;
  const brandModel = `Used ${brandName || ""} ${product.modelName}`.trim();

  const parts = [brandModel];
  if (hpPart) parts.push(hpPart);
  parts.push(yearPart);

  return parts.join(" | ");
}

/** Build the price line per mode */
function buildPriceLine(
  product: Product,
  locale: string
): { primary: string; secondary: string | null } | null {
  const priceMode = (product as any).priceMode || "por";

  if (locale === "zh") {
    // Chinese: keep existing behavior — let PriceDisplay handle it
    return null; // signal to use existing PriceDisplay
  }

  if (priceMode === "por") {
    return { primary: "Contact for Price", secondary: null };
  }

  // Fixed price mode
  const tradePort = (product as any).tradePort || "China Port";
  const tradeTerm = (product as any).tradeTerm || "FOB";

  if (product.priceUsd) {
    return {
      primary: `USD ${product.priceUsd.toLocaleString("en-US")} ${tradeTerm} ${tradePort}`,
      secondary: `≈ ¥${product.priceCny.toLocaleString("zh-CN")}`,
    };
  }

  return {
    primary: `¥${product.priceCny.toLocaleString("zh-CN")} ${tradeTerm} ${tradePort}`,
    secondary: null,
  };
}

export function ProductCard({ product, locale }: ProductCardProps) {
  const t = useTranslations("products.card");
  const td = useTranslations("products.detail");

  const brandName = (locale === "zh" ? product.brand?.nameZh : locale === "ru" ? (product.brand as any)?.nameRu || product.brand?.nameEn : product.brand?.nameEn);
  const categoryName = (locale === "zh" ? product.category?.nameZh : locale === "ru" ? (product.category as any)?.nameRu || product.category?.nameEn : product.category?.nameEn);
  const baseImageUrl = getImageUrl(product.images?.[0]?.url);
  // 为特定产品添加缓存破坏参数，强制刷新图片
  // 注意：getImageUrl() 已经包含 query string (?x-oss-process=...)，追加参数必须用 &
  const cacheBusterMap: Record<string, string> = {
    // 东洋甜菜机
    'cmpdknl8s00e511kwiy4tzjax': '&v=20260605',
    // 克拉斯860
    'cmpdknii2000111kwcau06hey': '&v=20260605',
    // 约翰迪尔7250
    'cmpdknj9v004b11kwqvki68wr': '&v=20260605',
  };
  const cacheBuster = cacheBusterMap[product.id];
  // 如果 URL 已经有 ?x-oss-process 参数，用 & 追加；否则用 ? 开头
  const separator = baseImageUrl.includes('?') ? '&' : '?';
  const primaryImage = cacheBuster ? `${baseImageUrl}${cacheBuster}` : baseImageUrl;

  const arbitrage = calculateArbitragePercent(product.priceCny, product.priceUsd);

  // Use real international price for arbitrage if available
  const intlPrice = (product as any).internationalPrices?.[0] || null;
  const realArbitrage = intlPrice?.priceForeignCny
    ? Math.round(((product.priceCny - intlPrice.priceForeignCny) / intlPrice.priceForeignCny) * 100)
    : arbitrage;
  const conditionLabel = td(`condition${product.condition.charAt(0).toUpperCase() + product.condition.slice(1)}`);

  const cardTitle = buildCardTitle(product, locale);
  const priceLine = buildPriceLine(product, locale);

  return (
    <Link href={`/${locale}/products/${product.id}`}>
      <Card className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg">
        {/* Image */}
        <div className="relative h-48 overflow-hidden bg-gray-100">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={generateImageAlt(brandName, product.modelName, product.year, categoryName, locale, {
                location: product.location || undefined,
                condition: product.condition,
              })}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget;
                // 重试一次（可能是 OSS 偶发超时）
                if (!img.dataset.retried) {
                  img.dataset.retried = '1';
                  img.src = primaryImage + (primaryImage.includes('?') ? '&' : '?') + '_r=' + Date.now();
                } else {
                  // 重试失败，显示占位图
                  img.style.display = 'none';
                }
              }}
            />
          ) : (
            // 无图占位：显示品牌名+品类图标
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <span className="mb-1 text-3xl font-bold text-gray-300">
                {brandName?.charAt(0) || "?"}
              </span>
              <span className="text-xs text-gray-400">
                {locale === "zh" ? "暂无图片" : locale === "ru" ? "Нет фото" : "No Image"}
              </span>
            </div>
          )}
          {realArbitrage !== null && Math.abs(realArbitrage) > 10 && (
            <div className="absolute right-2 top-2">
              <ArbitrageBadge percent={realArbitrage} source={intlPrice?.source} />
            </div>
          )}
          {product.brand?.isImported && (
            <div className="absolute left-2 top-2">
              <Badge variant="default" className="text-xs">
                {locale === "zh" ? "进口" : locale === "ru" ? "Импорт" : "Imported"}
              </Badge>
            </div>
          )}
          {(product as any).videos?.length > 0 && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="secondary" className="flex items-center gap-1 bg-black/60 text-xs text-white hover:bg-black/70">
                <Play className="h-3 w-3" />
                {(product as any).videos.length}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Brand + Model */}
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-medium text-primary-600">
              {brandName}
            </span>
            {categoryName && (
              <span className="text-xs text-gray-400">{categoryName}</span>
            )}
          </div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900 line-clamp-1">
            {cardTitle}
          </h3>

          {/* Year + Hours */}
          <div className="mb-2 flex items-center gap-3 text-xs text-gray-500">
            <span>{t("year", { year: product.year })}</span>
            {product.workingHours && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t("hours", { hours: product.workingHours.toLocaleString() })}
              </span>
            )}
            <Badge variant="outline" className="text-xs">
              {conditionLabel}
            </Badge>
          </div>

          {/* Price */}
          {locale === "zh" ? (
            <PriceDisplay
              priceCny={product.priceCny}
              priceUsd={product.priceUsd}
              locale={locale}
              size="sm"
              showLabel={false}
              internationalPrice={intlPrice}
            />
          ) : priceLine ? (
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-primary-700">
                {priceLine.primary}
              </div>
              {priceLine.secondary && (
                <div className="text-xs text-gray-500">{priceLine.secondary}</div>
              )}
            </div>
          ) : (
            <PriceDisplay
              priceCny={product.priceCny}
              priceUsd={product.priceUsd}
              locale={locale}
              size="sm"
              showLabel={false}
              internationalPrice={intlPrice}
            />
          )}

          {/* Location */}
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
            <MapPin className="h-3 w-3" />
            {product.location}
          </div>

          {/* Status tags */}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {(product as any).auctions?.[0] && (
              <Badge variant="secondary" className="flex items-center gap-0.5 bg-amber-50 text-xs text-amber-600 border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                {locale === "zh" ? "询价中" : "Inquiring"}
                {(product as any).auctions[0].totalBids > 0 && (
                  <span className="ml-0.5 text-amber-700">({(product as any).auctions[0].totalBids})</span>
                )}
              </Badge>
            )}
            {(product as any).videos?.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-0.5 bg-blue-50 text-xs text-blue-600">
                <Play className="h-2.5 w-2.5" />
                {locale === "zh" ? "有视频" : "Video"}
              </Badge>
            )}
            {(product as any).tradePort && (
              <Badge variant="secondary" className="flex items-center gap-0.5 bg-green-50 text-xs text-green-600">
                <Ship className="h-2.5 w-2.5" />
                {locale === "zh" ? "可出口" : "Export"}
              </Badge>
            )}
            {product.brand?.isImported && (
              <Badge variant="secondary" className="flex items-center gap-0.5 bg-purple-50 text-xs text-purple-600">
                <ShieldCheck className="h-2.5 w-2.5" />
                {locale === "zh" ? "进口" : locale === "ru" ? "Импорт" : "Imported"}
              </Badge>
            )}
          </div>

          {/* Seller info */}
          {product.seller?.companyName && (
            <div className="mt-2 border-t pt-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {product.seller.companyName}
                {product.seller.country && <span className="text-gray-400">· {product.seller.country}</span>}
              </span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
