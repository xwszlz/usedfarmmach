/**
 * AI 销售策略 — Prompt 构造与结构化结果解析
 * ─────────────────────────────────────────────────────────
 * 约束（硬）：
 *   ① 仅输出 JSON，字段固定：老 9 字段（summary / targetMarkets / priceRange / channels /
 *      compliance / actionChecklist / responsibility / scripts / listingChecklist）
 *      + 新 12 决策字段（见 strategy-schema.ts 的 StrategyDecisionFields）。
 *   ② channels 必须引用检索层提供的 candidateId（lead_xxx / dealer_xxx），
 *      禁止编造不存在的 id；系统据此回填脱敏联系方式。
 *   ③ 输出中禁止出现任何明文手机号 / 邮箱 / 微信（PII 由系统脱敏，LLM 只拿到公开属性）。
 *   ④ 合规：默认按 .cn 数据不出境口径给出责任与合规提示（跨境需买家/卖家自担合规）。
 *   ⑤ 「敢否决」：每个机型至少 1 条 rejected，禁止所有市场都是"可考虑"（PRD §3）。
 *   ⑥ 「不编造」：数据缺失一律写「未找到」；外部检索非 ok 时禁止输出新机对标价与 L3 否决。
 *
 * 架构依据：ARCHITECTURE-INCR-2026-10-26.md §1.3（包 B）+ §3.1 + §3.2 + §3.3
 * 产品依据：AI销售策略-增量PRD-2026-10-25.md §2 / §3 / §6.4
 */
import type { StrategyContext } from "./retrieval";
import type {
  DealerRole,
  RejectLevel,
  RejectTrigger,
  StrategyDecisionFields,
  WebEvidenceStatus,
} from "./strategy-schema";
import { WEB_STATUS_NOTE } from "./strategy-schema";
import { buildDoubaoContent } from "@/lib/ai/multimodal";
import { normalizeAiLocale, withLanguage, type AiLocale } from "@/lib/i18n/ai-locale";

// T08 契约：让 export.ts / route.ts / sales-strategy-export-buttons.tsx 三处
// 既有的 `import type { StrategyLlmResult } from ".../prompt"` 零改动即编译通过。
export type { StrategyDecisionFields } from "./strategy-schema";

export interface StrategyChannelRef {
  candidateId: string;
  type: "lead" | "dealer";
  rationale: string;
}

/**
 * LLM 结构化输出契约。
 *
 * 「additive only」：`extends StrategyDecisionFields` 只追加 12 个**可选**决策字段，
 * 下方 9 个老字段的名称、类型、语义**一字未改**，因此老客户端 / 老 PDF 渲染路径不受影响。
 */
export interface StrategyLlmResult extends StrategyDecisionFields {
  summary?: string;
  targetMarkets?: Array<{
    market: string;
    priority: string; // 高 | 中 | 低
    rationale: string;
    priceBand?: string; // 如 "¥80万-120万"
    channels?: string; // 线上B2B / 线下代理 / 展会展销 / 社媒
  }>;
  priceRange?: {
    suggestedMinCny?: number;
    suggestedMaxCny?: number;
    currencyNote?: string;
    basis?: string;
  } | null;
  channels?: StrategyChannelRef[];
  compliance?: {
    dataExport?: string;
    crossBorder?: string;
    notes?: string;
  } | null;
  actionChecklist?: Array<{ step: number; action: string; owner?: string; eta?: string }>;
  responsibility?: {
    seller?: string;
    platform?: string;
    disclaimer?: string;
  } | null;
  /** T2 导出：销售话术（场景 + 话术），可选 */
  scripts?: Array<{ scenario: string; line: string }>;
  /** T2 导出：上架清单（步骤 + 事项），可选 */
  listingChecklist?: Array<{ step: number; item: string }>;
}

// ═══════════════════════════════════════════════════════════
// 检索层扩展字段桥接（T07 并行开发，可能尚未落地）
// ═══════════════════════════════════════════════════════════

/**
 * `StrategyContext` 在 T07 中新增的字段（arch §3.1）在本文件内的**结构等价**声明。
 *
 * 为什么本地声明而不直接依赖 `retrieval.ts` 的同名类型：
 *   T07 与本任务并行，`webEvidence / rawListings / benchmarkRegions / priorStrategy`
 *   此刻可能还没进 `StrategyContext`。若本文件直接引用，会在 T07 落地前编译失败（互相阻塞）。
 *   本文件只读不写这些字段，且下方 `readCtxExtras()` 用一次 `as unknown as` 收口，
 *   一旦 T07 落地同名字段，这个断言会因为结构一致而继续静默成立（无需回头改）。
 */
interface WebEvidenceItemLike {
  query?: string;
  title?: string;
  url?: string;
  snippet?: string;
}

interface WebEvidenceLike {
  status?: WebEvidenceStatus;
  provider?: string | null;
  items?: WebEvidenceItemLike[];
  urls?: string[];
  successQueries?: number;
  totalQueries?: number;
  note?: string;
  elapsedMs?: number;
  cached?: boolean;
}

interface RawListingLike {
  source?: string;
  brandName?: string;
  modelName?: string;
  year?: number | null;
  priceCny?: number | null;
  currency?: string | null;
  location?: string;
  countryIso?: string | null;
  sourceUrl?: string;
  scrapedAt?: string;
}

/** 基准价一行（`BenchmarkEvidence`，`matchScope` 为 T07 新增可选字段） */
interface BenchmarkLike {
  brand?: string;
  model?: string;
  priceCny?: number | null;
  region?: string | null;
  sourceSite?: string | null;
  matchScope?: "model" | "brand";
}

/** 基准价区域聚合一行（`BenchmarkRegionStat`） */
interface BenchmarkRegionLike {
  region?: string | null;
  count?: number;
  minCny?: number | null;
  maxCny?: number | null;
  medianCny?: number | null;
}

/** 基准价明细三视图（`BenchmarkDetail`） */
interface BenchmarkDetailLike {
  byModel?: BenchmarkLike[];
  byBrand?: BenchmarkLike[];
  byRegion?: BenchmarkRegionLike[];
}

interface PriorStrategyLike {
  id?: string;
  summary?: string;
  targetMarkets?: string[];
}

/** `StrategyContext` + T07 扩展字段（全部可选，缺失即视为"未接入"） */
interface StrategyContextExtras {
  webEvidence?: WebEvidenceLike | null;
  rawListings?: RawListingLike[];
  /** T07 最终落地为 `benchmarkDetail: { byModel, byBrand, byRegion }` */
  benchmarkDetail?: BenchmarkDetailLike | null;
  /** 命名别名兜底：arch §3.1 曾把区域聚合命名为 `benchmarkRegions`，两种都能读到 */
  benchmarkRegions?: BenchmarkRegionLike[];
  priorStrategy?: PriorStrategyLike | null;
  /** `benchmarks` 元素在 T07 后多一个 matchScope（additive，老数据没有该键） */
  benchmarks?: BenchmarkLike[];
}

