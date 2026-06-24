import Link from "next/link";
import { useTranslations } from "next-intl";
import { MapPin, Clock, Play } from "lucide-react";
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

  return (
    <Link href={`/${locale}/products/${product.id}`}>
      <Card className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg">
        {/* Image */}
        <div className="relative h-48 overflow-hidden bg-gray-100">
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
              }
            }}
          />
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
            {product.modelName}
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
          <PriceDisplay
            priceCny={product.priceCny}
            priceUsd={product.priceUsd}
            locale={locale}
            size="sm"
            showLabel={false}
            internationalPrice={intlPrice}
          />

          {/* Location */}
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
            <MapPin className="h-3 w-3" />
            {product.location}
          </div>
        </div>
      </Card>
    </Link>
  );
}
