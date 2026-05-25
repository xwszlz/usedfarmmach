import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { ProductCarousel } from "@/components/product/product-carousel";
import { PriceDisplay } from "@/components/product/price-display";
import { InquiryForm } from "@/components/product/inquiry-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Calendar, Wrench, ArrowLeftRight, ExternalLink, Info } from "lucide-react";
import { getImageUrl, getVideoUrl } from "@/lib/image-url";
import { formatPrice } from "@/lib/utils";
import ArbitrageCalculatorSection from "@/components/product/arbitrage-calculator-section";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("products.detail");

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      brand: true,
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      videos: { orderBy: { sortOrder: "asc" } },
      internationalPrices: { orderBy: { sourceDate: "desc" } },
      seller: { select: { id: true, companyName: true, country: true } },
    },
  });

  if (!product || product.status !== "active") {
    notFound();
  }

  const brandName = locale === "zh" ? product.brand.nameZh : locale === "ru" ? (product.brand as any).nameRu || product.brand.nameEn : product.brand.nameEn;
  const categoryName = locale === "zh" ? product.category.nameZh : locale === "ru" ? (product.category as any).nameRu || product.category.nameEn : product.category.nameEn;
  const description = locale === "zh" ? product.descriptionZh : locale === "ru" ? (product as any).descriptionRu || product.descriptionEn : product.descriptionEn;
  const conditionLabel = t(`condition${product.condition.charAt(0).toUpperCase() + product.condition.slice(1)}`);

  // Use real international price from 神雕日报 if available, fallback to simple USD conversion
  const latestIntlPrice = product.internationalPrices[0] || null;
  const intlPriceCny = latestIntlPrice?.priceForeignCny || null;
  const intlPriceRaw = latestIntlPrice?.priceForeignRaw || null;
  const intlCurrency = latestIntlPrice?.currency || "USD";
  const intlSource = latestIntlPrice?.source || null;
  const intlSourceDate = latestIntlPrice?.sourceDate || null;
  const intlCountry = latestIntlPrice?.country || null;

  // Calculate arbitrage based on real international price
  const arbitragePercent = intlPriceCny && intlPriceCny > 0
    ? Math.round(((product.priceCny - intlPriceCny) / intlPriceCny) * 100)
    : null;

  // Format source date for display
  const formattedSourceDate = intlSourceDate
    ? `${intlSourceDate.slice(0, 4)}-${intlSourceDate.slice(4, 6)}-${intlSourceDate.slice(6, 8)}`
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left: Images + Videos */}
        <div className="space-y-4">
          <ProductCarousel images={product.images} alt={product.modelName} />
          {/* Video Player */}
          {product.videos.length > 0 && (
            <div className="space-y-3">
              {product.videos.map((video, idx) => (
                <div key={video.id} className="overflow-hidden rounded-lg bg-black">
                  <video
                    src={getVideoUrl(video.url)}
                    controls
                    className="h-auto w-full"
                    preload="metadata"
                    poster={getImageUrl(product.images[0]?.url)}
                  >
                    <track kind="captions" />
                    {locale === "zh" ? "您的浏览器不支持视频播放" : locale === "ru" ? "Ваш браузер не поддерживает воспроизведение видео" : "Your browser does not support video playback"}
                  </video>
                  {product.videos.length > 1 && (
                    <div className="bg-gray-900 px-3 py-1.5 text-xs text-gray-300">
                      {locale === "zh" ? `视频` : locale === "ru" ? "Видео" : "Video"} {idx + 1}/{product.videos.length}
                      {video.title && ` — ${video.title}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Details */}
        <div className="space-y-6">
          {/* Title area */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default">{brandName}</Badge>
              <Badge variant="secondary">{categoryName}</Badge>
              {product.brand.isImported && (
                <Badge variant="accent">
                  {locale === "zh" ? "进口品牌" : locale === "ru" ? "Импортный бренд" : "Imported"}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {brandName} {product.modelName}
            </h1>
          </div>

          {/* Specs */}
          <Card>
            <CardHeader>
              <CardTitle>{t("specs")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">{t("brand")}</p>
                    <p className="text-sm font-medium">{brandName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">{t("year")}</p>
                    <p className="text-sm font-medium">{product.year}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">{t("workingHours")}</p>
                    <p className="text-sm font-medium">
                      {product.workingHours?.toLocaleString() || "-"} {locale === "zh" ? "小时" : locale === "ru" ? "моточасов" : "hrs"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">{t("location")}</p>
                    <p className="text-sm font-medium">{product.location}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Badge
                  variant={
                    product.condition === "excellent"
                      ? "success"
                      : product.condition === "good"
                        ? "default"
                        : product.condition === "fair"
                          ? "warning"
                          : "destructive"
                  }
                >
                  {conditionLabel}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Price Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                {t("priceComparison")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* 中国市场价 */}
                <div className="rounded-lg bg-primary-50 p-4 text-center">
                  <p className="text-xs text-gray-500">{t("chinaMarketPrice")}</p>
                  <p className="text-xl font-bold text-primary-700">
                    {formatPrice(product.priceCny, "cny")}
                  </p>
                </div>
                {/* 国外市场价 - 来自神雕日报 */}
                <div className="rounded-lg bg-blue-50 p-4 text-center">
                  <p className="text-xs text-gray-500">{t("usMarketPrice")}</p>
                  {intlPriceCny ? (
                    <>
                      <p className="text-xl font-bold text-blue-700">
                        {formatPrice(intlPriceCny, "cny")}
                      </p>
                      {intlPriceRaw && (
                        <p className="mt-0.5 text-xs text-blue-500">
                          {intlCurrency === "EUR" ? "€" : "$"}{intlPriceRaw.toLocaleString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xl font-bold text-gray-400">-</p>
                  )}
                </div>
              </div>

              {/* 国外市场价数据来源标注 */}
              {latestIntlPrice && (
                <div className="mt-2 flex items-center justify-center gap-1 text-xs text-gray-400">
                  <Info className="h-3 w-3" />
                  <span>
                    {locale === "zh" ? "数据来源" : locale === "ru" ? "Источник" : "Source"}: {intlSource}
                    {intlCountry && ` · ${intlCountry}`}
                    {formattedSourceDate && ` · ${formattedSourceDate}`}
                  </span>
                </div>
              )}

              {/* 套利空间显示 */}
              {arbitragePercent !== null && (
                <div className="mt-3 rounded-lg bg-accent-50 p-3 text-center">
                  <p className="text-sm font-medium text-accent-700">
                    {t("priceDifference")}: {arbitragePercent > 0 ? "+" : ""}
                    {arbitragePercent}%
                    {Math.abs(arbitragePercent) > 15 && (
                      <span className="ml-2">
                        ({t("arbitrageOpportunity")}!)
                      </span>
                    )}
                  </p>
                  {latestIntlPrice && latestIntlPrice.notes && (
                    <p className="mt-1 text-xs text-accent-600/70">
                      {latestIntlPrice.notes}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Arbitrage Calculator */}
          {arbitragePercent !== null && latestIntlPrice && (
            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>跨境套利计算器</CardTitle>
                </CardHeader>
                <CardContent>
                  <ArbitrageCalculatorSection
                    productId={product.id}
                    domesticPrice={product.priceCny}
                    foreignPrice={latestIntlPrice.priceForeignRaw || undefined}
                    foreignCurrency={latestIntlPrice.currency as any}
                    showForeignPrice={true}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Inquiry */}
          <InquiryForm productId={product.id} />
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>{t("description")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-gray-600">{description}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