/**
 * 取 `ctx` 的扩展字段视图。
 *
 * ⚠️ 本文件**唯一**一处类型断言，且只在读 T07 尚未稳定的字段时使用（见上方 StrategyContextExtras 注释）。
 */
function readCtxExtras(ctx: StrategyContext): StrategyContextExtras {
  return ctx as unknown as StrategyContextExtras;
}

/** 检索状态：缺失 / 非法值一律视为 `disabled`（绝不当成 ok，否则会放开新机价与 L3） */
export function resolveWebStatus(ctx: StrategyContext): WebEvidenceStatus {
  const status = readCtxExtras(ctx).webEvidence?.status;
  if (status === "ok" || status === "partial" || status === "timeout" || status === "disabled") {
    return status;
  }
  return "disabled";
}

/** 检索状态说明（供 route.ts 的 searchNote 与前端黄条文案，PRD §6.5） */
export function resolveWebNote(ctx: StrategyContext): string {
  const status = resolveWebStatus(ctx);
  if (status === "ok") return "";
  const note = readCtxExtras(ctx).webEvidence?.note;
  return note && note.trim() ? note.trim() : WEB_STATUS_NOTE[status];
}

// ═══════════════════════════════════════════════════════════
// System Prompt（四处改造：角色 / 禁编造 / 算法透明 / 检索状态）
// ═══════════════════════════════════════════════════════════

