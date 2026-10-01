"use client";

import { useEffect, useState } from "react";
import { Play, X, Film, Sparkles } from "lucide-react";
import { isCnSite } from "@/config/site";

/**
 * 首页品牌影片横幅 · 《跨山海》30 秒
 *
 * 素材：
 * - 视频 `public/videos/national-day-30s-web.mp4`（1920×1080 / 30.00s / 7.0 MB）
 * - 海报 `public/videos/national-day-30s-poster.jpg`（1920×1080，取自片内「以数据丈量山海」帧）
 *
 * 分站叙事（沿用 dual-expo-banner 的做法，用 isCnSite() 切换）：
 * - .cn 国内站：定位为「国庆献礼」，落款带备案域名
 * - .com 海外站：定位为「Brand Film」，强调全球跨境与 8 语种触达，弱化节庆色彩
 *
 * 文案语言：zh / en / ru 全文落位；其余 5 语（es/pt/ar/fr/hi）回落英文。
 * 这是本仓既有约定（见 dual-expo-banner.tsx L73 注释）——不把机翻文案直接上线。
 *
 * 性能：视频 `preload="none"` 且只在弹窗打开后才挂载 <video>，
 * 未点击的用户不会为这 7 MB 付任何流量。
 */

const VIDEO_SRC = "/videos/national-day-30s-web.mp4";
const POSTER_SRC = "/videos/national-day-30s-poster.jpg";

interface BannerCopy {
  /** 角标 */
  badge: string;
  /** 主标题 */
  title: string;
  /** 副标题 */
  subtitle: string;
  /** 数据锚点行 */
  facts: string;
  /** 主 CTA */
  cta: string;
  /** 时长提示 */
  duration: string;
  /** 弹窗右上关闭 */
  close: string;
  /** 播放按钮无障碍名 */
  playLabel: string;
  /** 海报替代文本 */
  posterAlt: string;
  /** 视频不支持时的兜底文案 */
  videoFallback: string;
}

/* ---------- .com 海外站：品牌片定位 ---------- */
const COM_TEXTS: Record<string, BannerCopy> = {
  zh: {
    badge: "品牌影片",
    title: "跨山海 · 神雕农机品牌影片",
    subtitle: "30 秒，看中国二手农机如何跨越大山大洋，直达六大板块田间。",
    facts: "309 品牌 · 618 配件 · 14 品类 · 8 语种",
    cta: "观看影片",
    duration: "30 秒 · 1080P",
    close: "关闭",
    playLabel: "播放神雕农机品牌影片《跨山海》",
    posterAlt:
      "神雕农机品牌影片《跨山海》画面：以数据丈量山海，309 个全球在售农机品牌、618 项配件供应体系、14 本品类手册、8 语种直达，覆盖中东、非洲、南亚与东南亚等六大目标市场。",
    videoFallback: "您的浏览器不支持视频播放。",
  },
  en: {
    badge: "Brand Film",
    title: "Crossing Mountains and Seas · ShenDiao Brand Film",
    subtitle:
      "30 seconds inside China's used agricultural machinery export platform — from the yard to fields across six regions.",
    facts: "309 brands · 618 parts · 14 categories · 8 languages",
    cta: "Watch the film",
    duration: "30s · 1080P",
    close: "Close",
    playLabel: "Play the ShenDiao brand film, Crossing Mountains and Seas",
    posterAlt:
      "A frame from the ShenDiao brand film 'Crossing Mountains and Seas' — measuring the journey in data: 309 agricultural machinery brands on sale worldwide, 618 supply-chain parts, 14 category handbooks, 8 languages, covering six target regions including the Middle East, Africa, South Asia and Southeast Asia.",
    videoFallback: "Your browser does not support video playback.",
  },
  ru: {
    badge: "Фильм о бренде",
    title: "Через горы и моря · фильм о бренде ShenDiao",
    subtitle:
      "30 секунд о том, как платформа экспорта подержанной сельхозтехники из Китая работает от площадки до полей шести регионов.",
    facts: "309 брендов · 618 позиций запчастей · 14 категорий · 8 языков",
    cta: "Смотреть фильм",
    duration: "30 сек · 1080P",
    close: "Закрыть",
    playLabel: "Воспроизвести фильм о бренде ShenDiao «Через горы и моря»",
    posterAlt:
      "Кадр из фильма о бренде ShenDiao «Через горы и моря» — путь, измеренный данными: 309 брендов сельхозтехники в продаже по всему миру, 618 позиций системы поставки запчастей, 14 каталогов категорий, 8 языков; охвачены шесть целевых регионов, включая Ближний Восток, Африку, Южную и Юго-Восточную Азию.",
    videoFallback: "Ваш браузер не поддерживает воспроизведение видео.",
  },
};

