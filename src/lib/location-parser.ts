/**
 * 产地文本解析器
 *
 * 从自由文本 location 字段中智能提取 country / province / city。
 * 用于一次性数据迁移脚本和 filters API 的结构化返回。
 */

import {
  findProvinceInText,
  findCityInText,
  findCountryInText,
  type ProvinceData,
  type CityData,
  type CountryData,
} from "./location-data";

export interface ParsedLocation {
  /** 国家代码，如 "CN" / "DE" / "US"；中国默认 "CN" */
  country: string | null;
  /** 省/州，如 "河北" / "Bavaria" */
  province: string | null;
  /** 城市，如 "石家庄" / "Munich" */
  city: string | null;
}

/**
 * 从 location 文本中解析出结构化的 country/province/city
 *
 * 解析规则（按优先级）：
 * 1. 先尝试匹配国际国家名（中文/英文/代码）
 * 2. 如果不匹配国际，则尝试匹配中国省份和城市
 * 3. 无法识别的返回全 null
 *
 * @param location 位置文本，如 "河北石家庄"、"德国"、"Germany"、"山东潍坊"
 * @returns 解析结果
 */
export function parseLocationText(location: string | null | undefined): ParsedLocation {
  if (!location || typeof location !== "string") {
    return { country: null, province: null, city: null };
  }

  const trimmed = location.trim();
  if (trimmed === "") {
    return { country: null, province: null, city: null };
  }

  // Step 1: 尝试匹配国际国家
  const country = findCountryInText(trimmed);
  if (country) {
    // 如果匹配到的是中国，走中国逻辑
    if (country.code === "CN") {
      return parseChinaLocation(trimmed);
    }
    // 国际国家：country 为国家代码，province/city 暂不深度解析
    return {
      country: country.code,
      province: null,
      city: null,
    };
  }

  // Step 2: 尝试匹配中国省份/城市
  const chinaResult = parseChinaLocation(trimmed);
  if (chinaResult.country) {
    return chinaResult;
  }

  // Step 3: 无法识别
  return { country: null, province: null, city: null };
}

/**
 * 解析中国位置文本
 *
 * @param text 位置文本
 * @returns 解析结果，country 为 "CN" 或 null
 */
function parseChinaLocation(text: string): ParsedLocation {
  // 先尝试匹配城市（城市名可能包含省份信息）
  const cityMatch = findCityInText(text);
  if (cityMatch) {
    return {
      country: "CN",
      province: cityMatch.province.nameZh,
      city: cityMatch.city.nameZh,
    };
  }

  // 再尝试匹配省份
  const provinceMatch = findProvinceInText(text);
  if (provinceMatch) {
    return {
      country: "CN",
      province: provinceMatch.nameZh,
      city: null,
    };
  }

  return { country: null, province: null, city: null };
}

/**
 * 根据结构化字段生成 location 显示文本
 *
 * @param country 国家代码
 * @param province 省份
 * @param city 城市
 * @returns 拼接后的显示文本，如 "河北石家庄"、"德国"
 */
export function buildLocationText(
  country: string | null | undefined,
  province: string | null | undefined,
  city: string | null | undefined
): string {
  // 国内
  if (country === "CN" || country === "中国") {
    const parts: string[] = [];
    if (province) parts.push(province);
    if (city) parts.push(city);
    return parts.join("");
  }

  // 国际
  if (country && country !== "CN" && country !== "中国") {
    const countryData = findCountryInText(country);
    if (countryData) {
      return countryData.nameZh;
    }
    return country;
  }

  // 兜底：只有 province/city
  const parts: string[] = [];
  if (province) parts.push(province);
  if (city) parts.push(city);
  return parts.join("");
}

/**
 * 非地名过滤：判断 location 值是否为明显的非地名（公司名、品牌名等）
 *
 * @param location 位置文本
 * @returns true 表示应过滤掉（不是有效地名）
 */
export function isInvalidLocation(location: string | null | undefined): boolean {
  if (!location || typeof location !== "string") return true;

  const trimmed = location.trim();
  if (trimmed === "") return true;

  // 黑名单关键词：公司名、品牌名等非地名
  const blacklistKeywords = [
    "神雕",
    "农机",
    "公司",
    "有限",
    "集团",
    "厂家",
    "代理",
    "经销",
    "贸易",
    "进出口",
    "合作社",
    "农业",
    "机械",
  ];

  const lowerLocation = trimmed.toLowerCase();
  for (const keyword of blacklistKeywords) {
    if (lowerLocation.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  // 过滤纯数字或特殊字符
  if (/^[\d\s\-_.,/]+$/.test(trimmed)) return true;

  // 过滤过短的值（单个字符）
  if (trimmed.length < 2) return true;

  return false;
}