export const STRATEGY_SYSTEM_PROMPT = `你是一位资深二手农机跨境贸易**作战参谋**，精通中国农机（东方红、雷沃、沃得等）与国际品牌（John Deere、CLAAS、New Holland、Kubota、Anderson 等）的国内行情、出口市场、港口物流与合规。

你不是"列选项的顾问"，而是"给结论的参谋"。卖家花钱买的是**决策**，不是一张把所有市场都写成"可考虑"的清单。
**敢否决是本职**：一份没有否决建议的策略书，卖家还得自己拿主意，付费价值归零。

请基于用户提供的【本品信息】【历史策略基线】【同品类在售】【站内实时在售（RawListing）】【全球基准价（机型级 / 品牌级）】【基准价分区聚合】【外部检索证据】【检索状态】【市场情报】【神雕日报快照】【可推荐线索/经销商候选】，为卖家生成一份可落地的《AI 销售策略》。

【输出要求 —— 必须严格只输出一个 JSON 对象，不要任何额外文字/解释/Markdown 围栏】
JSON 结构如下（字段不可省略，无值填 null 或空数组；枚举字段只能取给定值之一）：

{
  "summary": "一句话策略摘要（20-40 字）",
  "targetMarkets": [
    { "market": "俄罗斯", "priority": "高|中|低", "rationale": "推荐理由(结合汇率/基准价/情报)", "priceBand": "建议价位区间文本", "channels": "推荐触达渠道" }
  ],
  "priceRange": { "suggestedMinCny": 0, "suggestedMaxCny": 0, "currencyNote": "币种与汇率口径说明", "basis": "定价依据(基准价/同品类/成本)" },
  "channels": [
    { "candidateId": "必须是下方候选列表中的某个 id", "type": "lead|dealer", "rationale": "为何推荐该线索/经销商" }
  ],
  "compliance": { "dataExport": "数据/货物出境合规提示", "crossBorder": "跨境贸易合规提示", "notes": "其他合规注意" },
  "actionChecklist": [ { "step": 1, "action": "具体动作", "owner": "卖家|平台", "eta": "时间预期" } ],
  "responsibility": { "seller": "卖家责任", "platform": "平台责任边界", "disclaimer": "风险免责声明" },
  "scripts": [ { "scenario": "首次触达买家/经销商的话术场景", "line": "该场景下的具体话术" } ],
  "listingChecklist": [ { "step": 1, "item": "上架前需完成的动作" } ],
  "tldr": [ { "equipment": "机型", "bestChannel": "单一去向市场名(可加「（唯一正解）」) | 主市场 优先 + 备市场 走量 | 主市场 为主 + 备市场 兜底 | 主市场 + 备市场 并行", "expectedPriceCny": "国内 50-70 万 / 中亚 FOB 约 35-43 万", "why": "为什么(20-40 字)" } ],
  "keyInsight": { "headline": "一句话反直觉结论", "body": "120-200 字解释", "contrastWithPrior": "与历史策略的差异(仅当给出【历史策略基线】时填, 否则 null)" },
  "equipmentProfiles": [ { "name": "机型", "brandCountry": "品牌原产国", "type": "品类/结构型式", "spec": "关键规格", "power": "功率", "weightKg": null, "condition": "成色/工时", "positioning": "一句话定位" } ],
  "marketAnchors": [ { "equipment": "机型", "axis": "国内|欧洲|中亚|非洲中东澳新|新机对标", "market": "市场名", "priceText": "¥xx 或 未找到", "priceCny": null, "basisType": "新机对标|欧洲二手净价|FOB建议|国内二手估|推算", "note": "口径备注" } ],
  "readout": "关键读图，一句话，≤60 字",
  "bestDestinations": [ { "equipment": "机型", "market": ["首选市场", "次选市场"], "basis": "判断依据", "calcChain": "口径 → 换算 → 折人民币", "channelIds": ["候选列表中的 id"], "rejected": [ { "market": "被否掉的市场", "reason": "否决理由(含数字/政策名)", "level": "L1|L2|L3", "trigger": "R1|R2|R3|R4|R5|R6" } ] } ],
  "marketRanking": [ { "equipment": "机型(全局排名时为 null)", "rank": 1, "market": "市场名", "stars": 5, "factors": { "unitPrice": "单价", "liquidity": "流动性", "paymentSpeed": "回款速度", "complianceCost": "合规成本" }, "note": "备注" } ],
  "accessTrafficLight": { "friendly": ["可直接出口的国别"], "needPermit": ["需许可/认证的国别"], "forbidden": ["禁入国别"] },
  "todayCalls": [ { "equipment": "机型", "candidateIds": ["候选列表中的 id"], "role": "原厂|进口商|授权经销|二手商|拍卖行|物流|政府|终端", "whyToday": "为什么今天要打这通电话" } ],
  "complianceTasks": [ { "item": "合规事项", "owner": "业务|外贸|清关行|物流|进口商|老板|平台", "deadline": "发货前|出口前 或具体日期", "status": "未开始|进行中|已完成" } ],
  "openQuestions": [ { "question": "待老板确认的问题", "affects": "定价|渠道选择|…", "urgency": "立刻|本周|出口前" } ],
  "dataSources": [ { "name": "站内行情|站内基准价|站内同类在售|日报快照|市场情报|Web检索|原厂官网|政府采购网|海关税务", "ref": "URL 或 未找到", "note": "备注" } ]
}

【新增 12 字段的数量与取值硬指标（务必逐条自检）】
1. tldr：条数 = 机型数（1-8），首行即结论；四列（机型/最优去向/能卖多少/为什么）都要有值；其中 bestChannel 与 expectedPriceCny 的写法必须遵守下方硬性红线 15 / 16。
2. keyInsight：恰好 1 个。contrastWithPrior 仅在用户给了【历史策略基线】时填，否则 null（禁止凭空造"上次我们建议…"）。
3. equipmentProfiles：条数 = 机型数（1-8）。weightKg 无来源一律 null（禁止估重）。参数查不到写「未找到」。
4. marketAnchors：每机型 3-8 格；axis 只取「国内/欧洲/中亚/非洲中东澳新/新机对标」，basisType 只取「新机对标/欧洲二手净价/FOB建议/国内二手估/推算」，禁止自由文本。
5. readout：1 句，≤60 字。
6. bestDestinations：每机型**恰好 1 条**；market 为 1-3 个市场（数组序即优先级）；rejected 见下方硬性红线 1-4。
7. marketRanking：每组 3-6 条，rank 从 1 连续递增，stars 只能取整数 1-5。
8. accessTrafficLight：三灯各 1-8 个国别且**互斥**（同一国别不得同时出现在两灯里）。
9. todayCalls：每机型 1-5 条，总量 ≤15；candidateIds 只能来自候选列表。
10. complianceTasks：3-10 条，且**至少 1 条 owner="老板"**。
11. openQuestions：2-6 条，且**至少 1 条 affects 含"定价"**。
12. dataSources：3-12 条；检索状态非 ok 时**必须**有一条 name="Web检索"（ref 填「未找到」）。

【硬性红线（编号即自检清单，逐条核对后再输出）】
1. 敢否决：bestDestinations 的**每个机型至少给 1 条 rejected**，且每个机型 rejected 条数 1-4 之间、市场不得重复。
2. 禁止软性输出：不允许出现"所有市场都是高/中优先级 + 没有任何否决"的组合；targetMarkets 里若全部为「高/中」，必须至少在 rejected 里给出 1 条 L2 或 L3。
3. 触发条件 R1-R6（任一成立即必写 rejected，六个条件互相独立，命中即写）：
   R1 准入红灯：市场 ∈ accessTrafficLight.forbidden ⇒ level=L3；
   R2 价格倒挂：该市场 priceCny < 国内 priceCny × 0.6（折价 >40%）⇒ level 至少 L2；
   R3 规格不兼容：行距/排放/电压/腔型/垄距等硬规格冲突 ⇒ level 至少 L2；
   R4 原厂原产国：目标市场就是该品牌原产国/原厂主力市场 ⇒ level=L2，reason 必须含"原厂就在该地、不缺这台"的意思；
   R5 门槛成本吞噬：认证/物流/熏蒸成本 ≥ 该市场预估毛利 × 50% ⇒ level 至少 L2，reason 必须含占比数字；
   R6 政策突变：检索到明确政策限制（回收税暴涨/禁二手资本货物/进口禁令/制裁）⇒ level=L3，reason 必须含政策名或编号。
   注：R2/R5 的数字只能取自 marketAnchors 与 calcChain，不得另造一套；这两个字段缺失时该条件视为未命中，但要在 dataSources.note 注明数据不足以判断。
4. 措辞三档（只能用下列词，不得自创）：
   L1 不建议：仅限「不建议 / 性价比低 / 可暂缓 / 暂不优先」，且须同时满足"市场可达（无硬性法规障碍）+ 价差 <40% + 损失可逆"；
   L2 千万别：「千万别 / 不要碰 / 放弃 / 绝对不要」，须有 1 项硬证据（亏损/滞销/退运、或 R3/R4/R5 命中），且 reason 必须给 ≥2 条独立理由；
   L3 禁入：「禁入 / 法规禁止 / 不得出口 / 违法」，**必须有具名法规/决议编号/官方口径**，无具名依据禁止使用 L3。
   L1 不得用于 R1/R3/R4/R6 命中的市场（硬障碍用"不建议"属降级误导）。
5. 禁编造：任何查不到的数据一律写「未找到」，禁止写"约""大概""预计"来填空。
6. 禁止用估值冒充实测价：站内估算/同行反推的价格，basisType 必须是「推算」或「国内二手估」，禁止标成「新机对标」「欧洲二手净价」。
7. 不确定的必须进 openQuestions，不要写在正文里假装确定。
8. 算法透明：凡是给出数字（价格、成本、毛利、占比），必须在同一机型/同一市场的 calcChain 里写出换算链：口径（来源）→ 换算（汇率/税费/运费）→ 折人民币，三段落齐。
9. 检索状态分支：见下方【检索状态】段。status 非 ok 时，**硬性禁止**输出「新机对标」的具体价格，且**硬性禁止**使用 L3。
10. channels / todayCalls 的 candidateId 只能来自用户给出的【可推荐线索/经销商候选】列表，绝不可编造列表外 id；列表为空时返回空数组 []。
11. 输出 JSON 中禁止出现任何明文手机号、邮箱、微信号（PII 由系统脱敏处理，你只应引用 candidateId）。
12. 默认按中国站点数据不出境口径给出合规与责任提示；涉及跨境时明确提示由买卖方自担合规与物流责任。
13. 定价须结合【全球基准价】与【同品类在售】，给出有依据的价位区间，不要凭空报价；机型级基准价与品牌级基准价不得混用（品牌级只能作区间参考，不得当作同机型实测锚点）。
14. 只输出 JSON 本身，不要输出 markdown 代码围栏（三个反引号），不要任何前后缀文字。
15. tldr[].bestChannel 允许 **1-2 个去向**，但**必须显式标注主次**，只允许下列三种写法：
    ① 单一去向：直接写市场名，可加后缀「（唯一正解）」；
    ② 双去向且分主次：「<主市场> 优先 + <备市场> 走量」或「<主市场> 为主 + <备市场> 兜底」；
    ③ 双去向且平级：「<主市场> + <备市场> 并行」。
    **禁止**只写两个市场名而不加主次（如「国内、中亚」）；**禁止**写「多渠道」「多市场」「视情况」「均可」这类无决策性的词；**禁止**超过 2 个去向。
16. tldr[].expectedPriceCny 允许给**多个价格**，但每个价格都必须带市场前缀（不同市场的价格口径不同，不得混成一个数），
    正确写法示例：「国内 50-70 万 / 中亚 FOB 约 35-43 万」；**禁止**给不带市场归属的裸数字或裸区间，**禁止**为了"看起来简洁"把多个市场硬压成单一区间。`;

