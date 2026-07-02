import type { Locale } from "../../i18n";

export interface NavItem {
  href?: string;
  labelKey?: string;
  label?: string;
  children?: NavItem[];
}

/** English navigation: category-first layout for international buyers */
export const mainNavEn: NavItem[] = [
  { href: "/", label: "HOME" },
  { href: "/products?category=forage-harvester", label: "USED SILAGE HARVESTERS" },
  { href: "/products?category=baler", label: "USED BALERS" },
  { href: "/products?category=header", label: "HEADER & PICKUP HEADS" },
  { href: "/products?category=implement", label: "IMPLEMENTS" },
  { href: "/about", label: "ABOUT US" },
  { href: "/about#contact", label: "CONTACT US" },
];

/** Chinese / default navigation: brand + category dropdowns for Chinese users */
export const mainNav: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/products", labelKey: "nav.products" },
  {
    labelKey: "nav.brands",
    children: [
      { href: "/brand/claas", label: "CLAAS" },
      { href: "/brand/new-holland", label: "New Holland" },
      { href: "/brand/krone", label: "Krone" },
      { href: "/brand/john-deere", label: "John Deere" },
    ],
  },
  {
    labelKey: "nav.categories",
    children: [
      { href: "/category/forage-harvester", label: "青储机" },
      { href: "/category/baler", label: "打捆机" },
      { href: "/category/mower", label: "割草机" },
      { href: "/category/bale-wrapper", label: "裹包机" },
      { href: "/category/forage-header", label: "饲料割台" },
      { href: "/category/pickup-header", label: "捡拾割台" },
      { href: "/category/rake", label: "搂草机" },
      { href: "/category/tedder", label: "摊晒机" },
      { href: "/category/spare-parts", label: "配件" },
    ],
  },
  { href: "/blog", labelKey: "nav.blog" },
  { href: "/intelligence", labelKey: "nav.intelligence" },
  { href: "/logistics", labelKey: "nav.logistics" },
  { href: "/about", labelKey: "nav.about" },
];

/** Resolve the appropriate nav items for a given locale */
export function getNavForLocale(locale: Locale): NavItem[] {
  if (locale === "en") {
    return mainNavEn;
  }
  return mainNav;
}

export function getLocalePath(path: string, locale: Locale): string {
  return `/${locale}${path}`;
}
