"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface BrandRel {
  id: string;
  nameZh: string;
  nameEn: string;
  isChineseBrand: boolean;
  brandTier: string | null;
  expoLogoUrl: string | null;
  expoStory: string | null;
  officialWebsite: string | null;
  establishedYear: number | null;
  exportVolume: string | null;
}

interface ShowcaseItemData {
  id: string;
  deviceType: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  workingHours: number | null;
  condition: string | null;
  price: number | null;
  currency: string;
  images: string[];
  videos: string[];
  description: string | null;
  status: string;
  viewCount: number;
  inquiryCount: number;
  booth: { id: string; name: string; hall: string; pavilion?: string; tier?: string };
  brandRel: BrandRel | null;
  specs: Record<string, any>;
  itemType: string;
  country: string | null;
  isChineseMade: boolean | null;
  launchYear: number | null;
  machineTier: string | null;
  msrpUsd: number | null;
  msrpCny: number | null;
  priceRange: string | null;
  isFeatured: boolean;
  isNewLaunch: boolean;
  createdAt: string;
}

export default function ShowcaseDetail({
  item,
  locale,
}: {
  item: ShowcaseItemData;
  locale: string;
}) {
  const [activeImage, setActiveImage] = useState(0);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inquiry form state
  const [form, setForm] = useState({
    buyerName: "",
    buyerPhone: "",
    buyerEmail: "",
    country: "",
    message: "",
  });

  const t = (zh: string, en: string, ru?: string) => {
    if (locale === "zh") return zh;
    if (locale === "ru" && ru) return ru;
    return en;
  };

  const isNew = item.itemType === "new";

  const machineTierLabels: Record<string, { zh: string; en: string; ru: string }> = {
    flagship: { zh: "旗舰机型", en: "Flagship", ru: "Флагман" },
    premium: { zh: "高端机型", en: "Premium", ru: "Премиум" },
    standard: { zh: "标准机型", en: "Standard", ru: "Стандарт" },
    entry: { zh: "入门机型", en: "Entry", ru: "Базовый" },
  };

  const getMachineTierLabel = (tier: string | null) => {
    if (!tier) return "";
    const c = machineTierLabels[tier];
    return c ? t(c.zh, c.en, c.ru) : tier;
  };

  const getMachineTierColor = (tier: string | null) => {
    if (!tier) return "bg-gray-100 text-gray-600";
    switch (tier) {
      case "flagship":
        return "bg-red-100 text-red-700";
      case "premium":
        return "bg-purple-100 text-purple-700";
      case "standard":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const brandTierLabels: Record<string, { zh: string; en: string; ru: string }> = {
    flagship: { zh: "旗舰品牌", en: "Flagship Brand", ru: "Флагман" },
    premium: { zh: "核心品牌", en: "Core Brand", ru: "Ядро" },
    standard: { zh: "精选品牌", en: "Selected Brand", ru: "Отбор" },
  };

  const getBrandTierLabel = (tier: string | null) => {
    if (!tier) return "";
    const c = brandTierLabels[tier];
    return c ? t(c.zh, c.en, c.ru) : tier;
  };

  const hallLabels: Record<string, { zh: string; en: string; ru: string }> = {
    tractor: { zh: "拖拉机馆", en: "Tractor Hall", ru: "Тракторный зал" },
    harvester: { zh: "收获机械馆", en: "Harvester Hall", ru: "Зал комбайнов" },
    planter: { zh: "播种种植馆", en: "Planter Hall", ru: "Посевной зал" },
    sprayer: { zh: "植保机械馆", en: "Sprayer Hall", ru: "Опрыскиватель зал" },
    forage: { zh: "牧草机械馆", en: "Forage Hall", ru: "Кормовой зал" },
    material: { zh: "物料搬运馆", en: "Material Hall", ru: "Материал зал" },
    comprehensive: { zh: "综合机械馆", en: "Comprehensive Hall", ru: "Комплексный зал" },
  };

  const getHallLabel = (hall: string) => {
    const h = hallLabels[hall];
    return h ? t(h.zh, h.en, h.ru) : hall;
  };

  const formatPrice = () => {
    if (isNew) {
      if (item.msrpCny) return `¥${item.msrpCny.toLocaleString()}`;
      if (item.msrpUsd) return `$${item.msrpUsd.toLocaleString()}`;
      if (item.priceRange) return item.priceRange;
      return t("询价", "Inquire", "По запросу");
    }
    if (!item.price) return t("询价", "Inquire", "По запросу");
    const symbol = item.currency === "CNY" ? "¥" : item.currency === "USD" ? "$" : "";
    return `${symbol}${item.price.toLocaleString()}`;
  };

  const specsList: { label: string; value: string | null }[] = [
    { label: t("发动机功率", "Engine Power", "Мощность"), value: item.specs.enginePower ? `${item.specs.enginePower} HP` : null },
    { label: t("发动机类型", "Engine Type", "Тип двигателя"), value: item.specs.engineType || null },
    { label: t("驱动方式", "Drive System", "Привод"), value: item.specs.driveSystem || null },
    { label: t("整机长度", "Length", "Длина"), value: item.specs.overallLength ? `${item.specs.overallLength} mm` : null },
    { label: t("整机宽度", "Width", "Ширина"), value: item.specs.overallWidth ? `${item.specs.overallWidth} mm` : null },
    { label: t("整机高度", "Height", "Высота"), value: item.specs.overallHeight ? `${item.specs.overallHeight} mm` : null },
    { label: t("整机重量", "Weight", "Вес"), value: item.specs.netWeight ? `${item.specs.netWeight} kg` : null },
    { label: t("主要配置", "Main Config", "Конфигурация"), value: item.specs.mainConfig || null },
    { label: t("贸易条款", "Trade Term", "Условия"), value: item.specs.tradeTerm || null },
    { label: t("发货港口", "Port", "Порт"), value: item.specs.tradePort || null },
  ].filter((s) => s.value);

  const submitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/expo/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "item_inquiry",
          showcaseItemId: item.id,
          buyerName: form.buyerName,
          buyerPhone: form.buyerPhone,
          buyerEmail: form.buyerEmail,
          country: form.country,
          message: form.message || `Inquiry about ${item.brand} ${item.model}`,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error("Inquiry failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const title = `${item.brand || ""} ${item.model || ""}`.trim() || item.deviceType;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href={`/${locale}`} className="hover:text-red-600">
              {t("首页", "Home", "Главная")}
            </Link>
            <span>›</span>
            <Link href={`/${locale}/expo`} className="hover:text-red-600">
              {t("农机博览会", "EXPO", "Выставка")}
            </Link>
            <span>›</span>
            <Link href={`/${locale}/expo/showroom`} className="hover:text-red-600">
              {t("线上展厅", "Showroom", "Шоурум")}
            </Link>
            <span>›</span>
            <span className="text-gray-900">{title}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Left: Images & Details */}
          <div className="lg:col-span-3">
            {/* Main Image */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white shadow-sm">
              {item.images[activeImage] ? (
                <Image
                  src={item.images[activeImage]}
                  alt={title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-300">
                  <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              {/* New Launch Badge */}
              {item.isNewLaunch && (
                <span className="absolute right-3 top-3 rounded-md bg-green-500 px-3 py-1 text-sm font-bold text-white">
                  {t("新品上市", "NEW", "NEW")}
                </span>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {item.images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {item.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                      activeImage === idx ? "border-red-500 ring-2 ring-red-200" : "border-gray-200"
                    }`}
                  >
                    <Image src={img} alt={`${title} ${idx + 1}`} fill sizes="96px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Videos */}
            {item.videos.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                  {t("设备视频", "Videos", "Видео")}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {item.videos.map((video, idx) => (
                    <video
                      key={idx}
                      src={video}
                      controls
                      className="w-full rounded-lg border border-gray-200"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Brand Story (for new machines with brand relation) */}
            {isNew && item.brandRel?.expoStory && (
              <div className="mt-6 rounded-xl bg-gradient-to-br from-red-50 to-amber-50 p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  {item.brandRel.expoLogoUrl && (
                    <Image
                      src={item.brandRel.expoLogoUrl}
                      alt={item.brandRel.nameZh}
                      width={48}
                      height={48}
                      className="rounded-lg"
                    />
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {locale === "zh" ? item.brandRel.nameZh : item.brandRel.nameEn}
                    </h3>
                    {item.brandRel.establishedYear && (
                      <p className="text-xs text-gray-500">
                        {t("创立于", "Established", "Основан")} {item.brandRel.establishedYear}
                        {item.brandRel.exportVolume && ` · ${t("出口量", "Export", "Экспорт")}: ${item.brandRel.exportVolume}`}
                      </p>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                  {item.brandRel.expoStory}
                </p>
                {item.brandRel.officialWebsite && (
                  <a
                    href={item.brandRel.officialWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline"
                  >
                    {t("品牌官网", "Official Website", "Официальный сайт")}
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            )}

            {/* Specs Table */}
            {specsList.length > 0 && (
              <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-gray-900">
                  {t("设备参数", "Specifications", "Характеристики")}
                </h3>
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {specsList.map((spec, idx) => (
                    <div key={idx} className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                      <span className="text-gray-500">{spec.label}</span>
                      <span className="font-medium text-gray-900">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {item.description && (
              <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-lg font-bold text-gray-900">
                  {t("设备描述", "Description", "Описание")}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                  {item.description}
                </p>
              </div>
            )}
          </div>

          {/* Right: Info & Inquiry */}
          <div className="lg:col-span-2">
            <div className="sticky top-4 rounded-xl bg-white p-6 shadow-sm">
              {/* Brand + Badges */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {item.brand && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-700">
                    {item.brand}
                  </span>
                )}
                {item.brandRel?.brandTier && (
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    item.brandRel.brandTier === "flagship"
                      ? "bg-red-100 text-red-700"
                      : item.brandRel.brandTier === "premium"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                  }`}>
                    {getBrandTierLabel(item.brandRel.brandTier)}
                  </span>
                )}
                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-sm font-medium text-blue-700">
                  {getHallLabel(item.booth.hall)}
                </span>
                {item.machineTier && (
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${getMachineTierColor(item.machineTier)}`}>
                    {getMachineTierLabel(item.machineTier)}
                  </span>
                )}
              </div>

              {/* China Made Badge */}
              {item.isChineseMade && (
                <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  🇨🇳 {t("中国制造", "Made in China", "Сделано в Китае")}
                </div>
              )}

              <h1 className="mb-3 text-2xl font-bold text-gray-900">{title}</h1>

              {/* Key Info */}
              <div className="mb-4 flex flex-wrap gap-3 text-sm text-gray-600">
                {isNew && item.launchYear && (
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">{t("上市年份", "Launch Year", "Год выпуска")}:</span>
                    <span className="font-medium">{item.launchYear}</span>
                  </span>
                )}
                {!isNew && item.year && (
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">{t("年份", "Year", "Год")}:</span>
                    <span className="font-medium">{item.year}</span>
                  </span>
                )}
                {!isNew && item.workingHours != null && (
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">{t("工时", "Hours", "Часы")}:</span>
                    <span className="font-medium">{item.workingHours.toLocaleString()}h</span>
                  </span>
                )}
                {!isNew && item.condition && (
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">{t("状况", "Condition", "Сост.")}:</span>
                    <span className="font-medium">{item.condition}</span>
                  </span>
                )}
                {item.country && (
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">{t("产地", "Origin", "Происх.")}:</span>
                    <span className="font-medium">{item.country}</span>
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mb-5 rounded-lg bg-gradient-to-r from-red-50 to-amber-50 p-4">
                <div className="text-sm text-gray-500">
                  {isNew ? t("厂商指导价", "MSRP", "Рекоменд. цена") : t("展会展价", "Expo Price", "Цена")}
                </div>
                <div className="text-3xl font-bold text-red-700">
                  {formatPrice()}
                </div>
                {isNew && item.msrpUsd && item.msrpCny && (
                  <div className="mt-1 text-xs text-gray-400">
                    ≈ ${item.msrpUsd.toLocaleString()} USD
                  </div>
                )}
                {!isNew && item.price && (
                  <div className="mt-1 text-xs text-gray-400">
                    {item.currency === "CNY"
                      ? t("人民币含税", "CNY tax included", "RMB с налогом")
                      : item.currency}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="mb-5 flex gap-4 text-xs text-gray-400">
                <span>{item.viewCount} {t("次浏览", "views", "просм.")}</span>
                <span>{item.inquiryCount} {t("次询盘", "inquiries", "запросов")}</span>
              </div>

              {/* Inquiry Button */}
              {!showInquiryForm && !submitted && (
                <button
                  onClick={() => setShowInquiryForm(true)}
                  className="w-full rounded-lg bg-red-600 py-3 text-center font-medium text-white transition-colors hover:bg-red-700"
                >
                  {t("立即询盘", "Inquire Now", "Запросить сейчас")}
                </button>
              )}

              {/* Inquiry Form */}
              {showInquiryForm && !submitted && (
                <form onSubmit={submitInquiry} className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-900">
                    {t("填写询盘信息", "Send Inquiry", "Отправить запрос")}
                  </h3>
                  <input
                    required
                    type="text"
                    placeholder={t("您的姓名 *", "Your Name *", "Ваше имя *")}
                    value={form.buyerName}
                    onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                  />
                  <input
                    required
                    type="tel"
                    placeholder={t("电话/WhatsApp *", "Phone/WhatsApp *", "Телефон/WhatsApp *")}
                    value={form.buyerPhone}
                    onChange={(e) => setForm({ ...form, buyerPhone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                  />
                  <input
                    type="email"
                    placeholder={t("邮箱 Email", "Email", "Email")}
                    value={form.buyerEmail}
                    onChange={(e) => setForm({ ...form, buyerEmail: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                  />
                  <input
                    type="text"
                    placeholder={t("国家/地区", "Country/Region", "Страна/Регион")}
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                  />
                  <textarea
                    placeholder={t("留言（可选）", "Message (optional)", "Сообщение (необязательно)")}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-red-600 py-3 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {submitting ? t("提交中...", "Submitting...", "Отправка...") : t("发送询盘", "Send Inquiry", "Отправить")}
                  </button>
                </form>
              )}

              {/* Submitted */}
              {submitted && (
                <div className="rounded-lg bg-green-50 p-6 text-center">
                  <svg className="mx-auto mb-3 h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg font-medium text-green-800">
                    {t("询盘已发送！", "Inquiry Sent!", "Запрос отправлен!")}
                  </p>
                  <p className="mt-1 text-sm text-green-600">
                    {t("我们将在24小时内联系您", "We'll contact you within 24 hours", "Мы свяжемся с вами в течение 24 часов")}
                  </p>
                </div>
              )}

              {/* Trust badges */}
              <div className="mt-5 space-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t("交易担保服务", "Escrow Transaction Service", "Эскроу-сервис")}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  </svg>
                  {t("跨境物流支持", "Cross-border Logistics", "Кросс-логистика")}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  {t("AI估值报告", "AI Valuation Report", "AI оценка")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
