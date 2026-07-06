import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { ImageGallery } from "@/components/product/image-gallery";
import { SpecificationTable } from "@/components/product/specification-table";
import { PriceTradeSection } from "@/components/product/price-trade-section";
import { StandardDescription } from "@/components/product/standard-description";
import { InquiryForm } from "@/components/product/inquiry-form";
import { EscrowPurchaseButton } from "@/components/escrow/escrow-purchase-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ArrowLeftRight, Info, Mail, ExternalLink } from "lucide-react";
import { getImageUrl, getVideoUrl, generateImageAlt } from "@/lib/image-url";
import { formatPrice } from "@/lib/utils";
import ArbitrageCalculatorSection from "@/components/product/arbitrage-calculator-section";
import { QuickContact } from "@/components/product/quick-contact";
import { BuyIntentButton } from "@/components/product/buy-intent-button";
import { ValuationCard } from "@/components/valuation/valuation-card";
import DeepAnalysisCard from "@/components/product/deep-analysis-card";
import { DAILY_REPORT_RANKING } from "@/config/daily-report-ranking";
import { getHreflangLanguages } from "@/components/seo/hreflang-head";
import { ProductStructuredData, BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { FloatingChat } from "@/components/chat/floating-chat";
import { MachineryIdentityCard } from "@/components/machinery/machinery-identity-card";
import { InspectionReportCard } from "@/components/inspection/inspection-report-card";
import { FavoriteButton } from "@/components/favorite/favorite-button";
import { SellerTrustCard } from "@/components/seller/seller-trust-card";
import BlockchainTrace from "@/components/blockchain/blockchain-trace";
import Link from "next/link";
import { Wrench } from "lucide-react";

export const revalidate = 300;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      modelName: true,
      year: true,
      brand: { select: { nameZh: true, nameEn: true } },
      category: { select: { nameZh: true, nameEn: true } },
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      descriptionZh: true,
      descriptionEn: true,
    },
  });

  if (!product) {
    return { title: "产品未找到" };
  }

  const brandName = locale === "zh" ? product.brand.nameZh : product.brand.nameEn;
  const categoryName = locale === "zh" ? product.category.nameZh : product.category.nameEn;
  const imgUrl = product.images[0] ? getImageUrl(product.images[0].url) : null;

  const titleMap: Record<string, string> = {
    zh: `${brandName} ${product.modelName} ${product.year}款二手${categoryName}_价格_神雕农机`,
    en: `${brandName} ${product.modelName} ${product.year} Used ${categoryName} | Price & Specs | AgriTrade`,
    ru: `${brandName} ${product.modelName} ${product.year} Подержанный ${categoryName} | Цена | AgriTrade`,
    es: `${brandName} ${product.modelName} ${product.year} ${categoryName} Usado | Precio | AgriTrade`,
    pt: `${brandName} ${product.modelName} ${product.year} ${categoryName} Usado | Preço | AgriTrade`,
    ar: `${brandName} ${product.modelName} ${product.year} ${categoryName} مستعمل | السعر | AgriTrade`,
    fr: `${brandName} ${product.modelName} ${product.year} ${categoryName} d'Occasion | Prix | AgriTrade`,
    hi: `${brandName} ${product.modelName} ${product.year} प्रयुक्त ${categoryName} | मूल्य | AgriTrade`,
  };

  const descMap: Record<string, string> = {
    zh: `${brandName} ${product.modelName} ${product.year}款二手${categoryName}。神雕农机全球平台，AI智能估价，真实跨境价格对比，中美汇率价差分析。`,
    en: `${brandName} ${product.modelName} ${product.year} used ${categoryName}. Browse on AgriTrade — AI valuation, cross-border price comparison, real arbitrage analysis.`,
    ru: `${brandName} ${product.modelName} ${product.year} подержанный ${categoryName}. AgriTrade — AI оценка, сравнение цен, арбитражный анализ.`,
    es: `${brandName} ${product.modelName} ${product.year} ${categoryName} usado. Explore en AgriTrade — valoración IA, comparación de precios, análisis de arbitraje.`,
    pt: `${brandName} ${product.modelName} ${product.year} ${categoryName} usado. AgriTrade — avaliação IA, comparação de preços, análise de arbitragem.`,
    ar: `${brandName} ${product.modelName} ${product.year} ${categoryName} مستعمل. AgriTrade — تقييم بالذكاء الاصطناعي، مقارنة أسعار، تحليل المراجحة.`,
    fr: `${brandName} ${product.modelName} ${product.year} ${categoryName} d'occasion. AgriTrade — évaluation IA, comparaison de prix, analyse d'arbitrage.`,
    hi: `${brandName} ${product.modelName} ${product.year} प्रयुक्त ${categoryName}। AgriTrade — AI मूल्यांकन, मूल्य तुलना, आर्बिट्राज विश्लेषण।`,
  };

  return {
    title: titleMap[locale] || titleMap["en"],
    description: descMap[locale] || descMap["en"],
    alternates: {
      canonical: `${BASE_URL}/${locale}/products/${id}`,
      languages: getHreflangLanguages(`/products/${id}`),
    },
    openGraph: {
      title: titleMap[locale] || titleMap["en"],
      description: descMap[locale] || descMap["en"],
      type: "website",
      ...(imgUrl ? { images: [{ url: imgUrl, width: 800, height: 600 }] } : {}),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export async function generateStaticParams() {
  const topIds = DAILY_REPORT_RANKING.slice(0, 20).map((p) => p.id);
  return topIds.flatMap((id) => [
    { locale: "zh", id },
    { locale: "en", id },
    { locale: "ru", id },
  ]);
}

/** Build the main title (Section 1) per spec */
function buildMainTitle(
  brandName: string,
  modelName: string,
  year: number,
  categoryName: string,
  enginePower: number | null,
  locale: string
): string {
  if (locale === "zh") {
    const hpPart = enginePower ? ` | ${enginePower}马力` : "";
    return `二手 ${brandName} ${modelName} ${categoryName} - ${year}年${hpPart}`;
  }
  // English (and fallback): "Used [Brand] [Model] Silage Harvester - [Year] | [HP] HP"
  // Note: We use categoryName instead of hardcoding "Silage Harvester"
  const hpPart = enginePower ? ` | ${enginePower} HP` : "";
  return `Used ${brandName} ${modelName} ${categoryName} - ${year}${hpPart}`;
}

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

  const mainTitle = buildMainTitle(brandName, product.modelName, product.year, categoryName, product.enginePower ?? null, locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ProductStructuredData
        id={product.id}
        name={`${brandName} ${product.modelName}`}
        brand={brandName}
        category={categoryName}
        year={product.year}
        description={description || ""}
        priceCny={product.priceCny}
        condition={product.condition}
        location={product.location || ""}
        workingHours={product.workingHours ?? undefined}
        imageUrl={product.images[0] ? getImageUrl(product.images[0].url) : `${BASE_URL}/images/og.png`}
        locale={locale}
      />
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "设备市场" : "Products", url: `${BASE_URL}/${locale}/products` },
          { name: `${brandName} ${product.modelName}`, url: `${BASE_URL}/${locale}/products/${product.id}` },
        ]}
      />

      {/* ================================================================ */}
      {/*  SECTION 1 — Main Title                                          */}
      {/* ================================================================ */}
      <div className="mb-8">
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
          {mainTitle}
        </h1>
      </div>

      {/* ================================================================ */}
      {/*  SECTION 2 — 8-Angle Image Gallery                               */}
      {/* ================================================================ */}
      <div className="mb-8">
        <ImageGallery
          images={product.images}
          alt={generateImageAlt(brandName, product.modelName, product.year, categoryName, locale, {
            location: product.location || undefined,
            condition: product.condition,
          })}
          locale={locale}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left Column: Specs + Price */}
        <div className="space-y-6">
          {/* ================================================================ */}
          {/*  SECTION 3 — Specification Table (11 rows)                      */}
          {/* ================================================================ */}
          <SpecificationTable
            brandName={brandName}
            modelName={product.modelName}
            year={product.year}
            workingHours={product.workingHours ?? null}
            engineType={product.engineType ?? null}
            enginePower={product.enginePower ?? null}
            driveSystem={product.driveSystem ?? null}
            mainConfig={product.mainConfig ?? null}
            overallLength={product.overallLength ?? null}
            overallWidth={product.overallWidth ?? null}
            overallHeight={product.overallHeight ?? null}
            netWeight={product.netWeight ?? null}
            conditionLabel={conditionLabel}
            locale={locale}
          />

          {/* ================================================================ */}
          {/*  SECTION 5 — Price & Trade Terms                                 */}
          {/* ================================================================ */}
          <PriceTradeSection
            priceCny={product.priceCny}
            priceUsd={product.priceUsd ?? null}
            priceMode={product.priceMode || "por"}
            tradeTerm={product.tradeTerm || "FOB"}
            tradePort={product.tradePort ?? null}
            locale={locale}
          />

          {/* Cross-Border Price Comparison (kept from existing design) */}
          {intlPriceCny && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5" />
                  {t("priceComparison")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-primary-50 p-4 text-center">
                    <p className="text-xs text-gray-500">{t("chinaMarketPrice")}</p>
                    <p className="text-xl font-bold text-primary-700">
                      {formatPrice(product.priceCny, "cny")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-4 text-center">
                    <p className="text-xs text-gray-500">{t("usMarketPrice")}</p>
                    <p className="text-xl font-bold text-blue-700">
                      {formatPrice(intlPriceCny, "cny")}
                    </p>
                    {intlPriceRaw && (
                      <p className="mt-0.5 text-xs text-blue-500">
                        {intlCurrency === "EUR" ? "€" : "$"}{intlPriceRaw.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

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
          )}

          {/* Buy Intent Button + Favorite */}
          <div className="flex items-center gap-3">
            <BuyIntentButton
              productId={product.id}
              productName={`${brandName} ${product.modelName}`}
              locale={locale}
            />
            <FavoriteButton productId={product.id} locale={locale} />
          </div>
        </div>

        {/* Right Column: Video + Contact */}
        <div className="space-y-6">
          {/* ================================================================ */}
          {/*  SECTION 4 — Video Area                                         */}
          {/* ================================================================ */}
          {product.videos.length > 0 && (
            <div className="space-y-3">
              {product.videos.map((video, idx) => (
                <div key={video.id} className="overflow-hidden rounded-lg bg-black">
                  <video
                    src={getVideoUrl(video.url)}
                    controls
                    playsInline
                    crossOrigin="anonymous"
                    className="h-auto w-full"
                    preload="metadata"
                    poster={getImageUrl(product.images[0]?.url)}
                  >
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

          {/* ================================================================ */}
          {/*  SECTION 7 — Contact & Inquiry (+ Email)                        */}
          {/* ================================================================ */}
          <Card>
            <CardHeader>
              <CardTitle>{t("contactSeller")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>Email: </span>
                <a
                  href="mailto:932133255@qq.com"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  932133255@qq.com
                </a>
              </div>

              {/* Escrow Purchase */}
              {product.status === "active" && (
                <EscrowPurchaseButton
                  productId={product.id}
                  productName={product.modelName}
                  price={product.priceCny}
                  sellerId={product.sellerId}
                />
              )}

              {/* Inquiry Form */}
              <InquiryForm productId={product.id} />

              {/* Quick Contact: QR Codes */}
              <QuickContact locale={locale} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  SECTION 6 — Standard Product Description                        */}
      {/* ================================================================ */}
      <div className="mt-8">
        <StandardDescription
          standardDescriptionEn={product.standardDescriptionEn ?? null}
          descriptionZh={product.descriptionZh ?? null}
          descriptionEn={product.descriptionEn ?? null}
          locale={locale}
        />
      </div>

      {/* ================================================================ */}
      {/*  Differentiated Features (below standard blocks)                 */}
      {/* ================================================================ */}

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

      {/* AI Valuation */}
      <div className="mt-6">
        <ValuationCard
          productId={product.id}
          productName={`${brandName} ${product.modelName}`}
          locale={locale}
        />
      </div>

      {/* AI Deep Analysis (豆包大模型) */}
      <div className="mt-6">
        <DeepAnalysisCard
          productId={product.id}
          productName={`${brandName} ${product.modelName}`}
          imageUrls={product.images.map((img) => getImageUrl(img.url))}
          videoUrls={product.videos.length > 0 ? product.videos.map((v) => getVideoUrl(v.url)) : []}
          locale={locale}
        />
      </div>

      {/* Machinery Identity & Traceability (一机一码) */}
      <div className="mt-6">
        <MachineryIdentityCard productId={product.id} locale={locale} />
      </div>

      {/* Inspection Report (设备检验报告) */}
      <div className="mt-6">
        <InspectionReportCard productId={product.id} locale={locale} />
      </div>

      {/* Seller Trust Card (卖家信任体系) */}
      <div className="mt-6">
        <SellerTrustCard
          sellerId={product.seller.id}
          sellerName={product.seller.companyName ?? undefined}
          locale={locale}
        />
      </div>

      {/* Blockchain Traceability (区块链溯源) */}
      <div className="mt-6">
        <BlockchainTrace productId={product.id} locale={locale} />
      </div>

      {/* Offline Service Appointment */}
      <div className="mt-4 flex items-center justify-center gap-3 rounded-lg bg-gray-50 p-4">
        <Wrench className="h-5 w-5 text-primary-500" />
        <span className="text-sm text-gray-600">
          {locale === "zh" ? "需要线下检测？" : "Need offline inspection?"}
        </span>
        <Link
          href={`/${locale}/service-network`}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {locale === "zh" ? "查看附近服务网点 →" : "Find nearby service centers →"}
        </Link>
      </div>

      {/* AI Multi-language Chat Floating Window */}
      <FloatingChat locale={locale as any} productId={id} />
    </div>
  );
}
