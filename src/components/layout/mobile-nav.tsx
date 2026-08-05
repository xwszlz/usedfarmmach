"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { mainNav } from "@/config/navigation";
import { Button } from "@/components/ui/button";

interface MobileNavProps {
  locale: string;
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ locale, open, onClose }: MobileNavProps) {
  const t = useTranslations();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-72 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <img
            src="/logo.jpg"
            alt="神雕农机"
            className="h-8 w-auto object-contain"
          />
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-6 space-y-1">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className="block rounded-lg px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
              onClick={onClose}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
        <div className="mt-6 space-y-2">
          <Link href={`/${locale}/auth/login`} onClick={onClose}>
            <Button variant="outline" className="w-full">
              {t("nav.login")}
            </Button>
          </Link>
          <Link href={`/${locale}/auth/register`} onClick={onClose}>
            <Button className="w-full">{t("nav.register")}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
