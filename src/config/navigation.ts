import type { Locale } from "../../i18n";

export interface NavItem {
  href?: string;
  labelKey?: string;
  label?: string;
  children?: NavItem[];
}

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
    ],
  },
  { href: "/blog", labelKey: "nav.blog" },
  { href: "/intelligence", labelKey: "nav.intelligence" },
  { href: "/logistics", labelKey: "nav.logistics" },
  { href: "/about", labelKey: "nav.about" },
];

export function getLocalePath(path: string, locale: Locale): string {
  return `/${locale}${path}`;
}
