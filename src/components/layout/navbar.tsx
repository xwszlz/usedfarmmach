"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Globe, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { mainNav } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  locale: string;
}

export function Navbar({ locale }: NavbarProps) {
  const t = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <img
            src="/logo.jpg"
            alt="神雕农机"
            className="h-10 w-auto object-contain"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-600"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher locale={locale} />
          <div className="hidden items-center gap-2 md:flex">
            <Link href={`/${locale}/auth/login`}>
              <Button variant="ghost" size="sm">
                {t("nav.login")}
              </Button>
            </Link>
            <Link href={`/${locale}/auth/register`}>
              <Button size="sm">{t("nav.register")}</Button>
            </Link>
          </div>
          <button
            className="rounded-lg p-2 hover:bg-gray-100 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t md:hidden">
          <div className="space-y-1 px-4 py-3">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                onClick={() => setMobileOpen(false)}
              >
                {t(item.labelKey)}
              </Link>
            ))}
            <div className="flex gap-2 pt-2">
              <Link href={`/${locale}/auth/login`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link href={`/${locale}/auth/register`} className="flex-1">
                <Button size="sm" className="w-full">
                  {t("nav.register")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function LanguageSwitcher({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);

  const languages = [
    { code: "zh", label: "中文", flag: "🇨🇳" },
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "ru", label: "Русский", flag: "🇷🇺" },
  ];

  const current = languages.find((l) => l.code === locale) || languages[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
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