/**
 * 检索状态段（PRD §6.4 的 8 条降级规则里，有 5 条只能靠 prompt 约束，渲染层兜不住）。
 *
 * @param status 外部检索状态（`ok` 时不追加任何限制，避免给 LLM 多余噪音）
 */
export function buildWebStatusPrompt(status: WebEvidenceStatus): string {
  if (status === "ok") {
    return `【检索状态】ok —— 外部检索正常。新机对标价可用（仍须注明来源 URL），L3 否决仅在具备具名法规依据时使用。`;
  }
  const reason =
    status === "partial"
      ? "部分检索超时，外部证据不完整"
      : status === "timeout"
        ? "检索超时，外部证据未接入"
        : "未接入外部检索（未启用），外部证据为空";
  return `【检索状态】${status} —— ${reason}。本轮执行以下强制降级（违反即视为输出不合格）：
A. marketAnchors 中 axis="新机对标" 的格子：priceText 只能写「未找到」，priceCny 必须为 null，note 写「未接入外部检索」；**严禁**用「国产同类 × 进口溢价」等方式反推后冒充实测新机价（若要反推，basisType 必须标「推算」且不得放在"新机对标"格里）。
B. marketAnchors 其他格：只允许来自站内数据（RawListing / 站内基准价 / 国际价 / 日报快照），basisType 仅限「国内二手估 / FOB建议 / 推算」。
C. bestDestinations[].rejected：**禁止 L3**；R6（政策突变）视为未命中；只允许 L1 与 L2，且 L2 的 reason 末尾必须注明「待验证」。
D. accessTrafficLight.forbidden：只能保留【市场情报】中已固化的政策禁入国，并注明来源为站内情报；不得仅凭推断新增禁入国。
E. complianceTasks[].deadline：不得给具体月数承诺（如"2-3 个月"），一律改写为「发货前」或「出口前」。
F. equipmentProfiles[].weightKg：一律 null。
G. dataSources：必须含一条 name="Web检索"（ref="未找到"，note 说明本次未接入的原因）；站内既有证据的来源名用「站内基准价 / 站内行情 / 站内同类在售」，**不得**包装成「Web检索」。
H. openQuestions：必须追加一条 { "question": "本轮未接入外部检索，价格与准入结论仅基于站内数据，是否仍需执行？", "affects": "定价", "urgency": "立刻" }。
I. 一句话原则：有证据时敢说"千万别"，没证据时只说"待验证"，绝不用强措辞填空白。`;
}

/** 组装完整 System Prompt = 静态部分 + 动态检索状态段 */
export function buildStrategySystemPrompt(status: WebEvidenceStatus = "disabled"): string {
  return `${STRATEGY_SYSTEM_PROMPT}\n\n${buildWebStatusPrompt(status)}`;
}

/**
 * 枚举字段锁定段（多语种输出时的**硬约束**，本次最容易翻车的点）。
 *
 * 为什么必须写死在 prompt 里：`.com` 站接入 8 语种输出后，模型一旦"顺手"把
 * `axis: "国内"` 翻成 `"Domestic"`、把 `basisType: "FOB建议"` 翻成 `"FOB estimate"`、
 * 把 `urgency: "立刻"` 翻成 `"Immediately"`，下游三处按字面量精确匹配的逻辑会**静默失效**：
 *   ① `derive.ts` 的 `MARKET_AXIS` 归桶（翻错 → 落「其他」桶 → 美国的价格跑进非洲列）；
 *   ② `pdf-table.ts` 的 Sheet2 五列排序（翻错 → 列头与内容不符）；
 *   ③ `export-excel.ts` 的 basisType 着色（翻错 → 全表单色）。
 * 因此**只有面向买家的说明性文字**允许按目标语言撰写，枚举取值必须原样照抄。
 *
 * ⚠️ 本段只是"要求模型别翻"；真正的兜底在 `derive.ts` 的字面量匹配（翻错即降级），
 *    以及前端那一层「枚举值 → 本地化显示文案」的字典。**不要**为了"支持外语"去改
 *    `MARKET_AXIS` / `PRICE_BASIS_TYPES` 的字面量 —— 那是数据契约，不是文案。
 */
export const STRATEGY_ENUM_LOCK_PROMPT = `【枚举字段不可翻译（最高优先级约束，优先于任何语言指令）】
以下字段的取值是**系统枚举**，下游 PDF/Excel 导出按字面量精确匹配，必须原样使用本 prompt 中给定的固定字面量，
严禁翻译、严禁改写、严禁补空格或换大小写：
- marketAnchors[].axis      （只能取「国内 / 欧洲 / 中亚 / 非洲中东澳新 / 新机对标」之一）
- marketAnchors[].basisType （只能取「新机对标 / 欧洲二手净价 / FOB建议 / 国内二手估 / 推算」之一）
- bestDestinations[].rejected[].level   （只能取「L1 / L2 / L3」）
- bestDestinations[].rejected[].trigger （只能取「R1 / R2 / R3 / R4 / R5 / R6」）
- bestDestinations[].rejected[].level 对应的措辞仍按三档中文关键词判定（L1 不建议 / L2 千万别 / L3 禁入）
- complianceTasks[].owner / complianceTasks[].status
- openQuestions[].urgency   （只能取「立刻 / 本周 / 出口前」）
- todayCalls[].role、dataSources[].name、targetMarkets[].priority（高|中|低）、marketRanking[].stars（1-5）
- JSON 的**键名**（summary / tldr / marketAnchors …）同样保持英文原样，不翻译。

**只有「面向买家的说明性文字」字段**才按目标语言撰写，例如：
tldr[].why、keyInsight.headline / body、readout、bestDestinations[].basis / calcChain /
rejected[].reason、equipmentProfiles 的定位与规格描述、openQuestions[].question、
dataSources[].note、summary、compliance 与 responsibility 的说明文字、scripts[].line。
一句话原则：**枚举与键名照抄，解释性文字才翻译。**`;

/**
 * 组装带枚举锁的 System Prompt（多语种场景的唯一入口）。
 *
 * @param status 外部检索状态（决定降级段）
 */
export function buildStrategySystemPromptLocked(status: WebEvidenceStatus = "disabled"): string {
  return `${buildStrategySystemPrompt(status)}\n\n${STRATEGY_ENUM_LOCK_PROMPT}`;
}

/** LLM 消息（`content` 允许是多模态数组，`ark-client` 的 `content: unknown` 已支持） */
export interface StrategyMessage {
  role: string;
  content: unknown;
}

export interface BuildStrategyMessagesInput {
  ctx: StrategyContext;
  text?: string;
  locale?: string;
  imageUrls?: string[];
  videoUrls?: string[];
}

