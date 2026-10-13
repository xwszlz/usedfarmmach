/**
 * 双站归属判定（`goodsRegion`）—— **货物（机器）实际所在地** → .cn / .com
 *
 * ## 口径（老板已拍板，勿擅改）
 * 1. 归属判定核心 = **货物（机器）的实际所在地**：
 *      - 货在境内 → `cn`（入 .cn 站）；
 *      - 货在境外 → `intl`（入 .com 站）；
 *      - **判不出 → `unknown`，不入库**（转「待核队列」，人工核实后回填再导）。
 * 2. **卖家所在地 / 挂牌平台都只是弱线索**，不作判定依据。
 * 3. `goodsRegion` 必须**显式且可人工覆写**：自动推断只作默认值，**人工覆写为权威**。
 *
 * ## 两个函数的分工（重要）
 *  - `inferGoodsRegion(row)`：**弱线索推断**（location/平台 hint），用途是给 UI 逐行预览「自动填值」；
 *  - `resolveStoreScope(row)`：**权威取值**（《国内经销商与挂牌整合方案》§2.6.3），
 *    落库与站点准入一律以它为准。二者不可混用。
 *
 * ## 命名避坑
 * 本模块的「双站归属」叫 **StoreScope**，**不叫 channel** ——
 * `source-catalog.ts` 里的 `channel` 指「获取方式（crawler / websearch / manual）」，语义不同。
 *
 * ⚠️ 本模块**零 DB 依赖**（纯函数），因此**客户端组件可以直接 import**。
 */
import { derivePlatform } from "./source-catalog";

// ───────────────────────────────────────────────
// 1. 类型定义
// ───────────────────────────────────────────────

/**
 * 归属（货物所在地）三态。
 *  - `cn`：境内，写入 .cn 站数据库；
 *  - `intl`：境外，写入 .com 站数据库；
 *  - `unknown`：判不出 → **不入库**，转待核队列。
 */
export type StoreScope = "cn" | "intl" | "unknown";

/** 弱线索推断的**依据来源**（供 UI 展示「为什么这么判」） */
export type StoreScopeBasis = "location" | "locationCode" | "platform" | "none";

/** 行的最小字段投影（RawListing 行、导入请求行都满足） */
export interface StoreScopeRow {
  /** 人工权威归属；显式给出时**碾压一切自动推断**（含 "unknown"） */
  goodsRegion?: string | null;
  /** 采集来源标识，如 `domestic_websearch` / `agroline` / `manual_dealer` */
  source?: string | null;
  /** 挂牌链接（用于派生平台 host，仅作弱线索） */
  sourceUrl?: string | null;
  /** 货物Location 自由文本 */
  location?: string | null;
  /** 货源地国别 code（ISO 3166-1 alpha-2，schema 既有列）；有值时强于 location 文本 */
  locationCode?: string | null;
}

/** 弱线索推断结果（含依据，供 UI 逐行展示） */
export interface GoodsRegionInference {
  /** 推断出的归属（未判出为 unknown） */
  scope: StoreScope;
  /** 依据来源 */
  basis: StoreScopeBasis;
  /** 命中的线索原文（如命中的地名 / 平台域名），未命中为空串 */
  evidence: string;
  /** 人工是否已给出权威值（true 表示本结果来自人工，非自动推断） */
  authoritative: boolean;
  /** 可直接展示给用户的一句话依据 */
  reason: string;
}

// ───────────────────────────────────────────────
// 2. 常量：标签 / 选项 / source 命名（R9）
// ───────────────────────────────────────────────

/** 归属 → 中文标签（UI 展示） */
export const STORE_SCOPE_LABEL: Readonly<Record<StoreScope, string>> = {
  cn: "境内（.cn）",
  intl: "境外（.com）",
  unknown: "待人工核实",
};

/** 归属下拉的可选项（顺序即 UI 顺序） */
export const STORE_SCOPE_OPTIONS: readonly StoreScope[] = ["cn", "intl", "unknown"];

