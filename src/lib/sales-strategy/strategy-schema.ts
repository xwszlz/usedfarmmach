/**
 * AI 销售策略 · 决策字段契约与枚举常量（N02）
 * ─────────────────────────────────────────────────────────
 * 本文件是「12 个决策字段 + 全部枚举 + 固定文案常量」的**唯一真相**：
 *   - 零 prisma 依赖、零 node:fs、零网络调用 ⇒ **可被客户端组件安全 import**
 *   - 只导出 `type` / `interface` / `const` 字面量，没有任何副作用
 *
 * 行号级依据：
 *   - 12 字段类型 = ARCHITECTURE-INCR-2026-10-26.md §3.2（逐字）
 *   - 枚举与常量 = 同文件 §3.3（逐字）
 *   - 产品语义 = AI销售策略-增量PRD-2026-10-25.md §2 / §3 / §5
 *
 * ⚠️ 修改本文件等于修改对外契约：T07/T08/T10/T11/N03 全部依赖这里，
 *    任何字段改名或枚举增删都会造成跨模块编译失败，必须走架构变更。
 */

// ═══════════════════════════════════════════════════════════
// 0. 共用基础类型
// ═══════════════════════════════════════════════════════════

/**
 * 外部检索状态（PRD §6.3 四档）。
 *
 * ⚠️ T07 会在 `retrieval.ts` 内声明同构的同名类型；两者是**结构等价的字符串联合**，
 *    TS 结构化类型下可直接互相赋值，不会报错。**刻意不在本文件 import retrieval.ts**，
 *    因为后者依赖 prisma，一旦引入本文件就无法被客户端组件引用。
 */
export type WebEvidenceStatus = "ok" | "partial" | "timeout" | "disabled";

/** 外部检索状态全集（顺序即严重度递增，供运行时校验使用） */
export const WEB_EVIDENCE_STATUSES: readonly WebEvidenceStatus[] = [
  "ok",
  "partial",
  "timeout",
  "disabled",
];

// ═══════════════════════════════════════════════════════════
// 1. 12 个决策字段（全部可选 — arch §3.2 逐字）
// ═══════════════════════════════════════════════════════════

/**
 * 12 个新增决策字段。
 *
 * 契约要点（PRD §1.4）：
 * 1. **全部 `?` 可选**：老客户端只传 9 个老字段也不会编译失败 / 运行报错；
 * 2. 「可选」≠「可以不给」：P0 字段的产出由 System Prompt 强制，
 *    渲染层的兜底**只允许**写在 `derive.ts`（`normalizeDecisionFields`），
 *    PDF / Excel 不得各自造一套默认值；
 * 3. 读取处禁止 `strategy.tldr!.map(...)`，必须先过 `normalizeDecisionFields`。
 */
export interface StrategyDecisionFields {
  /** ① 一页结论：行数 = 机型数（1–8） */
  tldr?: Array<{
    equipment: string;
    bestChannel: string;
    expectedPriceCny: string;
    why: string;
  }>;

  /** ② 反直觉洞察：恰好 1 个；contrastWithPrior 仅在 ctx.priorStrategy 非空时允许 */
  keyInsight?: { headline: string; body: string; contrastWithPrior?: string | null };

  /** ③ 机型画像：条数 = 机型数（1–8） */
  equipmentProfiles?: Array<{
    name: string;
    brandCountry: string;
    type: string;
    spec: string;
    power: string;
    weightKg?: number | null;
    condition: string;
    positioning: string;
  }>;

  /** ④ 价格锚点矩阵：每机型 3–8 格；axis/basisType 为严格 5 值枚举 */
  marketAnchors?: Array<{
    equipment: string;
    axis: MarketAxis;
    market: string;
    priceText: string;
    priceCny?: number | null;
    basisType: PriceBasisType;
    note?: string;
  }>;

  /** ⑤ 关键读图：1 句 ≤60 字 */
  readout?: string;

  /** ⑥ 每台最优去向：每机型恰好 1 条，market 1–3 个（数组序即优先级） */
  bestDestinations?: Array<{
    equipment: string;
    market: string[];
    basis: string;
    calcChain?: string;
    channelIds?: string[];
    rejected?: Array<{
      market: string;
      reason: string;
      level?: RejectLevel;
      trigger?: RejectTrigger;
    }>;
  }>;

  /** ⑦ 市场排名：每组 3–6 条，rank 从 1 连续 */
  marketRanking?: Array<{
    equipment?: string | null;
    rank: number;
    market: string;
    stars: 1 | 2 | 3 | 4 | 5;
    factors?: {
      unitPrice: string;
      liquidity: string;
      paymentSpeed: string;
      complianceCost: string;
    };
    note?: string;
  }>;

