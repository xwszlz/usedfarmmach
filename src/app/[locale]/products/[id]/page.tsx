import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { ImageGallery } from "@/components/product/image-gallery";
import { SpecificationTable } from "@/components/product/specification-table";
import { StandardDescription } from "@/components/product/standard-description";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight, Info, MessageCircle } from "lucide-react";
import { getImageUrl, getVideoUrl, generateImageAlt } from "@/lib/image-url";
import { formatPrice } from "@/lib/utils";
import { normalizeCondition } from "@/lib/condition";
import ArbitrageCalculatorSection from "@/components/product/arbitrage-calculator-section";
import { InquiryActions } from "@/components/product/inquiry-actions";
import InquirySection from "@/components/product/inquiry-section";
import { ValuationCard } from "@/components/valuation/valuation-card";
import DeepAnalysisCard from "@/components/product/deep-analysis-card";
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
import { ProductViewBadge } from "@/components/stats/ProductViewBadge";
import { ProductVideoGallery } from "@/components/stats/ProductVideoGallery";
import CompatiblePartsSection from "@/components/parts/CompatiblePartsSection";
import { SellerContactCard } from "@/components/product/seller-contact-card";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

/**
 * P1-4：产地展示统一。
 * 公司名/品牌名不是产地，截断值也不是 —— 统一显示为「河北·石家庄」；只到市一级的补齐为省市。
 * 只影响页面呈现层，不修改任何产品数据。
 */
const DEFAULT_ORIGIN = "河北·石家庄";

function normalizeOriginLocation(raw: string | null | undefined): string {
  const v = (raw || "").trim();
  if (!v) return "";
  if (v.includes("神雕") || v === "石") return DEFAULT_ORIGIN;
  if (v === "石家庄" || v === "石家庄市") return DEFAULT_ORIGIN;
  return v;
}

/** P1-5：产品描述为空时的兜底说明单位表 */
const DESC_UNITS: Record<string, { hours: string; power: string }> = {
  zh: { hours: "小时", power: "马力" },
  en: { hours: "hrs", power: "HP" },
  ru: { hours: "моточасов", power: "л.с." },
  es: { hours: "horas", power: "CV" },
  pt: { hours: "horas", power: "cv" },
  ar: { hours: "ساعة", power: "حصان" },
  fr: { hours: "heures", power: "ch" },
  hi: { hours: "घंटे", power: "HP" },
};

interface FallbackDescInput {
  brand: string;
  model: string;
  year: number;
  category: string;
  workingHours: number | null;
  enginePower: number | null;
  condition: string;
  location: string;
}

/**
 * P1-5：仅用该机「真实字段」拼一段兜底说明。
 * 硬约束：字段缺失时对应整句不出现 —— 不推断、不补全、不编造任何参数。
 */
