/**
 * AI 销售策略 · 降级归一化唯一真相（N02）
 * ─────────────────────────────────────────────────────────
 * **存在理由**（arch §3.6）：PRD §2 的 12 条「为空时降级」规则若分别写在 PDF 与 Excel 里，
 * 必然出现两套口径（同一份策略，PDF 显示「未找到」、Excel 显示空白）。
 * ⇒ 归一化只做一次，PDF / Excel / UI **消费同一份结果**。
 *
 * 硬约束：
 *   1. **纯函数**：零 prisma / 零 node:fs / 零网络 / 零 Date.now() 依赖 ⇒ 可被
 *      `scripts/seed-dealers.ts`（相对路径 import）与服务端、客户端共同使用；
 *   2. **永不抛错**：任意边界输入（null / 空对象 / 错误类型 / 非法枚举 / 超限数量）
 *      都必须返回确定值，且 `NormalizedStrategy` 的**每个字段都不是 undefined**；
 *   3. **不做加权计算**：星级只做 `clamp[1,5]` + 「合规成本一票否决压到 1」（PRD §2 ⑦）。
 */
import { parseLocationText } from "../location-parser";
import { INTERNATIONAL_COUNTRIES, type CountryData } from "../location-data";
import {
  COMPLIANCE_OWNERS,
  COMPLIANCE_STATUSES,
  DATA_SOURCE_NAMES,
  DEALER_ROLES,
  EMPTY_CELL,
  MARKET_AXIS,
  NOT_FOUND,
  PRICE_BASIS_TYPES,
  REJECT_LEVELS,
  REJECT_LEVEL_WORDS,
  REJECT_TRIGGERS,
  RESIDUAL_MARKET_AXIS,
  TRIGGER_MIN_LEVEL,
  URGENCIES,
  WEB_EVIDENCE_STATUSES,
  WEB_STATUS_NOTE,
  type ComplianceOwner,
  type ComplianceStatus,
  type DataSourceName,
  type DealerRole,
  type MarketAxis,
  type PriceBasisType,
  type Priority,
  type RejectLevel,
  type RejectTrigger,
  type StarsLevel,
  type StrategyDecisionFields,
  type Urgency,
  type WebEvidenceStatus,
} from "./strategy-schema";

// ═══════════════════════════════════════════════════════════
// 1. 环境入参 & 归一化输出
// ═══════════════════════════════════════════════════════════

/**
 * 降级合成所需的最小环境。
 *
 * **刻意不依赖 `StrategyContext`**（arch §3.6）：那会让 derive 与 T07 抢文件，
 * 也会把 prisma 依赖拖进来。调用方（T08 / T10 / T11）自行从上下文里取字段填进来。
 *
 * 末尾 3 个字段是 additive 可选扩展：不传也能跑（对应降级会退化为通用文案）。
 */
export interface DecisionEnv {
  /** 本品名（`品牌 型号（年份）`），用于合成 tldr / 画像占位行 */
  productName: string;
  /** 本品品牌，用于数据来源 ref 描述 */
  brandName: string;
  /** 站内报价下限（元）；null = 未知 */
  priceMinCny: number | null;
  /** 站内报价上限（元）；null = 未知 */
  priceMaxCny: number | null;
  /** 外部检索状态（决定 PRD §6.4 的 8 处强制降级） */
  webStatus: WebEvidenceStatus;
  /** 检索层给的备注原文（原样进 `dataSources.note`） */
  webNote: string;
  /** 是否存在历史对照基线（决定 `contrastWithPrior` 是否允许保留） */
  hasPriorStrategy: boolean;
  /** 渠道池条数（为 0 时降级文案要说明「见附件 Excel 全量名单」） */
  candidateCount: number;
  /** 可引用 URL（`webStatus === "ok"` 时进 `dataSources.ref`） */
  evidenceUrls: string[];

  // ── additive 可选扩展（不传则退化为通用文案，不报错）────────────────
  /** 老字段 `summary`：tldr 的 `why` 兜底来源 */
  summary?: string | null;
  /** 老字段 `priceRange`：tldr 的 `expectedPriceCny` 兜底来源 */
  priceRange?: string | null;
  /** 老字段 `compliance`：`complianceTasks` 为空时的转换来源（PRD §2 ⑩） */
  compliance?: {
    dataExport?: string | null;
    crossBorder?: string | null;
    /**
     * 合规提示原文 —— **规范名**，与 `prompt.ts` 的 LLM 输出 schema（`compliance.notes`）一致。
     *
     * ⚠️ 历史坑：上游 `prompt.ts` 产的是 `notes`，本模块曾只读 `note` ⇒ 上游给了
     * 下游永远读到 `null`（字段名打架，静默丢数据）。现以 `notes` 为规范名，
     * 读取处取 `notes ?? note`。
     */
    notes?: string | null;
    /**
     * @deprecated 向后兼容别名（早期调用方 / 手工构造的 env 用的是单数）。
     * 读取时 `notes` 优先；两者都空则为 `null`。**新代码请用 `notes`。**
     */
    note?: string | null;
  } | null;
}

/** 归一化后的 tldr 行（字段全部落地） */
export interface TldrRow {
  equipment: string;
  bestChannel: string;
  expectedPriceCny: string;
  why: string;
}

/** 归一化后的反直觉洞察（`contrastWithPrior` 已按基线存在性裁决） */
export interface KeyInsightNormalized {
  headline: string;
  body: string;
  contrastWithPrior: string | null;
}

/** 归一化后的机型画像（`weightKg` 无外部来源时恒 null） */
export interface EquipmentProfileNormalized {
  name: string;
  brandCountry: string;
  type: string;
  spec: string;
  power: string;
  weightKg: number | null;
  condition: string;
  positioning: string;
}

/** 归一化后的价格锚点（axis 已二次归桶；非 ok 时「新机对标」格强制降级） */
export interface MarketAnchorNormalized {
  equipment: string;
  axis: MarketAxis;
  market: string;
  priceText: string;
  priceCny: number | null;
  basisType: PriceBasisType;
  note: string;
  /**
   * `true` = 该格无法归入 5 轴（北美 / 日韩 / 东南亚 / 纯规格描述等），
   * 只是被兜底塞进 `RESIDUAL_MARKET_AXIS`。
   *
   * **渲染层契约（Sheet2）**：`true` 的格必须放「备注」列，
   * 不得进入任何价格列；`false` 才是真归桶。
   */
  axisResidual: boolean;
}

/** 归一化后的否决条（level/trigger 已补齐，非 ok 时 L3 被压到 L2） */
export interface RejectedNormalized {
  market: string;
  reason: string;
  level: RejectLevel;
  trigger: RejectTrigger | null;
}

/** 归一化后的最优去向（`market` 恒为数组，兼容 LLM 偶尔给字符串） */
export interface BestDestinationNormalized {
  equipment: string;
  market: string[];
  basis: string;
  calcChain: string | null;
  channelIds: string[];
  rejected: RejectedNormalized[];
}

/** 归一化后的市场排名（stars 已 clamp + 一票否决校正） */
export interface MarketRankingNormalized {
  equipment: string | null;
  rank: number;
  market: string;
  stars: StarsLevel;
  factors: {
    unitPrice: string;
    liquidity: string;
    paymentSpeed: string;
    complianceCost: string;
  } | null;
  note: string | null;
}

/** 归一化后的准入红绿灯（三灯互斥已由服务端保证） */
export interface TrafficLightNormalized {
  friendly: string[];
  needPermit: string[];
  forbidden: string[];
}

/** 归一化后的今日电话（渠道 id 为空的条目已整条丢弃） */
export interface TodayCallNormalized {
  equipment: string;
  candidateIds: string[];
  role: DealerRole;
  whyToday: string;
}

/** 归一化后的合规事项（status 缺省 `未开始`） */
export interface ComplianceTaskNormalized {
  item: string;
  owner: ComplianceOwner;
  deadline: string;
  status: ComplianceStatus;
}

/** 归一化后的待确认项 */
export interface OpenQuestionNormalized {
  question: string;
  affects: string;
  urgency: Urgency;
}

/** 归一化后的数据来源 */
export interface DataSourceNormalized {
  name: DataSourceName;
  ref: string;
  note: string | null;
}

/**
 * 归一化结果：**每个字段都已落地，永不为 `undefined`**。
 *
 * 语义约定：
 *   - `keyInsight === null` ⇒ 整段不渲染（PRD §2 ②，不留空标题）；
 *   - `readout === null` ⇒ 不渲染「关键读图」行（PRD §2 ⑤）；
 *   - 空数组 ⇒ 该章保留标题并走「未生成」降级文案（PRD §2 ⑦/⑨）；
 *   - `warnings` ⇒ 渲染层必须显式告警的条目（如「未生成否决建议」）。
 */
