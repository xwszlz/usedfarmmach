"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

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
  booth: { id: string; name: string; hall: string };
  specs: Record<string, any>;
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

  const conditionLabels: Record<string, { zh: string; en: string; ru: string }> = {
    excellent: { zh: "优秀", en: "Excellent", ru: "Отличное" },
    good: { zh: "良好", en: "Good", ru: "Хорошее" },
    fair: { zh: "一般", en: "Fair", ru: "Удовлетворительное" },
    poor: { zh: "差", en: "Poor", ru: "Плохое" },
  };

  const getConditionLabel = (cond: string | null) => {
    if (!cond) return "";
    const c = conditionLabels[cond];
    return c ? t(c.zh, c.en, c.ru) : cond;
  };

  const hallLabels: Record<string, { zh: string; en: string; ru: string }> = {
    tractor: { zh: "拖拉机馆", en: "Tractor Hall", ru: "Тракторный зал" },
    harvester: { zh: "收获机械馆", en: "Harvester Hall", ru: "Зал комбайнов" },
    planter: { zh: "播种种植馆", en: "Planter Hall", ru: "Посевной зал" },
    sprayer: { zh: "植保机械馆", en: "Sprayer Hall", ru: "Опрыскиватель зал" },
    comprehensive: { zh: "综合机械馆", en: "Comprehensive Hall", ru: "Комплексный зал" },
  };

  const getHallLabel = (hall: string) => {
    const h = hallLabels[hall];
    return h ? t(h.zh, h.en, h.ru) : hall;
  };

  const formatPrice = (price: number | null, currency: string) => {
    if (!price) return t("询价", "Inquire", "По запросу");
    const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
    return `${symbol}${price.toLocaleString()}`;
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
            <Link href={`/${locale}`} className="hover:text-amber-600">
              {t("首页", "Home", "Главная")}
            </Link>
            <span>›</span>
            <Link href={`/${locale}/expo`} className="hover:text-amber-600">
              {t("农机博览会", "EXPO", "Выставка")}
            </Link>
            <span>›</span>
            <Link href={`/${locale}/expo/showroom`} className="hover:text-amber-600">
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
            </div>

            {/* Thumbnail Gallery */}
            {item.images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {item.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                      activeImage === idx ? "border-amber-500 ring-2 ring-amber-200" : "border-gray-200"
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
              {/* Title */}
              <div className="mb-1 flex items-center gap-2">
                {item.brand && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-700">
                    {item.brand}
                  </span>
                )}
                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-sm font-medium text-blue-700">
                  {getHallLabel(item.booth.hall)}
                </span>
              </div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900">{title}</h1>

              {/* Key Info */}
              <div className="mb-4 flex flex-wrap gap-3 text-sm text-gray-600">
                {item.year && (
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">{t("年份", "Year", "Год")}:</span>
                    <span className="font-medium">{item.year}</span>
                  </span>
                )}
                {item.workingHours != null && (
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">{t("工时", "Hours", "Часы")}:</span>
                    <span className="font-medium">{item.workingHours.toLocaleString()}h</span>
                  </span>
                )}
                {item.condition && (
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">{t("状况", "Condition", "Сост.")}:</span>
                    <span className="font-medium">{getConditionLabel(item.condition)}</span>
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mb-5 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 p-4">
                <div className="text-sm text-gray-500">{t("展会展价", "Expo Price", "Цена")}</div>
                <div className="text-3xl font-bold text-amber-700">
                  {formatPrice(item.price, item.currency)}
                </div>
                {item.price && (
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
                  className="w-full rounded-lg bg-amber-600 py-3 text-center font-medium text-white transition-colors hover:bg-amber-700"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                  <input
                    required
                    type="tel"
                    placeholder={t("电话/WhatsApp *", "Phone/WhatsApp *", "Телефон/WhatsApp *")}
                    value={form.buyerPhone}
                    onChange={(e) => setForm({ ...form, buyerPhone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                  <input
                    type="email"
                    placeholder={t("邮箱 Email", "Email", "Email")}
                    value={form.buyerEmail}
                    onChange={(e) => setForm({ ...form, buyerEmail: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder={t("国家/地区", "Country/Region", "Страна/Регион")}
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                  <textarea
                    placeholder={t("留言（可选）", "Message (optional)", "Сообщение (необязательно)")}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-amber-600 py-3 font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
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
