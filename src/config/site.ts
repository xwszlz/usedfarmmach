/**
 * SITE 真相源 — 唯一入口
 *
 * 读 process.env.SITE（缺省值 "com"），导出 siteConfig 供全站使用。
 *
 * - 客户端：构建时注入 NEXT_PUBLIC_SITE（在 next.config.js 中设置），
 *   组件用 useSite() 消费。
 * - 服务端：process.env.SITE 或直接从本模块 import { SITE, siteConfig }。
 */

export type SiteVariant = "com" | "cn";

export const SITE: SiteVariant = (process.env.SITE ?? "com") as SiteVariant;

export interface SitePayments {
  stripe: boolean;
  wechatPay: boolean;
}

export interface SiteFeatures {
  /** AI 估值功能 */
  valuation: boolean;
  /** 价格指数 */
  priceIndex: boolean;
  /** 政府监管看板 */
  govDashboard: boolean;
  /** 车况信息卡 / 核验 */
  machineryIdentity: boolean;
  /** 展会模块 */
  expo: boolean;
  /** Stripe 增值包 */
  stripeAddons: boolean;
  /** 权属核验 */
  certificate: boolean;
  /** 小程序码 */
  miniAppQr: boolean;
}

export interface SiteCompliance {
  icpNo: string | null;
  /** 公安联网备案号（如「冀公网安备13013202000274号」），无则为 null */
  beianNo: string | null;
  dataLocalized: boolean;
  serveDomesticUsers: boolean;
  /**
   * 拍卖经营批准证书编号（S4 公示模块）。
   * 仅 .cn 读取环境变量 CN_AUCTION_LICENSE_NO；未取证时保持 null，
   * 对应公示组件一律不渲染，避免"无照虚假公示"反向违规（2024-50号文）。
   */
  auctionLicenseNo: string | null;
}

export interface SiteConfigItem {
  site: SiteVariant;
  siteName: string;
  locales: string[];
  defaultLocale: string;
  domains: {
    primary: string;
    /** canonical 主机名（不带协议）—— 线上最终落地的那个，SEO 输出一律用它 */
    canonical: string;
    aliases: string[];
  };
  payments: SitePayments;
  features: SiteFeatures;
  compliance: SiteCompliance;
  /** 版本标识，用于构建/部署追溯 */
  version: string;
}

type SiteConfigMap = Record<SiteVariant, SiteConfigItem>;

export const siteConfigMap: SiteConfigMap = {
  com: {
    site: "com",
    siteName: "AgriTrade",
    locales: ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"],
    defaultLocale: "en",
    domains: {
      primary: "usedfarmmach.com",
      // 2026-09-25 实测：裸域 usedfarmmach.com --308--> www.usedfarmmach.com。
      // 故 canonical 必须带 www，否则 canonical / hreflang / og:url / sitemap
      // 输出的每条 URL 都指向一个「会跳转的地址」。
      canonical: "www.usedfarmmach.com",
      aliases: ["usedfarmmach.com", "www.usedfarmmach.com"],
    },
    payments: { stripe: true, wechatPay: false },
    features: {
      valuation: true,
      priceIndex: false,
      govDashboard: false,
      machineryIdentity: false,
      expo: true,
      stripeAddons: true,
      certificate: false,
      miniAppQr: false,
    },
    compliance: {
      icpNo: null,
      beianNo: null,
      dataLocalized: false,
      serveDomesticUsers: false,
      auctionLicenseNo: null,
    },
    version: "1.0.0",
  },
  cn: {
    site: "cn",
    siteName: "神雕农机",
    locales: ["zh", "en"],
    defaultLocale: "zh",
    domains: {
      primary: "usedfarmmach.cn",
      // .cn 裸域与 www 均**直接 200**（无跳转，2026-09-25 实测）⇒ 保持裸域不变。
      canonical: "usedfarmmach.cn",
      aliases: ["usedfarmmach.cn", "www.usedfarmmach.cn"],
    },
    payments: { stripe: false, wechatPay: true },
    features: {
      valuation: true,
      priceIndex: true,
      govDashboard: true,
      machineryIdentity: true,
      expo: true,
      stripeAddons: false,
      certificate: true,
      miniAppQr: true,
    },
    compliance: {
      icpNo: process.env.CN_ICP_NO ?? "冀ICP备2024053719号-4",
      beianNo: process.env.CN_BEIAN_NO ?? "冀公网安备13013202000274号",
      dataLocalized: true,
      serveDomesticUsers: true,
      auctionLicenseNo: process.env.CN_AUCTION_LICENSE_NO ?? null,
    },
    version: "1.0.0-cn",
  },
};

/** 当前站点的完整配置 */
export const siteConfig: SiteConfigItem = siteConfigMap[SITE];

/** .cn 专属功能开关（简便引用） */
export const cnFeatures = siteConfig.features;

/**
 * 客户端用 Hook：读取 NEXT_PUBLIC_SITE。
 * 在 Server Component / Route Handler 中直接 import { siteConfig } 即可。
 */
export function getSiteVariant(): SiteVariant {
  if (typeof window !== "undefined") {
    // 客户端从 meta 或环境变量读
    const meta = document.querySelector('meta[name="x-site"]');
    if (meta) {
      const val = meta.getAttribute("content");
      if (val === "cn" || val === "com") return val;
    }
  }
  return SITE;
}

/** 是否为 .cn 站点 */
export function isCnSite(): boolean {
  return getSiteVariant() === "cn";
}

/** 是否为 .com 站点 */
export function isComSite(): boolean {
  return getSiteVariant() === "com";
}

/**
 * 是否允许调用「境外 AI 服务」（Gemini / OpenRouter / OpenAI 等）。
 *
 * 🔴 合规红线：.cn 站数据不出境。
 *    - .cn：一律返回 false —— 所有境外 AI 分支必须被跳过，只允许走境内的豆包（ARK/火山引擎）。
 *    - .com：返回 true —— 维持原有国际链路不变。
 *
 * 用法：在调用境外 AI 之前将其并入守卫条件，例如
 *   if (!text && GOOGLE_API_KEY && isOverseasAiAllowed()) { ... }
 *
 * 注意：本函数只回答「站点是否允许」。是否真的调用，仍取决于对应 API Key 是否配置。
 * 两者是「与」关系，缺一不可 —— 这样即使未来 .cn 误配了境外 key，也不会出境。
 */
export function isOverseasAiAllowed(): boolean {
  return getSiteVariant() !== "cn";
}