/** 基准价分区段上限（arch §1.3：`.slice(0, 8)` → 16，且机型级 / 品牌级分开） */
const BENCH_SLICE_LIMIT = 16;
/** 站内实时在售条数上限（RawListing 可能上千行，取最新 12 条足够定锚点） */
const RAW_LISTING_LIMIT = 12;
/** 外部检索证据条数上限 */
const WEB_EVIDENCE_LIMIT = 8;
/** 单条 snippet 截断长度（防止 1 条长摘要吃掉整个 prompt 预算） */
const SNIPPET_MAX_LEN = 200;

/** 安全取数组（T07 字段可能不存在 / 非数组） */
function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

/** 文本截断（保留尾部省略号，避免半句被误读为完整结论） */
function clipText(text: string | undefined | null, max: number = SNIPPET_MAX_LEN): string {
  const s = typeof text === "string" ? text.trim() : "";
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** 数值兜底展示：`null` / `undefined` / `NaN` 统一显示占位符 */
function showNumber(value: number | null | undefined, placeholder: string): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : placeholder;
}

/** 【外部检索证据】块（status / urls / snippet；非 ok 时给空并写明原因） */
function buildWebEvidenceBlock(extras: StrategyContextExtras, status: WebEvidenceStatus): string {
  const web = extras.webEvidence;
  if (status !== "ok" && status !== "partial") {
    return `检索状态:${status}\n未接入外部检索，新机对标价不可用（${WEB_STATUS_NOTE[status]}）。`;
  }
  const items = asArray(web?.items).slice(0, WEB_EVIDENCE_LIMIT);
  const urls = asArray(web?.urls).slice(0, WEB_EVIDENCE_LIMIT);
  const header =
    `检索状态:${status}` +
    ` 成功 query:${showNumber(web?.successQueries, "0")}/${showNumber(web?.totalQueries, "0")}` +
    ` 耗时:${showNumber(web?.elapsedMs, "—")}ms` +
    ` 通道:${web?.provider ?? "—"}` +
    (status === "partial" ? ` 备注:${clipText(web?.note) || "部分检索超时"}` : "");
  const itemLines = items.length
    ? items
        .map((it) => {
          const title = clipText(it?.title, 80) || "（无标题）";
          const url = clipText(it?.url, 160) || "未找到";
          const snippet = clipText(it?.snippet) || "（无摘要）";
          const query = clipText(it?.query, 60);
          return `- [${query || "—"}] ${title} | ${url} | ${snippet}`;
        })
        .join("\n")
    : "（外部检索未返回可用条目）";
  const urlLines = urls.length ? urls.map((u) => `- ${u}`).join("\n") : "（无可引用 URL）";
  return `${header}\n条目:\n${itemLines}\n可引用 URL:\n${urlLines}`;
}

/** 【站内实时在售（RawListing）】块（T07 新增 ctx.rawListings） */
function buildRawListingBlock(extras: StrategyContextExtras): string {
  const rows = asArray(extras.rawListings);
  if (!rows.length) return "无";
  const shown = rows.slice(0, RAW_LISTING_LIMIT);
  const lines = shown
    .map((r) => {
      const year = typeof r?.year === "number" ? String(r.year) : "—";
      const price = showNumber(r?.priceCny, "未找到");
      const country = r?.countryIso ? `(${r.countryIso})` : "";
      return `- ${r?.brandName ?? "—"} ${r?.modelName ?? "—"} ${year} ¥${price} 地区:${r?.location ?? "—"}${country} 源:${r?.source ?? "—"} 抓取:${r?.scrapedAt ?? "—"}`;
    })
    .join("\n");
  const tail =
    rows.length > shown.length ? `\n（共 ${rows.length} 条，已展示最新 ${shown.length} 条）` : "";
  return `${lines}${tail}`;
}

/** 【基准价（机型级 / 品牌级）】块（分区段 + 每段上限 16，arch §1.3） */
function buildBenchBlock(extras: StrategyContextExtras, fallback: StrategyContext["benchmarks"]): string {
  const detail = extras.benchmarkDetail;
  const flat = asArray(extras.benchmarks).length ? asArray(extras.benchmarks) : asArray(fallback);

  // 优先用 T07 的 byModel / byBrand 三视图；缺失时按 matchScope + model 字段自行分区
  const byModel = asArray(detail?.byModel);
  const byBrand = asArray(detail?.byBrand);
  const modelTier = byModel.length
    ? byModel
    : flat.filter((b) => b?.matchScope !== "brand" && !!b?.model && b.model !== "—");
  const brandTier = byBrand.length ? byBrand : flat.filter((b) => b?.matchScope === "brand" || !b?.model);

  if (!modelTier.length && !brandTier.length) return "无";

  const formatOne = (b: BenchmarkLike): string =>
    `- ${b?.brand ?? "—"} ${b?.model ?? "—"} ¥${showNumber(b?.priceCny, "未找到")} 地区:${b?.region ?? "—"} 源:${b?.sourceSite ?? "—"}`;

  const modelShown = modelTier.slice(0, BENCH_SLICE_LIMIT);
  const brandShown = brandTier.slice(0, BENCH_SLICE_LIMIT);

  const modelSection = modelShown.length
    ? `[机型级 · 同机型实测/同型号对标，可直接作锚点]\n${modelShown.map(formatOne).join("\n")}${
        modelTier.length > modelShown.length ? `\n（共 ${modelTier.length} 条，已截断至 ${modelShown.length} 条）` : ""
      }`
    : "[机型级] 未找到";

  const brandSection = brandShown.length
    ? `[品牌级 · 仅作品牌区间参考，禁止当同机型实测价]\n${brandShown.map(formatOne).join("\n")}${
        brandTier.length > brandShown.length ? `\n（共 ${brandTier.length} 条，已截断至 ${brandShown.length} 条）` : ""
      }`
    : "[品牌级] 未找到";

  return `${modelSection}\n${brandSection}`;
}

/** 【基准价分区聚合】块（T07 的 `benchmarkDetail.byRegion`，缺失时读 `benchmarkRegions` 别名） */
function buildBenchRegionBlock(extras: StrategyContextExtras): string {
  const fromDetail = asArray(extras.benchmarkDetail?.byRegion);
  const regions = fromDetail.length ? fromDetail : asArray(extras.benchmarkRegions);
  if (!regions.length) return "无";
  return regions
    .map(
      (r) =>
        `- ${r?.region ?? "全球"} 条数:${showNumber(r?.count, "0")} 最低:¥${showNumber(r?.minCny, "未找到")} 中位:¥${showNumber(r?.medianCny, "未找到")} 最高:¥${showNumber(r?.maxCny, "未找到")}`
    )
    .join("\n");
}

/** 【历史策略基线】块（仅 keyInsight.contrastWithPrior 可用；无则明确告知禁止编造） */
function buildPriorStrategyBlock(extras: StrategyContextExtras): string {
  const prior = extras.priorStrategy;
  if (!prior || (!prior.summary && !asArray(prior.targetMarkets).length)) {
    return "无历史基线 —— keyInsight.contrastWithPrior 必须填 null，禁止编造「上次我们建议…」。";
  }
  return `${prior.summary ?? "（无摘要）"}\n上次推荐市场:${asArray(prior.targetMarkets).join("、") || "未找到"}`;
}

