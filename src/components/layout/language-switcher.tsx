"use client";
import Link from "next/link";
import { Globe } from "lucide-react";
import { useState } from "react";
import { useTr } from "@/lib/i18n-tr";
interface LanguageSwitcherProps {
    locale: string;
    className?: string;
}
function getLanguages(tr: (s: string) => string) {
  return [
    { code: "zh", label: tr("中文"), flag: "\uD83C\uDDE8\uD83C\uDDF3" },
    { code: "en", label: "English", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
    { code: "ru", label: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", flag: "\uD83C\uDDF7\uD83C\uDDFA" },
    { code: "es", label: "Espa\u00F1ol", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
    { code: "pt", label: "Portugu\u00EAs", flag: "\uD83C\uDDE7\uD83C\uDDF7" },
    { code: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", flag: "\uD83C\uDDF8\uD83C\uDDE6" },
    { code: "fr", label: "Fran\u00E7ais", flag: "\uD83C\uDDEB\uD83C\uDDF7" },
    { code: "hi", label: "\u0939\u093F\u0928\u094D\u0926\u0940", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
];
}
export function LanguageSwitcher({ locale, className }: LanguageSwitcherProps) {
  const tr = useTr();
        const [open, setOpen] = useState(false);
    const current = getLanguages(tr).find((l) => l.code === locale) || getLanguages(tr)[0];
    return (<div className={`relative ${className ?? ""}`}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary-600">
        <Globe className="h-4 w-4"/>
        <span>{current.flag} {current.label}</span>
      </button>

      {open && (<>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}/>
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border bg-white py-1 shadow-lg">
            {getLanguages(tr).map((lang) => (<Link key={lang.code} href={`/${lang.code}`} onClick={() => setOpen(false)} className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${lang.code === locale
                    ? "font-medium text-primary-600 bg-primary-50"
                    : "text-gray-600"}`}>
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </Link>))}
          </div>
        </>)}
    </div>);
}
