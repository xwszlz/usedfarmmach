export interface NavItem {
  href: string;
  labelKey: string;
  highlight?: boolean;
  /** Spotlight: the brightest nav item site-wide (gradient capsule + pulse). Takes precedence over highlight. */
  spotlight?: boolean;
}

/**
 * 下拉菜单子项（分组导航）
 * - href 相对于当前 locale，如 "/products" → /zh/products
 * - 纯分组（无链接）用 href: "#" 且 children 非空
 */
export interface NavDropdown {
  labelKey: string;
  children: NavItem[];
  /** 下拉菜单在导航中的位置 */
  href?: string;
}

/**
 * 顶层导航：混合了直链项与下拉分组
 * 首页 | 买农机▼ | 卖农机▼ | 市场洞察▼ | 服务支持▼ | 关于我们
 */
export type TopNavItem = NavItem | NavDropdown;

/** 判断是否为下拉分组 */
export function isDropdown(item: TopNavItem): item is NavDropdown {
  return "children" in item && Array.isArray((item as NavDropdown).children);
}

/**
 * 重构后的统一导航（含下拉分组）。
 * 对标 improvement-plan P0-①：买农机/卖农机/市场洞察/服务支持 分组，
 * 突出"卖农机"交易入口。
 */
export const mainNav: TopNavItem[] = [
  { href: "/", labelKey: "nav.home" },

  // 买农机 ▼
  {
    labelKey: "nav.buyMachinery",
    children: [
      { href: "/products", labelKey: "nav.browseEquipment" },
      { href: "/auctions", labelKey: "nav.bargain", spotlight: true },
      { href: "/parts", labelKey: "nav.parts" },
    ],
  },

  // 卖农机 ▼（交易闭环核心入口）
  {
    labelKey: "nav.sellMachinery",
    children: [
      { href: "/seller/products/new", labelKey: "nav.publishProduct", highlight: true },
      { href: "/seller/guide", labelKey: "nav.publishGuide" },
      { href: "/seller/products", labelKey: "nav.sellerCenter" },
      { href: "/seller/inquiries", labelKey: "nav.inquiryManagement" },
    ],
  },

  // 市场洞察 ▼
  {
    labelKey: "nav.marketInsights",
    children: [
      { href: "/intelligence", labelKey: "nav.dailyReport" },
      { href: "/research", labelKey: "nav.industryReport" },
      { href: "/arbitrage-top", labelKey: "nav.arbitrageTop" },
      { href: "/blog", labelKey: "nav.blog" },
    ],
  },

  // 服务支持 ▼
  {
    labelKey: "nav.serviceSupport",
    children: [
      { href: "/logistics", labelKey: "nav.logistics" },
      { href: "/service-network", labelKey: "nav.serviceNetwork" },
      { href: "/services", labelKey: "nav.inspectionService" },
      { href: "/solutions", labelKey: "nav.solutions" },
      { href: "/standards", labelKey: "nav.standards" },
    ],
  },

  { href: "/about", labelKey: "nav.about" },
  { href: "/arena", labelKey: "nav.arena", highlight: true },
  { href: "/credits", labelKey: "nav.credits", highlight: true },
];

/** Resolve nav items for a given locale — unified, same for all locales */
export function getNavForLocale(_locale: string): TopNavItem[] {
  return mainNav;
}

export function getLocalePath(path: string, locale: string): string {
  return `/${locale}${path}`;
}
