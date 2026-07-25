/**
 * Geo 服务（T05 — 合规与 geo 分流）
 *
 * 职责：
 *  - 从请求头推断访问者所在国家/地区（优先 CDN 注入头，其次 .cn 阿里云 X-Forwarded-For）。
 *  - 提供 isDomestic 判断（CN 视为境内）。
 *
 * 红线：
 *  - 不依赖外网；geoip-lite 为可选增强，装不上则降级为头读取，绝不阻塞主流程。
 *  - .cn 站数据不出境，geoip 离线库也不联网。
 */

import type { NextRequest } from "next/server";

/** 可选：动态加载 geoip-lite（装不上就忽略） */
let geoipLookup: ((ip: string) => { country?: string } | null) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const geoip = require("geoip-lite") as { lookup: (ip: string) => { country?: string } | null };
  geoipLookup = geoip.lookup;
} catch {
  geoipLookup = null;
}

export class GeoService {
  /**
   * 从请求推断国家/地区代码（ISO 3166-1 alpha-2，大写）。
   * 读取顺序：
   *  1) x-vercel-ip-country（Vercel 边缘注入）
   *  2) cf-ipcountry（Cloudflare 注入）
   *  3) .cn 阿里云 X-Forwarded-For 取客户端 IP → geoip-lite 离线库（可选）
   * 读不到返回空串。
   */
  detectCountry(req: NextRequest): string {
    const vercel = req.headers.get("x-vercel-ip-country");
    if (vercel) return vercel.toUpperCase();

    const cf = req.headers.get("cf-ipcountry");
    if (cf) return cf.toUpperCase();

    // .cn 阿里云：X-Forwarded-For 第一段为客户端真实 IP
    const xff = req.headers.get("x-forwarded-for");
    if (xff && geoipLookup) {
      const clientIp = xff.split(",")[0]?.trim();
      if (clientIp) {
        const rec = geoipLookup(clientIp);
        if (rec?.country) return rec.country.toUpperCase();
      }
    }

    return "";
  }

  /** 是否境内（CN） */
  isDomestic(country: string): boolean {
    return country === "CN";
  }

  /** 当前请求是否境内 */
  isDomesticRequest(req: NextRequest): boolean {
    return this.isDomestic(this.detectCountry(req));
  }
}

export const geoService = new GeoService();

/**
 * 客户端/服务端通用的境内手机号判断（仅作辅助，以 country 头为准）。
 */
export function looksLikeDomesticPhone(phone?: string | null): boolean {
  if (!phone) return false;
  return phone.startsWith("+86") || /^1[3-9]\d{9}$/.test(phone);
}
