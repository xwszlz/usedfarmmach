import type { Locale } from "../../i18n";

export interface NavItem {
  href?: string;
  labelKey: string;
  children?: NavItem[];
}

export const mainNav: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/products", labelKey: "nav.products" },
  { href: "/logistics", labelKey: "nav.logistics" },
  { href: "/about", labelKey: "nav.about" },
  { 
    labelKey: "nav.arbitrage", 
    children: [
      { href: "/arbitrage-calculator", labelKey: "nav.arbitrageCalculator" },
      { href: "/arbitrage-top", labelKey: "nav.arbitrageTop" },
    ]
  },
];

export function getLocalePath(path: string, locale: Locale): string {
  return `/${locale}${path}`;
}
