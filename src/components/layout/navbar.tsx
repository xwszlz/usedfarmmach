"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Globe, Menu, X, ChevronDown, Store, LayoutDashboard } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { mainNav, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  locale: string;
}

type Userinfo = {
  role: string;
  email: string;
  membershipTier: string;
} | null;

export function Navbar({ locale }: NavbarProps) {
  const t = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<Userinfo>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setUser({
          role: u.role,
          email: u.email,
          membershipTier: u.membershipTier || "free",
        });
      } catch {}
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = `/${locale}`;
  };

  const tierLabel: Record<string, string> = {
    free: "免费",
    basic: "普通会员",
    premium: "高级会员",
    enterprise: "企业会员",
  };

  const tierColor: Record<string, string> = {
    free: "bg-gray-100 text-gray-500",
    basic: "bg-blue-100 text-blue-700",
    premium: "bg-amber-100 text-amber-700",
    enterprise: "bg-purple-100 text-purple-700",
  };

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
            <DesktopNavItem key={item.labelKey} item={item} locale={locale} t={t} />
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher locale={locale} />
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                {/* 会员等级徽章 */}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierColor[user.membershipTier] || tierColor.free}`}>
                  {tierLabel[user.membershipTier] || "免费"}
                </span>

                <Link href={`/${locale}/seller/products`}>
                  <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
                    <Store className="h-4 w-4" />
                    卖家中心
                  </Button>
                </Link>
                {user.role === "admin" && (
                  <Link href={`/${locale}/admin`}>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
                      <LayoutDashboard className="h-4 w-4" />
                      管理后台
                    </Button>
                  </Link>
                )}
                <Button variant="outline" size="sm" onClick={logout}>
                  退出
                </Button>
              </>
            ) : (
              <>
                <Link href={`/${locale}/auth/login`}>
                  <Button variant="ghost" size="sm">{t("nav.login")}</Button>
                </Link>
                <Link href={`/${locale}/auth/register`}>
                  <Button size="sm">{t("nav.register")}</Button>
                </Link>
              </>
            )}
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
              <MobileNavItem key={item.labelKey} item={item} locale={locale} t={t} setMobileOpen={setMobileOpen} />
            ))}
            <div className="flex gap-2 pt-2">
              {user ? (
                <>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierColor[user.membershipTier] || tierColor.free}`}>
                    {tierLabel[user.membershipTier] || "免费"}
                  </span>
                  <Link href={`/${locale}/seller/products`} className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button size="sm" className="w-full">卖家中心</Button>
                  </Link>
                  {user.role === "admin" && (
                    <Link href={`/${locale}/admin`} className="flex-1" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">管理后台</Button>
                    </Link>
                  )}
                  <Button variant="outline" size="sm" onClick={() => { logout(); setMobileOpen(false); }}>
                    退出
                  </Button>
                </>
              ) : (
                <>
                  <Link href={`/${locale}/auth/login`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">{t("nav.login")}</Button>
                  </Link>
                  <Link href={`/${locale}/auth/register`} className="flex-1">
                    <Button size="sm" className="w-full">{t("nav.register")}</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

interface DesktopNavItemProps {
  item: NavItem;
  locale: string;
  t: (key: string) => string;
}

function DesktopNavItem({ item, locale, t }: DesktopNavItemProps) {
  const [open, setOpen] = useState(false);
  const label = item.label || t(item.labelKey || '');

  if (item.children) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-primary-600"
        >
          {label}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border bg-white py-2 shadow-lg">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  href={`/${locale}${child.href}`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600"
                >
                  {child.label || t(child.labelKey || '')}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <Link
      href={`/${locale}${item.href}`}
      className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-600"
    >
      {label}
    </Link>
  );
}

interface MobileNavItemProps {
  item: NavItem;
  locale: string;
  t: (key: string) => string;
  setMobileOpen: (open: boolean) => void;
}

function MobileNavItem({ item, locale, t, setMobileOpen }: MobileNavItemProps) {
  const [open, setOpen] = useState(false);
  const label = item.label || t(item.labelKey || '');

  if (item.children) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <span>{label}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="ml-4 space-y-1 border-l pl-2">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={`/${locale}${child.href}`}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                {child.label || t(child.labelKey || '')}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={`/${locale}${item.href}`}
      onClick={() => setMobileOpen(false)}
      className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
    >
      {label}
    </Link>
  );
}

function LanguageSwitcher({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);

  const languages = [
    { code: "zh", label: "中文", flag: "🇨🇳" },
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "ru", label: "Русский", flag: "🇷🇺" },
    { code: "es", label: "Español", flag: "🇪🇸" },
    { code: "pt", label: "Português", flag: "🇧🇷" },
    { code: "ar", label: "العربية", flag: "🇸🇦" },
    { code: "fr", label: "Français", flag: "🇫🇷" },
    { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
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