  /** ⑧ 准入红绿灯：三灯各 1–8 且互斥 */
  accessTrafficLight?: {
    friendly: string[];
    needPermit: string[];
    forbidden: string[];
  };

  /** ⑨ 今天该打的电话：每机型 1–5 条，总 ≤15 */
  todayCalls?: Array<{
    equipment: string;
    candidateIds: string[];
    role: DealerRole;
    whyToday: string;
  }>;

  /** ⑩ 合规前置清单：3–10 条，且 ≥1 条 owner="老板" */
  complianceTasks?: Array<{
    item: string;
    owner: ComplianceOwner;
    deadline: string;
    status?: ComplianceStatus;
  }>;

  /** ⑪ 待老板确认：2–6 条，且 ≥1 条 affects 含"定价" */
  openQuestions?: Array<{ question: string; affects: string; urgency: Urgency }>;

  /** ⑫ 数据来源：3–12 条；非 ok 时必须有 Web检索 一条 */
  dataSources?: Array<{ name: DataSourceName; ref: string; note?: string }>;
}

// ═══════════════════════════════════════════════════════════
// 2. 枚举（arch §3.3 逐字；顺序有意义，勿重排）
// ═══════════════════════════════════════════════════════════

/** 价格锚点矩阵的「轴」——Excel Sheet2 的 5 个价格列固定顺序即此数组顺序 */
export type MarketAxis = "国内" | "欧洲" | "中亚" | "非洲中东澳新" | "新机对标";

/** 5 个价格轴（Sheet2 列序；`新机对标` 在 Sheet2 里下沉到「备注」列） */
export const MARKET_AXIS: readonly MarketAxis[] = [
  "国内",
  "欧洲",
  "中亚",
  "非洲中东澳新",
  "新机对标",
];

/**
 * 归桶失败时的兜底轴。
 *
 * MARKET_AXIS 只有 5 个值、**没有「其他」**，而 PRD §4.1.1 的「其他」桶（含北美）
 * 在价格轴上无处安放 ⇒ 值统一落到范围最宽的 `非洲中东澳新`，
 * **但必须在归一化结果里打 `axisResidual: true`**（`derive.ts` / `MarketAnchorNormalized`）：
 * 渲染层据此把该格放进 Sheet2「备注」列，**不得进入任何价格列**
 * —— 否则会出现「美国 $48k」显示在「非洲中东澳新」列下面这种价格列名与内容不符的硬伤。
 */
export const RESIDUAL_MARKET_AXIS: MarketAxis = "非洲中东澳新";

/** 价格口径：**禁止自由文本**（UI 按口径着色，PRD §7 D1 严格枚举断言） */
export type PriceBasisType = "新机对标" | "欧洲二手净价" | "FOB建议" | "国内二手估" | "推算";

/** 价格口径全集（运行时校验用） */
export const PRICE_BASIS_TYPES: readonly PriceBasisType[] = [
  "新机对标",
  "欧洲二手净价",
  "FOB建议",
  "国内二手估",
  "推算",
];

/** 否决措辞强度三档 */
export type RejectLevel = "L1" | "L2" | "L3";

/** 否决措辞档位全集 */
export const REJECT_LEVELS: readonly RejectLevel[] = ["L1", "L2", "L3"];

/** 否决触发条件 R1–R6（PRD §3.2） */
export type RejectTrigger = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

/** 否决触发条件全集 */
export const REJECT_TRIGGERS: readonly RejectTrigger[] = ["R1", "R2", "R3", "R4", "R5", "R6"];

/** PRD §3.2 六触发条件 → 允许的**最低**档位（防降级误导：R1/R3/R4/R6 不得用 L1） */
export const TRIGGER_MIN_LEVEL: Record<RejectTrigger, RejectLevel> = {
  R1: "L3",
  R2: "L2",
  R3: "L2",
  R4: "L2",
  R5: "L2",
  R6: "L3",
};

/** L1/L2/L3 允许措辞（防滥用；QA B5 用作正则来源） */
export const REJECT_LEVEL_WORDS: Record<RejectLevel, readonly string[]> = {
  L1: ["不建议", "性价比低", "可暂缓", "暂不优先"],
  L2: ["千万别", "不要碰", "放弃", "绝对不要"],
  L3: ["禁入", "法规禁止", "不得出口", "违法"],
};