/** 弱线索依据 → 中文标签 */
export const STORE_SCOPE_BASIS_LABEL: Readonly<Record<StoreScopeBasis, string>> = {
  location: "地区文字",
  locationCode: "货源国别码",
  platform: "平台（仅提示）",
  none: "未判出",
};

/**
 * R9 source 命名 —— **去掉 "82" 死数字面量**。
 *  - 境内人工行：`manual_dealer`
 *  - 境外人工行：`manual_dealer_intl`
 *  - 过渡期兼容读的旧值：`manual_cn_lead`（读取时归一到 `manual_dealer`）
 */
export const SOURCE_MANUAL_DEALER = "manual_dealer";
export const SOURCE_MANUAL_DEALER_INTL = "manual_dealer_intl";
export const SOURCE_MANUAL_LEGACY_CN = "manual_cn_lead";

/** 人工行的 source 白名单（其余一律拒绝） */
export const MANUAL_SOURCE_WHITELIST: readonly string[] = [
  SOURCE_MANUAL_DEALER,
  SOURCE_MANUAL_DEALER_INTL,
  SOURCE_MANUAL_LEGACY_CN,
];

// ───────────────────────────────────────────────
// 3. 常量：地名 / 平台 弱线索词典
// ───────────────────────────────────────────────

/** 境内地名（省 / 直辖市 / 自治区 / 主要城市 / 中国别称）—— 命中即弱线索 cn */
export const CN_LOCATION_TOKENS: readonly string[] = [
  // ⚠️ 刻意**不收裸 "cn" 二字**：命中率低且易误撞英文单词；
  //    ISO code 判定统一走 locationCode / `hitCountryCode`。
  "中国", "china",
  "北京", "上海", "天津", "重庆",
  "河北", "山西", "辽宁", "吉林", "黑龙江",
  "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南",
  "湖北", "湖南", "广东", "海南", "四川", "贵州", "云南",
  "陕西", "甘肃", "青海", "台湾", "内蒙古", "广西", "西藏", "宁夏", "新疆",
  "香港", "澳门",
  "石家庄", "唐山", "邯郸", "保定", "沧州", "邢台", "廊坊", "衡水",
  "秦皇岛", "张家口", "承德", "哈尔滨", "齐齐哈尔", "佳木斯", "大庆",
  "长春", "沈阳", "大连", "济南", "青岛", "潍坊", "临沂", "济宁", "烟台",
  "郑州", "洛阳", "南阳", "武汉", "宜昌", "长沙", "株洲",
  "广州", "深圳", "东莞", "佛山", "南京", "苏州", "无锡", "徐州", "常州",
  "杭州", "宁波", "温州", "合肥", "蚌埠", "福州", "厦门", "泉州",
  "南昌", "西安", "咸阳", "成都", "绵阳", "昆明", "贵阳", "南宁",
  "太原", "大同", "呼和浩特", "包头", "乌鲁木齐", "喀什", "伊犁",
  "兰州", "西宁", "银川", "拉萨", "海口", "三亚",
];

