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
  paddle: boolean;
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
  /** Paddle 增值包 */
  paddleAddons: boolean;
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
  /** 客服邮箱（分站，不带 notify. 前缀） */
  supportEmail: string;
  /**
   * 销售邮箱（分站，可选）—— 站内所有「我要买」类询盘的落点：
   * 产品询盘、配件询价、展会/品牌招商、验机预约、页脚与 services 页 CTA。
   *
   * 该地址只在 .com 开通；.cn 未开通 ⇒ 留空，`getSalesEmail()` 回退 supportEmail，
   * 保证 .cn 永不下发一个收不到信的地址（2026-11-21 老板拍板）。
   */
  salesEmail?: string;
  /**
   * 市场 / 商务合作邮箱（分站，可选）—— 只用于「我们对别人提交」的场景
   * （广告目录收录、媒体联络、协会名录），**不上前台主打位**，避免被爬虫抓走后灌垃圾邮件。
   *
   * 同样只在 .com 开通；.cn 留空 ⇒ `getMarketingEmail()` 回退 supportEmail。
   */
  marketingEmail?: string;
  /** 系统发信 from（分站，notify. 子域） */
  systemFromEmail: string;
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
    payments: { paddle: true, wechatPay: false },
    features: {
      valuation: true,
      priceIndex: false,
      govDashboard: false,
      machineryIdentity: false,
      expo: true,
      paddleAddons: true,
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
    supportEmail: "support@usedfarmmach.com",
    // 销售 / 市场两个地址（2026-11-21）：Resend 收信 webhook 已按地址分流到
    // sales@shendiaotech.cn / marketing@shendiaotech.cn 企业邮公共邮箱，
    // 再由公共邮箱 + 邮件群组落到国外业务部与市场组。
    salesEmail: "sales@usedfarmmach.com",
    marketingEmail: "marketing@usedfarmmach.com",
    // 系统发件人 = 客服地址本身（2026-11-20 老板拍板统一规范）：
    // ① 废掉 no-reply（不礼貌、拉低送达率、客户无处追问）；
    // ② 不用 notify. 子域——该子域从未在 Resend 验证，发信必被拒；
    //    usedfarmmach.com 根域已通过 DKIM(resend._domainkey) + send. 子域 SPF 验证。
    systemFromEmail: "support@usedfarmmach.com",
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
    payments: { paddle: false, wechatPay: true },
    features: {
      valuation: true,
      priceIndex: true,
      govDashboard: true,
      machineryIdentity: true,
      expo: true,
      paddleAddons: false,
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
    // 🔴 2026-11-21 老板拍板 A 方案：.cn 站客服邮箱改用 shendiaotech.cn 域。
    //
    // 为什么不是 support@usedfarmmach.cn（原值）——两个硬约束：
    //   ① usedfarmmach.cn **没有任何 MX 记录**（nslookup 8.8.8.8 实测，NS=vip1.alidns.com），
    //      即该地址是「死信箱」：页面上挂出去的客服邮箱，客户来信全部静默消失。
    //   ② 腾讯企业邮**免费版只允许绑定 1 个自有域名**，名额已被 shendiaotech.cn 占用
    //      （MX=mxbiz1.qq.com/mxbiz2.qq.com）；且只允许本域账号发信。
    //      ⇒ 拿 shendiaotech.cn 的账号密码，却在信头写 usedfarmmach.cn，收发两头都不成立。
    // 代价：发件人显示的是公司域（shendiaotech.cn）而非平台域（usedfarmmach.cn），可接受。
    supportEmail: "support@shendiaotech.cn",
    // ⚠️ .cn 站**没有** sales@ / marketing@ 邮箱（腾讯企业邮只开了 support 一个公共邮箱）。
    //    这里刻意留空，getSalesEmail() / getMarketingEmail() 会回退到 supportEmail，
    //    避免页面挂出一个收不到信的死地址。将来 .cn 开通再填即可。
    // 同 .com 口径：发件人即客服地址，不再使用 no-reply / notify. 子域。
    // .cn 走腾讯企业邮 SMTP（smtp.exmail.qq.com:465 SSL），
    //   凭据为 support@shendiaotech.cn 的「客户端专用密码」——不是登录密码。
    systemFromEmail: "support@shendiaotech.cn",
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

/** 当前站点客服邮箱（客户端 meta 优先，服务端构建期 SITE） */
export function getSupportEmail(): string {
  return siteConfigMap[getSiteVariant()].supportEmail;
}

/** 当前站点系统发信 from 地址 */
export function getSystemFromEmail(): string {
  return siteConfigMap[getSiteVariant()].systemFromEmail;
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
 * 是否允许调用「境外 AI 服务」（历史兼容守卫）。
 *
 * 🔴 合规红线：.cn 站数据不出境。
 *    V1.3 起全站 AI 已统一走境内豆包（ARK/火山引擎，.cn 直连 / .com 经 B 通道代理），
 *    不再存在境外 AI 分支，本函数已不再被任何调用方使用。
 *
 * 用法（历史示例）：在调用境外 AI 之前将其并入守卫条件，例如
 *   if (!text && isOverseasAiAllowed()) { ... }
 *
 * 注意：本函数只回答「站点是否允许」。是否真的调用，仍取决于对应 API Key 是否配置。
 * 两者是「与」关系，缺一不可 —— 这样即使未来 .cn 误配了境外 key，也不会出境。
 */
export function isOverseasAiAllowed(): boolean {
  return getSiteVariant() !== "cn";
}
