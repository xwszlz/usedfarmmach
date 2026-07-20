"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, Gavel, ArrowRight, Sparkles } from "lucide-react";

const AD_LABELS: Record<string, { title: string; subtitle: string; cta: string; live: string }> = {
  zh: { title: "在线询价", subtitle: "精选好机 · 欢迎参与", cta: "立即参与", live: "正在进行" },
  en: { title: "Online Inquiry", subtitle: "Quality machines · Join now", cta: "Participate", live: "Live now" },
  ru: { title: "Онлайн-запрос цен", subtitle: "Отборная техника · Присоединяйтесь", cta: "Участвовать", live: "Идёт сейчас" },
  es: { title: "Consulta en línea", subtitle: "Maquinaria selecta · Únase ahora", cta: "Participar", live: "En vivo" },
  pt: { title: "Consulta online", subtitle: "Máquinas selecionadas · Participe", cta: "Participar", live: "Agora" },
  ar: { title: "استفسار عبر الإنترنت", subtitle: "آلات مختارة · انضم الآن", cta: "شارك", live: "مباشر" },
  fr: { title: "Demande en ligne", subtitle: "Machines sélectionnées · Rejoignez", cta: "Participer", live: "En direct" },
  hi: { title: "ऑनलाइन पूछताछ", subtitle: "चुनी हुई मशीनें · अभी शामिल हों", cta: "भाग लें", live: "अभी चल रहा है" },
};

const STORAGE_KEY = "ufm_bargain_ad_closed";
const HIDE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function FloatingBargainAd({ locale = "zh" }: { locale?: string }) {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Don't show on auction pages (would be redundant)
    if (pathname.includes("/auctions")) return;

    // Check if user closed it recently
    try {
      const closedTime = localStorage.getItem(STORAGE_KEY);
      if (closedTime) {
        const elapsed = Date.now() - parseInt(closedTime, 10);
        if (elapsed < HIDE_DURATION) return;
      }
    } catch {
      // localStorage not available (SSR or privacy mode)
    }

    // Delay show so page content loads first
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // ignore
    }
  }, []);

  if (!visible) return null;

  const t = AD_LABELS[locale] || AD_LABELS.en;
  const href = `/${locale}/auctions`;

  return (
    <div
      className="fixed bottom-4 left-4 z-40 animate-[slideInLeft_0.5s_ease-out]"
      role="dialog"
      aria-label={t.title}
    >
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes bargainPulse {
          0%, 100% { box-shadow: 0 8px 24px -4px rgba(245, 158, 11, 0.4), 0 0 0 0 rgba(245, 158, 11, 0.3); }
          50% { box-shadow: 0 8px 24px -4px rgba(245, 158, 11, 0.5), 0 0 0 8px rgba(245, 158, 11, 0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
      <Link
        href={href}
        className="group relative block w-[280px] overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 p-[2px] text-white shadow-2xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
        style={{ animation: "bargainPulse 2.5s ease-in-out infinite" }}
      >
        {/* Shimmer overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 3s linear infinite",
          }}
        />

        {/* Inner content */}
        <div className="relative rounded-[14px] bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 px-4 py-3.5">
          {/* Close button */}
          <button
            onClick={handleClose}
            aria-label="Close"
            className="absolute right-2 top-2 rounded-full p-1 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Main row */}
          <div className="flex items-center gap-3 pr-4">
            {/* Icon */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Gavel className="h-6 w-6 text-white" />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-base font-bold leading-tight">{t.title}</h3>
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-yellow-200" />
              </div>
              <p className="truncate text-xs text-white/85">{t.subtitle}</p>
            </div>
          </div>

          {/* Live indicator + CTA */}
          <div className="mt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              <span className="text-[10px] font-medium text-white/80">{t.live}</span>
            </div>

            <span className="inline-flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1 text-xs font-bold text-orange-600 transition-all group-hover:gap-2 group-hover:bg-white">
              {t.cta}
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