export interface NormalizedStrategy {
  tldr: TldrRow[];
  keyInsight: KeyInsightNormalized | null;
  equipmentProfiles: EquipmentProfileNormalized[];
  marketAnchors: MarketAnchorNormalized[];
  readout: string | null;
  bestDestinations: BestDestinationNormalized[];
  marketRanking: MarketRankingNormalized[];
  accessTrafficLight: TrafficLightNormalized;
  todayCalls: TodayCallNormalized[];
  complianceTasks: ComplianceTaskNormalized[];
  openQuestions: OpenQuestionNormalized[];
  dataSources: DataSourceNormalized[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════
// 2. 方向归桶（PRD §4.1.1 五桶）
// ═══════════════════════════════════════════════════════════

/** Excel Sheet1「方向」列的 5 个桶（顺序即排序键） */
export type DirectionBucket = "中国国内" | "欧洲" | "中亚独联体" | "非洲中东南美澳新" | "其他";

/** 方向桶排序（Sheet1 `序号` 的第一排序键，PRD §4.1） */
export const DIRECTION_ORDER: readonly DirectionBucket[] = [
  "中国国内",
  "欧洲",
  "中亚独联体",
  "非洲中东南美澳新",
  "其他",
];

/** 欧洲关键词（**不含**俄罗斯/乌克兰/白俄——它们归「中亚独联体」） */
const EUROPE_RE =
  /欧洲|欧盟|西欧|东欧|北欧|南欧|中欧|欧亚|(?:^|[^a-z])eu(?:[^a-z]|$)|euro|德国|法国|荷兰|波兰|意大利|西班牙|葡萄牙|英国|丹麦|瑞典|芬兰|挪威|奥地利|比利时|捷克|匈牙利|罗马尼亚|保加利亚|爱尔兰|瑞士|希腊|斯洛伐克|斯洛文尼亚|克罗地亚|立陶宛|拉脱维亚|爱沙尼亚|卢森堡|germany|france|netherlands|holland|poland|italy|spain|portugal|united kingdom|denmark|sweden|finland|norway|austria|belgium|czech|hungary|romania|bulgaria|ireland|switzerland|greece/i;

/** 中亚独联体关键词（含蒙古；**排在 EUROPE 之前判定**，否则乌克兰/俄罗斯会被误归欧洲） */
const CIS_RE =
  /中亚|独联体|俄罗斯|俄国|白俄|乌克兰|摩尔多瓦|哈萨|乌兹|吉尔吉斯|塔吉克|土库曼|阿塞拜疆|亚美尼亚|格鲁吉亚|蒙古|(?:^|[^a-z])cis(?:[^a-z]|$)|russia|kazakh|uzbek|kyrgyz|tajik|turkmen|belarus|ukrain|moldova|azerbaijan|armenia|georgia|mongolia/i;

/** 非洲/中东/南美/澳新关键词（Sheet1 的「其他」以外的最宽桶） */
const AF_ME_SA_OC_RE =
  /非洲|中东|南美|拉美|澳新|澳洲|大洋洲|南非|北非|东非|西非|中非|埃及|埃塞|尼日利亚|肯尼亚|坦桑尼亚|加纳|摩洛哥|阿尔及利亚|突尼斯|利比亚|苏丹|赞比亚|津巴布韦|莫桑比克|安哥拉|阿联酋|迪拜|沙特|阿曼|卡塔尔|科威特|约旦|伊拉克|以色列|伊朗|黎巴嫩|土耳其|巴西|阿根廷|智利|秘鲁|哥伦比亚|乌拉圭|巴拉圭|玻利维亚|委内瑞拉|厄瓜多尔|澳大利亚|新西兰|africa|middle east|south america|latin|australia|new zealand|south africa|egypt|ethiopia|nigeria|kenya|tanzania|ghana|morocco|algeria|(?:^|[^a-z])uae(?:[^a-z]|$)|dubai|saudi|oman|qatar|kuwait|jordan|iraq|israel|iran|turkey|brazil|argentina|chile|peru|colombia|uruguay|paraguay|bolivia|venezuela|ecuador/i;

/** 中国国内关键词 */
const CN_RE = /中国|中国大陆|境内|国内|内蒙|(?:^|[^a-z])cn(?:[^a-z]|$)|china|domestic|mainland/i;

/**
 * ISO 国别码 → 方向桶。
 *
 * 只覆盖 `INTERNATIONAL_COUNTRIES` 里出现的 32 国（**不新建国别表**，arch §3.6）；
 * 未列出的国家落在下游正则里兜底，仍未命中即「其他」（含北美：美/加）。
 */
const CODE_TO_DIRECTION: Record<string, DirectionBucket> = {
  CN: "中国国内",
  DE: "欧洲",
  FR: "欧洲",
  IT: "欧洲",
  GB: "欧洲",
  NL: "欧洲",
  ES: "欧洲",
  PL: "欧洲",
  RU: "中亚独联体",
  BY: "中亚独联体",
  UA: "中亚独联体",
  KZ: "中亚独联体",
  UZ: "中亚独联体",
  ZA: "非洲中东南美澳新",
  EG: "非洲中东南美澳新",
  SA: "非洲中东南美澳新",
  AE: "非洲中东南美澳新",
  TR: "非洲中东南美澳新",
  BR: "非洲中东南美澳新",
  AR: "非洲中东南美澳新",
  AU: "非洲中东南美澳新",
  US: "其他",
  CA: "其他",
  JP: "其他",
  KR: "其他",
  IN: "其他",
  TH: "其他",
  VN: "其他",
  ID: "其他",
  MY: "其他",
  PH: "其他",
  MX: "其他",
  PK: "其他",
};

/**
 * 把任意文本归到 5 个方向桶之一（纯文本兜底，用不上国别表）。
 *
 * @param text 已拼接的 `country + regions` 文本
 * @returns 命中的桶；无法识别返回 `null`（由调用方决定是否落「其他」）
 */
function classifyDirectionText(text: string): DirectionBucket | null {
  const t = text.trim();
  if (!t) return null;
  if (CN_RE.test(t)) return "中国国内";
  // 顺序敏感：中亚独联体必须先于欧洲（俄罗斯/乌克兰/白俄）
  if (CIS_RE.test(t)) return "中亚独联体";
  if (EUROPE_RE.test(t)) return "欧洲";
  if (AF_ME_SA_OC_RE.test(t)) return "非洲中东南美澳新";
  return null;
}

/**
 * 计算 Excel Sheet1「方向」列（PRD §4.1.1，5 桶）。
 *
 * 规则：`partition === "cn"` 或国别是中国 ⇒ `中国国内`；其余按 欧洲 → 中亚独联体 →
 * 非洲中东南美澳新 顺序匹配（**中亚先于欧洲**）；未命中（含北美 美/加）⇒ `其他`。
 *
 * @param i 渠道的方向原始信息（`partition` 必传，`country`/`regions` 可为空）
 * @returns 5 桶之一，**永不抛错、永不返回 null**
 */
export function resolveDirection(i: {
  partition: "cn" | "intl";
  country?: string | null;
  regions?: string[];
}): DirectionBucket {
  const partition = i?.partition === "cn" ? "cn" : "intl";
  if (partition === "cn") return "中国国内";

  const country = str(i?.country);
  if (country) {
    // 国别字段先用国别表精确判定，避免「乔治亚」这类正则歧义
    const hit = findCountryByText(country);
    if (hit) {
      const bucket = CODE_TO_DIRECTION[hit.code];
      if (bucket) return bucket;
    }
    const direct = classifyDirectionText(country);
    if (direct) return direct;
  }

  const regions = toStrArray(i?.regions);
  if (regions.length > 0) {
    const byRegions = classifyDirectionText(regions.join(" "));
    if (byRegions) return byRegions;
  }

  return "其他";
}

// ═══════════════════════════════════════════════════════════
// 3. 优先级映射（grade → priority，永不产出 S）
// ═══════════════════════════════════════════════════════════

/**
 * `grade`(A/B/C) → `priority`(A/B/C) 兜底映射。
 *
 * **硬红线（PRD §5.2 末段）**：S 是「今天必打」的强承诺，只能由策略判定或人工指定；
 * 本函数**永不返回 S**，否则全表 S 泛滥、红色高亮失去意义。
 *
 * `grade` 位置出现 `S` 属数据污染 ⇒ 降级为 `A`（保留紧迫度排序，但不再是强承诺）；
 * 其它无法识别值（null / "" / 乱码）⇒ `C`（= 只留档，最保守，不虚抬预期）。
 *
 * @param grade 数据库 `Dealer.grade` 原值
 * @returns `"A" | "B" | "C"`，**绝不返回 `"S"`**
 */
export function gradeToPriority(grade: string | null | undefined): Priority {
  const g = str(grade).toUpperCase();
  if (g === "A") return "A";
  if (g === "B") return "B";
  if (g === "C") return "C";
  // grade 语义冻结为 A/B/C；出现 S 说明数据被污染，降一档到 A，绝不原样回传
  if (g === "S") return "A";
  return "C";
}

// ═══════════════════════════════════════════════════════════
// 4. 价格轴二次归桶（服务端可覆盖 LLM 输出）
// ═══════════════════════════════════════════════════════════

/**
 * 价格轴归桶结果：`axis` = 落在哪一轴，`residual` = 该轴是**关键词真命中**还是**兜底**。
 */
export interface AxisResolution {
  /** 最终价格轴（必 ∈ `MARKET_AXIS`） */
  axis: MarketAxis;
  /**
   * `true` = 无法归入 `MARKET_AXIS` 五轴（原轴为北美 / 日韩 / 东南亚 / 纯规格描述等），
   * 只是被兜底塞进 `RESIDUAL_MARKET_AXIS`。
   *
   * **渲染层契约**：`axisResidual === true` 的价格必须放「备注」列，
   * **绝不能**出现在 Sheet2 的价格列里 —— 否则会出现「美国 $48k」横在
   * 「非洲中东澳新」列下面这种价格列名与内容不符的硬伤。
   */
  residual: boolean;
}

/**
 * 价格轴归桶（带残差标记）——`normalizeAxis` 的完整版。
 *
 * 策略（逐级降级，全部失败落 `RESIDUAL_MARKET_AXIS` 且 `residual=true`）：
 *   ① `axis` 本身就是合法枚举 ⇒ 直接用（`residual=false`）；
 *   ② `axis` 文本含关键词（如 LLM 把「南非」当 axis）⇒ 按关键词归桶（`false`）；
 *   ③ `market` 文本含关键词 ⇒ 按关键词归桶（`false`）；
 *   ④ 均无法识别 ⇒ `非洲中东澳新` 且 `residual=true`。
 *
 * **永不抛错、永不返回非枚举值**。
 *
 * @param market 细分市场文本（`南非` / `乌兹别克` / `北美` …）
 * @param axis LLM 给的 axis 原值（`unknown`，可能是乱码 / 数字 / undefined）
 */
export function normalizeAxisEx(market: string, axis: unknown): AxisResolution {
  const exact = pickEnum(axis, MARKET_AXIS);
  if (exact) return { axis: exact, residual: false };

  const byAxis = classifyAxisText(str(axis));
  if (byAxis) return { axis: byAxis, residual: false };

  const byMarket = classifyAxisText(str(market));
  if (byMarket) return { axis: byMarket, residual: false };

  return { axis: RESIDUAL_MARKET_AXIS, residual: true };
}

/**
 * 把任意 LLM 输出 / 自由文本归到 `MARKET_AXIS` 5 个枚举之一。
 *
 * 薄封装：只返回轴，丢弃残差标记。**需要知道是否兜底时请用 `normalizeAxisEx`。**
 *
 * **永不抛错、永不返回非枚举值**（arch §3.6 / §8#4 授权服务端覆盖 LLM 输出）。
 *
 * @param market 细分市场文本（`南非` / `乌兹别克` / `新机价` …）
 * @param axis LLM 给的 axis 原值（`unknown`，可能是乱码 / 数字 / undefined）
 */
export function normalizeAxis(market: string, axis: unknown): MarketAxis {
  return normalizeAxisEx(market, axis).axis;
}

/** 「新机对标」是价格口径而非区域，必须先于区域判定 */
const NEW_MACHINE_RE =
  /新机|原厂|新车价|出厂价|brand new|new machine|new price|list price|msrp/i;

/**
 * 价格轴文本归桶（`normalizeAxis` 的内部实现）。
 *
 * @param t 文本（可为空串）
 * @returns 命中的轴；无法识别返回 `null`
 */
function classifyAxisText(t: string): MarketAxis | null {
  const text = t.trim();
  if (!text) return null;
  // ① 新机对标（口径优先于区域：`新机对标（欧洲）` 必须归到口径轴上）
  if (NEW_MACHINE_RE.test(text)) return "新机对标";
  // ② 国内（`内蒙` 必须在 CIS_RE 的 `蒙古` 之前，否则内蒙古会被归到中亚）
  if (CN_RE.test(text)) return "国内";
  // ③ 中亚独联体（先于欧洲，避免 俄罗斯/乌克兰/白俄 被误归欧洲）
  if (CIS_RE.test(text)) return "中亚";
  // ④ 欧洲
  if (EUROPE_RE.test(text)) return "欧洲";
  // ⑤ 非洲/中东/南美/澳新（含北美「其他」的兜底由 normalizeAxis 末段负责）
  if (AF_ME_SA_OC_RE.test(text)) return "非洲中东澳新";
  return null;
}

// ═══════════════════════════════════════════════════════════
// 5. 国别/城市拆分（复用 location-parser + location-data，唯一实现）
// ═══════════════════════════════════════════════════════════

/**
 * 国别匹配只需这三个字段（宽化以便补充表复用，`CountryData` 天然可赋值）。
 */
interface CountryNameLike {
  code: string;
  nameZh: string;
  nameEn: string;
}

/**
 * **本模块私有**国别补充表（T06 实测缺口）。
 *
 * 存在理由：生产表 `INTERNATIONAL_COUNTRIES`（`src/lib/location-data.ts`）只收 32 国，
 * 实测缺 `丹麦` / `奥地利` 等 **PRD §4.1.1「方向」归桶必需**的国家：
 * `country=null` ⇒ `resolveDirection()` 落到「其他」桶 ⇒ Excel「方向」列错、排序被推到表尾
 * （样板里「欧洲」是 17 行的大组，错归桶是硬伤）。
 *
 * 为什么不改 `location-data.ts`：那是**全站共用生产文件**，有别的模块在消费，
 * 本期不允许动 ⇒ 兜底表放本模块私有，只被 `splitCountryCity` 使用。
 *
 * TODO: 待 `location-data.ts` 扩容为完整国别表后删除本常量（届时本模块无需改动调用方）。
 */
const SUPPLEMENT_COUNTRIES: readonly CountryNameLike[] = [
  // ── 欧洲 ──
  { code: "AT", nameZh: "奥地利", nameEn: "Austria" },
  { code: "DK", nameZh: "丹麦", nameEn: "Denmark" },
  { code: "CH", nameZh: "瑞士", nameEn: "Switzerland" },
  { code: "SE", nameZh: "瑞典", nameEn: "Sweden" },
  { code: "NO", nameZh: "挪威", nameEn: "Norway" },
  { code: "FI", nameZh: "芬兰", nameEn: "Finland" },
  { code: "BE", nameZh: "比利时", nameEn: "Belgium" },
  { code: "CZ", nameZh: "捷克", nameEn: "Czechia" },
  { code: "HU", nameZh: "匈牙利", nameEn: "Hungary" },
  { code: "RO", nameZh: "罗马尼亚", nameEn: "Romania" },
  { code: "IE", nameZh: "爱尔兰", nameEn: "Ireland" },
  { code: "PT", nameZh: "葡萄牙", nameEn: "Portugal" },
  { code: "SK", nameZh: "斯洛伐克", nameEn: "Slovakia" },
  { code: "SI", nameZh: "斯洛文尼亚", nameEn: "Slovenia" },
  { code: "HR", nameZh: "克罗地亚", nameEn: "Croatia" },
  { code: "BG", nameZh: "保加利亚", nameEn: "Bulgaria" },
  { code: "LT", nameZh: "立陶宛", nameEn: "Lithuania" },
  { code: "LV", nameZh: "拉脱维亚", nameEn: "Latvia" },
  { code: "EE", nameZh: "爱沙尼亚", nameEn: "Estonia" },
  { code: "GR", nameZh: "希腊", nameEn: "Greece" },
  // ── 中亚独联体 ──
  { code: "AZ", nameZh: "阿塞拜疆", nameEn: "Azerbaijan" },
  { code: "AM", nameZh: "亚美尼亚", nameEn: "Armenia" },
  { code: "GE", nameZh: "格鲁吉亚", nameEn: "Georgia" },
  { code: "KG", nameZh: "吉尔吉斯斯坦", nameEn: "Kyrgyzstan" },
  { code: "TJ", nameZh: "塔吉克斯坦", nameEn: "Tajikistan" },
  { code: "TM", nameZh: "土库曼斯坦", nameEn: "Turkmenistan" },
  { code: "MD", nameZh: "摩尔多瓦", nameEn: "Moldova" },
  { code: "MN", nameZh: "蒙古", nameEn: "Mongolia" },
  // ── 非洲 / 中东 ──
  { code: "NG", nameZh: "尼日利亚", nameEn: "Nigeria" },
  { code: "KE", nameZh: "肯尼亚", nameEn: "Kenya" },
  { code: "GH", nameZh: "加纳", nameEn: "Ghana" },
  { code: "TZ", nameZh: "坦桑尼亚", nameEn: "Tanzania" },
  { code: "MA", nameZh: "摩洛哥", nameEn: "Morocco" },
  { code: "DZ", nameZh: "阿尔及利亚", nameEn: "Algeria" },
  { code: "TN", nameZh: "突尼斯", nameEn: "Tunisia" },
  { code: "ET", nameZh: "埃塞俄比亚", nameEn: "Ethiopia" },
  { code: "ZM", nameZh: "赞比亚", nameEn: "Zambia" },
  { code: "MZ", nameZh: "莫桑比克", nameEn: "Mozambique" },
  { code: "OM", nameZh: "阿曼", nameEn: "Oman" },
  { code: "QA", nameZh: "卡塔尔", nameEn: "Qatar" },
  { code: "KW", nameZh: "科威特", nameEn: "Kuwait" },
  { code: "JO", nameZh: "约旦", nameEn: "Jordan" },
  { code: "IQ", nameZh: "伊拉克", nameEn: "Iraq" },
  { code: "IL", nameZh: "以色列", nameEn: "Israel" },
  // ── 南美 / 澳新 ──
  { code: "CL", nameZh: "智利", nameEn: "Chile" },
  { code: "PE", nameZh: "秘鲁", nameEn: "Peru" },
  { code: "CO", nameZh: "哥伦比亚", nameEn: "Colombia" },
  { code: "UY", nameZh: "乌拉圭", nameEn: "Uruguay" },
  { code: "PY", nameZh: "巴拉圭", nameEn: "Paraguay" },
  { code: "BO", nameZh: "玻利维亚", nameEn: "Bolivia" },
  { code: "EC", nameZh: "厄瓜多尔", nameEn: "Ecuador" },
  { code: "NZ", nameZh: "新西兰", nameEn: "New Zealand" },
  // ── 南亚 / 东南亚 ──
  { code: "BD", nameZh: "孟加拉国", nameEn: "Bangladesh" },
  { code: "MM", nameZh: "缅甸", nameEn: "Myanmar" },
  { code: "KH", nameZh: "柬埔寨", nameEn: "Cambodia" },
  { code: "LA", nameZh: "老挝", nameEn: "Laos" },
  { code: "LK", nameZh: "斯里兰卡", nameEn: "Sri Lanka" },
  { code: "NP", nameZh: "尼泊尔", nameEn: "Nepal" },
  { code: "SG", nameZh: "新加坡", nameEn: "Singapore" },
];

/**
 * 国别匹配表 = 生产表 + 本模块补充表，**按中文名长度降序**排序。
 *
 * 排序的目的：`findCountryInText()` 按数组顺序返回首个命中，生产表里「印度」排在
 * 「印度尼西亚」之前 ⇒ `"印度尼西亚"` 会被误判成「印度」。本表改为最长名优先，
 * 顺带修掉这个既有隐患（`"印度尼西亚"` → 印度尼西亚、`"斯洛文尼亚"` 不被 `"斯洛伐克"` 抢）。
 */
const COUNTRY_MATCH_LIST: readonly CountryNameLike[] = [
  ...INTERNATIONAL_COUNTRIES.map((c) => ({ code: c.code, nameZh: c.nameZh, nameEn: c.nameEn })),
  ...SUPPLEMENT_COUNTRIES,
].sort((a, b) => b.nameZh.length - a.nameZh.length);

/**
 * 在自由文本中做「最长国名优先」匹配。
 *
 * **两趟匹配，中文名整趟优先于任何英文名**：
 *   1. 先扫所有中文名（按 `COUNTRY_MATCH_LIST` 的最长名优先顺序）；
 *   2. 全部中文名都不命中，再扫英文名（同样最长名优先）。
 *
 * 两趟而非一趟的理由：一趟混扫时，**中文文本会被别国的英文名抢走** ——
 * `"美国 Georgia"` 里「格鲁吉亚」的中文名不在文本中、但它的英文名 `Georgia` 在，
 * 而按名字长度排序「格鲁吉亚」排在「美国」前面 ⇒ 一趟混扫会把美国判成格鲁吉亚。
 * 中文名是更强的信号，必须先穷尽。
 *
 * @param text 位置自由文本
 * @returns 命中的国别；无命中返回 `null`
 */
function matchCountryInText(text: string): CountryNameLike | null {
  if (!text) return null;

  // ① 中文名整趟优先
  for (const country of COUNTRY_MATCH_LIST) {
    if (country.nameZh && text.includes(country.nameZh)) return country;
  }

  // ② 再退到英文名（大小写不敏感）
  const lower = text.toLowerCase();
  for (const country of COUNTRY_MATCH_LIST) {
    if (country.nameEn && lower.includes(country.nameEn.toLowerCase())) return country;
  }

  return null;
}

/**
 * 从 `location` 自由文本拆出「国家」与「城市」。
 *
 * 取数优先级：
 *   1. `parseLocationText()` 判定为中国 ⇒ `country="中国"` + `city ?? province`；
 *   2. `partition === "cn"` 但认不出中国行政区划 ⇒ 双 `null`（**不猜**）；
 *   3. 本模块 `COUNTRY_MATCH_LIST`（生产表 + 补充表）最长国名匹配 ⇒ 中文名作 `country`，
 *      抹掉国名后的剩余段作 `city`（`"丹麦奥尔堡"` → `丹麦` + `奥尔堡`）；
 *   4. 文本无国名但 `parseLocationText()` 给出 ISO code（如 `"DE"`）⇒ 反查中文名；
 *   5. 仍无 ⇒ 双 `null`。
 *
 * **复用** `parseLocationText()`（`src/lib/location-parser.ts`）与
 * `INTERNATIONAL_COUNTRIES`（`src/lib/location-data.ts`），只有「生产表缺国」时才用本模块补充表；
 * T06 的 seed 脚本从相对路径 import 同一函数 ⇒ 国家/城市解析只有一份实现。
 *
 * 覆盖用例：
 *   - `splitCountryCity("荷兰 Drenthe", "intl")` → `{ country: "荷兰", city: "Drenthe" }`
 *   - `splitCountryCity("丹麦奥尔堡", "intl")` → `{ country: "丹麦", city: "奥尔堡" }`
 *   - `splitCountryCity("内蒙古 呼和浩特", "cn")` → `{ country: "中国", city: "呼和浩特" }`
 *   - 无法解析 ⇒ `{ country: null, city: null }`（**不猜**）
 *
 * 说明（与 arch §1.6 的差异）：arch 写作「CN 行用 `province ?? city`」，
 * 但 Excel 该列表头是「城市」，且 `内蒙古 呼和浩特` 必须得到 `呼和浩特` 而非 `内蒙古`
 * ⇒ 实现取 `city ?? province`。
 *
 * @param location 位置自由文本
 * @param partition `"cn"` = 境内库，`"intl"` = 跨境库
 */
export function splitCountryCity(
  location: string | null,
  partition: "cn" | "intl"
): { country: string | null; city: string | null } {
  const empty = { country: null, city: null };
  if (typeof location !== "string") return { ...empty };
  const raw = location.trim();
  if (!raw) return { ...empty };

  const parsed = parseLocationText(raw);

  if (parsed.country === "CN") {
    return { country: "中国", city: firstNonEmpty(parsed.city, parsed.province) };
  }

  if (partition === "cn") {
    // 境内库但解析不出中国行政区划 ⇒ 不猜
    return { ...empty };
  }

  // ③ 生产表 + 本模块补充表 最长国名匹配（补充表覆盖 丹麦/奥地利 等生产表缺失国）
  const matched = matchCountryInText(raw);
  if (matched) {
    return { country: matched.nameZh, city: stripCountryName(raw, matched) };
  }

  if (!parsed.country) return { ...empty };

  // ④ 文本无国名但解析出 ISO code（如 "DE"）⇒ 反查中文名
  const hit = COUNTRY_MATCH_LIST.find((c) => c.code === parsed.country);
  if (!hit) return { ...empty };

  return { country: hit.nameZh, city: stripCountryName(raw, hit) };
}

/**
 * 从原始 location 文本中抹掉已识别的国名，剩余段即城市。
 *
 * @param text 原始文本
 * @param country 已识别的国别（生产表 `CountryData` 或本模块补充表项）
 * @returns 城市文本；剩余为空返回 `null`
 */
function stripCountryName(text: string, country: CountryNameLike | undefined): string | null {
  if (!country) return null;
  let rest = text;

  if (country.nameZh && rest.includes(country.nameZh)) {
    rest = rest.split(country.nameZh).join(" ");
  } else if (country.nameEn && rest.toLowerCase().includes(country.nameEn.toLowerCase())) {
    const idx = rest.toLowerCase().indexOf(country.nameEn.toLowerCase());
    rest = `${rest.slice(0, idx)} ${rest.slice(idx + country.nameEn.length)}`;
  } else {
    const codeRe = new RegExp(`(^|[^A-Za-z])${country.code}([^A-Za-z]|$)`);
    if (codeRe.test(rest)) rest = rest.replace(codeRe, " ");
  }

  return cleanupSegment(rest);
}

/** 去掉首尾分隔符与空白，返回剩余文本（空则 null） */
function cleanupSegment(s: string): string | null {
  const cleaned = s
    .replace(/^[\s,，、·/|()（）\-–—:：]+/, "")
    .replace(/[\s,，、·/|()（）\-–—:：]+$/, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

// ═══════════════════════════════════════════════════════════
// 6. 星级一致性校正（不做加权计算）
// ═══════════════════════════════════════════════════════════

/** 合规成本一票否决关键词（`禁止` 是 `禁入` 在自由文本里的常见同义写法） */
const COST_VETO_RE = /禁入|禁止|不兼容|放弃/;

/** 星级缺省值（LLM 未给 / 给了非数字时的中性档） */
const DEFAULT_STARS = 3;

/**
 * 星级一致性校正（arch §3.3 末尾）。
 *
 * **不做任何加权计算**（PRD §2 ⑦：加权平均不可验证、LLM 算不准），只做两件事：
 *   ① `factors.complianceCost` 命中 `禁入|禁止|不兼容|放弃` ⇒ 强制压到 `1`（一票否决）；
 *   ② 越界 `clamp` 到 `[1,5]` 并取整；非数字 ⇒ `3`。
 *
 * 不做四舍五入之外的任何统计动作，保证 `stars` 始终是 `1–5` 的整数。
 *
 * @param stars LLM 给的星级（`unknown`，可能是字符串 / 越界值 / 乱码）
 * @param factors 四因子（只要 `complianceCost`）
 * @returns `1 | 2 | 3 | 4 | 5`
 */
export function enforceStars(
  stars: unknown,
  factors?: { complianceCost?: string } | null
): StarsLevel {
  let n = DEFAULT_STARS;
  if (typeof stars === "number" && Number.isFinite(stars)) {
    n = Math.round(stars);
  } else if (typeof stars === "string") {
    const parsed = Number.parseFloat(stars.trim());
    if (Number.isFinite(parsed)) n = Math.round(parsed);
  }
  if (!Number.isFinite(n)) n = DEFAULT_STARS;
  if (n < 1) n = 1;
  if (n > 5) n = 5;

  const cost =
    factors && typeof factors === "object" ? str((factors as { complianceCost?: unknown }).complianceCost) : "";
  if (COST_VETO_RE.test(cost)) return 1;

  return n as StarsLevel;
}

// ═══════════════════════════════════════════════════════════
// 7. 降级合成器（导出给 T10 / T11 复用，避免两处口径分叉）
// ═══════════════════════════════════════════════════════════

/**
 * 合成一页结论（PRD §2 ①）。
 *
 * @param env 环境
 * @param s 原始策略（用来取已有 tldr；不给则全合成）
 * @returns 至少 1 行，字段全部落地
 */
export function synthesizeTldr(
  env: DecisionEnv,
  s?: Partial<StrategyDecisionFields> | null
): TldrRow[] {
  const e = resolveEnv(env);
  const src = s && typeof s === "object" ? s : {};
  const raw = Array.isArray(src.tldr) ? src.tldr : [];
  const rows = raw.slice(0, MAX_EQUIPMENT).map((r) => ({
    equipment: str(r?.equipment) || e.productName || FALLBACK_EQUIPMENT,
    bestChannel: str(r?.bestChannel) || FALLBACK_BEST_CHANNEL,
    expectedPriceCny: str(r?.expectedPriceCny) || priceRangeText(e),
    why: str(r?.why) || e.summary || NOT_FOUND,
  }));
  if (rows.length > 0) return rows;

  return [
    {
      equipment: e.productName || FALLBACK_EQUIPMENT,
      bestChannel: FALLBACK_BEST_CHANNEL,
      expectedPriceCny: priceRangeText(e),
      why: e.summary || NOT_FOUND,
    },
  ];
}

/**
 * 由老字段 `compliance.dataExport / crossBorder / notes` 转换出合规清单（PRD §2 ⑩）。
 *
 * 保证返回 **≥3 条**且 **≥1 条 `owner === "老板"`**（PRD 硬性必备项）。
 *
 * `notes` 是 `prompt.ts` 里 LLM 输出的**规范字段名**，必须被消费成一条「待核实项」，
 * 否则合规提示会在归一化阶段被静默丢弃（上游给了、下游没人读）。
 *
 * @param env 环境（读 `compliance` 可选扩展字段）
 */
export function fallbackComplianceTasks(env: DecisionEnv): ComplianceTaskNormalized[] {
  const e = resolveEnv(env);
  const rows: ComplianceTaskNormalized[] = [];

  if (e.compliance?.dataExport) {
    rows.push({
      item: `核实出口报关与商检要求：${truncate(e.compliance.dataExport, 50)}`,
      owner: "外贸",
      deadline: "出口前",
      status: "未开始",
    });
  }
  if (e.compliance?.crossBorder) {
    rows.push({
      item: `确认跨境税务与结算口径：${truncate(e.compliance.crossBorder, 50)}`,
      owner: "外贸",
      deadline: "出口前",
      status: "未开始",
    });
  }
  // 规范名 notes：LLM 的合规提示原文 → 一条待核实项（不丢信息）
  if (e.compliance?.notes) {
    rows.push({
      item: `核实合规提示：${truncate(e.compliance.notes, 50)}`,
      owner: "外贸",
      deadline: "出口前",
      status: "未开始",
    });
  }
  rows.push({ ...COST_CONFIRM_TASK });

  if (rows.length < 3) {
    rows.push({
      item: "核实目标市场准入认证（EAC / GOST / CE 等，按目的国确认）",
      owner: "业务",
      deadline: "出口前",
      status: "未开始",
    });
  }
  if (rows.length < 3) {
    rows.push({
      item: "确认目的港与运费报价（含熏蒸 / 木包装 / 内陆运输）",
      owner: "物流",
      deadline: "出口前",
      status: "未开始",
    });
  }

  return rows.slice(0, MAX_COMPLIANCE_TASKS);
}

/**
 * 待确认项兜底（PRD §2 ⑪）。
 *
 * @param env 环境（`webStatus` 非 ok 时追加「未接入外部检索」确认项）
 */
export function fallbackOpenQuestions(env: DecisionEnv): OpenQuestionNormalized[] {
  const e = resolveEnv(env);
  const rows: OpenQuestionNormalized[] = [{ ...COST_QUESTION }];
  if (e.webStatus !== "ok") rows.push({ ...WEB_DEGRADED_QUESTION });
  return rows;
}

/**
 * 数据来源兜底（PRD §2 ⑫ + §6.3）。
 *
 * 始终保证：≥2 条站内来源 + 一条 `Web检索`（`ok` 时带 URL，非 ok 时 `ref: "—"` + 四档 note）。
 *
 * @param env 环境
 */
export function fallbackDataSources(env: DecisionEnv): DataSourceNormalized[] {
  const e = resolveEnv(env);
  return [
    {
      name: "站内行情",
      ref: `Product/站内同类在售聚合（${e.productName || FALLBACK_EQUIPMENT}）`,
      note: null,
    },
    {
      name: "站内基准价",
      ref: `BrandBenchmark?brand=${e.brandName || NOT_FOUND}`,
      note: null,
    },
    buildWebDataSource(e),
  ];
}

/**
 * 构造「Web检索」这一条数据来源（PRD §6.3 四档，**四种状态都必须产出一条**）。
 *
 * @param e 已解析的环境
 */
function buildWebDataSource(e: ResolvedEnv): DataSourceNormalized {
  if (e.webStatus === "ok" && e.evidenceUrls.length > 0) {
    return { name: "Web检索", ref: e.evidenceUrls.slice(0, 3).join("; "), note: null };
  }
  if (e.webStatus === "ok") {
    return { name: "Web检索", ref: EMPTY_CELL, note: "外部证据未接入（无可引用 URL）" };
  }
  const preset = WEB_STATUS_NOTE[e.webStatus];
  return { name: "Web检索", ref: EMPTY_CELL, note: e.webNote || preset };
}

// ═══════════════════════════════════════════════════════════
// 8. 核心：normalizeDecisionFields
// ═══════════════════════════════════════════════════════════

/** 机型数上限（PRD §8#4：一次策略最多 8 台） */
const MAX_EQUIPMENT = 8;
/** 今日电话总上限（PRD §2 ⑨：总数 ≤15） */
const MAX_TODAY_CALLS = 15;
/** 合规清单上限（PRD §2 ⑩：3–10 条） */
const MAX_COMPLIANCE_TASKS = 10;
/** 待确认项上限（PRD §2 ⑪：2–6 条） */
const MAX_OPEN_QUESTIONS = 6;
/** 数据来源上限（PRD §2 ⑫：3–12 条） */
const MAX_DATA_SOURCES = 12;
/** 每机型否决条数上限（PRD §3.3：≥1 且 ≤4） */
const MAX_REJECTED_PER_EQUIPMENT = 4;
/** 价格锚点上限（8 机型 × 8 格 = 64，留余量） */
const MAX_ANCHORS = 128;
/** 市场排名上限（每机型 3–6 条 × 8） */
const MAX_RANKING = 64;

/** 「本批机型」——`productName` 缺失时的机型占位名 */
const FALLBACK_EQUIPMENT = "本批机型";
/** tldr 合成时 `bestChannel` 的占位（PRD §2 ① 的降级文案） */
const FALLBACK_BEST_CHANNEL = "见③全渠道打法";

/** 强制必备的「确认实际采购成本」合规条（PRD §2 ⑩ 硬性必备项） */
const COST_CONFIRM_TASK: ComplianceTaskNormalized = {
  item: "确认实际采购成本（决定利润口径是否算得出来）",
  owner: "老板",
  deadline: "立刻",
  status: "未开始",
};

/** 强制必备的「实际到手成本」待确认项（PRD §2 ⑪ 唯一允许无条件插入的条目） */
const COST_QUESTION: OpenQuestionNormalized = {
  question: "这批货的实际到手成本是多少？",
  affects: "定价",
  urgency: "立刻",
};

/** 检索非 ok 时必须追加的确认项（PRD §6.4 末行 / §3.6） */
const WEB_DEGRADED_QUESTION: OpenQuestionNormalized = {
  question: "本轮未接入外部检索，价格与准入结论仅基于站内数据，是否仍需执行？",
  affects: "定价",
  urgency: "立刻",
};

/**
 * **降级归一化唯一入口**：把 LLM 输出的 12 个可选字段落成 `NormalizedStrategy`。
 *
 * 覆盖 PRD §2 的 12 条「为空时降级」+ §6.4 的 8 处「非 ok 强制降级」中
 * 可以在此处收口的部分（其余依赖 prompt 约束的见 T08）。
 *
 * **永不抛错**：任意输入（`null` / `{}` / 字段类型错乱）都返回字段齐全的结果。
 *
 * @param s LLM 输出的策略对象（可空）
 * @param env 降级合成所需环境
 * @returns 每个字段都已落地，永不为 `undefined`
 */
export function normalizeDecisionFields(
  s: Partial<StrategyDecisionFields> | null | undefined,
  env: DecisionEnv
): NormalizedStrategy {
  const e = resolveEnv(env);
  const src: Partial<StrategyDecisionFields> =
    s && typeof s === "object" ? (s as Partial<StrategyDecisionFields>) : {};
  const warnings: string[] = [];
  const equipName = (v: unknown): string => str(v) || e.productName || FALLBACK_EQUIPMENT;

  // ── 全局告警 ────────────────────────────────────────────
  if (e.webStatus !== "ok") {
    warnings.push(
      `外部检索不可用（status=${e.webStatus}）：新机对标价未获取，价格与准入结论仅基于站内数据`
    );
  }
  if (e.candidateCount <= 0) {
    warnings.push("渠道池为空：今日电话与最优去向可能缺渠道，请见附件 Excel 全量名单");
  }

  // ── ① tldr ─────────────────────────────────────────────
  const tldrRaw = Array.isArray(src.tldr) ? src.tldr : [];
  const tldr = synthesizeTldr(e, src);
  if (tldrRaw.length === 0) {
    warnings.push("AI 未给出一页结论，已用 summary / priceRange 自动汇总");
  }

  // ── ② keyInsight（缺失 ⇒ 整段不渲染）───────────────────
  let keyInsight: KeyInsightNormalized | null = null;
  const kiRaw = src.keyInsight;
  if (kiRaw && typeof kiRaw === "object") {
    const headline = str(kiRaw.headline);
    const body = str(kiRaw.body);
    if (headline && body) {
      let contrast = str(kiRaw.contrastWithPrior) || null;
      if (contrast && !e.hasPriorStrategy) {
        contrast = null;
        warnings.push("keyInsight.contrastWithPrior 无历史基线，已丢弃该子字段（禁止凭空造「上一单」）");
      }
      keyInsight = { headline, body, contrastWithPrior: contrast };
    } else {
      warnings.push("keyInsight 缺 headline / body，整段不渲染");
    }
  }

  // ── ③ equipmentProfiles ────────────────────────────────
  const profRaw = Array.isArray(src.equipmentProfiles) ? src.equipmentProfiles : [];
  let equipmentProfiles: EquipmentProfileNormalized[] = profRaw
    .slice(0, MAX_EQUIPMENT)
    .map((p) => ({
      name: equipName(p?.name),
      brandCountry: str(p?.brandCountry) || NOT_FOUND,
      type: str(p?.type) || NOT_FOUND,
      spec: str(p?.spec) || EMPTY_CELL,
      power: str(p?.power) || NOT_FOUND,
      // PRD §6.4：无外部来源一律 null（重量影响运费报价，估错会误导）
      weightKg: e.webStatus === "ok" ? numOrNull(p?.weightKg) : null,
      condition: str(p?.condition) || NOT_FOUND,
      positioning: str(p?.positioning) || NOT_FOUND,
    }));

  if (equipmentProfiles.length === 0) {
    // 与 tldr 行数对齐（T10 A2 断言 tldr.length === equipmentProfiles.length）
    equipmentProfiles = tldr.map((row) => ({
      name: row.equipment,
      brandCountry: NOT_FOUND,
      type: NOT_FOUND,
      spec: EMPTY_CELL,
      power: NOT_FOUND,
      weightKg: null,
      condition: NOT_FOUND,
      positioning: NOT_FOUND,
    }));
    warnings.push("机型画像未生成，已用占位行占位（参数未找到）");
  }
  if (e.webStatus !== "ok" && profRaw.some((p) => numOrNull(p?.weightKg) != null)) {
    warnings.push("无外部证据：weightKg 已全部置空（禁止估算重量）");
  }

  // ── ④ marketAnchors（axis 二次归桶 + 新机对标强制降级）──
  const anchorRaw = Array.isArray(src.marketAnchors) ? src.marketAnchors : [];
  let newMachineDowngraded = false;
  let residualAnchorCount = 0;
  const marketAnchors: MarketAnchorNormalized[] = anchorRaw.slice(0, MAX_ANCHORS).map((a) => {
    const market = str(a?.market) || NOT_FOUND;
    // 服务端二次归桶：axis 能判出来就用 axis，否则用 market 文本，都不行才兜底
    const resolution = normalizeAxisEx(market, a?.axis);
    const axis = resolution.axis;
    if (resolution.residual) residualAnchorCount += 1;
    const basisType = pickEnum(a?.basisType, PRICE_BASIS_TYPES) ?? "推算";
    const rawText = str(a?.priceText);
    let priceText = rawText || NOT_FOUND;
    let priceCny = numOrNull(a?.priceCny);
    let note = str(a?.note);

    if (axis === "新机对标" && e.webStatus !== "ok") {
      // PRD §6.4 第 1 行：禁止用「国产同类 × 溢价」冒充新机价
      priceText = "未找到（未接入外部检索）";
      priceCny = null;
      note = "未接入外部检索";
      newMachineDowngraded = true;
    } else if (!rawText && !note) {
      note = "已检索未获取";
    }

    return {
      equipment: equipName(a?.equipment),
      axis,
      market,
      priceText,
      priceCny,
      basisType,
      note: note || "",
      axisResidual: resolution.residual,
    };
  });
  if (newMachineDowngraded) {
    warnings.push("外部检索不可用：「新机对标」格已强制降级为「未找到」");
  }
  if (residualAnchorCount > 0) {
    warnings.push(
      `${residualAnchorCount} 格无法归入价格轴（北美 / 日韩 / 东南亚 / 纯规格描述等），已标 axisResidual：渲染层必须放「备注」列，不得进入任何价格列`
    );
  }
  if (marketAnchors.length === 0) {
    warnings.push("价格锚点未生成（Excel Sheet2 价格四列将全为「—」）");
  }

  // ── ⑤ readout（缺失 ⇒ 不渲染该行）──────────────────────
  const readout = str(src.readout) || null;

  // ── ⑦ marketRanking（先算，供 ⑥ 的降级推导）───────────
  const rankRaw = Array.isArray(src.marketRanking) ? src.marketRanking : [];
  const groupCounter = new Map<string, number>();
  const marketRanking: MarketRankingNormalized[] = rankRaw
    .slice(0, MAX_RANKING)
    .map((r) => {
      const factors = normalizeFactors(r?.factors);
      const equipment = str(r?.equipment) || null;
      const groupKey = equipment ?? "__global__";
      const seq = (groupCounter.get(groupKey) ?? 0) + 1;
      groupCounter.set(groupKey, seq);
      const rankNum = Number(r?.rank);
      const rank =
        Number.isFinite(rankNum) && rankNum > 0 && Number.isInteger(rankNum) ? rankNum : seq;
      return {
        equipment,
        rank,
        market: str(r?.market) || NOT_FOUND,
        stars: enforceStars(r?.stars, factors),
        factors,
        note: str(r?.note) || null,
      };
    });
  if (marketRanking.length === 0) {
    warnings.push("市场排名未生成（该章保留标题并标注「未生成排名」）");
  }

  // ── ⑥ bestDestinations（含 rejected 三档）──────────────
  const bdRaw = Array.isArray(src.bestDestinations) ? src.bestDestinations : [];
  const rejectStats = { total: 0, nonSoft: 0, l3Downgraded: 0 };
  let bestDestinations: BestDestinationNormalized[] = bdRaw.slice(0, MAX_EQUIPMENT).map((d) => {
    const markets = toStrArray(d?.market).slice(0, 3);
    return {
      equipment: equipName(d?.equipment),
      market: markets.length > 0 ? markets : [NOT_FOUND],
      basis: str(d?.basis) || NOT_FOUND,
      calcChain: str(d?.calcChain) || null,
      channelIds: toStrArray(d?.channelIds),
      rejected: normalizeRejected(d?.rejected, e, rejectStats),
    };
  });

  if (bestDestinations.length === 0 && marketRanking.length > 0) {
    // PRD §2 ⑥：用 marketRanking[0] 合成，并显式标注「结论由排名推导」
    const groups = new Map<string, MarketRankingNormalized[]>();
    for (const row of marketRanking) {
      const key = row.equipment ?? e.productName ?? FALLBACK_EQUIPMENT;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    bestDestinations = [...groups.entries()].map(([equipment, rows]) => {
      const top = [...rows].sort((x, y) => x.rank - y.rank)[0];
      return {
        equipment,
        market: [top.market],
        basis: "（结论由市场排名推导，AI 未给出直接判断）",
        calcChain: null,
        channelIds: [],
        rejected: [],
      };
    });
    warnings.push("最优去向未生成，已按市场排名首位推导（结论由排名推导）");
  } else if (bestDestinations.length === 0) {
    warnings.push("最优去向未生成（且无市场排名可推导）");
  }

  if (rejectStats.l3Downgraded > 0) {
    warnings.push(
      `无外部证据：${rejectStats.l3Downgraded} 条 L3「禁入」结论已降为 L2（禁止无具名法规使用强措辞）`
    );
  }
  if (rejectStats.total === 0) {
    warnings.push("本次未生成否决建议，请谨慎决策并自行核实准入政策");
  } else if (rejectStats.nonSoft === 0) {
    warnings.push("否决措辞全部为 L1（最软档），未出现「千万别/禁入」级结论，请谨慎决策");
  }

  // ── ⑧ accessTrafficLight（三灯互斥由服务端保证）────────
  const atlRaw = src.accessTrafficLight;
  const accessTrafficLight = normalizeTrafficLight(atlRaw, warnings);

  // ── ⑨ todayCalls ───────────────────────────────────────
  const callRaw = Array.isArray(src.todayCalls) ? src.todayCalls : [];
  const droppedCalls: string[] = [];
  const todayCalls: TodayCallNormalized[] = [];
  for (const c of callRaw) {
    const candidateIds = toStrArray(c?.candidateIds).slice(0, 3);
    if (candidateIds.length === 0) {
      // PRD §2 ⑨：过滤后为空 ⇒ 整条丢弃（不得留空 id 条目）
      droppedCalls.push(str(c?.equipment) || NOT_FOUND);
      continue;
    }
    if (todayCalls.length >= MAX_TODAY_CALLS) break;
    todayCalls.push({
      equipment: equipName(c?.equipment),
      candidateIds,
      role: pickEnum(c?.role, DEALER_ROLES) ?? "终端",
      whyToday: str(c?.whyToday) || NOT_FOUND,
    });
  }
  if (droppedCalls.length > 0) {
    warnings.push(`${droppedCalls.length} 条今日电话渠道 id 为空，已整条丢弃（不许编造机构名）`);
  }
  if (todayCalls.length === 0) {
    warnings.push(
      `今日无可用电话：渠道池中无匹配本机型的可拨号渠道（候选 ${e.candidateCount} 条，详见附件 Excel 全量名单）`
    );
  }

  // ── ⑩ complianceTasks ─────────────────────────────────
  const taskRaw = Array.isArray(src.complianceTasks) ? src.complianceTasks : [];
  let complianceTasks: ComplianceTaskNormalized[] = taskRaw.slice(0, MAX_COMPLIANCE_TASKS).map((t) => ({
    item: str(t?.item) || NOT_FOUND,
    owner: pickEnum(t?.owner, COMPLIANCE_OWNERS) ?? "业务",
    deadline: normalizeDeadline(str(t?.deadline), e, warnings),
    status: pickEnum(t?.status, COMPLIANCE_STATUSES) ?? "未开始",
  }));

  if (complianceTasks.length === 0) {
    complianceTasks = fallbackComplianceTasks(e);
    warnings.push("合规清单未生成，已由合规提示自动转换（建议人工复核）");
  } else {
    if (!complianceTasks.some((t) => t.owner === "老板")) {
      complianceTasks.push({ ...COST_CONFIRM_TASK });
      warnings.push("合规清单缺「确认实际采购成本（老板）」，已自动补齐");
    }
    if (complianceTasks.length < 3) {
      const filler = fallbackComplianceTasks(e).filter(
        (f) => !complianceTasks.some((t) => t.item === f.item)
      );
      complianceTasks = complianceTasks.concat(filler).slice(0, MAX_COMPLIANCE_TASKS);
      warnings.push("合规清单少于 3 条（视为漏项），已补足站内通用项");
    }
  }

  // ── ⑪ openQuestions ───────────────────────────────────
  const oqRaw = Array.isArray(src.openQuestions) ? src.openQuestions : [];
  const openQuestions: OpenQuestionNormalized[] = oqRaw.slice(0, MAX_OPEN_QUESTIONS).map((q) => ({
    question: str(q?.question) || NOT_FOUND,
    affects: str(q?.affects) || "定价",
    urgency: pickEnum(q?.urgency, URGENCIES) ?? "本周",
  }));

  if (openQuestions.length === 0) {
    openQuestions.push({ ...COST_QUESTION });
    warnings.push("待确认项未生成，已补「实际到手成本」1 条");
  } else if (!openQuestions.some((q) => q.affects.includes("定价"))) {
    openQuestions.push({ ...COST_QUESTION });
    warnings.push("待确认项缺少「定价」相关问题，已补「实际到手成本」1 条");
  }
  if (e.webStatus !== "ok") {
    openQuestions.push({ ...WEB_DEGRADED_QUESTION });
  }

  // ── ⑫ dataSources ─────────────────────────────────────
  const dsRaw = Array.isArray(src.dataSources) ? src.dataSources : [];
  const dataSources: DataSourceNormalized[] = [];
  let invalidSourceName = 0;
  for (const d of dsRaw) {
    const ref = str(d?.ref);
    if (!ref) continue; // PRD §2 ⑫：ref 必须可追溯，空 ref 无条件丢弃
    const name = pickEnum(d?.name, DATA_SOURCE_NAMES);
    if (!name) invalidSourceName += 1;
    dataSources.push({ name: name ?? "站内行情", ref, note: str(d?.note) || null });
    if (dataSources.length >= MAX_DATA_SOURCES) break;
  }
  if (invalidSourceName > 0) {
    warnings.push(`${invalidSourceName} 条数据来源名称非法，已归入「站内行情」`);
  }

  if (!dataSources.some((d) => d.name === "Web检索")) {
    // PRD §6.3：四种状态都必须产出一条 Web检索 记录（否则无法区分「没查到」与「没查」）
    dataSources.push(buildWebDataSource(e));
  }
  if (dataSources.length < 3) {
    const fallback = fallbackDataSources(e);
    for (const f of fallback) {
      if (dataSources.length >= 3) break;
      if (!dataSources.some((d) => d.name === f.name)) dataSources.push(f);
    }
    warnings.push("数据来源不足 3 条，已补站内固定来源");
  }

  return {
    tldr,
    keyInsight,
    equipmentProfiles,
    marketAnchors,
    readout,
    bestDestinations,
    marketRanking,
    accessTrafficLight,
    todayCalls,
    complianceTasks,
    openQuestions,
    dataSources: dataSources.slice(0, MAX_DATA_SOURCES + 1),
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════
// 9. normalizeDecisionFields 的内部工具
// ═══════════════════════════════════════════════════════════

/** 已解析、字段必有值且合法化的环境 */
interface ResolvedEnv {
  productName: string;
  brandName: string;
  priceMinCny: number | null;
  priceMaxCny: number | null;
  webStatus: WebEvidenceStatus;
  webNote: string;
  hasPriorStrategy: boolean;
  candidateCount: number;
  evidenceUrls: string[];
  summary: string | null;
  priceRange: string | null;
  compliance: {
    dataExport: string | null;
    crossBorder: string | null;
    /** 规范名（读自 `compliance.notes ?? compliance.note`） */
    notes: string | null;
    /** 与 `notes` 同值，仅为兼容旧读取点保留 */
    note: string | null;
  } | null;
}

/**
 * 把外部传入的 `env` 合法化（默认值兜底，非法 `webStatus` 视为 `disabled`）。
 *
 * @param env 调用方给的环境（可能不完整）
 */
function resolveEnv(env: DecisionEnv | null | undefined): ResolvedEnv {
  const raw = (env && typeof env === "object" ? env : {}) as unknown as Record<string, unknown>;
  const status = pickEnum(raw.webStatus, WEB_EVIDENCE_STATUSES) ?? "disabled";
  const complianceRaw =
    raw.compliance && typeof raw.compliance === "object"
      ? (raw.compliance as Record<string, unknown>)
      : null;
  const candidateCount =
    typeof raw.candidateCount === "number" && Number.isFinite(raw.candidateCount)
      ? Math.max(0, Math.round(raw.candidateCount))
      : 0;

  return {
    productName: str(raw.productName),
    brandName: str(raw.brandName),
    priceMinCny: numOrNull(raw.priceMinCny),
    priceMaxCny: numOrNull(raw.priceMaxCny),
    webStatus: status,
    webNote: str(raw.webNote),
    hasPriorStrategy: raw.hasPriorStrategy === true,
    candidateCount,
    evidenceUrls: toStrArray(raw.evidenceUrls),
    summary: str(raw.summary) || null,
    priceRange: str(raw.priceRange) || null,
    compliance: complianceRaw
      ? {
          dataExport: str(complianceRaw.dataExport) || null,
          crossBorder: str(complianceRaw.crossBorder) || null,
          // 规范名 notes 优先，单数 note 仅作向后兼容
          notes: str(complianceRaw.notes) || str(complianceRaw.note) || null,
          note: str(complianceRaw.notes) || str(complianceRaw.note) || null,
        }
      : null,
  };
}

/**
 * 归一化 `rejected`（PRD §3）：补 level / trigger、非 ok 时压掉 L3、组内去重。
 *
 * @param list 原始 rejected 数组
 * @param e 已解析环境
 * @param stats 统计累加器（供全局告警使用）
 */
function normalizeRejected(
  list: unknown,
  e: ResolvedEnv,
  stats: { total: number; nonSoft: number; l3Downgraded: number }
): RejectedNormalized[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: RejectedNormalized[] = [];

  for (const item of list) {
    const row = item as { market?: unknown; reason?: unknown; level?: unknown; trigger?: unknown };
    const market = str(row?.market);
    if (!market || seen.has(market)) continue; // PRD §3.3：同一市场不得重复
    seen.add(market);
    if (out.length >= MAX_REJECTED_PER_EQUIPMENT) break;

    const reason = str(row?.reason) || NOT_FOUND;
    const trigger = pickEnum(row?.trigger, REJECT_TRIGGERS);
    let level = pickEnum(row?.level, REJECT_LEVELS) ?? inferRejectLevel(reason, trigger);

    // PRD §6.4 / §3.6：无外部证据禁止 L3（无具名法规依据）
    if (level === "L3" && e.webStatus !== "ok") {
      level = "L2";
      stats.l3Downgraded += 1;
    }

    stats.total += 1;
    if (level !== "L1") stats.nonSoft += 1;

    out.push({ market, reason, level, trigger });
  }

  return out;
}

/**
 * 按 trigger / 措辞反推 `level`（PRD §3.1：缺省时渲染层按 reason 反推）。
 *
 * @param reason 否决理由文本
 * @param trigger 触发条件（有则按其最低档位）
 */
function inferRejectLevel(reason: string, trigger: RejectTrigger | null): RejectLevel {
  if (trigger) return TRIGGER_MIN_LEVEL[trigger];
  if (REJECT_LEVEL_WORDS.L3.some((w) => reason.includes(w))) return "L3";
  if (REJECT_LEVEL_WORDS.L2.some((w) => reason.includes(w))) return "L2";
  if (REJECT_LEVEL_WORDS.L1.some((w) => reason.includes(w))) return "L1";
  return "L1";
}

/**
 * 归一化四因子（每因子仅 3 档 + 括号理由，PRD §2 ⑦）。
 *
 * @param factors 原始 factors
 * @returns 四因子齐全的对象；原值缺失/非法 ⇒ `null`
 */
function normalizeFactors(
  factors: unknown
): { unitPrice: string; liquidity: string; paymentSpeed: string; complianceCost: string } | null {
  if (!factors || typeof factors !== "object") return null;
  const raw = factors as Record<string, unknown>;
  return {
    unitPrice: str(raw.unitPrice) || "未评估",
    liquidity: str(raw.liquidity) || "未评估",
    paymentSpeed: str(raw.paymentSpeed) || "未评估",
    complianceCost: str(raw.complianceCost) || "未评估",
  };
}

/**
 * 归一化准入红绿灯：三灯各自去空、`cap 8`、**跨灯互斥**（PRD §2 ⑧）。
 *
 * 去重优先级 `forbidden > needPermit > friendly`：宁可多报「别去」，不可把禁入国洗成友好国。
 *
 * @param raw 原始对象
 * @param warnings 告警收集器
 */
function normalizeTrafficLight(raw: unknown, warnings: string[]): TrafficLightNormalized {
  const src: Record<string, unknown> =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const forbidden = toStrArray(src.forbidden).slice(0, 8);
  const used = new Set(forbidden);
  const needPermit: string[] = [];
  for (const m of toStrArray(src.needPermit).slice(0, 8)) {
    if (used.has(m)) continue;
    used.add(m);
    needPermit.push(m);
  }
  const friendly: string[] = [];
  for (const m of toStrArray(src.friendly).slice(0, 8)) {
    if (used.has(m)) continue;
    used.add(m);
    friendly.push(m);
  }

  const dupRemoved =
    toStrArray(src.friendly).length +
      toStrArray(src.needPermit).length +
      toStrArray(src.forbidden).length >
    friendly.length + needPermit.length + forbidden.length;
  if (dupRemoved) {
    warnings.push("准入红绿灯存在跨灯重复市场，已按 forbidden > needPermit > friendly 去重");
  }

  const emptyLights: string[] = [];
  if (friendly.length === 0) emptyLights.push("友好");
  if (needPermit.length === 0) emptyLights.push("需许可");
  if (forbidden.length === 0) emptyLights.push("禁入");
  if (emptyLights.length > 0) {
    warnings.push(`准入红绿灯灯位为空（${emptyLights.join("/")}）：本轮未覆盖，渲染为「暂无」`);
  }

  return { friendly, needPermit, forbidden };
}

/**
 * 归一化 `deadline`：空 ⇒ `出口前`；无外部证据时**禁止给具体月数**（PRD §6.4）。
 *
 * @param deadline 原始时限文本
 * @param e 已解析环境
 * @param warnings 告警收集器
 */
function normalizeDeadline(deadline: string, e: ResolvedEnv, warnings: string[]): string {
  const d = deadline.trim();
  if (!d) return "出口前";
  if (e.webStatus !== "ok" && /月|周/.test(d)) {
    if (!warnings.some((w) => w.includes("deadline"))) {
      warnings.push("无外部证据：合规时限中的具体月数/周数已改为「出口前」");
    }
    return "出口前";
  }
  return d;
}

/**
 * 由 `priceMinCny / priceMaxCny / priceRange` 合成 tldr 的价格文案。
 *
 * @param e 已解析环境
 */
function priceRangeText(e: ResolvedEnv): string {
  if (e.priceRange) return e.priceRange;
  const min = e.priceMinCny;
  const max = e.priceMaxCny;
  if (min != null && max != null) return `¥${wan(min)}–${wan(max)} 万`;
  if (min != null) return `≥¥${wan(min)} 万`;
  if (max != null) return `≤¥${wan(max)} 万`;
  return NOT_FOUND;
}

/** 元 → 万（保留 1 位小数，去掉多余的 `.0`） */
function wan(cny: number): string {
  const v = Math.round((cny / 10000) * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/**
 * 在国别表里找匹配的国家（复用 `findCountryInText` 的同类语义，但不引整表循环）。
 *
 * @param text 国别文本（中文 / 英文 / ISO 码）
 */
function findCountryByText(text: string): CountryData | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const lower = t.toLowerCase();
  return INTERNATIONAL_COUNTRIES.find(
    (c) =>
      t.includes(c.nameZh) ||
      lower.includes(c.nameEn.toLowerCase()) ||
      new RegExp(`(^|[^A-Za-z])${c.code}([^A-Za-z]|$)`).test(t)
  );
}

/** 取第一个非空字符串（去空白） */
function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const s = str(v);
    if (s) return s;
  }
  return null;
}

/**
 * 在枚举里取值（大小写不敏感）；非法/缺失返回 `null`。
 *
 * @param v 原始值
 * @param allowed 枚举全集
 */
function pickEnum<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = str(v);
  if (!s) return null;
  const exact = allowed.find((a) => a === s);
  if (exact) return exact;
  const lower = s.toLowerCase();
  return allowed.find((a) => a.toLowerCase() === lower) ?? null;
}

/**
 * 安全转字符串：只接受 `string` / 有限 `number`，其余一律空串。
 *
 * @param v 原始值
 */
function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/**
 * 安全转数字：兼容 `"12,000"`、`"¥120000"` 这类脏数据。
 *
 * @param v 原始值
 */
function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[,\s¥$€£]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * 安全转字符串数组：兼容 LLM 偶尔给单个字符串的情况（`market` 字段高频出错）。
 *
 * @param v 原始值
 */
function toStrArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      const s = str(item);
      if (s) out.push(s);
    }
    return out;
  }
  const single = str(v);
  return single ? [single] : [];
}

/** 截断到 `max` 字符（超出补 `…`） */
function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** `PRIORITIES` 再导出，供 Excel Sheet1 排序键使用（避免调用方二次 import schema） */
export { PRIORITIES } from "./strategy-schema";
