export interface NavItem {
  href: string;
  labelKey: string;
  highlight?: boolean;
  /** Spotlight: the brightest nav item site-wide (gradient capsule + pulse). Takes precedence over highlight. */
  spotlight?: boolean;
}

/**
 * Unified 9-item flat navigation (no dropdowns).
 * Used for both zh and en — labels come from i18n translation keys.
 *
 * 首页 | 二手农机 | 零配件 | 增值服务 | 博览会 | AI竞技场 | AI认证 | 研究Hub | 关于我们
 */
export const mainNav: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/products", labelKey: "nav.machinery" },
  { href: "/auctions", labelKey: "nav.bargain", spotlight: true },
  { href: "/parts", labelKey: "nav.parts" },
  { href: "/services", labelKey: "nav.services" },
  { href: "/expo", labelKey: "nav.expo" },
  { href: "/arena", labelKey: "nav.arena", highlight: true },
  { href: "/engineer", labelKey: "nav.engineer" },
  { href: "/research", labelKey: "nav.research" },
  { href: "/about", labelKey: "nav.about" },
];

/** Resolve nav items for a given locale — now unified, same for all locales */
export function getNavForLocale(_locale: string): NavItem[] {
  return mainNav;
}

export function getLocalePath(path: string, locale: string): string {
  return `/${locale}${path}`;
}