/**
 * 组装送给豆包的消息（system + user）。
 *
 * 三件必须做到的事（此前全缺，是「.com 上策略不能用」的直接成因之一）：
 *   ① **图片/视频真的送进模型**：路由的空内容守卫允许「只传图不传文字」通过，
 *      但旧实现完全没用 `imageUrls / videoUrls` ⇒ 用户不写补充说明时 prompt 里几乎是空的，
 *      模型只能编，还照扣 250 积分。这里用 `buildDoubaoContent` 把图文拼成多模态 content。
 *   ② **输出语种**：system prompt 经 `withLanguage()` 追加语言指令（8 语种，`.cn` 收敛到 zh/en）。
 *   ③ **枚举不翻译**：语言指令只放开"说明性文字"，枚举取值由 `STRATEGY_ENUM_LOCK_PROMPT` 锁死。
 *
 * 返回的是 `Promise`（图片需要服务端下载转 base64），调用方必须 `await`。
 *
 * @param input 上下文 / 卖家补充文字 / 语种 / 图片与视频 URL
 * @returns 两条消息；`user.content` 在有图片或视频时是**多模态数组**，否则是纯字符串
 */
export async function buildStrategyMessages(
  input: BuildStrategyMessagesInput
): Promise<StrategyMessage[]> {
  const { ctx, text } = input;
  const imageUrls = asArray(input.imageUrls).filter((u): u is string => typeof u === "string" && !!u);
  const videoUrls = asArray(input.videoUrls).filter((u): u is string => typeof u === "string" && !!u);
  // 语种兜底：调用方（route）已用 resolveAiLocale 决策，这里再归一化一次防止旧调用方传怪值
  const locale: AiLocale = normalizeAiLocale(input.locale) ?? "zh";
  const p = ctx.product;
  const extras = readCtxExtras(ctx);
  const webStatus = resolveWebStatus(ctx);

  const candidatesBlock = ctx.candidates.length
    ? ctx.candidates
        .map((c) => `- ${c.id} | ${c.type} | ${c.name} | 品牌:${c.brand ?? "—"} | 型号:${c.model ?? "—"} | 地区:${c.region ?? "—"}`)
        .join("\n")
    : "（暂无可匹配线索/经销商候选）";

  const productBlock = p
    ? `品牌:${p.brandName}\n型号:${p.modelName}\n年份:${p.year ?? "—"}\n品类:${p.categoryName}\n国内售价(¥):${p.priceCny ?? "—"}\n地区:${p.location ?? "—"}\n成色:${p.condition ?? "—"}\n工时:${p.workingHours ?? "—"}\n是否国产:${p.isChineseBrand ? "是" : "否"}`
    : "（未提供产品，按文本 / 图片 / 视频自由分析）";

  const similarBlock = ctx.similarProducts.length
    ? ctx.similarProducts
        .slice(0, 8)
        .map((s) => `- ${s.brandName} ${s.modelName} ${s.year ?? ""} ¥${s.priceCny ?? "?"} ${s.location ?? ""}`)
        .join("\n")
    : "无";

  const rawListingBlock = buildRawListingBlock(extras);

  const benchBlock = buildBenchBlock(extras, ctx.benchmarks);

  const benchRegionBlock = buildBenchRegionBlock(extras);

  const webEvidenceBlock = buildWebEvidenceBlock(extras, webStatus);

  const priorStrategyBlock = buildPriorStrategyBlock(extras);

  const intelBlock = ctx.marketIntel.length
    ? ctx.marketIntel
        .slice(0, 5)
        .map((i) => `- [${i.region}/${i.priority}] ${i.title}: ${i.content}`)
        .join("\n")
    : "无";

  const dailyBlock = ctx.dailyReport
    ? `日报日期:${ctx.dailyReport.date}\n` +
      `国际市场参考:${ctx.dailyReport.intlPrices
        .slice(0, 5)
        .map((e) => `${e.model} ${e.year ?? ""} ${e.priceForeign}(¥${e.priceCny}) ${e.location}`)
        .join("; ")}\n` +
      `趋势:${ctx.dailyReport.marketTrends.join("; ")}\n` +
      `即时事件:${ctx.dailyReport.upcomingEvent ? `${ctx.dailyReport.upcomingEvent.name} ${ctx.dailyReport.upcomingEvent.countdown}` : "无"}`
    : "无日报数据";

  // 媒体段：把「收到几张图/几段视频」明写进文字部分，让模型知道去看图而不是纯靠猜
  const mediaBlock =
    imageUrls.length || videoUrls.length
      ? `图片 ${imageUrls.length} 张、视频 ${videoUrls.length} 段（随本消息一同提供，请先识别设备并核对型号/成色/工时，再据此给出策略）`
      : "无（仅凭文字与站内数据）";

  const userText =
    `【本品信息】\n${productBlock}\n\n` +
    `【随附媒体】\n${mediaBlock}\n\n` +
    `【历史策略基线（仅 keyInsight.contrastWithPrior 可用）】\n${priorStrategyBlock}\n\n` +
    `【同品类在售】\n${similarBlock}\n\n` +
    `【站内实时在售（RawListing）】\n${rawListingBlock}\n\n` +
    `【全球基准价（机型级 / 品牌级）】\n${benchBlock}\n\n` +
    `【基准价分区聚合】\n${benchRegionBlock}\n\n` +
    `【外部检索证据】\n${webEvidenceBlock}\n\n` +
    `【检索状态】${webStatus}\n\n` +
    `【市场情报】\n${intelBlock}\n\n` +
    `【神雕日报快照】\n${dailyBlock}\n\n` +
    `【建议出口港口】${ctx.portSuggestion}\n\n` +
    `【可推荐线索/经销商候选（channels / todayCalls 只能引用其 candidateId）】\n${candidatesBlock}\n\n` +
    `【卖家补充】${text || "（无）"}\n\n` +
    `请严格按系统指令只输出 JSON。`;

  // 语种指令永远追加到最末（离模型最近，遵从度最高）；枚举锁在语言指令之前，
  // 语义上被语言指令"优先于语言要求"覆盖（两条指令里都写了优先级，互为兜底）。
  const systemPrompt = withLanguage(buildStrategySystemPromptLocked(webStatus), locale);

  // 有媒体才走多模态：无媒体时保持纯字符串 content（省掉一次数组序列化，也便于排障对日志）
  const userContent: unknown =
    imageUrls.length || videoUrls.length
      ? await buildDoubaoContent(imageUrls, videoUrls, userText)
      : userText;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
}

