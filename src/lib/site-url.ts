import { siteConfig } from "@/config/site";

/**
 * SEO 输出的 canonical origin（协议 + canonical 主机名，无尾斜杠）。
 *
 * 为什么不直接用 process.env.NEXT_PUBLIC_APP_URL：
 *   线上该变量被设为**裸域**（https://usedfarmmach.com），而裸域对全站
 *   308 跳 www（2026-09-25 实测：sitemap 2664 条 URL 全部多一跳）。
 *   若 canonical / hreflang / og:url / sitemap / JSON-LD 继续输出裸域，
 *   等于对外声明了一个「非最终」的 canonical host —— 既白费抓取预算，
 *   也让 canonical host 自相矛盾。
 *
 * 单一真相源 = siteConfig.domains.canonical（.com 带 www / .cn 保持裸域）。
 * ⚠️ 改动该值前，必须先确认线上跳转方向与之一致，否则会引入新的不统一。
 */
export const SITE_ORIGIN = `https://${siteConfig.domains.canonical}`;