/** 境外国 / 州 / 地区名（中英）—— 命中即弱线索 intl */
export const INTL_LOCATION_TOKENS: readonly string[] = [
  "德国", "法国", "英国", "意大利", "荷兰", "比利时", "卢森堡",
  "西班牙", "葡萄牙", "波兰", "乌克兰", "俄罗斯", "白俄罗斯", "立陶宛",
  "拉脱维亚", "爱沙尼亚", "捷克", "斯洛伐克", "匈牙利", "罗马尼亚",
  "保加利亚", "塞尔维亚", "克罗地亚", "斯洛文尼亚", "丹麦", "瑞典",
  "挪威", "芬兰", "冰岛", "爱尔兰", "瑞士", "奥地利", "希腊", "土耳其",
  "美国", "加拿大", "墨西哥", "巴西", "阿根廷", "智利", "乌拉圭",
  "澳大利亚", "新西兰", "南非", "埃及", "肯尼亚", "尼日利亚",
  "印度", "巴基斯坦", "日本", "韩国", "哈萨克斯坦", "乌兹别克斯坦",
  "蒙古国", "泰国", "越南", "马来西亚", "印度尼西亚", "菲律宾", "缅甸",
  "germany", "deutschland", "france", "netherlands", "holland", "belgium",
  "poland", "ukraine", "russia", "italy", "spain", "portugal", "romania",
  "hungary", "czech", "denmark", "sweden", "norway", "finland", "ireland",
  "switzerland", "austria", "greece", "turkey", "united kingdom",
  "united states", "usa", "california", "texas", "texas-us", "canada",
  "brazil", "argentina", "australia", "new zealand", "south africa",
  "japan", "korea", "kazakhstan", "thailand", "vietnam", "malaysia",
  "indonesia", "philippines", "india",
];

/**
 * 境内平台 host 白名单（仅供 hint，**不作定论**）。
 * 判定只看货物所在地；挂在哪儿卖说明不了机器在哪儿。
 */
export const CN_PLATFORM_HOSTS: readonly string[] = [
  "usedfarmmach.cn",
  "58.com",
  "ganji.com",
  "baixing.com",
  "1688.com",
  "taobao.com",
  "jd.com",
  "nongjitong.com",
  "nongji360.com",
  "chinaequip.com.cn",
];

/** 境外平台 host 白名单（仅供 hint，**不作定论**） */
export const INTL_PLATFORM_HOSTS: readonly string[] = [
  "usedfarmmach.com",
  "mascus.com",
  "agriaffaires.com",
  "machineryline.com",
  "tractorpool.com",
  "traktorpool.de",
  "landwirt.com",
  "agriaffaires.co.uk",
  "agrotyres.com",
  "autoline.info",
  "ebay.com",
  "alibaba.com",
  "aliexpress.com",
  "machinio.com",
  "truck1.eu",
];

// ───────────────────────────────────────────────
// 4. 工具函数
// ───────────────────────────────────────────────

/** 国家/地区两个字母 code → 是否境内/境外的判定词表 */
const INTL_COUNTRY_CODES: readonly string[] = [
  "PL", "DE", "NL", "BE", "FR", "IT", "ES", "PT", "UA", "RU", "BY", "LT",
  "LV", "EE", "CZ", "SK", "HU", "RO", "BG", "RS", "HR", "SI", "DK", "SE",
  "NO", "FI", "IS", "IE", "CH", "AT", "GR", "TR", "US", "CA", "MX", "BR",
  "AR", "CL", "UY", "AU", "NZ", "ZA", "EG", "KE", "NG", "IN", "PK", "JP",
  "KR", "KZ", "UZ", "MN", "TH", "VN", "MY", "ID", "PH", "MM", "GB", "UK",
];

/** 把任意输入规整成 StoreScope；不合法返回 null（表示「没给」而非 unknown） */
export function normalizeGoodsRegion(value: unknown): StoreScope | null {
  const v = (value ?? "").toString().trim().toLowerCase();
  if (v === "cn" || v === "intl" || v === "unknown") return v;
  return null;
}

/** 文本是否包含 tokens 中任意一项（大小写不敏感） */
function hitToken(text: string, tokens: readonly string[]): string {
  for (const t of tokens) {
    const token = t.toLowerCase();
    if (!token) continue;
    if (text.includes(token)) return t;
  }
  return "";
}

/** 两个字母国家码是否被整体词命中（避免 "DE" 误撞 "MODEL"） */
function hitCountryCode(text: string): string {
  for (const code of INTL_COUNTRY_CODES) {
    const re = new RegExp(`(^|[^a-zA-Z])${code}($|[^a-zA-Z])`, "i");
    if (re.test(text)) return code;
  }
  return "";
}