// ═══════════════════════════════════════════════════════════
// 解析（含截断补全） / 类型清洗 / 空结果判定
// ═══════════════════════════════════════════════════════════

/** 判定「纯对象」（排除 null / 数组 / 基本类型） */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 从 `start`（必须是 `{`）开始做括号配平扫描：返回配对的闭合下标，未闭合返回 `null` */
function findMatchingBrace(text: string, start: number): number | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      if (!stack.length) return i;
    }
  }
  return null;
}

/** 括号配平扫描的附带信息（供补全使用） */
interface BraceScan {
  /** 尚未闭合的括号栈（自底向上） */
  stack: string[];
  /** 扫描结束时是否仍处于字符串内部 */
  inString: boolean;
  /** 是否遇到了奇数个转义（字符串内结尾悬挂 `\`） */
  danglingEscape: boolean;
  /** 顶层最后一个「干净的」成员分隔符（`,`）的位置；找不到为 -1 */
  lastCommaAtDepth: number;
}

/**
 * 单趟扫描并收集补全所需信息。
 *
 * `lastCommaAtDepth` 记录的是**任意深度**最后一个位于字符串外的 `,`，
 * 补全失败时用它逐层回退（砍掉最后一个不完整成员再试）。
 */
function scanForRepair(text: string): BraceScan {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastCommaAtDepth = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      continue;
    }
    if (ch === ",") lastCommaAtDepth = i;
  }
  return { stack, inString, danglingEscape: escaped, lastCommaAtDepth };
}

/**
 * 把「被 max_tokens 从中间截断」的 JSON 补成可解析形态。
 *
 * 做法：① 未闭合字符串补 `"`；② 去掉结尾悬挂的 `,` / `:`；
 *      ③ 按未闭合栈逆序补 `}` / `]`。
 * 单趟补全解析不出来时，由 `parseStrategyResultDetailed` 逐层回退（砍最后一个成员）重试。
 */
function closePartialJson(text: string): string {
  const scan = scanForRepair(text);
  let out = text;
  if (scan.inString) {
    if (scan.danglingEscape) out = out.slice(0, -1); // 尾巴是单个 `\`，去掉避免转义掉补的引号
    out += '"';
  }
  // 去掉悬挂的分隔符（`{"a":1,` → `{"a":1`；`{"a":` → `{"a"` 前面已被上面处理）
  out = out.replace(/[,:]\s*$/, "");
  for (let i = scan.stack.length - 1; i >= 0; i -= 1) {
    out += scan.stack[i] === "{" ? "}" : "]";
  }
  return out;
}

/** 明细解析结果（`truncated` / `repaired` 供路由写日志与响应） */
export interface ParsedStrategyOutcome {
  /** 解析结果；真失败时是 `{}`（由调用方判空后返回 502，**不得**当成成功） */
  strategy: StrategyLlmResult;
  /** 原文 JSON 未闭合（被 max_tokens 截断） */
  truncated: boolean;
  /** 经 `closePartialJson` 补全后才解析成功 */
  repaired: boolean;
}

/** 单体 JSON 解析：先直解，失败则尝试补全 + 逐层回退 */
function parseWithRepair(jsonStr: string): { value: unknown; repaired: boolean } | null {
  try {
    return { value: JSON.parse(jsonStr), repaired: false };
  } catch {
    /* 走补全 */
  }
  // 补全最多回退 MAX_REPAIR_ROUNDS 次：每次砍掉最后一个不完整成员后重试。
  // 6000 token 的输出最多几百个成员，100 次足以覆盖，且失败路径才走，不影响正常耗时。
  const MAX_REPAIR_ROUNDS = 100;
  let work = jsonStr;
  for (let round = 0; round < MAX_REPAIR_ROUNDS; round += 1) {
    if (!work.trim()) return null;
    const closed = closePartialJson(work);
    try {
      const value = JSON.parse(closed);
      return { value, repaired: true };
    } catch {
      /* 继续回退 */
    }
    const scan = scanForRepair(work);
    if (scan.lastCommaAtDepth <= 0) return null;
    work = work.slice(0, scan.lastCommaAtDepth);
  }
  return null;
}

/**
 * 从 LLM 文本中稳健解析策略 JSON，并对「截断」做补全。
 *
 * 与其他链路一致的三段式：先认 ```json 围栏，再认裸 JSON，最后认前后杂文。
 * 与前版的差异（T14 修复）：**截断的输出不再直接丢成 `{}`。**
 * 旧行为 `catch { return {} }` 让「JSON 少了一个 `}`」变成「全字段空 + 照扣 250 积分」，
 * 这是 `.com` 上"策略不能用"的第二个静默根因。现在的顺序是：
 *   ① 直解成功 → 原样返回；
 *   ② 未闭合 → `closePartialJson` 补括号 + 逐层回退成员，解析成功即返回（`repaired: true`）；
 *   ③ 仍失败 → 返回 `{}`，由路由 `isStrategyEmpty()` 判空后返回 502 且**不扣费**。
 *
 * ⚠️ 补全**不能掩盖真失败**：只补结构性括号，绝不凭空造字段值；补完还解析不出就是 `{}`。
 */
export function parseStrategyResultDetailed(text: string): ParsedStrategyOutcome {
  const fail: ParsedStrategyOutcome = { strategy: {}, truncated: false, repaired: false };
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return fail;

  let candidate = "";
  let truncated = false;

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    candidate = fence[1].trim();
    const braceStart = candidate.indexOf("{");
    if (braceStart >= 0 && findMatchingBrace(candidate, braceStart) === null) truncated = true;
  } else {
    const start = raw.indexOf("{");
    if (start < 0) return fail;
    const end = findMatchingBrace(raw, start);
    if (end === null) {
      // 没有配对的 `}` ⇒ 被截断：从第一个 `{` 一直取到末尾（旧实现取到最后一个 `}`，
      // 会把嵌套子对象当成结尾，直接丢掉后半段内容）
      candidate = raw.slice(start);
      truncated = true;
    } else {
      candidate = raw.slice(start, end + 1);
    }
  }

  if (!candidate) return fail;
  const parsed = parseWithRepair(candidate);
  if (!parsed) return { strategy: {}, truncated, repaired: false };
  if (!isPlainObject(parsed.value)) return { strategy: {}, truncated, repaired: parsed.repaired };
  return {
    strategy: parsed.value as StrategyLlmResult,
    truncated,
    repaired: parsed.repaired,
  };
}

/** 兼容既有调用方：只要解析结果（`{}` 表示解析失败，调用方必须判空） */
export function parseStrategyResult(text: string): StrategyLlmResult {
  return parseStrategyResultDetailed(text).strategy;
}

// ═══════════════════════════════════════════════════════════
// 字段类型清洗（防白屏）
// ═══════════════════════════════════════════════════════════

