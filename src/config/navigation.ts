import type { Locale } from "../../i18n";

export interface NavItem {
  href?: string;
  labelKey?: string;
  label?: string;
  children?: NavItem[];
}

/**
 * English navigation: structured dropdowns for international buyers
 * HOME | BUY▼ | SELL▼ | INSIGHTS▼ | SERVICES▼ | ABOUT
 */
export const mainNavEn: NavItem[] = [
  { href: "/", label: "HOME" },
  {
    label: "BUY",
    children: [
      { href: "/products", label: "Browse Equipment" },
      { href: "/auctions", label: "Auctions" },
      { href: "/products?match=true", label: "Buyer Request" },
      { href: "/brand/claas", label: "CLAAS" },
      { href: "/brand/new-holland", label: "New Holland" },
      { href: "/brand/john-deere", label: "John Deere" },
      { href: "/brand/krone", label: "Krone" },
      { href: "/products?category=forage-harvester", label: "Silage Harvesters" },
      { href: "/products?category=baler", label: "Balers" },
      { href: "/products?category=header", label: "Headers & Pickup Heads" },
      { href: "/products?category=implement", label: "Implements" },
    ],
  },
  {
    label: "SELL",
    children: [
      { href: "/seller/products/new", label: "List Equipment" },
      { href: "/seller/guide", label: "Listing Guide" },
      { href: "/seller/products", label: "Seller Center" },
      { href: "/seller/inquiries", label: "Inquiries" },
      { href: "/seller/certification", label: "Certification" },
      { href: "/user/favorites", label: "My Favorites" },
    ],
  },
  {
    label: "INSIGHTS",
    children: [
      { href: "/insights", label: "Market Insights" },
      { href: "/intelligence", label: "Market Intel" },
      { href: "/arbitrage", label: "Arbitrage Rankings" },
      { href: "/blog", label: "Industry News" },
    ],
  },
  {
    label: "SERVICES",
    children: [
      { href: "/logistics", label: "Logistics" },
      { href: "/service-network", label: "Service Network" },
      { href: "/standards", label: "Standards" },
      { href: "/parts", label: "Parts" },
      { href: "/solutions", label: "Solutions" },
      { href: "/finance", label: "Finance & Insurance" },
      { href: "/about#contact", label: "Contact Us" },
    ],
  },
  { href: "/about", label: "ABOUT" },
];

/**
 * Chinese / default navigation: structured dropdowns
 * 首页 | 买农机▼ | 卖农机▼ | 市场洞察▼ | 服务支持▼ | 关于我们
 */
export const mainNav: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  {
    labelKey: "nav.buyMachinery",
    children: [
      { href: "/products", labelKey: "nav.browseEquipment" },
      { href: "/auctions", label: "在线拍卖" },
      { href: "/products?match=true", labelKey: "nav.buyerRequest" },
      { href: "/brand/claas", label: "CLAAS" },
      { href: "/brand/new-holland", label: "New Holland" },
      { href: "/brand/krone", label: "Krone" },
      { href: "/brand/john-deere", label: "John Deere" },
      { href: "/category/forage-harvester", label: "青储机" },
      { href: "/category/baler", label: "打捆机" },
      { href: "/category/mower", label: "割草机" },
      { href: "/category/bale-wrapper", label: "裹包机" },
      { href: "/category/forage-header", label: "饲料割台" },
      { href: "/category/pickup-header", label: "捡拾割台" },
      { href: "/category/rake", label: "搂草机" },
      { href: "/category/tedder", label: "摊晒机" },
    ],
  },
  {
    labelKey: "nav.sellMachinery",
    children: [
      { href: "/seller/products/new", labelKey: "nav.publishProduct" },
      { href: "/seller/guide", labelKey: "nav.publishGuide" },
      { href: "/seller/products", labelKey: "nav.sellerCenter" },
      { href: "/seller/inquiries", labelKey: "nav.inquiryManagement" },
      { href: "/seller/certification", labelKey: "nav.certification" },
      { href: "/user/favorites", labelKey: "nav.myFavorites" },
    ],
  },
  {
    labelKey: "nav.marketInsights",
    children: [
      { href: "/insights", label: "数据洞察" },
      { href: "/intelligence", labelKey: "nav.intelligence" },
      { href: "/arbitrage", labelKey: "nav.arbitrageAnalysis" },
      { href: "/blog", labelKey: "nav.blog" },
    ],
  },
  {
    labelKey: "nav.serviceSupport",
    children: [
      { href: "/logistics", labelKey: "nav.logistics" },
      { href: "/service-network", labelKey: "nav.serviceNetwork" },
      { href: "/standards", labelKey: "nav.standards" },
      { href: "/parts", labelKey: "nav.parts" },
      { href: "/solutions", labelKey: "nav.solutions" },
      { href: "/finance", label: "金融保险" },
      { href: "/about#contact", labelKey: "nav.contactUs" },
    ],
  },
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
