"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Globe, Menu, X, Store, LayoutDashboard } from "lucide-react";
import { useState, useEffect } from "react";
import { mainNav, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";

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
  const navItems = mainNav;

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
    free: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    basic: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    premium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    enterprise: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-gray-700 dark:bg-gray-950/95 dark:supports-[backdrop-filter]:bg-gray-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex shrink-0 items-center gap-2">
          <img
            src="/logo.jpg"
            alt="神雕农机"
            className="h-10 w-auto object-contain"
          />
        </Link>

        {/* Desktop nav — 8 items flat */}
        <nav className="hidden items-center gap-2 lg:flex">
          {navItems.map((item) => (
            <DesktopNavItem key={item.href} item={item} locale={locale} t={t} />
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && <NotificationBell locale={locale} />}
          <LanguageSwitcher locale={locale} />
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tierColor[user.membershipTier] || tierColor.free)}>
                  {tierLabel[user.membershipTier] || "免费"}
                </span>
                <Link href={`/${locale}/seller/products`}>
                  <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
                    <Store className="h-4 w-4" />
                    {locale === "en" ? "Seller" : "卖家中心"}
                  </Button>
                </Link>
                {["admin", "super_admin"].includes(user.role) && (
                  <Link href={`/${locale}/admin`}>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
                      <LayoutDashboard className="h-4 w-4" />
                      {locale === "en" ? "Admin" : "管理后台"}
                    </Button>
                  </Link>
                )}
                <Button variant="outline" size="sm" onClick={logout}>
                  {t("nav.logout")}
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
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 md:hidden"
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
        <div className="border-t border-gray-200 dark:border-gray-700 md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navItems.map((item) => (
              <MobileNavItem key={item.href} item={item} locale={locale} t={t} setMobileOpen={setMobileOpen} />
            ))}
            <div className="flex gap-2 pt-2">
              {user ? (
                <>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tierColor[user.membershipTier] || tierColor.free)}>
                    {tierLabel[user.membershipTier] || "免费"}
                  </span>
                  <Link href={`/${locale}/seller/products`} className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button size="sm" className="w-full">{locale === "en" ? "Seller" : "卖家中心"}</Button>
                  </Link>
                  {["admin", "super_admin"].includes(user.role) && (
                    <Link href={`/${locale}/admin`} className="flex-1" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">{locale === "en" ? "Admin" : "管理后台"}</Button>
                    </Link>
                  )}
                  <Button variant="outline" size="sm" onClick={() => { logout(); setMobileOpen(false); }}>
                    {t("nav.logout")}
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

    {/* Tagline banner — English locale only */}
    {locale === "en" && (
      <div className="bg-gray-900 text-center text-xs sm:text-sm text-white py-1.5 tracking-wide">
        Reliable Used Farm Machinery &nbsp;|&nbsp; Export Worldwide &nbsp;|&nbsp; FOB China Port
      </div>
    )}
  </>
  );
}

interface DesktopNavItemProps {
  item: NavItem;
  locale: string;
  t: (key: string) => string;
}

function splitNavLabel(label: string): string {
  if (label.length <= 2) return label;

  // 中文+英文混合：在中英文边界处切分
  // 研究Hub → 研究 \n Hub
  let m = label.match(/^([\u4e00-\u9fa5]+)([A-Za-z].*)$/);
  if (m) return m[1] + "\n" + m[2];
  // AI竞技场 → AI \n 竞技场
  m = label.match(/^([A-Za-z]+)([\u4e00-\u9fa5].*)$/);
  if (m) return m[1] + "\n" + m[2];

  // 纯中文：从中间切
  const mid = Math.ceil(label.length / 2);
  return label.slice(0, mid) + "\n" + label.slice(mid);
}

function DesktopNavItem({ item, locale, t }: DesktopNavItemProps) {
  const label = t(item.labelKey);

  return (
    <Link
      href={`/${locale}${item.href}`}
        className={cn(
          "rounded-lg px-2 py-1.5 text-sm font-medium text-center leading-tight min-w-[3.5rem]",
          item.spotlight
          ? "rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-3 font-bold text-white shadow-md shadow-orange-500/30 transition-all duration-300 animate-[pulse_2s_ease-in-out_infinite] hover:scale-105 hover:brightness-110 hover:shadow-lg hover:shadow-orange-500/50 dark:shadow-orange-400/30 dark:hover:shadow-orange-400/50"
          : item.highlight
          ? "bg-brand-accent-light text-brand-accent transition-colors dark:text-brand-accent"
          : "text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-primary-400"
      )}
    >
      <span className="whitespace-pre-line block">{splitNavLabel(label)}</span>
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
  const label = t(item.labelKey);

  return (
    <Link
      href={`/${locale}${item.href}`}
      onClick={() => setMobileOpen(false)}
      className={cn(
        "block rounded-lg px-3 py-2 text-sm font-medium transition-all",
        item.spotlight
          ? "rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 font-bold text-white shadow-md shadow-orange-500/30 animate-[pulse_2s_ease-in-out_infinite] hover:scale-[1.02] hover:brightness-110 dark:shadow-orange-400/30"
          : item.highlight
          ? "bg-brand-accent-light text-brand-accent dark:text-brand-accent"
          : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      )}
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
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{current.flag} {current.label}</span>
        <span className="sm:hidden">{current.flag}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
            {languages.map((lang) => (
              <Link
                key={lang.code}
                href={`/${lang.code}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800",
                  lang.code === locale
                    ? "font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-400"
                    : "text-gray-600 dark:text-gray-300"
                )}
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