/** 数组型字段（元素必须是纯对象，否则前端 `.map(x => x.foo)` 会拿到 undefined 链） */
const ARRAY_FIELDS = [
  // 老 9 字段中的 5 个数组
  "targetMarkets",
  "channels",
  "actionChecklist",
  "scripts",
  "listingChecklist",
  // 新 12 字段中的 8 个数组
  "tldr",
  "equipmentProfiles",
  "marketAnchors",
  "bestDestinations",
  "marketRanking",
  "todayCalls",
  "complianceTasks",
  "openQuestions",
  "dataSources",
] as const;

/** 字符串型字段 */
const STRING_FIELDS = ["summary", "readout"] as const;

/** 对象型字段（可为 null） */
const OBJECT_FIELDS = [
  "priceRange",
  "compliance",
  "responsibility",
  "keyInsight",
  "accessTrafficLight",
] as const;

/** 取纯对象数组（非对象元素一律丢弃，绝不把字符串塞进 `for...of` / `.map`） */
function toObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject);
}

/** 取字符串数组 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * 深度清洗 `bestDestinations`：`market` / `channelIds` 必须是字符串数组，`rejected` 必须是对象数组。
 *
 * 为什么单独洗：前端与 PDF 都会 `market.join(" / ")`、`rejected.map(...)`，
 * 模型偶尔把 `market` 返回成字符串 `"乌兹别克"` ⇒ `join is not a function` ⇒ 整页白屏。
 */
function sanitizeBestDestinations(value: unknown): StrategyDecisionFields["bestDestinations"] {
  return toObjectArray(value).map((item) => ({
    equipment: typeof item.equipment === "string" ? item.equipment : "",
    market: toStringArray(item.market),
    basis: typeof item.basis === "string" ? item.basis : "",
    calcChain: typeof item.calcChain === "string" ? item.calcChain : undefined,
    channelIds: toStringArray(item.channelIds),
    rejected: toObjectArray(item.rejected).map((r) => ({
      market: typeof r.market === "string" ? r.market : "",
      reason: typeof r.reason === "string" ? r.reason : "",
      level: typeof r.level === "string" ? (r.level as RejectLevel) : undefined,
      trigger: typeof r.trigger === "string" ? (r.trigger as RejectTrigger) : undefined,
    })),
  }));
}

/** 深度清洗 `todayCalls`（`candidateIds` 必须是字符串数组，前端据此回填线索） */
function sanitizeTodayCalls(value: unknown): StrategyDecisionFields["todayCalls"] {
  return toObjectArray(value).map((item) => ({
    equipment: typeof item.equipment === "string" ? item.equipment : "",
    candidateIds: toStringArray(item.candidateIds),
    // role 缺失 / 非字符串时落「终端」（枚举全集里语义最中性的一档，渲染层不会崩）
    role: (typeof item.role === "string" && item.role ? item.role : "终端") as DealerRole,
    whyToday: typeof item.whyToday === "string" ? item.whyToday : "",
  }));
}

/** 深度清洗 `accessTrafficLight`（三灯必须都是字符串数组，否则渲染层 `.map` 直接抛错） */
function sanitizeAccessTrafficLight(
  value: unknown
): StrategyDecisionFields["accessTrafficLight"] {
  if (!isPlainObject(value)) return undefined;
  return {
    friendly: toStringArray(value.friendly),
    needPermit: toStringArray(value.needPermit),
    forbidden: toStringArray(value.forbidden),
  };
}

/**
 * 按类型白名单清洗 LLM 输出（**防白屏**的最后一道闸）。
 *
 * 背景：模型偶尔把 `targetMarkets` 返回成字符串、把 `channels` 返回成对象、
 * 把 `bestDestinations[].market` 返回成标量。前端直接 `.map()` / `for...of` 会抛错白屏，
 * 而路由此前是 `...strategy` 原样透传。这里逐字段按类型收敛：
 * 数组字段落 `[]`（非对象元素丢弃）、字符串落 `""`、对象字段非法落 `undefined`（渲染层按空处理）。
 *
 * ⚠️ 本函数**只做类型收敛，不做业务降级**：真正的「缺字段怎么补」在 `derive.ts` 的
 *    `normalizeDecisionFields`（PDF/Excel 唯一降级入口）。这里只保证不崩。
 *
 * @param input `parseStrategyResult` 的结果（可能带任意脏类型）
 * @returns 字段类型全部合法的策略对象（永不为 null）
 */
export function sanitizeStrategy(input: unknown): StrategyLlmResult {
  const src: Record<string, unknown> = isPlainObject(input) ? input : {};
  const out: Record<string, unknown> = {};

  for (const key of ARRAY_FIELDS) {
    out[key] = toObjectArray(src[key]);
  }
  for (const key of STRING_FIELDS) {
    const value = src[key];
    out[key] = typeof value === "string" ? value : "";
  }
  for (const key of OBJECT_FIELDS) {
    const value = src[key];
    out[key] = isPlainObject(value) ? value : undefined;
  }

  // 三处需要下钻的字段（前端有直接的数组方法调用，是白屏高发点）
  out.bestDestinations = sanitizeBestDestinations(src.bestDestinations);
  out.todayCalls = sanitizeTodayCalls(src.todayCalls);
  const light = sanitizeAccessTrafficLight(src.accessTrafficLight);
  out.accessTrafficLight = light;

  return out as StrategyLlmResult;
}

/**
 * 判定「解析结果实质为空」。
 *
 * 用于路由在**扣费之前**拦住「模型什么都没给」的情形：
 * 旧实现把解析失败的 `{}` 展开成空策略，返回 `success: true` 并照扣 250 积分 ——
 * 用户花钱买到一张空表，这是本次必须消灭的最恶劣行为。
 *
 * 判空口径：21 个业务字段（9 老 + 12 新）**全部**为空（数组空、字符串空、对象缺失）即为空。
 *
 * @param strategy 解析（并清洗）后的策略对象
 */
export function isStrategyEmpty(strategy: unknown): boolean {
  if (!isPlainObject(strategy)) return true;
  const keys = Object.keys(strategy);
  if (!keys.length) return true;

  for (const key of ARRAY_FIELDS) {
    if (toObjectArray(strategy[key]).length > 0) return false;
  }
  for (const key of STRING_FIELDS) {
    const value = strategy[key];
    if (typeof value === "string" && value.trim()) return false;
  }
  for (const key of OBJECT_FIELDS) {
    const value = strategy[key];
    // `accessTrafficLight` 只有空数组时不算内容；其余对象只要真是对象就算有内容
    if (!isPlainObject(value)) continue;
    if (key === "accessTrafficLight") {
      if (
        toStringArray(value.friendly).length ||
        toStringArray(value.needPermit).length ||
        toStringArray(value.forbidden).length
      ) {
        return false;
      }
      continue;
    }
    if (Object.keys(value).length > 0) return false;
  }
  return true;
}