/** sourceUrl → 平台 host 是否命中白名单；命中返回命中项，否则空串 */
function hitPlatform(sourceUrl: string | null | undefined, hosts: readonly string[]): string {
  const host = derivePlatform((sourceUrl ?? "").toString());
  if (!host) return "";
  for (const candidate of hosts) {
    const lower = candidate.toLowerCase();
    if (host === lower || host.endsWith(`.${lower}`)) return candidate;
  }
  return "";
}

// ───────────────────────────────────────────────
// 5. 弱线索推断（UI 自动填值用，**不作权威**）
// ───────────────────────────────────────────────

/**
 * 弱线索推断「货物所在地归属」，并返回依据（为什么这么判）。
 *
 * 判定顺序（**全部只是弱线索**）：
 *  ① `locationCode`（ISO 3166-1 alpha-2，schema 既有列）明确 → 直接给结论；
 *  ② `location` 自由文本：命中境内地名 → `cn`；命中境外国/州 → `intl`；
 *     **同时命中两边（自相矛盾）→ 不猜，判 `unknown`**；
 *  ③ 以上都没判出 → 看 `sourceUrl` 的平台 host 白名单，**只作 hint**；
 *  ④ 还是判不出 → `unknown`。
 *
 * @param row 行的最小字段投影
 */
export function inferGoodsRegionWithBasis(row: StoreScopeRow): GoodsRegionInference {
  const manual = normalizeGoodsRegion(row?.goodsRegion);
  if (manual) {
    return {
      scope: manual,
      basis: "none",
      evidence: "",
      authoritative: true,
      reason: `人工指定：${STORE_SCOPE_LABEL[manual]}`,
    };
  }

  // ① 货源国别码（强于自由文本）
  const code = (row?.locationCode ?? "").toString().trim().toUpperCase();
  if (code) {
    if (code === "CN") {
      return {
        scope: "cn",
        basis: "locationCode",
        evidence: code,
        authoritative: false,
        reason: `货源国别码 ${code} → 境内`,
      };
    }
    return {
      scope: "intl",
      basis: "locationCode",
      evidence: code,
      authoritative: false,
      reason: `货源国别码 ${code} → 境外`,
    };
  }

  // ② location 自由文本
  const locationText = (row?.location ?? "").toString().trim().toLowerCase();
  if (locationText) {
    const cnHit = hitToken(locationText, CN_LOCATION_TOKENS);
    const intlHitCn = hitToken(locationText, INTL_LOCATION_TOKENS);
    const intlHitCode = hitCountryCode(locationText);
    const intlHit = intlHitCn || intlHitCode;
    if (cnHit && !intlHit) {
      return {
        scope: "cn",
        basis: "location",
        evidence: cnHit,
        authoritative: false,
        reason: `地区文字命中境内地名「${cnHit}」`,
      };
    }
    if (intlHit && !cnHit) {
      return {
        scope: "intl",
        basis: "location",
        evidence: intlHit,
        authoritative: false,
        reason: `地区文字命中境外国/州「${intlHit}」`,
      };
    }
    if (cnHit && intlHit) {
      return {
        scope: "unknown",
        basis: "location",
        evidence: `${cnHit} / ${intlHit}`,
        authoritative: false,
        reason: `地区文字同时命中境内与境外线索（${cnHit} / ${intlHit}），自相矛盾 → 交人工`,
      };
    }
  }

  // ③ 平台 host（仅 hint，不作定论）
  const cnPlatform = hitPlatform(row?.sourceUrl, CN_PLATFORM_HOSTS);
  const intlPlatform = hitPlatform(row?.sourceUrl, INTL_PLATFORM_HOSTS);
  if (cnPlatform && !intlPlatform) {
    return {
      scope: "cn",
      basis: "platform",
      evidence: cnPlatform,
      authoritative: false,
      reason: `平台 ${cnPlatform} 提示境内（平台只是弱线索，请人工确认货物所在地）`,
    };
  }
  if (intlPlatform && !cnPlatform) {
    return {
      scope: "intl",
      basis: "platform",
      evidence: intlPlatform,
      authoritative: false,
      reason: `平台 ${intlPlatform} 提示境外（平台只是弱线索，请人工确认货物所在地）`,
    };
  }

  // ④ 判不出
  return {
    scope: "unknown",
    basis: "none",
    evidence: "",
    authoritative: false,
    reason: "无地区文字 / 无平台线索，判不出货物所在地 → 待人工核实",
  };
}

