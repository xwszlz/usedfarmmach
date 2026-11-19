/**
 * 客服邮箱真相源（客户端安全）
 *
 * - 不引 Prisma、不引 next/headers、不散读 process.env；
 *   仅复用 site.ts 的纯数据 siteConfigMap 与 getSiteVariant()。
 * - P1：提供分站客服地址解析与字面量正则常量；
 *   P2 工程师将用 localizeSupportEmail() 做 i18n 单一汇聚点替换。
 */
import { getSiteVariant, siteConfigMap } from "./site";

/** 历史硬编码客服邮箱字面量（3 组 × 8 语字典中的死键 + 页面直接字面量） */
export const SUPPORT_EMAIL_LITERALS: RegExp = /jiusei0319@gmail\.com|932133255@qq\.com/g;

/** URL 编码变体（@ → %40），部分文案以链接形式出现 */
const SUPPORT_EMAIL_ENCODED_LITERALS: RegExp = /jiusei0319%40gmail\.com|932133255%40qq\.com/gi;

/** 当前站点客服邮箱，由 getSiteVariant() 决定（客户端 meta 优先） */
export function getSupportEmail(): string {
  return siteConfigMap[getSiteVariant()].supportEmail;
}

/** 当前站点系统发信 from 地址 */
export function getSystemFromEmail(): string {
  return siteConfigMap[getSiteVariant()].systemFromEmail;
}

/**
 * 把历史客服邮箱字面量替换为当前站点的客服邮箱。
 * 纯函数、同步、客户端安全；无命中时原样返回。
 */
export function localizeSupportEmail(text: string): string {
  if (typeof text !== "string" || text.length === 0) return text;
  const email = getSupportEmail();
  // 每次新建 RegExp，避免全局正则 lastIndex 状态跨调用泄漏
  return text
    .replace(new RegExp(SUPPORT_EMAIL_LITERALS.source, "g"), email)
    .replace(new RegExp(SUPPORT_EMAIL_ENCODED_LITERALS.source, "gi"), email);
}
