export interface NavItem {
  href: string;
  labelKey: string;
  highlight?: boolean;
}

/**
 * Unified 8-item flat navigation (no dropdowns).
 * Used for both zh and en — labels come from i18n translation keys.
 *
 * 首页 | 二手农机 | AI竞技场 | 博览会 | 零部件 | 增值服务 | 研究Hub | 关于我们
 */
export const mainNav: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/products", labelKey: "nav.machinery" },
  { href: "/arena", labelKey: "nav.arena", highlight: true },
  { href: "/engineer", labelKey: "nav.engineer" },
  { href: "/expo", labelKey: "nav.expo" },
  { href: "/parts", labelKey: "nav.parts" },
  { href: "/services", labelKey: "nav.services" },
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
