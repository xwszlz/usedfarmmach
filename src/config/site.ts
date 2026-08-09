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
  dataLocalized: boolean;
  serveDomesticUsers: boolean;
}

export interface SiteConfigItem {
  site: SiteVariant;
  siteName: string;
  locales: string[];
  defaultLocale: string;
  domains: {
    primary: string;
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
      dataLocalized: false,
      serveDomesticUsers: false,
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
      dataLocalized: true,
      serveDomesticUsers: true,
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
