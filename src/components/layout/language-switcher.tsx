"use client";

import Link from "next/link";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  locale: string;
  className?: string;
}

export function LanguageSwitcher({ locale, className }: LanguageSwitcherProps) {
  const targetLocale = locale === "zh" ? "en" : "zh";
  const label = locale === "zh" ? "English" : "中文";

  return (
    <Link
      href={`/${targetLocale}`}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary-600 ${className ?? ""}`}
    >
      <Globe className="h-4 w-4" />
      {label}
    </Link>
  );
}
