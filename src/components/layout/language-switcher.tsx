"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { useState } from "react";

interface LanguageSwitcherProps {
  locale: string;
  className?: string;
}

const languages = [
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
];

export function LanguageSwitcher({ locale, className }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const current = languages.find((l) => l.code === locale) || languages[0];

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary-600"
      >
        <Globe className="h-4 w-4" />
        <span>{current.flag} {current.label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border bg-white py-1 shadow-lg">
            {languages.map((lang) => (
              <Link
                key={lang.code}
                href={`/${lang.code}`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                  lang.code === locale
                    ? "font-medium text-primary-600 bg-primary-50"
                    : "text-gray-600"
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