/* ---------- .cn 国内站：国庆献礼定位 ---------- */
const CN_TEXTS: Record<string, BannerCopy> = {
  zh: {
    badge: "国庆献礼 · 2026",
    title: "神雕农机品牌影片《跨山海》",
    subtitle:
      "庆祝中华人民共和国成立 77 周年 —— 30 秒，看中国农机如何跨山越海，把好农机送到世界每一个田野。",
    facts: "309 品牌 · 618 配件 · 14 品类 · 8 语种 · 六大市场",
    cta: "观看影片",
    duration: "30 秒 · 1080P",
    close: "关闭",
    playLabel: "播放神雕农机国庆献礼影片《跨山海》",
    posterAlt:
      "神雕农机国庆献礼影片《跨山海》画面：以数据丈量山海，309 个全球在售农机品牌、618 项配件供应体系、14 本品类手册、8 语种直达，覆盖中东、非洲、南亚与东南亚等六大目标市场。",
    videoFallback: "您的浏览器不支持视频播放。",
  },
  en: {
    badge: "National Day · 2026",
    title: "ShenDiao Brand Film — Crossing Mountains and Seas",
    subtitle:
      "Marking the 77th anniversary of the founding of the People's Republic of China — 30 seconds of Chinese machinery crossing mountains and seas to reach every field.",
    facts: "309 brands · 618 parts · 14 categories · 8 languages",
    cta: "Watch the film",
    duration: "30s · 1080P",
    close: "Close",
    playLabel: "Play the ShenDiao National Day brand film, Crossing Mountains and Seas",
    posterAlt:
      "A frame from the ShenDiao National Day brand film 'Crossing Mountains and Seas' — measuring the journey in data: 309 agricultural machinery brands on sale worldwide, 618 supply-chain parts, 14 category handbooks, 8 languages, covering six target regions including the Middle East, Africa, South Asia and Southeast Asia.",
    videoFallback: "Your browser does not support video playback.",
  },
};

export function BrandFilmBanner({ locale }: { locale: string }) {
  const isCn = isCnSite();
  const isRTL = locale === "ar";
  const t: BannerCopy = isCn
    ? CN_TEXTS[locale] || CN_TEXTS.zh
    : COM_TEXTS[locale] || COM_TEXTS.en;

  const [open, setOpen] = useState(false);

  // 弹窗打开时锁滚动 + 支持 ESC 关闭
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <section
      dir={isRTL ? "rtl" : "ltr"}
      aria-label={t.title}
      className="relative overflow-hidden bg-[#0d0d0f]"
    >
      {/* 底色：玄黑 → 深红（品牌色板 B 轨），右侧铺一层极淡的鎏金光晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0d0d0f] via-[#1a1a1a] to-[#331410]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-[#c8a35a]/10 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1.15fr_1fr] lg:gap-10 lg:px-8 lg:py-10">
        {/* 左：文案 + CTA */}
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c8a35a]/15 px-3 py-1 text-[11px] font-bold tracking-wide text-[#e0c485] ring-1 ring-[#c8a35a]/40 sm:text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            {t.badge}
          </span>

          <h2 className="mt-3 text-xl font-bold leading-snug text-[#f5f1e8] sm:text-2xl lg:text-3xl">
            {t.title}
          </h2>

          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-[#f5f1e8]/75 sm:text-base">
            {t.subtitle}
          </p>

          <p className="mt-3 text-xs font-semibold tracking-wide text-[#c8a35a] sm:text-sm">
            {t.facts}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t.playLabel}
              className="inline-flex items-center gap-2 rounded-lg bg-[#e63e2e] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#e63e2e]/25 transition hover:bg-[#c9351f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a35a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0f] sm:text-base"
            >
              <Play className="h-4 w-4 fill-current" />
              {t.cta}
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#f5f1e8]/55 sm:text-sm">
              <Film className="h-4 w-4" />
              {t.duration}
            </span>
          </div>
        </div>

        {/* 右：海报缩略图（点击同样打开弹窗） */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.playLabel}
          className="group relative block w-full overflow-hidden rounded-xl ring-1 ring-[#c8a35a]/35 transition hover:ring-[#c8a35a]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a35a]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={POSTER_SRC}
            alt={t.posterAlt}
            width={1920}
            height={1080}
            loading="lazy"
            className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          {/* 播放按钮 + 压暗蒙层 */}
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/15">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e63e2e]/90 text-white shadow-xl ring-4 ring-white/25 transition group-hover:scale-110 sm:h-16 sm:w-16">
              <Play className="h-6 w-6 translate-x-0.5 fill-current sm:h-7 sm:w-7" />
            </span>
          </span>
        </button>
      </div>

      {/* 播放弹窗 */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.close}
              className="absolute -top-10 right-0 inline-flex items-center gap-1.5 text-sm text-white/80 transition hover:text-white"
            >
              <X className="h-4 w-4" />
              {t.close}
            </button>
            <video
              controls
              autoPlay
              playsInline
              preload="metadata"
              poster={POSTER_SRC}
              className="w-full rounded-lg shadow-2xl"
            >
              <source src={VIDEO_SRC} type="video/mp4" />
              {t.videoFallback}
            </video>
          </div>
        </div>
      )}
    </section>
  );
}
