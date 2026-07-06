"use client";

import { useState } from "react";
import { Phone, Mail, MapPin, MessageSquare, Package, Play, Award, ChevronLeft, ChevronRight, X, Sparkles, TrendingUp, Globe } from "lucide-react";
import type { BoothData } from "../types";

export default function FlagshipBooth({ booth, locale, onInquiry }: {
  booth: BoothData;
  locale: string;
  onInquiry: (showcaseItemId?: string) => void;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);

  const t = locale === "zh" ? {
    devices: "展品设备",
    about: "关于我们",
    contact: "联系方式",
    inquiry: "立即询盘",
    stats: "数据亮点",
    global: "全球触达",
    featured: "明星产品",
    allDevices: "全部设备",
    video: "企业视频",
  } : locale === "ru" ? {
    devices: "Экспонаты",
    about: "О нас",
    contact: "Контакты",
    inquiry: "Запрос",
    stats: "Статистика",
    global: "Глобальный охват",
    featured: "Звёздный продукт",
    allDevices: "Все устройства",
    video: "Видео",
  } : {
    devices: "Exhibits",
    about: "About Us",
    contact: "Contact",
    inquiry: "Inquire Now",
    stats: "Highlights",
    global: "Global Reach",
    featured: "Featured Product",
    allDevices: "All Devices",
    video: "Company Video",
  };

  // Hero images
  const heroImages: string[] = [];
  if (booth.coverImage) heroImages.push(booth.coverImage);
  booth.showcaseItems?.slice(0, 4).forEach(item => {
    if (item.images?.[0] && !heroImages.includes(item.images[0])) heroImages.push(item.images[0]);
  });

  // Featured product (most viewed)
  const featured = booth.showcaseItems?.[0];
  const allItems = booth.showcaseItems || [];
  const videos = allItems.flatMap(i => i.videos || []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Cinematic Hero */}
      <div className="relative h-[480px] w-full overflow-hidden">
        {heroImages.length > 0 ? (
          <img src={heroImages[heroIdx]} alt={booth.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full bg-gradient-to-br from-slate-800 via-blue-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/20" />

        {/* Carousel dots */}
        {heroImages.length > 1 && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2">
            {heroImages.map((_, i) => (
              <button key={i} onClick={() => setHeroIdx(i)}
                className={`h-3 w-3 rounded-full border-2 border-white/50 transition ${i === heroIdx ? "bg-white" : "bg-transparent"}`} />
            ))}
          </div>
        )}

        {/* Booth title */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              <span className="text-xs font-bold tracking-widest text-yellow-400">FLAGSHIP BOOTH</span>
            </div>
            <div className="flex items-end gap-5">
              {booth.logoUrl && (
                <img src={booth.logoUrl} alt="logo" className="h-24 w-24 rounded-2xl border-2 border-white/20 object-cover shadow-2xl" />
              )}
              <div>
                <h1 className="text-3xl font-black sm:text-4xl">{booth.name}</h1>
                <p className="mt-1 text-sm text-slate-300">{booth.hall}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b border-white/10 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-5 w-5 text-blue-400" />
            <span className="font-bold text-2xl">{allItems.length}</span>
            <span className="text-slate-400">{locale === "zh" ? "台设备" : "Devices"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-5 w-5 text-green-400" />
            <span className="font-bold text-2xl">30+</span>
            <span className="text-slate-400">{locale === "zh" ? "国家买家" : "Countries"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-5 w-5 text-orange-400" />
            <span className="font-bold text-2xl">{allItems.reduce((s, i) => s + (i.viewCount || 0), 0)}</span>
            <span className="text-slate-400">{locale === "zh" ? "次浏览" : "Views"}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Video */}
        {videos.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Play className="h-5 w-5 text-blue-400" />{t.video}
            </h2>
            <div className="overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10">
              <video src={videos[0]} controls className="aspect-video w-full" />
            </div>
          </section>
        )}

        {/* Featured Product */}
        {featured && (
          <section className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Sparkles className="h-5 w-5 text-yellow-400" />{t.featured}
            </h2>
            <div className="grid gap-6 rounded-3xl border border-white/10 bg-slate-900 p-6 sm:grid-cols-2">
              <div className="relative overflow-hidden rounded-2xl bg-slate-800">
                {featured.images?.[0] && (
                  <img src={featured.images[0]} alt={featured.model || ""} className="aspect-square w-full object-cover cursor-pointer"
                    onClick={() => setLightbox(featured.images[0])} />
                )}
              </div>
              <div className="flex flex-col justify-center">
                {featured.brand && <span className="mb-2 inline-block w-fit rounded-full bg-blue-600/20 px-3 py-1 text-xs text-blue-400">{featured.brand}</span>}
                <h3 className="text-2xl font-bold">{featured.model || featured.deviceType}</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  {featured.year && <p>Year: {featured.year}</p>}
                  {featured.workingHours != null && <p>Working Hours: {featured.workingHours}h</p>}
                  {featured.condition && <p>Condition: {featured.condition}</p>}
                  {featured.description && <p className="line-clamp-3">{featured.description}</p>}
                </div>
                {featured.price && (
                  <p className="mt-4 text-3xl font-black text-orange-400">¥{featured.price.toLocaleString()}</p>
                )}
                <button onClick={() => onInquiry(featured.id)}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 text-sm font-bold hover:from-blue-500 hover:to-blue-400">
                  <MessageSquare className="h-4 w-4" />{t.inquiry}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* All Devices */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Package className="h-5 w-5 text-blue-400" />{t.allDevices}
            </h2>
            <button onClick={() => onInquiry()}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10">
              {t.inquiry}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {allItems.map((item) => (
              <div key={item.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-900 transition hover:border-white/30 hover:bg-slate-800 cursor-pointer"
                onClick={() => onInquiry(item.id)}
              >
                <div className="relative aspect-square overflow-hidden bg-slate-800">
                  {item.images?.[0] ? (
                    <img src={item.images[0]} alt={item.model || item.deviceType} className="h-full w-full object-cover transition group-hover:scale-110" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-600"><Package className="h-10 w-10" /></div>
                  )}
                  {item.brand && (
                    <span className="absolute left-2 top-2 rounded bg-blue-600/90 px-2 py-0.5 text-xs text-white">{item.brand}</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{item.model || item.deviceType}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                    <span>{item.year || ""} {item.workingHours ? `${item.workingHours}h` : ""}</span>
                    {item.price && <span className="font-bold text-orange-400">¥{item.price.toLocaleString()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* About + Contact */}
        <section className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h2 className="mb-3 text-lg font-bold">{t.about}</h2>
            <p className="text-sm leading-relaxed text-slate-300">{booth.intro || "—"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h2 className="mb-3 text-lg font-bold">{t.contact}</h2>
            <div className="space-y-3">
              {booth.merchant?.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Phone className="h-4 w-4 text-blue-400" />{booth.merchant.phone}
                </div>
              )}
              {booth.merchant?.email && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Mail className="h-4 w-4 text-blue-400" />{booth.merchant.email}
                </div>
              )}
              {booth.merchant?.location && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <MapPin className="h-4 w-4 text-blue-400" />{booth.merchant.location}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 text-white" onClick={() => setLightbox(null)}>
            <X className="h-8 w-8" />
          </button>
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
