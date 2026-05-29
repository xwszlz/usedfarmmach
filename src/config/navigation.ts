import type { Locale } from "../../i18n";

export interface NavItem {
  href?: string;
  labelKey: string;
  children?: NavItem[];
}

export const mainNav: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/products", labelKey: "nav.products" },
  { href: "/blog", labelKey: "nav.blog" },
  { href: "/intelligence", labelKey: "nav.intelligence" },
  { href: "/logistics", labelKey: "nav.logistics" },
  { href: "/about", labelKey: "nav.about" },
];

export function getLocalePath(path: string, locale: Locale): string {
  return `/${locale}${path}`;
}
