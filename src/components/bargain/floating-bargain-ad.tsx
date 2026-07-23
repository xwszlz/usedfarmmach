"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Tag, ArrowRight, X } from "lucide-react";

const BAR_LABELS: Record<string, { title: string; cta: string }> = {
  zh: { title: "在线询价", cta: "查看询价产品 →" },
  en: { title: "Online Inquiry", cta: "Browse inquiry products →" },
  ru: { title: "Онлайн-запрос", cta: "Смотреть товары →" },
  es: { title: "Consulta en línea", cta: "Ver productos →" },
  pt: { title: "Consulta online", cta: "Ver produtos →" },
  ar: { title: "استفسار عبر الإنترنت", cta: "عرض المنتجات →" },
  fr: { title: "Demande en ligne", cta: "Voir les produits →" },
  hi: { title: "ऑनलाइन पूछताछ", cta: "उत्पाद देखें →" },
};

/** sessionStorage key — once dismissed, the ad stays hidden for the rest of the session */
const DISMISS_KEY = "floatingAdDismissed";

export function FloatingBargainAd({ locale = "zh" }: { locale?: string }) {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Don't show on auction pages (would be redundant)
    if (pathname.includes("/auctions")) return;
    // Respect the per-session dismissal
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    // Show after a short delay so page content loads first
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  const t = BAR_LABELS[locale] || BAR_LABELS.en;
  const href = `/${locale}/auctions`;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-20 left-4 z-40 max-w-[calc(100vw-2rem)] animate-[slideInLeft_0.3s_ease-out] sm:bottom-24"
      role="complementary"
      aria-label={t.title}
    >
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes adHalo {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.18; transform: scale(1.07); }
        }
      `}</style>

      <div className="relative">
        {/* Breathing pulse halo — catches peripheral vision */}
        <div
          aria-hidden="true"
          className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 blur-md animate-[adHalo_2.5s_ease-in-out_infinite]"
        />

        {/* Card */}
        <Link
          href={href}
          className="group relative flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-4 py-3 shadow-xl shadow-emerald-500/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-400/60 active:scale-[0.98]"
        >
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
            <Tag className="h-5 w-5 text-emerald-600" />
          </div>

          {/* Text */}
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-tight text-white">{t.title}</h3>
            <p className="flex items-center gap-0.5 text-xs text-white/90 transition-all group-hover:gap-1.5 group-hover:text-white">
              {t.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </p>
          </div>
        </Link>

        {/* HOT badge */}
        <span className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-md">
          HOT
        </span>

        {/* Dismiss button — hidden for the rest of the session once clicked */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute -top-2 -left-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700/90 text-white shadow-md transition-colors hover:bg-gray-900"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
