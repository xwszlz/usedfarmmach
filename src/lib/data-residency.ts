/**
 * DataResidencyGuard —— 数据驻留守卫
 *
 * 防御纵深（defense-in-depth）：
 * - 注册层已拦截境内用户注册 .com（+86 / country=CN）
 * - 中间件已做 geo 重定向（境内 IP → .cn）
 * - 本守卫在写入关键 PII 前再次断言 site 与 user.country 一致
 *
 * 使用场景：
 *   在创建/更新 User、Inquiry、Product 等涉及 PII 或属地字段的
 *   API route 中，写入前调用 assertDomesticWrite() 或 assertOverseasWrite()。
 */

import { SITE, type SiteVariant } from "@/config/site";

export interface UserResidencyInfo {
  id: string;
  country?: string | null;
  phone?: string | null;
}

/**
 * 检查用户属地是否与当前站点匹配。
 *
 * @param user - 用户信息（需含 country 字段）
 * @returns 合规返回 true，不合规返回 false
 */
export function checkResidency(user: UserResidencyInfo): boolean {
  if (SITE === "cn") {
    // .cn 站：仅允许境内用户（country=CN 或 phone 以 +86 开头）
    return isDomesticUser(user);
  } else {
    // .com 站：不允许境内用户
    return !isDomesticUser(user);
  }
}

/**
 * 判断用户是否为境内用户（中国）。
 * 依据：country==='CN' 或 phone 以 +86 开头。
 */
function isDomesticUser(user: UserResidencyInfo): boolean {
  if (user.country === "CN" || user.country === "cn") return true;
  if (user.phone?.startsWith("+86")) return true;
  return false;
}

/**
 * 断言当前操作为境内写入（.cn 站 → 用户应为境内用户）。
 * 如不匹配则抛出错误。
 */
export function assertDomesticWrite(user: UserResidencyInfo): void {
  if (SITE !== "cn") {
    throw new Error(
      `[DataResidency] assertDomesticWrite 只能在 SITE=cn 时调用（当前 SITE=${SITE}）`
    );
  }
  if (!isDomesticUser(user)) {
    throw new Error(
      `[DataResidency] 向 .cn 库写入非境内用户数据被拒绝（userId=${user.id}, country=${user.country}）`
    );
  }
}

/**
 * 断言当前操作为境外写入（.com 站 → 用户不应为境内用户）。
 * 如不匹配则抛出错误。
 */
export function assertOverseasWrite(user: UserResidencyInfo): void {
  if (SITE !== "com") {
    throw new Error(
      `[DataResidency] assertOverseasWrite 只能在 SITE=com 时调用（当前 SITE=${SITE}）`
    );
  }
  if (isDomesticUser(user)) {
    throw new Error(
      `[DataResidency] 向 .com 库写入境内用户数据被拒绝（userId=${user.id}, country=${user.country}）`
    );
  }
}

/**
 * 获取当前站点应服务的 country 白名单。
 * - .cn：仅 'CN'
 * - .com：除 'CN' 外的所有国家
 */
export function getAllowedCountries(site?: SiteVariant): string[] {
  const s = site ?? SITE;
  if (s === "cn") return ["CN"];
  return ["US", "GB", "DE", "FR", "RU", "IN", "BR", "AR", "ZA", "AU", "CA", "JP", "KR", "NG", "KE", "EG", "SA", "AE", "MX", "other"];
}

/**
 * 数据驻留检查配置接口
 */
export interface ResidencyCheckConfig {
  site: SiteVariant;
  userCountry: string | null | undefined;
  userPhone: string | null | undefined;
}

/**
 * 执行完整的数据驻留检查。
 * 返回 { pass: boolean, reason?: string }
 */
export function checkResidencyWithDetail(cfg: ResidencyCheckConfig): { pass: boolean; reason?: string } {
  const { site, userCountry, userPhone } = cfg;

  const isCN = userCountry === "CN" || userCountry === "cn" || userPhone?.startsWith("+86");

  if (site === "cn") {
    if (!isCN) {
      return { pass: false, reason: "非境内用户不允许写入 .cn 数据库" };
    }
    return { pass: true };
  }

  // site === "com"
  if (isCN) {
    return { pass: false, reason: "境内用户不允许写入 .com 数据库" };
  }
  return { pass: true };
}
