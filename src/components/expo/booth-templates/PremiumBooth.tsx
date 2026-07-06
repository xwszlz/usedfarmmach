"use client";

import { useState } from "react";
import { Phone, Mail, MapPin, MessageSquare, Package, Play, Award, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { BoothData } from "../types";

export default function PremiumBooth({ booth, locale, onInquiry }: {
  booth: BoothData;
  locale: string;
  onInquiry: (showcaseItemId?: string) => void;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);

  const t = locale === "zh" ? {
    devices: "展品设备",
    company: "企业介绍",
    contact: "联系方式",
    inquiry: "在线询盘",
    certs: "资质证书",
    video: "企业视频",
    noDevices: "暂无展品",
    noCerts: "暂无证书",
  } : locale === "ru" ? {
    devices: "Экспонаты",
    company: "О компании",
    contact: "Контакты",
    inquiry: "Запрос",
    certs: "Сертификаты",
    video: "Видео",
    noDevices: "Нет экспонатов",
    noCerts: "Нет сертификатов",
  } : {
    devices: "Exhibits",
    company: "About Company",
    contact: "Contact",
    inquiry: "Inquiry",
    certs: "Certifications",
    video: "Company Video",
    noDevices: "No exhibits",
    noCerts: "No certifications",
  };

  // Collect all images for carousel (cover + first images of items)
  const carouselImages: string[] = [];
  if (booth.coverImage) carouselImages.push(booth.coverImage);
  booth.showcaseItems?.forEach(item => {
    if (item.images?.[0]) carouselImages.push(item.images[0]);
  });

  // Collect videos
  const videos: string[] = [];
  booth.showcaseItems?.forEach(item => {
    item.videos?.forEach(v => videos.push(v));
  });

  const nextCarousel = () => setCarouselIdx(i => (i + 1) % Math.max(carouselImages.length, 1));
  const prevCarousel = () => setCarouselIdx(i => (i - 1 + carouselImages.length) % Math.max(carouselImages.length, 1));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50">
      {/* Hero Carousel */}
      <div className="relative h-80 w-full overflow-hidden bg-slate-800 sm:h-96">
        {carouselImages.length > 0 ? (
          <>
            <img src={carouselImages[carouselIdx]} alt={booth.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {carouselImages.length > 1 && (
              <>
                <button onClick={prevCarousel} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur hover:bg-white/30">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button onClick={nextCarousel} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur hover:bg-white/30">
                  <ChevronRight className="h-6 w-6" />
                </button>
                <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {carouselImages.map((_, i) => (
                    <button key={i} onClick={() => setCarouselIdx(i)}
                      className={`h-2 rounded-full transition-all ${i === carouselIdx ? "w-6 bg-white" : "w-2 bg-white/50"}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-700 to-slate-800">
            <h1 className="text-3xl font-bold text-white">{booth.name}</h1>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="mx-auto flex max-w-5xl items-end gap-4">
            {booth.logoUrl && (
              <img src={booth.logoUrl} alt="logo" className="h-20 w-20 rounded-2xl border-2 border-white object-cover shadow-xl" />
            )}
            <div className="text-white">
              <span className="inline-block rounded-full bg-blue-500/80 px-3 py-0.5 text-xs font-medium backdrop-blur">PREMIUM</span>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{booth.name}</h1>
              <p className="text-sm text-white/70">{booth.hall}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Video Section */}
        {videos.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
              <Play className="h-5 w-5 text-blue-600" />
              {t.video}
            </h2>
            <div className="overflow-hidden rounded-2xl bg-black shadow-lg">
              <video src={videos[0]} controls className="aspect-video w-full" />
            </div>
          </section>
        )}

        {/* Devices */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Package className="h-5 w-5 text-blue-600" />
              {t.devices} ({booth.showcaseItems?.length || 0})
            </h2>
            <button onClick={() => onInquiry()} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <MessageSquare className="h-4 w-4" />
              {t.inquiry}
            </button>
          </div>

          {booth.showcaseItems && booth.showcaseItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {booth.showcaseItems.map((item) => (
                <div key={item.id} className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-lg"
                  onClick={() => onInquiry(item.id)}
                >
                  <div className="relative aspect-square cursor-pointer overflow-hidden bg-gray-100"
                    onClick={(e) => { e.stopPropagation(); if (item.images?.[0]) setLightbox(item.images[0]); }}
                  >
                    {item.images?.[0] ? (
                      <img src={item.images[0]} alt={item.model || item.deviceType} className="h-full w-full object-cover transition group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300"><Package className="h-10 w-10" /></div>
                    )}
                    {item.videos?.length > 0 && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white">
                        <Play className="h-3 w-3" />
                      </span>
                    )}
                    {item.brand && (
                      <span className="absolute left-2 top-2 rounded bg-blue-600/90 px-2 py-0.5 text-xs text-white">{item.brand}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-gray-900">{item.model || item.deviceType}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                      <span>{item.year || ""} {item.workingHours ? `${item.workingHours}h` : ""}</span>
                      {item.price && <span className="font-bold text-orange-600">¥{item.price.toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed py-12 text-center text-gray-400">{t.noDevices}</div>
          )}
        </section>

        {/* Company Intro */}
        <section className="mb-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-l-4 border-blue-600 p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900">{t.company}</h2>
            <p className="text-sm leading-relaxed text-gray-600">{booth.intro || "—"}</p>
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-gray-900">{t.contact}</h2>
          <div className="flex flex-wrap gap-6">
            {booth.merchant?.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4 text-blue-500" />{booth.merchant.phone}
              </div>
            )}
            {booth.merchant?.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4 text-blue-500" />{booth.merchant.email}
              </div>
            )}
            {booth.merchant?.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 text-blue-500" />{booth.merchant.location}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 text-white" onClick={() => setLightbox(null)}>
            <X className="h-8 w-8" />
          </button>
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
