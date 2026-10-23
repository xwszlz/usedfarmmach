/**
 * AI 销售策略 — Prompt 构造与结构化结果解析
 * ─────────────────────────────────────────────────────────
 * 约束（硬）：
 *   ① 仅输出 JSON，字段固定：summary / targetMarkets / priceRange / channels /
 *      compliance / actionChecklist / responsibility（共 6 业务字段 + 1 摘要）。
 *   ② channels 必须引用检索层提供的 candidateId（lead_xxx / dealer_xxx），
 *      禁止编造不存在的 id；系统据此回填脱敏联系方式。
 *   ③ 输出中禁止出现任何明文手机号 / 邮箱 / 微信（PII 由系统脱敏，LLM 只拿到公开属性）。
 *   ④ 合规：默认按 .cn 数据不出境口径给出责任与合规提示（跨境需买家/卖家自担合规）。
 */
import type { StrategyContext } from "./retrieval";

export interface StrategyChannelRef {
  candidateId: string;
  type: "lead" | "dealer";
  rationale: string;
}

export interface StrategyLlmResult {
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
}

export const STRATEGY_SYSTEM_PROMPT = `你是一位资深二手农机跨境贸易策略顾问，精通中国农机（东方红、雷沃、沃得等）与国际品牌（John Deere、CLAAS、New Holland、Kubota 等）的国内行情、出口市场、港口物流与合规。

请基于用户提供的【本品信息】【同品类在售】【全球基准价】【市场情报】【神雕日报快照】【可推荐线索/经销商候选】，为卖家生成一份可落地的《AI 销售策略》。

【输出要求 —— 必须严格只输出一个 JSON 对象，不要任何额外文字/解释/Markdown 围栏】
JSON 结构如下（字段不可省略，无值填 null 或空数组）：
{
  "summary": "一句话策略摘要（20-40 字）",
  "targetMarkets": [
    { "market": "目标市场名(如 俄罗斯/中亚/东欧/东南亚/国内)", "priority": "高|中|低", "rationale": "推荐理由(结合汇率/基准价/情报)", "priceBand": "建议价位区间文本", "channels": "推荐触达渠道" }
  ],
  "priceRange": { "suggestedMinCny": 数字或null, "suggestedMaxCny": 数字或null, "currencyNote": "币种与汇率口径说明", "basis": "定价依据(基准价/同品类/成本)" },
  "channels": [
    { "candidateId": "必须是下方候选列表中的某个 id", "type": "lead|dealer", "rationale": "为何推荐该线索/经销商" }
  ],
  "compliance": { "dataExport": "数据/货物出境合规提示", "crossBorder": "跨境贸易合规提示", "notes": "其他合规注意" },
  "actionChecklist": [ { "step": 1, "action": "具体动作", "owner": "卖家|平台", "eta": "时间预期" } ],
  "responsibility": { "seller": "卖家责任", "platform": "平台责任边界", "disclaimer": "风险免责声明" }
}

【硬性红线】
1. channels 数组中的 candidateId 只能来自用户给出的【可推荐线索/经销商候选】列表，绝不可编造列表外 id；若该列表为空，channels 返回空数组 []。
2. 输出 JSON 中禁止出现任何明文手机号、邮箱、微信号（PII 由系统脱敏处理，你只应引用 candidateId）。
3. 默认按中国站点数据不出境口径给出合规与责任提示；涉及跨境时明确提示由买卖方自担合规与物流责任。
4. 定价须结合【全球基准价】与【同品类在售】，给出有依据的价位区间，不要凭空报价。
5. 只输出 JSON，不要输出 \`\`\`json 围栏或任何前后缀文字。`;

export interface BuildStrategyMessagesInput {
  ctx: StrategyContext;
  text?: string;
  locale?: string;
  imageUrls?: string[];
  videoUrls?: string[];
}

export function buildStrategyMessages(input: BuildStrategyMessagesInput): Array<{ role: string; content: string }> {
  const { ctx, text } = input;
  const p = ctx.product;

  const candidatesBlock = ctx.candidates.length
    ? ctx.candidates
        .map((c) => `- ${c.id} | ${c.type} | ${c.name} | 品牌:${c.brand ?? "—"} | 型号:${c.model ?? "—"} | 地区:${c.region ?? "—"}`)
        .join("\n")
    : "（暂无可匹配线索/经销商候选）";

  const productBlock = p
    ? `品牌:${p.brandName}\n型号:${p.modelName}\n年份:${p.year ?? "—"}\n品类:${p.categoryName}\n国内售价(¥):${p.priceCny ?? "—"}\n地区:${p.location ?? "—"}\n成色:${p.condition ?? "—"}\n工时:${p.workingHours ?? "—"}\n是否国产:${p.isChineseBrand ? "是" : "否"}`
    : "（未提供产品，按文本自由分析）";

  const similarBlock = ctx.similarProducts.length
    ? ctx.similarProducts
        .slice(0, 8)
        .map((s) => `- ${s.brandName} ${s.modelName} ${s.year ?? ""} ¥${s.priceCny ?? "?"} ${s.location ?? ""}`)
        .join("\n")
    : "无";

  const benchBlock = ctx.benchmarks.length
    ? ctx.benchmarks
        .slice(0, 8)
        .map((b) => `- ${b.brand} ${b.model} ¥${b.priceCny ?? "?"} 地区:${b.region ?? "—"} 源:${b.sourceSite ?? "—"}`)
        .join("\n")
    : "无";

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

  const userText =
    `【本品信息】\n${productBlock}\n\n` +
    `【同品类在售】\n${similarBlock}\n\n` +
    `【全球基准价】\n${benchBlock}\n\n` +
    `【市场情报】\n${intelBlock}\n\n` +
    `【神雕日报快照】\n${dailyBlock}\n\n` +
    `【建议出口港口】${ctx.portSuggestion}\n\n` +
    `【可推荐线索/经销商候选（channels 只能引用其 candidateId）】\n${candidatesBlock}\n\n` +
    `【卖家补充】${text || "（无）"}\n\n` +
    `请严格按系统指令只输出 JSON。`;

  return [
    { role: "system", content: STRATEGY_SYSTEM_PROMPT },
    { role: "user", content: userText },
  ];
}

/** 从 LLM 文本中稳健解析策略 JSON（兼容 ```json 围栏 / 裸 JSON / 前后杂文） */
export function parseStrategyResult(text: string): StrategyLlmResult {
  if (!text) return {};
  let jsonStr = text.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    jsonStr = fence[1].trim();
  } else {
    const s = jsonStr.indexOf("{");
    const e = jsonStr.lastIndexOf("}");
    if (s >= 0 && e > s) jsonStr = jsonStr.slice(s, e + 1);
  }
  if (!jsonStr) return {};
  try {
    return JSON.parse(jsonStr) as StrategyLlmResult;
  } catch {
    return {};
  }
}
