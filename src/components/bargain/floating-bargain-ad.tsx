"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Tag, ArrowRight, X } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
function getBAR_LABELS(tr: (s: string) => string): Record<string, {
    title: string;
    cta: string;
}> {
  return {
    zh: { title: tr("在线询价"), cta: "\u67E5\u770B\u8BE2\u4EF7\u4EA7\u54C1 \u2192" },
    en: { title: "Online Inquiry", cta: "Browse inquiry products \u2192" },
    ru: { title: "\u041E\u043D\u043B\u0430\u0439\u043D-\u0437\u0430\u043F\u0440\u043E\u0441", cta: "\u0421\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0442\u043E\u0432\u0430\u0440\u044B \u2192" },
    es: { title: "Consulta en l\u00EDnea", cta: "Ver productos \u2192" },
    pt: { title: "Consulta online", cta: "Ver produtos \u2192" },
    ar: { title: "\u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0639\u0628\u0631 \u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A", cta: "\u0639\u0631\u0636 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u2192" },
    fr: { title: "Demande en ligne", cta: "Voir les produits \u2192" },
    hi: { title: "\u0911\u0928\u0932\u093E\u0907\u0928 \u092A\u0942\u091B\u0924\u093E\u091B", cta: "\u0909\u0924\u094D\u092A\u093E\u0926 \u0926\u0947\u0916\u0947\u0902 \u2192" },
};
}
/** sessionStorage key — once dismissed, the ad stays hidden for the rest of the session */
const DISMISS_KEY = "floatingAdDismissed";
export function FloatingBargainAd({ locale = "zh" }: {
    locale?: string;
}) {
  const tr = useTr();
        const [visible, setVisible] = useState(false);
    const pathname = usePathname();
    useEffect(() => {
        // Don't show on auction pages (would be redundant)
        if (pathname.includes("/auctions"))
            return;
        // Respect the per-session dismissal
        if (sessionStorage.getItem(DISMISS_KEY) === "1")
            return;
        // Show after a short delay so page content loads first
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
    }, [pathname]);
    if (!visible)
        return null;
    const t = getBAR_LABELS(tr)[locale] || getBAR_LABELS(tr).en;
    const href = `/${locale}/auctions`;
    const dismiss = () => {
        sessionStorage.setItem(DISMISS_KEY, "1");
        setVisible(false);
    };
    return (<div className="fixed bottom-20 left-4 z-40 max-w-[calc(100vw-2rem)] animate-[slideInLeft_0.3s_ease-out] sm:bottom-24" role="complementary" aria-label={t.title}>
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
        <div aria-hidden="true" className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 blur-md animate-[adHalo_2.5s_ease-in-out_infinite]"/>

        {/* Card */}
        <Link href={href} className="group relative flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-4 py-3 shadow-xl shadow-emerald-500/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-400/60 active:scale-[0.98]">
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
            <Tag className="h-5 w-5 text-emerald-600"/>
          </div>

          {/* Text */}
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-tight text-white">{t.title}</h3>
            <p className="flex items-center gap-0.5 text-xs text-white/90 transition-all group-hover:gap-1.5 group-hover:text-white">
              {t.cta}
              <ArrowRight className="h-3.5 w-3.5"/>
            </p>
          </div>
        </Link>

        {/* HOT badge */}
        <span className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-md">
          HOT
        </span>

        {/* Dismiss button — hidden for the rest of the session once clicked */}
        <button type="button" onClick={dismiss} aria-label="Close" className="absolute -top-2 -left-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700/90 text-white shadow-md transition-colors hover:bg-gray-900">
          <X className="h-3 w-3"/>
        </button>
      </div>
    </div>);
}
