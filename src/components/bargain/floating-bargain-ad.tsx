"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Tag, ArrowRight } from "lucide-react";

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

export function FloatingBargainAd({ locale = "zh" }: { locale?: string }) {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Don't show on auction pages (would be redundant)
    if (pathname.includes("/auctions")) return;

    // Show after a short delay so page content loads first
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  const t = BAR_LABELS[locale] || BAR_LABELS.en;
  const href = `/${locale}/auctions`;

  return (
    <div
      className="fixed bottom-4 left-4 z-40 animate-[slideInLeft_0.3s_ease-out]"
      role="complementary"
      aria-label={t.title}
    >
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <Link
        href={href}
        className="group flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-white/95 px-4 py-2.5 shadow-md backdrop-blur-sm transition-all hover:border-emerald-400 hover:shadow-lg active:scale-[0.98]"
      >
        {/* Icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
          <Tag className="h-4 w-4 text-emerald-600" />
        </div>

        {/* Text */}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight text-gray-800">{t.title}</h3>
          <p className="flex items-center gap-0.5 text-xs text-gray-500 transition-all group-hover:gap-1.5 group-hover:text-emerald-600">
            {t.cta}
            <ArrowRight className="h-3 w-3" />
          </p>
        </div>
      </Link>
    </div>
  );
}