function buildFallbackDescription(locale: string, p: FallbackDescInput): string {
  const u = DESC_UNITS[locale] || DESC_UNITS.en;
  const hours = p.workingHours != null ? `${p.workingHours.toLocaleString()} ${u.hours}` : "";
  const power = p.enginePower != null ? `${p.enginePower} ${u.power}` : "";
  const sep = locale === "zh" ? "" : " ";
  const seg: string[] = [];

  switch (locale) {
    case "zh":
      seg.push(`这是一台 ${p.year} 年的 ${p.brand} ${p.model} ${p.category}。`);
      if (p.condition) seg.push(`设备状况：${p.condition}。`);
      if (hours) seg.push(`累计工作${hours}。`);
      if (power) seg.push(`额定功率${power}。`);
      if (p.location) seg.push(`现机所在地：${p.location}。`);
      seg.push("更多配置细节与实拍图片可在下方询价获取，以上信息以实机查验为准。");
      break;
    case "ru":
      seg.push(`Это подержанный ${p.category} ${p.brand} ${p.model} ${p.year} года выпуска.`);
      if (p.condition) seg.push(`Состояние: ${p.condition}.`);
      if (hours) seg.push(`Наработка: ${hours}.`);
      if (power) seg.push(`Мощность: ${power}.`);
      if (p.location) seg.push(`Местонахождение: ${p.location}.`);
      seg.push("Дополнительные характеристики и фотографии — по запросу. Приведённые данные уточняются при осмотре машины.");
      break;
    case "es":
      seg.push(`Se trata de un ${p.category} ${p.brand} ${p.model} del año ${p.year}.`);
      if (p.condition) seg.push(`Estado: ${p.condition}.`);
      if (hours) seg.push(`Horas de trabajo: ${hours}.`);
      if (power) seg.push(`Potencia nominal: ${power}.`);
      if (p.location) seg.push(`Ubicación de la máquina: ${p.location}.`);
      seg.push("Contáctenos para más detalles y fotos. La información anterior está sujeta a la inspección física de la máquina.");
      break;
    case "pt":
      seg.push(`Trata-se de um ${p.category} ${p.brand} ${p.model} do ano ${p.year}.`);
      if (p.condition) seg.push(`Estado: ${p.condition}.`);
      if (hours) seg.push(`Horas de trabalho: ${hours}.`);
      if (power) seg.push(`Potência nominal: ${power}.`);
      if (p.location) seg.push(`Localização da máquina: ${p.location}.`);
      seg.push("Fale conosco para mais detalhes e fotos. As informações acima estão sujeitas à inspeção física da máquina.");
      break;
    case "ar":
      seg.push(`هذه ${p.category} ${p.brand} ${p.model} موديل ${p.year}.`);
      if (p.condition) seg.push(`الحالة: ${p.condition}.`);
      if (hours) seg.push(`ساعات العمل: ${hours}.`);
      if (power) seg.push(`القدرة المقدرة: ${power}.`);
      if (p.location) seg.push(`موقع الآلة: ${p.location}.`);
      seg.push("تواصل معنا للحصول على مزيد من التفاصيل والصور. المعلومات أعلاه تخضع للفحص الفعلي للآلة.");
      break;
    case "fr":
      seg.push(`Il s'agit d'un ${p.category} ${p.brand} ${p.model} de ${p.year}.`);
      if (p.condition) seg.push(`État : ${p.condition}.`);
      if (hours) seg.push(`Heures de travail : ${hours}.`);
      if (power) seg.push(`Puissance nominale : ${power}.`);
      if (p.location) seg.push(`Machine située à : ${p.location}.`);
      seg.push("Contactez-nous pour plus de détails et de photos. Les informations ci-dessus sont soumises à l'inspection physique de la machine.");
      break;
    case "hi":
      seg.push(`यह ${p.year} मॉडल का ${p.brand} ${p.model} ${p.category} है।`);
      if (p.condition) seg.push(`स्थिति: ${p.condition}।`);
      if (hours) seg.push(`कार्य घंटे: ${hours}।`);
      if (power) seg.push(`रेटेड पावर: ${power}।`);
      if (p.location) seg.push(`मशीन का स्थान: ${p.location}।`);
      seg.push("अधिक जानकारी और तस्वीरों के लिए हमसे संपर्क करें। ऊपर दी गई जानकारी मशीन के भौतिक निरीक्षण के अधीन है।");
      break;
    default:
      seg.push(`This is a ${p.year} ${p.brand} ${p.model} ${p.category}.`);
      if (p.condition) seg.push(`Condition: ${p.condition}.`);
      if (hours) seg.push(`Working hours: ${hours}.`);
      if (power) seg.push(`Rated power: ${power}.`);
      if (p.location) seg.push(`Machine located in: ${p.location}.`);
      seg.push("Message us for more configuration details and photos. The information above is subject to physical inspection of the machine.");
      break;
  }

  return seg.join(sep);
}

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
      brand: { select: { nameZh: true, nameEn: true, nameRu: true, nameEs: true, namePt: true, nameAr: true, nameFr: true, nameHi: true } },
      category: { select: { nameZh: true, nameEn: true, nameRu: true, nameEs: true, namePt: true, nameAr: true, nameFr: true, nameHi: true } },
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      descriptionZh: true,
      descriptionEn: true,
    },
  });

  if (!product) {
    return { title: "产品未找到" };
  }

  const langKey = `name${locale.charAt(0).toUpperCase()}${locale.slice(1)}` as keyof typeof product.brand;
  const brandName = (product.brand as any)[langKey] || product.brand.nameEn || product.brand.nameZh;
  const categoryName = (product.category as any)[langKey] || product.category.nameEn || product.category.nameZh;
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
  // Disabled — next-intl static prerendering is not compatible with
  // product detail pages that use dynamic data (getTranslations, prisma).
  // Products are served via ISR (revalidate=300) at runtime instead.
  return [];
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
      // 查询是否有关联的活跃询价
      auctions: {
        where: { status: "active" },
        select: { id: true, bargainNo: true, askingPrice: true, totalBids: true },
        take: 1,
      },
    },
  });

  if (!product || product.status !== "active") {
    notFound();
  }

  const langKey2 = `name${locale.charAt(0).toUpperCase()}${locale.slice(1)}` as keyof typeof product.brand;
  const brandName = (product.brand as any)[langKey2] || product.brand.nameEn || product.brand.nameZh;
  const categoryName = (product.category as any)[langKey2] || product.category.nameEn || product.category.nameZh;
  const description = (product as any)[`description${locale.charAt(0).toUpperCase()}${locale.slice(1)}`] || product.descriptionEn;
  const conditionSuffix = normalizeCondition(product.condition);
  const conditionLabel = conditionSuffix
    ? t.has(`condition${conditionSuffix}`)
      ? t(`condition${conditionSuffix}`)
      : conditionSuffix
    : "";

  // P1-4：产地展示统一（「神雕农机」/截断值不再作为产地）
  const originLocation = normalizeOriginLocation(product.location);

  // P1-5：描述为空时用该机真实字段生成兜底说明；描述非空则一字不动
  const fallbackDescription = buildFallbackDescription(locale, {
    brand: brandName,
    model: product.modelName,
    year: product.year,
    category: categoryName,
    workingHours: product.workingHours ?? null,
    enginePower: product.enginePower ?? null,
    condition: conditionLabel,
    location: originLocation,
  });
  // 注：StandardDescription 的非中文分支读的是 descriptionEn 入参，
  // 因此这里把「按当前语言」的兜底文本经由该入参传入（不改动第二个组件）。
  const zhDescriptionText = (product.descriptionZh || "").trim() || fallbackDescription;
  const nonZhDescriptionText = (product.descriptionEn || "").trim() || fallbackDescription;

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
        location={originLocation}
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
        {/* 浏览量标注：挂载即 track('product') 并展示最新累计值 */}
        <div className="mt-3">
          <ProductViewBadge productId={product.id} initialViewCount={product.viewCount} locale={locale} />
        </div>
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
        {/* Left Column: Specs + Description */}
        <div className="space-y-6">
          {/* ================================================================ */}
          {/*  SECTION 3 — Specification Table (11 rows)                      */}
          {/* ================================================================ */}
          <SpecificationTable
            brandName={brandName}
            brandOfficialWebsite={product.brand?.officialWebsite ?? null}
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
            categoryName={categoryName}
            location={originLocation}
            locale={locale}
          />

          {/* ================================================================ */}
          {/*  SECTION 5 — Product Description (moved up below specs)           */}
          {/* ================================================================ */}
          <StandardDescription
            standardDescriptionEn={product.standardDescriptionEn ?? null}
            descriptionZh={zhDescriptionText}
            descriptionEn={nonZhDescriptionText}
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
        </div>

        {/* Right Column: Video + AI Deep Analysis */}
        <div className="space-y-6">
          {/* ================================================================ */}
          {/*  SECTION 4 — Video Area（onPlay 调 track('video') 并展示播放量）  */}
          {/* ================================================================ */}
          {product.videos.length > 0 && (
            <ProductVideoGallery
              videos={product.videos.map((v) => ({
                id: v.id,
                url: getVideoUrl(v.url),
                title: v.title ?? null,
                playCount: v.playCount ?? 0,
              }))}
              posterUrl={product.images[0] ? getImageUrl(product.images[0].url) : undefined}
              locale={locale}
            />
          )}

          {/* ================================================================ */}
          {/*  AI 深度分析（豆包大模型）— 原在下方，与联系卖家对调后移到这里        */}
          {/* ================================================================ */}
          <DeepAnalysisCard
            productId={product.id}
            productName={`${brandName} ${product.modelName}`}
            category={categoryName}
            imageUrls={product.images.map((img) => getImageUrl(img.url))}
            videoUrls={product.videos.length > 0 ? product.videos.map((v) => getVideoUrl(v.url)) : []}
            locale={locale}
            isChineseBrand={(product.brand as any).isChineseBrand}
            brandName={brandName}
            year={product.year || undefined}
            enginePower={product.enginePower ? String(product.enginePower) : undefined}
          />
        </div>
      </div>

      {/* ================================================================ */}
      {/*  Machinery Identity & Traceability (一机一码) — 紧贴产品描述       */}
      {/* ================================================================ */}
      <div className="mt-8">
        <MachineryIdentityCard productId={product.id} locale={locale} />
      </div>

      {/* ================================================================ */}
      {/*  AI 智能估值                                                      */}
      {/* ================================================================ */}
      <div className="mt-6">
        <ValuationCard
          productId={product.id}
          productName={`${brandName} ${product.modelName}`}
          locale={locale}
        />
      </div>

      {/* ================================================================ */}
      {/*  Differentiated Features — 跨境套利计算器                         */}
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

      {/* ================================================================ */}
      {/*  联系卖家 / 快速联系卖家 — 统一询价入口                           */}
      {/* ================================================================ */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary-600" />
              {t("contactSeller")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 单一询价入口（阶段0-A）：主按钮滚动到统一询价区；售前咨询为次要独立通道 */}
            <div className="space-y-1">
              <InquiryActions
                productId={product.id}
                productName={`${brandName} ${product.modelName}`}
                locale={locale}
              />
              <FavoriteButton productId={product.id} locale={locale} />
            </div>

            {/* 开放直连 P0：卖家自有联系方式（登录买家可见，替代原平台统一号码） */}
            <SellerContactCard productId={product.id} locale={locale} />
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/*  统一在线询价栏目（阶段0-A：所有产品自动开通，单一入口）        */}
      {/* ================================================================ */}
      <InquirySection
        productId={product.id}
        sellerId={product.seller.id}
        locale={locale}
        productName={`${brandName} ${product.modelName}`}
        askingPrice={product.priceCny}
      />

      {/* Compatible Parts (适配零部件) — 按品牌运行时匹配 */}
      <div className="mt-6">
        <CompatiblePartsSection
          productId={product.id}
          locale={locale}
        />
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