/**
 * 弱线索推断「货物所在地归属」（`inferGoodsRegionWithBasis` 的简版）。
 * 判不出返回 `unknown`。
 */
export function inferGoodsRegion(row: StoreScopeRow): StoreScope {
  return inferGoodsRegionWithBasis(row).scope;
}

// ───────────────────────────────────────────────
// 6. 权威取值（落库 / 站点准入唯一口径）
// ───────────────────────────────────────────────

/**
 * **权威取值**（《国内经销商与挂牌整合方案》§2.6.3），落库与站点准入一律以此为准：
 *
 * ```
 * 1) 人工给了 goodsRegion        → 直接返回（含 unknown，人工权威碾压自动推断）
 * 2) source 以 "domestic_" 开头  → cn    （境内采集行：来源前缀可靠）
 * 3) source 以 "manual_" 开头    → unknown（人工行未给出归属 → 保守转待核，绝不猜）
 * 4) 其它（国际采集行兜底）      → intl
 * ```
 *
 * 注：第 4 步的兜底语义是「.com 国际采集行」。若 source 为空串/缺失（脏数据），
 * 它并不等于「国际采集行」，此时退化为弱线索推断（`inferGoodsRegion`），
 * 推断不出则 `unknown` —— 宁可转待核，也不把机器判到错站点。
 *
 * @param row 行的最小字段投影
 */
export function resolveStoreScope(row: StoreScopeRow): StoreScope {
  // 1) 人工权威（含 unknown）
  const manual = normalizeGoodsRegion(row?.goodsRegion);
  if (manual) return manual;

  const source = (row?.source ?? "").toString().trim();

  // 2) 境内采集行
  if (source.startsWith("domestic_")) return "cn";

  // 3) 人工行未给出归属 → 保守待核
  if (source.startsWith("manual_")) return "unknown";

  // 4) 兜底
  if (!source) return inferGoodsRegion(row);
  return "intl";
}

/**
 * 站点准入判定：该行的归属是否允许写入当前站点。
 * - `.cn` 站只收 `cn`；`.com` 站只收 `intl`；`unknown` 两边都不收（不入库）。
 *
 * @param scope 行的权威归属（由 `resolveStoreScope` 得到）
 * @param site 当前站点（`"cn"` / `"com"`）
 */
export function isScopeAllowedOnSite(scope: StoreScope, site: "cn" | "com"): boolean {
  if (scope === "unknown") return false;
  return site === "cn" ? scope === "cn" : scope === "intl";
}

/**
 * R9：按归属推导人工行的 `source` 取值（**去掉 "82" 死数字面量**）。
 * - 显式给出且在白名单内 → 原样保留（`manual_cn_lead` 归一为 `manual_dealer`）；
 * - 未给出 / 非法 → 归属为 intl 用 `manual_dealer_intl`，其余用 `manual_dealer`。
 */
export function resolveLeadSource(row: StoreScopeRow, scope: StoreScope): string {
  const raw = (row?.source ?? "").toString().trim();
  if (MANUAL_SOURCE_WHITELIST.includes(raw)) {
    return raw === SOURCE_MANUAL_LEGACY_CN ? SOURCE_MANUAL_DEALER : raw;
  }
  return scope === "intl" ? SOURCE_MANUAL_DEALER_INTL : SOURCE_MANUAL_DEALER;
}