/** 合规事项的责任方（7 值） */
export type ComplianceOwner = "业务" | "外贸" | "清关行" | "物流" | "进口商" | "老板" | "平台";

/** 合规责任方全集 */
export const COMPLIANCE_OWNERS: readonly ComplianceOwner[] = [
  "业务",
  "外贸",
  "清关行",
  "物流",
  "进口商",
  "老板",
  "平台",
];

/** 合规事项状态（缺省 `未开始`） */
export type ComplianceStatus = "未开始" | "进行中" | "已完成";

/** 合规状态全集 */
export const COMPLIANCE_STATUSES: readonly ComplianceStatus[] = ["未开始", "进行中", "已完成"];

/** 待确认项的紧迫度（严格 3 值） */
export type Urgency = "立刻" | "本周" | "出口前";

/** 紧迫度全集 */
export const URGENCIES: readonly Urgency[] = ["立刻", "本周", "出口前"];

/** 渠道角色（8 值，与 `Dealer.role` 对齐） */
export type DealerRole =
  | "原厂"
  | "进口商"
  | "授权经销"
  | "二手商"
  | "拍卖行"
  | "物流"
  | "政府"
  | "终端";

/** 渠道角色全集（顺序即 todayCalls 的 role 权重：靠前更重要） */
export const DEALER_ROLES: readonly DealerRole[] = [
  "授权经销",
  "进口商",
  "二手商",
  "终端",
  "原厂",
  "拍卖行",
  "物流",
  "政府",
];

/** 数据来源名称（9 值） */
export type DataSourceName =
  | "站内行情"
  | "站内基准价"
  | "站内同类在售"
  | "日报快照"
  | "市场情报"
  | "Web检索"
  | "原厂官网"
  | "政府采购网"
  | "海关税务";

/** 数据来源名称全集 */
export const DATA_SOURCE_NAMES: readonly DataSourceName[] = [
  "站内行情",
  "站内基准价",
  "站内同类在售",
  "日报快照",
  "市场情报",
  "Web检索",
  "原厂官网",
  "政府采购网",
  "海关税务",
];

/** 优先级（动作属性，**不是**渠道分级；S 只能由策略判定或人工指定） */
export type Priority = "S" | "A" | "B" | "C";

/** 优先级全集（顺序即排序键：S → A → B → C） */
export const PRIORITIES: readonly Priority[] = ["S", "A", "B", "C"];

/** 星级 1–5 整数（由 LLM 给出，服务端只做 clamp + 一票否决校正） */
export type StarsLevel = 1 | 2 | 3 | 4 | 5;

// ═══════════════════════════════════════════════════════════
// 3. 固定文案与常量（**禁止 LLM 生成**）
// ═══════════════════════════════════════════════════════════

/**
 * 汇率基准：服务端常量，不由 LLM 提供（PRD §4.2 + §8#5）。
 *
 * 理由：一份文件全篇必须用同一套汇率，LLM 逐格换算必然自相矛盾。
 */
export const FX_BASE = { EUR: 7.8, USD: 7.15, JPY: 0.047 } as const;

/** 汇率基准的中文展示文案（Excel Sheet2 末行 B 列逐字使用） */
export const FX_NOTE_ZH = "1 EUR≈7.8元、1 USD≈7.15元、1 JPY≈0.047元";

/** 附录固定声明（服务端常量，禁止 LLM 生成，PRD §2 ⑫） */
export const NO_FABRICATION_CLAUSE =
  "未查到的标「未找到」，无编造。价格为挂牌价/推算，实际成交通常下浮 10–20%，请电话核实。";

/** 统一空值占位（全角破折号；Excel 全表口径，PRD §4.0） */
export const EMPTY_CELL = "—";

/** 统一「查了没有」占位（与 `EMPTY_CELL` 语义不同，禁止混用，PRD §2 ④） */
export const NOT_FOUND = "未找到";

/** 检索非 ok 时的 PDF 顶部告警条文案（emoji 已被 T10 的 stripEmoji 剥离） */
export const WEB_DEGRADED_BANNER =
  "本次策略未接入外部检索（检索超时/未启用）。下列价格与准入结论仅基于站内数据；标注「推算」的数字请务必电话核实。";

/** 检索状态 → `dataSources.note` 四档文案（PRD §6.3） */
export const WEB_STATUS_NOTE: Record<Exclude<WebEvidenceStatus, "ok">, string> = {
  partial: "外部证据部分缺失（部分检索超时）",
  timeout: "外部证据未接入（检索超时）",
  disabled: "外部证据未接入（未启用）",
};
