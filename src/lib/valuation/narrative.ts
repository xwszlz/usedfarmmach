/**
 * AI 估值「结论叙述层」（Valuation Narrative Layer）
 * ────────────────────────────────────────────────────────────────────────────
 * 背景（老板实测反馈：「可以生成，但是这报告还是比较简单的」）：
 *   改造前整条估值链路**没有任何文本大模型**——所谓「结论」是 formulas.ts 里 if-else
 *   拼的一句模板，而且在国内登录路径被前端直接丢弃。后端算出的几十个字段里，
 *   前端只用了 6 个。本模块补上真正缺的那一层：**判断**。
 *
 * 职责边界（很重要，别在这里做别的事）：
 *   - 本模块**只读**用 `ValuationResult` / `getValuationIntelligence()` / `productMeta`
 *     传进来的既有计算结果，**不重算价格、不改因子**。价格口径的唯一真相仍是 formulas.ts。
 *   - 本模块只做三件事：① 把服务端已有数据压成一份紧凑 payload 喂给豆包；
 *     ② 拿回严格 JSON 并做**防御式归一化**；③ 失败一律返回 `narrative: null`。
 *
 * 三条设计红线（踩了就等于白做）：
 *   1. **绝不抛异常**。结论生成失败不能让估值失败——LLM 挂了也必须返回 `null`，
 *      route 照常把价格结果返回给用户。
 *   2. **绝不编造价格**。算不出的轴位必须 `priceCny: null` + `basis: "not_found"`。
 *      禁止「国产同类价 × 出口溢价系数」这类反推后冒充实测值（这正是老板会当场识破的东西）。
 *      `dataSources` 的 `ref` 走**白名单校验**：模型写出 payload 里不存在的来源，
 *      该条直接丢弃，再由确定性兜底补上真实来源。
 *   3. **枚举不翻译**。`axis` / `basis` 是前端按字面量匹配的机器值，必须原样输出英文枚举；
 *      所有说明性文字按 `locale` 撰写（由 `withLanguage` 注入的语言指令约束）。
 *
 * 计费：拿不到 provider usage 时用 `ESTIMATED_TOKENS` 兜底并标 `estimated`，
 *   与 image-analyzer / video-analyzer 同一模式 —— route 的 `drainUsage()` 会把视觉 token
 *   与本层 token 合并成**一次**扣费，不产生第二笔账单。
 */

import { isCnSite } from "@/config/site";
import { chatCompletionDoubao, getArkModelId } from "@/lib/ai/ark-client";
import { recordUsage, ESTIMATED_TOKENS } from "@/lib/credits/usage-collector";
import { withLanguage, type AiLocale } from "@/lib/i18n/ai-locale";
import type { ValuationResult } from "@/lib/valuation/formulas";
import { MIN_RESIDUAL_RATIO } from "@/lib/valuation/brand-data";

// ============================================================
// 对外类型（前端 / route 依赖这些字面量，改动需同步前端）
// ============================================================

/** 价格锚点轴位（英文枚举，不翻译 —— 前端按字面量渲染图标与文案） */
export type MarketAnchorAxis =
  | "domestic_used"
  | "export_fob"
  | "target_market_retail"
  | "new_equivalent"
  | "salvage";

/** 锚点依据强度（英文枚举，不翻译） */
export type AnchorBasis = "measured" | "benchmark" | "derived" | "not_found";

/** 价格锚点：本机在某个市场轴位上的价格判断 */
export interface MarketAnchor {
  axis: MarketAnchorAxis;
  /** 面向用户的描述（按目标语言，如「约 ¥185,000」/「未找到」） */
  priceText: string;
  /** 人民币数值；算不出为 null（此时 basis 必须是 not_found） */
  priceCny: number | null;
  basis: AnchorBasis;
  /** 依据说明（按目标语言；basis=derived 时必须写清算式） */
  note: string;
}

/** 待确认问题：缺什么 → 影响哪个估值因子 → 补上后能收窄多少 */
export interface OpenQuestion {
  question: string;
  affects: string;
  impact: string;
}

/** 数据来源：ref 为机器可校验的 payload 路径，不是自由文本 */
export interface NarrativeDataSource {
  name: string;
  ref: string;
  note: string;
}

/** 估值结论叙述层输出 */
export interface ValuationNarrative {
  /** 一页结论：3–5 条，每条必须带具体数字 */
  tldr: string[];
  /** 恰好 1 条最有价值的反直觉洞察 */
  keyInsight: { headline: string; detail: string };
  /** 价格锚点矩阵 */
  marketAnchors: MarketAnchor[];
  /** 2–5 条待确认问题 */
  openQuestions: OpenQuestion[];
  /** 3–8 条数据来源（全部可追溯到入参） */
  dataSources: NarrativeDataSource[];
}

export interface NarrativeUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateValuationNarrativeInput {
  locale: AiLocale;
  /** formulas.ts 的 ValuationResult 全量（只读） */
  result: ValuationResult;
  /** intelligence.ts 的 getValuationIntelligence 结果（unknown：调用方可能是 mock） */
  intelligence: unknown;
  /** 本机已知信息：品牌/型号/年份/工时/成色/地区/卖家报价/图片数/视频数 */
  productMeta: Record<string, unknown>;
  /** 是否国产通道（决定要不要讲补贴：还必须叠加 .cn 站点判断） */
  isChineseBrand: boolean;
  timeoutMs?: number;
}

export interface GenerateValuationNarrativeOutput {
  narrative: ValuationNarrative | null;
  usage: NarrativeUsage;
  /** 原始模型输出（失败排障用，绝不含密钥；调用方不要回传给前端） */
  raw?: string;
}

// ============================================================
// 常量
// ============================================================

/** 一次典型报告 900~1600 输出 token，4096 留足阿拉伯语/俄语的膨胀余量 */
const NARRATIVE_MAX_TOKENS = 4096;

/** 默认超时：报告生成比单图分析慢，但必须有上限（失败就返回 null） */
const NARRATIVE_DEFAULT_TIMEOUT_MS = 120_000;

/** 合法轴位（顺序即输出顺序，前端渲染顺序稳定） */
const AXES: readonly MarketAnchorAxis[] = [
  "new_equivalent",
  "domestic_used",
  "export_fob",
  "target_market_retail",
  "salvage",
];

/** 合法依据枚举 */
const BASES: readonly AnchorBasis[] = ["measured", "benchmark", "derived", "not_found"];

/**
 * 数据来源白名单：key 必须能在 payload 里找到同名路径。
 * 模型写任何不在表内的 ref → 该条丢弃（反编造硬闸门）。
 */
const ALLOWED_SOURCE_REFS: readonly string[] = [
  "result.estimatedValue",
  "result.basePrice",
  "result.priceRange",
  "result.channelPrices",
  "result.factors",
  "result.confidenceScore",
  "intelligence.model",
  "intelligence.brandCategory",
  "intelligence.depreciation",
  "intelligence.regional",
  "intelligence.brandRanking",
  "intelligence.confidence",
  "visual.perImage",
  "productMeta.sellerAskingCny",
  "productMeta.foreignPriceCny",
  "productMeta.workingHours",
  "derived.salvageFloorCny",
  "policy.subsidyTalkAllowed",
];

/** 确定性兜底来源（LLM 给的来源全被白名单拒掉时用这些补足 3 条） */
type FallbackSourceRef =
  | "result.basePrice"
  | "intelligence.model"
  | "intelligence.depreciation"
  | "result.channelPrices"
  | "visual.perImage"
  | "productMeta.sellerAskingCny";

interface LocaleText {
  /** 「未找到」 */
  notFound: string;
  /** 新机对标轴位兜底说明 */
  newEquivalentNote: string;
  /** 国内二手轴位兜底说明 */
  domesticUsedNote: string;
  /** 残值底线说明 */
  salvageNote: string;
  /** 确定性来源的通用说明 */
  genericNote: string;
  /** 兜底来源名称（按 ref） */
  sourceNames: Record<FallbackSourceRef, string>;
}

/**
 * 8 语种的**兜底文案**。
 *
 * 只在两种情况下用到：模型输出缺字段、或模型写的来源不在白名单。
 * 正常路径下所有文案都由模型按目标语言撰写，本表不参与渲染。
 */
const LOCALE_TEXT: Record<AiLocale, LocaleText> = {
  zh: {
    notFound: "未找到",
    newEquivalentNote: "站内新机基准价（品类/型号查表），本机由机龄与工时折旧得出，非实测新车报价。",
    domesticUsedNote: "由折旧公式叠加品牌/年份/工时/成色/市场因子推导，非实盘成交记录。",
    salvageNote: "新机基准价 × 10% 残值底线（站内参数），是议价的理论下限。",
    genericNote: "站内自有数据，仅统计口径，不含外部报价。",
    sourceNames: {
      "result.basePrice": "站内新机基准价",
      "intelligence.model": "国内新机成交行情",
      "intelligence.depreciation": "品类折旧曲线",
      "result.channelPrices": "渠道成交价矩阵",
      "visual.perImage": "AI 视觉成色评估",
      "productMeta.sellerAskingCny": "卖家报价",
    },
  },
  en: {
    notFound: "Not found",
    newEquivalentNote:
      "Platform new-machine benchmark for this category/model; the subject is depreciated from it by age and working hours — not a recorded new-machine quote.",
    domesticUsedNote:
      "Derived from the depreciation formula with brand, age, hours, condition and market factors — not a recorded transaction.",
    salvageNote:
      "New-machine benchmark x 10% residual floor (platform parameter) — the theoretical lower bound in a negotiation.",
    genericNote: "Platform-owned data, statistical basis only, no external quotes.",
    sourceNames: {
      "result.basePrice": "Platform new-machine benchmark",
      "intelligence.model": "Domestic new-machine transaction data",
      "intelligence.depreciation": "Category depreciation curve",
      "result.channelPrices": "Channel price matrix",
      "visual.perImage": "AI visual condition assessment",
      "productMeta.sellerAskingCny": "Seller asking price",
    },
  },
  ru: {
    notFound: "Не найдено",
    newEquivalentNote:
      "Базовая цена новой машины по каталогу платформы для этой категории/модели; стоимость объекта получена из неё с учётом возраста и моточасов — это не зафиксированная котировка новой машины.",
    domesticUsedNote:
      "Рассчитано по формуле амортизации с поправками на бренд, возраст, моточасы, состояние и рынок — это не данные реальной сделки.",
    salvageNote:
      "Базовая цена новой машины × 10% (минимальная остаточная стоимость, параметр платформы) — теоретический нижний предел при торге.",
    genericNote: "Собственные данные платформы, только статистическая база, без внешних котировок.",
    sourceNames: {
      "result.basePrice": "Базовая цена новой машины",
      "intelligence.model": "Данные сделок по новым машинам в Китае",
      "intelligence.depreciation": "Кривая амортизации категории",
      "result.channelPrices": "Матрица цен по каналам",
      "visual.perImage": "Визуальная оценка состояния ИИ",
      "productMeta.sellerAskingCny": "Цена продавца",
    },
  },
  es: {
    notFound: "No encontrado",
    newEquivalentNote:
      "Precio base de máquina nueva de la plataforma para esta categoría/modelo; el valor del equipo se deriva de él por antigüedad y horas de trabajo, no es una cotización registrada.",
    domesticUsedNote:
      "Calculado con la fórmula de depreciación (marca, antigüedad, horas, estado y mercado); no es una transacción registrada.",
    salvageNote:
      "Precio base de máquina nueva × 10% (valor residual mínimo, parámetro de la plataforma): el límite teórico de la negociación.",
    genericNote: "Datos propios de la plataforma, base estadística, sin cotizaciones externas.",
    sourceNames: {
      "result.basePrice": "Precio base de máquina nueva",
      "intelligence.model": "Datos de transacciones de máquina nueva en China",
      "intelligence.depreciation": "Curva de depreciación de la categoría",
      "result.channelPrices": "Matriz de precios por canal",
      "visual.perImage": "Evaluación visual del estado por IA",
      "productMeta.sellerAskingCny": "Precio pedido por el vendedor",
    },
  },
  pt: {
    notFound: "Não encontrado",
    newEquivalentNote:
      "Preço-base de máquina nova da plataforma para esta categoria/modelo; o valor do equipamento é derivado dele por idade e horas de trabalho, não é uma cotação registada.",
    domesticUsedNote:
      "Calculado pela fórmula de depreciação (marca, idade, horas, estado e mercado); não é uma transação registada.",
    salvageNote:
      "Preço-base de máquina nova × 10% (valor residual mínimo, parâmetro da plataforma): o limite teórico da negociação.",
    genericNote: "Dados próprios da plataforma, base estatística, sem cotações externas.",
    sourceNames: {
      "result.basePrice": "Preço-base de máquina nova",
      "intelligence.model": "Dados de transações de máquina nova na China",
      "intelligence.depreciation": "Curva de depreciação da categoria",
      "result.channelPrices": "Matriz de preços por canal",
      "visual.perImage": "Avaliação visual do estado por IA",
      "productMeta.sellerAskingCny": "Preço pedido pelo vendedor",
    },
  },
  ar: {
    notFound: "غير متوفر",
    newEquivalentNote:
      "السعر الأساسي للآلة الجديدة من قاعدة المنصة لهذه الفئة/الطراز، وقد اشتُقت قيمة الآلة منه حسب العمر وساعات التشغيل، وليس عرض سعر مُسجَّلًا لآلة جديدة.",
    domesticUsedNote:
      "محسوب بمعادلة الإهلاك مع معاملات العلامة والعمر وساعات التشغيل والحالة والسوق، وليس صفقة مُسجَّلة.",
    salvageNote:
      "السعر الأساسي للآلة الجديدة × 10% (الحد الأدنى للقيمة المتبقية، معامل المنصة) وهو الحد النظري في التفاوض.",
    genericNote: "بيانات المنصة الخاصة، أساس إحصائي فقط، دون عروض أسعار خارجية.",
    sourceNames: {
      "result.basePrice": "السعر الأساسي للآلة الجديدة",
      "intelligence.model": "بيانات صفقات الآلات الجديدة في الصين",
      "intelligence.depreciation": "منحنى إهلاك الفئة",
      "result.channelPrices": "مصفوفة أسعار القنوات",
      "visual.perImage": "التقييم البصري للحالة بالذكاء الاصطناعي",
      "productMeta.sellerAskingCny": "سعر طلب البائع",
    },
  },
  fr: {
    notFound: "Non disponible",
    newEquivalentNote:
      "Prix de référence machine neuve de la plateforme pour cette catégorie/modèle ; la valeur du bien en est dérivée par l'âge et les heures d'utilisation, ce n'est pas une cotation enregistrée.",
    domesticUsedNote:
      "Calculé par la formule de dépréciation (marque, âge, heures, état, marché) ; ce n'est pas une transaction enregistrée.",
    salvageNote:
      "Prix de référence machine neuve × 10 % (valeur résiduelle plancher, paramètre de la plateforme) : la borne théorique de la négociation.",
    genericNote: "Données propres à la plateforme, base statistique uniquement, sans cotation externe.",
    sourceNames: {
      "result.basePrice": "Prix de référence machine neuve",
      "intelligence.model": "Données de transactions machine neuve en Chine",
      "intelligence.depreciation": "Courbe de dépréciation de la catégorie",
      "result.channelPrices": "Matrice de prix par canal",
      "visual.perImage": "Évaluation visuelle de l'état par IA",
      "productMeta.sellerAskingCny": "Prix demandé par le vendeur",
    },
  },
  hi: {
    notFound: "उपलब्ध नहीं",
    newEquivalentNote:
      "इस श्रेणी/मॉडल के लिए प्लेटफ़ॉर्म का नई मशीन संदर्भ मूल्य; मशीन का मूल्य उससे आयु और कार्य-घंटों के आधार पर घटाया गया है, यह दर्ज नई-मशीन कोटेशन नहीं है।",
    domesticUsedNote:
      "मूल्यह्रास सूत्र (ब्रांड, आयु, घंटे, स्थिति और बाज़ार कारक) से निकाला गया, यह दर्ज लेन-देन नहीं है।",
    salvageNote:
      "नई मशीन संदर्भ मूल्य × 10% (न्यूनतम अवशिष्ट मूल्य, प्लेटफ़ॉर्म पैरामीटर) — मोल-भाव की सैद्धांतिक निचली सीमा।",
    genericNote: "प्लेटफ़ॉर्म का स्वयं का डेटा, केवल सांख्यिकीय आधार, कोई बाहरी कोटेशन नहीं।",
    sourceNames: {
      "result.basePrice": "नई मशीन संदर्भ मूल्य",
      "intelligence.model": "चीन में नई मशीन लेन-देन डेटा",
      "intelligence.depreciation": "श्रेणी मूल्यह्रास वक्र",
      "result.channelPrices": "चैनल मूल्य मैट्रिक्स",
      "visual.perImage": "AI दृश्य स्थिति मूल्यांकन",
      "productMeta.sellerAskingCny": "विक्रेता का माँगा मूल्य",
    },
  },
};

/** 取某语种的兜底文案（未知语种回落英文，绝不返回 undefined） */
function text(locale: AiLocale): LocaleText {
  return LOCALE_TEXT[locale] ?? LOCALE_TEXT.en;
}

// ============================================================
// prompt
// ============================================================

/**
 * 系统提示词（英文书写）。
 *
 * 为什么用英文：模型对英文元指令的遵从度更稳定，且本 prompt 需要引用大量中文域名数据
 * （品牌/品类/补贴），中英混排时英文指令更不容易被「中文本体」带跑偏。
 * 输出语言由 `withLanguage` 追加的语言指令统一约束，不在这里硬编码。
 */
export const NARRATIVE_SYSTEM_PROMPT = `You are the lead appraiser at UsedFarmMach, a cross-border marketplace for used agricultural machinery (tractors, combine harvesters, balers, forage harvesters, rice transplanters, implements).

Your job is to write the CONCLUSION LAYER of an AI valuation report. The reader already sees the number; what they cannot get from the number is judgement:
- how far this valuation can be trusted, and why;
- where this machine sits on the real market axes (domestic used, export FOB, target-market retail, a new equivalent, salvage);
- the single most non-obvious thing about this deal;
- what is missing, and how much closing that gap would sharpen the range.

STYLE
- Commit to a position. "Cannot tell" is acceptable ONLY when the payload genuinely lacks the input, and then name the missing input.
- Every bullet and sentence carries a concrete number copied from the payload (CNY amount, %, years, working hours, sample size n, image count). No number, no claim.
- No filler. Never write "this machine is in good condition with a reasonable price". Never restate the formula. Never explain what a valuation is.
- No markdown, no headings, no code fences. One JSON object only.

ANTI-FABRICATION (hard rules; a violation is worse than an empty section)
1. Numbers may only come from the input payload. Do not invent market prices, discounts, freight, tariffs, dealer margins, subsidy amounts, VAT rebates, exchange rates or competitor quotes.
2. Market anchors: when the payload cannot support a price on an axis, output "priceCny": null with "basis": "not_found", and priceText must be the plain localized phrase for "not found". A missing anchor is a professional answer; an invented one destroys the report.
3. basis semantics — use exactly one of these four English literals:
   - "measured"  = the payload holds an actual recorded price or quote for this machine (seller asking price, recorded foreign price, per-image visual score).
   - "benchmark" = a platform statistic present in the payload (new-machine base price, recorded domestic new-machine transaction P25/median/P75, category depreciation curve, regional index, brand residual ranking).
   - "derived"   = you computed it arithmetically from two or more payload numbers, and the note SHOWS the arithmetic. A derived number must never be presented as measured.
   - "not_found" = no basis in the payload.
4. Never fabricate an export FOB or overseas retail price by multiplying a domestic price by an uplift or coefficient. If the payload holds no recorded export price and no recorded foreign price, that axis is "not_found".
5. dataSources may only cite the ref tokens listed in the prompt. Never add outside sources such as "industry reports", "expert interviews", "auction records" or "overseas dealer listings".
6. Do not over-promise precision. If the sample size is small, the coefficient of variation is high or the confidence level is low, say so in plain language inside tldr or keyInsight.

POLICY SCOPE
- Chinese purchase-subsidy policy (农机购置补贴, provincial subsidy quotas, subsidy retreat) may be mentioned ONLY when payload.policy.subsidyTalkAllowed is true. Otherwise never reference Chinese subsidy programmes: an international buyer reads them as an unexplained discount, and they are irrelevant to their market.
- When payload.site is "com" the word for subsidy must not appear anywhere in your output, in any language (not in tldr, not in notes, not in data source names). Any sentence that mentions it will be deleted automatically and the report loses content.

LANGUAGE
- Write every VALUE in the required output language. Keep JSON keys, "axis" values and "basis" values exactly as the English literals specified above — downstream code matches them as exact strings.`;

/** 输出结构示例（写进 prompt，模型照抄结构最稳） */
const SCHEMA_EXAMPLE = `{
  "tldr": ["string", "string", "string"],
  "keyInsight": { "headline": "string", "detail": "string" },
  "marketAnchors": [
    {
      "axis": "new_equivalent",
      "priceText": "string",
      "priceCny": 123456,
      "basis": "benchmark",
      "note": "string"
    }
  ],
  "openQuestions": [{ "question": "string", "affects": "string", "impact": "string" }],
  "dataSources": [{ "name": "string", "ref": "result.basePrice", "note": "string" }]
}`;

/**
 * 组装 user prompt：payload + 结构约束 + 字段规则 + 语言指令。
 *
 * 导出是为了让测试能断言「语言指令确实被注入」「schema 里的英文枚举没有被翻译」。
 */
export function buildNarrativePrompt(payload: Record<string, unknown>, locale: AiLocale): string {
  const site = payload?.site === "cn" ? "cn" : "com";
  const body = [
    "== INPUT PAYLOAD (single source of truth for every number you write) ==",
    JSON.stringify(payload, null, 2),
    "",
    "== REQUIRED OUTPUT SHAPE ==",
    SCHEMA_EXAMPLE,
    "",
    "== FIELD RULES ==",
    "1. tldr — 3 to 5 bullets. Each bullet = one judgement + the number that supports it.",
    "   Length: 20-40 Chinese characters, or at most 30 words in other languages.",
    "   The first bullet must state the valuation and its range; later bullets must NOT repeat the price.",
    "2. keyInsight — exactly one object: the single most counter-intuitive, decision-changing finding in this payload",
    "   (e.g. the depreciation curve says age costs more than working hours; the brand ranks 7th of 24 on residual value;",
    "   the asking price already sits inside P25-P75 so the seller is not overreaching; only 1 photo was scored so visual confidence is thin).",
    "   headline <= 20 words, detail 2-4 sentences with numbers.",
    "3. marketAnchors — 3 to 5 objects, at most one per axis.",
    '   - "new_equivalent" and "domestic_used" are MANDATORY.',
    site === "com" ? '   - "export_fob" is MANDATORY on this site (payload.site = "com").' : '   - "export_fob" and "target_market_retail" are NOT applicable on payload.site = "cn" — do not emit them.',
    '   - "target_market_retail" only when payload.productMeta.foreignPriceCny is a number.',
    '   - "salvage" only when payload.derived.salvageFloorCny is a number.',
    "   - priceText: one short localized phrase such as a currency amount, or the localized phrase for not found. Never a sentence.",
    "   - priceCny: integer in CNY, no currency symbol, or null.",
    '   - axis: exactly one of "domestic_used" | "export_fob" | "target_market_retail" | "new_equivalent" | "salvage" (English, never localized).',
    '   - basis: exactly one of "measured" | "benchmark" | "derived" | "not_found" (English, never localized).',
    "   - note: one sentence stating the evidence, and for basis=derived the arithmetic itself.",
    "4. openQuestions — 2 to 5 objects. question: the specific missing fact, phrased so the user can answer it.",
    "   affects: the valuation factor it moves, naming the payload field (e.g. result.factors.hours).",
    "   impact: how much the range would narrow — give a percentage ONLY if derivable from payload.derived.rangeWidthPercent",
    "   or payload.intelligence.confidence; otherwise state the direction without a number.",
    "5. dataSources — 3 to 8 objects, one per distinct ref you actually used.",
    "   name: short localized label. ref: exactly one of the tokens below. note: one sentence on what this source contributed.",
    `   allowed ref tokens: ${ALLOWED_SOURCE_REFS.join(" | ")}`,
    "",
    'Return ONE JSON object and nothing else. Do not wrap it in a code fence, do not add any prose before or after it.',
  ].join("\n");

  // 语言指令永远追加在最末（离模型最近，遵从度最高），不改动上面任何一个字
  return withLanguage(body, locale);
}

// ============================================================
// payload 组装
// ============================================================

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toFinite(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** 保留 1 位小数（只在 payload 里用，供模型直接引用） */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 金额取整（payload 中所有金额都是整元，避免模型抄错小数） */
function round0(value: number): number {
  return Math.round(value);
}

/** 从 intelligence（unknown）里只挑出 numeric 可靠的部分，绝不透传未知结构 */
function readIntelligence(raw: unknown): Record<string, unknown> {
  const root = asRecord(raw) ?? {};
  const pickStat = (value: unknown): Record<string, number> | null => {
    const stat = asRecord(value);
    if (!stat) return null;
    const out: Record<string, number> = {};
    for (const key of ["n", "median", "p25", "p75", "mean", "min", "max", "netMedian"]) {
      const n = toFinite(stat[key]);
      if (n !== null) out[key] = round0(n);
    }
    return Object.keys(out).length > 0 ? out : null;
  };

  const result: Record<string, unknown> = { available: root.available === true };

  const model = pickStat(root.model);
  if (model) result.model = { level: "model", ...model };

  const brandCategory = pickStat(root.brandCat);
  if (brandCategory) result.brandCategory = { level: "brand_category", ...brandCategory };

  const depreciation = asRecord(root.depreciation);
  if (depreciation) {
    const pointsRaw = Array.isArray(depreciation.curve) ? depreciation.curve : [];
    const points = pointsRaw
      .map((point) => {
        const p = asRecord(point);
        const age = toFinite(p?.age);
        const residual = toFinite(p?.residual);
        return age !== null && residual !== null ? { age: round0(age), residual: round1(residual * 100) / 100 } : null;
      })
      .filter((p): p is { age: number; residual: number } => p !== null)
      .slice(0, 12);
    const refNewMedian = toFinite(depreciation.refNewMedian);
    result.depreciation = {
      refNewMedian: refNewMedian !== null ? round0(refNewMedian) : null,
      // residual 用小数表示（0.62 = 残值 62%），单位写进 key 名避免模型误读
      residualByAge: points,
    };
  }

  const regional = asRecord(root.regional);
  if (regional) {
    const current = asRecord(regional.current);
    const currentIndex = toFinite(regional.currentIndex);
    result.regional = {
      current: current
        ? {
            province: typeof current.province === "string" ? current.province : null,
            n: toFinite(current.n) !== null ? round0(toFinite(current.n) as number) : null,
            median: toFinite(current.median) !== null ? round0(toFinite(current.median) as number) : null,
            index: toFinite(current.index),
          }
        : null,
      currentIndex,
    };
  }

  const brandRanking = asRecord(root.brandRanking);
  if (brandRanking) {
    const topRaw = Array.isArray(brandRanking.top) ? brandRanking.top : [];
    const top = topRaw
      .map((item) => {
        const entry = asRecord(item);
        if (!entry) return null;
        const brand = typeof entry.brand === "string" ? entry.brand : "";
        const netMedian = toFinite(entry.netMedian);
        const n = toFinite(entry.n);
        if (!brand || netMedian === null) return null;
        return { brand, netMedian: round0(netMedian), n: n !== null ? round0(n) : null };
      })
      .filter((item): item is { brand: string; netMedian: number; n: number | null } => item !== null)
      .slice(0, 3);
    result.brandRanking = {
      currentRank: toFinite(brandRanking.currentRank),
      total: toFinite(brandRanking.total),
      top,
    };
  }

  const confidence = asRecord(root.confidence);
  if (confidence) {
    result.confidence = {
      n: toFinite(confidence.n),
      cv: toFinite(confidence.cv),
      level: typeof confidence.level === "string" ? confidence.level : null,
    };
  }

  return result;
}

/**
 * 把「服务端已有的一切」压成一份紧凑 payload。
 *
 * 关键约定：payload 的**键路径就是 dataSources.ref 的取值**（如 `result.basePrice`、
 * `intelligence.model`），模型能直接从 payload 里找到自己引用的来源，幻觉来源无处藏身。
 */
function buildNarrativePayload(input: GenerateValuationNarrativeInput): Record<string, unknown> {
  const { result, productMeta } = input;
  const meta = asRecord(productMeta) ?? {};
  const cn = isCnSite();

  const estimated = toFinite(result?.estimatedValue) ?? 0;
  const basePrice = toFinite(result?.basePrice) ?? 0;
  const rangeLow = toFinite(result?.priceRange?.low) ?? estimated;
  const rangeHigh = toFinite(result?.priceRange?.high) ?? estimated;

  const year = toFinite(meta.year);
  const currentYear = new Date().getFullYear();
  const ageYears = year !== null && year > 1900 ? Math.max(0, currentYear - Math.round(year)) : null;

  const asking = toFinite(meta.sellerAskingCny) ?? toFinite(result?.sellerPrice);
  const sellerGapPercent =
    asking !== null && asking > 0 && estimated > 0 ? round1(((estimated - asking) / asking) * 100) : null;
  const rangeWidthPercent = estimated > 0 ? round1(((rangeHigh - rangeLow) / estimated) * 100) : null;
  const salvageFloorCny = basePrice > 0 ? round0(basePrice * MIN_RESIDUAL_RATIO) : null;

  const visualScore = toFinite(result?.visualConditionScore ?? meta.visualConditionScore);
  const perImageCount = Array.isArray(meta.perImage) ? (meta.perImage as unknown[]).length : 0;

  return {
    site: cn ? "cn" : "com",
    result: {
      estimatedValue: round0(estimated),
      basePrice: round0(basePrice),
      priceRange: { low: round0(rangeLow), mid: round0(estimated), high: round0(rangeHigh) },
      channelPrices: asRecord(result?.channelPrices) ?? null,
      factors: {
        brand: toFinite(result?.brandFactor),
        year: toFinite(result?.yearFactor),
        hours: toFinite(result?.hoursFactor),
        condition: toFinite(result?.conditionFactor),
        market: toFinite(result?.marketFactor),
        spec: toFinite(result?.specFactor),
        video: toFinite(result?.videoFactor),
        engineBrand: toFinite(result?.engineBrandFactor),
        tradeChannel: toFinite(result?.tradeChannelFactor),
        depreciationFactor: toFinite(result?.depreciationFactor),
      },
      confidenceScore: toFinite(result?.confidenceScore),
      depreciationPercent: toFinite(result?.depreciationPercent),
      usedV4Condition: result?.usedV4Condition === true,
    },
    // 视觉逐图明细：只在真的分析过才有内容，模型不许凭空写出第 4 张图
    visual: {
      perImage: Array.isArray(meta.perImage) ? (meta.perImage as unknown[]).slice(0, 3) : [],
      imageCount: perImageCount,
      visualConditionScore: visualScore,
      visualConditionAnalysis: typeof meta.visualConditionAnalysis === "string" ? meta.visualConditionAnalysis : null,
      videoCount: toFinite(meta.videoCount) ?? 0,
    },
    intelligence: readIntelligence(input.intelligence),
    productMeta: {
      brand: typeof meta.brand === "string" ? meta.brand : "",
      modelName: typeof meta.modelName === "string" ? meta.modelName : "",
      category: typeof meta.category === "string" ? meta.category : "",
      year: year !== null ? Math.round(year) : null,
      workingHours: toFinite(meta.workingHours),
      condition: typeof meta.condition === "string" ? meta.condition : null,
      region: typeof meta.region === "string" ? meta.region : null,
      engineBrand: typeof meta.engineBrand === "string" ? meta.engineBrand : null,
      enginePowerHp: toFinite(meta.enginePower),
      driveSystem: typeof meta.driveSystem === "string" ? meta.driveSystem : null,
      sellerAskingCny: asking !== null ? round0(asking) : null,
      foreignPriceCny: toFinite(meta.foreignPriceCny),
    },
    derived: {
      ageYears,
      salvageFloorCny,
      rangeWidthPercent,
      sellerGapPercent,
    },
    policy: {
      // 补贴话题只在「.cn 站 + 国产品牌」时开放：.com 国际买家读不懂也与我们无关
      subsidyTalkAllowed: cn && input.isChineseBrand === true,
      isChineseBrand: input.isChineseBrand === true,
    },
  };
}

// ============================================================
// `.com` 补贴话题硬过滤（prompt 约束之外的确定性兜底）
// ============================================================

/**
 * 补贴相关词根（小写匹配；中文不受 toLowerCase 影响）。
 *
 * 为什么要写成词根而不是整词：8 语种里 subsidy 有 subsidy / subsidies / subsidised /
 * subsidized / субсидия / субсидии / subvención / subvenciones / subsídio / subvention /
 * الدعم / सब्सिडी 等大量变形，逐个列举必然漏。
 */
const SUBSIDY_KEYWORDS: readonly string[] = [
  "补贴",
  "国补",
  "subsid",
  "subvenci",
  "subsídi",
  "subvention",
  "субсид",
  "دعم",
  "सब्सिडी",
  "सब्सिड",
];

/** 句子切分（中英俄阿印地标点都覆盖；印地语用 danda `।`） */
const SENTENCE_RE = /[^。．.!?！？\n।]+[。．.!?！？\n।]?/g;

/** 删除命中的句子；返回删完后的文本（可能是空串） */
function stripSubsidySentences(value: string): string {
  if (!value) return "";
  const lower = value.toLowerCase();
  // 快路径：不含任何补贴词根 → 原样返回，避免无谓的切分与拼接
  if (!SUBSIDY_KEYWORDS.some((keyword) => lower.includes(keyword))) return value;
  const sentences = value.match(SENTENCE_RE) ?? [value];
  return sentences
    .filter((sentence) => {
      const s = sentence.toLowerCase();
      return !SUBSIDY_KEYWORDS.some((keyword) => s.includes(keyword));
    })
    .join("")
    .trim();
}

/**
 * 国际站（`.com`）出口过滤：**一个补贴字样都不许留**。
 *
 * 老板口径：国际买家看到「农机购置补贴」只会当成看不懂的折扣，且会误读成「国内=中国」。
 * prompt 里已经写了「只有 subsidyTalkAllowed 才能提补贴」，但 LLM 不保证听话，
 * 所以在**出口**再做一道确定性过滤 —— 文本层保证，而不是靠概率。
 *
 * 过滤后如果 tldr / headline 空了，说明整份报告基本只剩补贴内容 ⇒ 判定失败返回 null
 * （宁可不给结论，也不给一份被抽空的残句）。
 */
function sanitizeSubsidyMentions(narrative: ValuationNarrative, fallbackText: LocaleText): ValuationNarrative | null {
  const tldr = narrative.tldr
    .map((item) => stripSubsidySentences(item))
    .filter((item) => item.length > 0);

  const headline = stripSubsidySentences(narrative.keyInsight.headline);
  const detail = stripSubsidySentences(narrative.keyInsight.detail);
  if (tldr.length === 0 || !headline) return null;

  const marketAnchors = narrative.marketAnchors.map((anchor) => {
    const priceText = stripSubsidySentences(anchor.priceText);
    return {
      ...anchor,
      priceText:
        priceText ||
        (anchor.priceCny !== null ? formatCny(anchor.priceCny) : fallbackText.notFound),
      note: stripSubsidySentences(anchor.note),
    };
  });

  const openQuestions = narrative.openQuestions
    .map((item) => ({
      question: stripSubsidySentences(item.question),
      affects: stripSubsidySentences(item.affects),
      impact: stripSubsidySentences(item.impact),
    }))
    .filter((item) => item.question.length > 0);

  const dataSources = narrative.dataSources.map((item) => ({
    name: stripSubsidySentences(item.name) || item.ref,
    ref: item.ref,
    note: stripSubsidySentences(item.note),
  }));

  return { tldr, keyInsight: { headline, detail }, marketAnchors, openQuestions, dataSources };
}

// ============================================================
// 解析与归一化（全部防御式，绝不抛异常）
// ============================================================

/** 剥掉 ```json 围栏（模型偶尔不听话） */
function stripCodeFence(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

/**
 * 宽松解析：先按原样，再截取首个 `{` 到末个 `}`。
 * 两轮都失败返回 null —— 调用方据此返回 `narrative: null`，不抛异常。
 */
export function parseNarrativeJson(raw: string): Record<string, unknown> | null {
  const base = stripCodeFence(typeof raw === "string" ? raw : "");
  if (!base) return null;

  const candidates: string[] = [base];
  const first = base.indexOf("{");
  const last = base.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(base.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      const record = asRecord(parsed);
      if (record) return record;
    } catch {
      // 继续尝试下一个候选
    }
  }
  return null;
}

/** 清洗字符串：去空白、折叠换行、截断超长 */
function cleanText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen - 1)}…` : normalized;
}

/** 金额展示：「¥185,000」（统一 en-US 分组，避免阿拉伯语数字形体打乱前端解析） */
function formatCny(value: number): string {
  return `¥${Math.round(value).toLocaleString("en-US")}`;
}

function normalizeAnchor(raw: unknown, fallbackText: LocaleText): MarketAnchor | null {
  const record = asRecord(raw);
  if (!record) return null;

  const axisRaw = typeof record.axis === "string" ? record.axis.trim().toLowerCase() : "";
  const axis = AXES.find((item) => item === axisRaw);
  if (!axis) return null; // 非法轴位直接丢弃，不允许出现未知 axis

  const basisRaw = typeof record.basis === "string" ? record.basis.trim().toLowerCase() : "";
  const basisGiven = BASES.find((item) => item === basisRaw) ?? null;

  const priceCny = toFinite(record.priceCny);
  const hasPositivePrice = priceCny !== null && priceCny > 0;
  // 兜底口径：只要 basis 缺失/非法/为 not_found，或价格不是正数 ⇒ 一律落回 not_found + null
  // （宁可少一个锚点，也不允许出现「没有依据却带价格」的条目）
  const basis: AnchorBasis = basisGiven && basisGiven !== "not_found" && hasPositivePrice ? basisGiven : "not_found";

  const rawText = cleanText(record.priceText, 200);
  const note = cleanText(record.note, 400) ?? "";

  if (basis === "not_found") {
    return {
      axis,
      priceText: rawText ?? fallbackText.notFound,
      priceCny: null,
      basis,
      note,
    };
  }

  const settled = round0(priceCny as number);
  return {
    axis,
    priceText: rawText ?? formatCny(settled),
    priceCny: settled,
    basis,
    note,
  };
}

/** 用确定性数据补齐必填锚点（新机对标 / 国内二手 / 残值底线） */
function buildFallbackAnchor(
  axis: MarketAnchorAxis,
  payload: Record<string, unknown>,
  fallbackText: LocaleText
): MarketAnchor | null {
  const result = asRecord(payload.result) ?? {};
  const derived = asRecord(payload.derived) ?? {};

  if (axis === "new_equivalent") {
    const basePrice = toFinite(result.basePrice);
    if (basePrice !== null && basePrice > 0) {
      return {
        axis,
        priceText: formatCny(basePrice),
        priceCny: round0(basePrice),
        basis: "benchmark",
        note: fallbackText.newEquivalentNote,
      };
    }
    return { axis, priceText: fallbackText.notFound, priceCny: null, basis: "not_found", note: "" };
  }

  if (axis === "domestic_used") {
    const estimated = toFinite(result.estimatedValue);
    if (estimated !== null && estimated > 0) {
      return {
        axis,
        priceText: formatCny(estimated),
        priceCny: round0(estimated),
        basis: "derived",
        note: fallbackText.domesticUsedNote,
      };
    }
    return { axis, priceText: fallbackText.notFound, priceCny: null, basis: "not_found", note: "" };
  }

  if (axis === "salvage") {
    const salvage = toFinite(derived.salvageFloorCny);
    if (salvage !== null && salvage > 0) {
      return {
        axis,
        priceText: formatCny(salvage),
        priceCny: round0(salvage),
        basis: "derived",
        note: fallbackText.salvageNote,
      };
    }
  }

  return null;
}

/** 确定性来源（模型来源被白名单全部拒掉时补足，保证「来源如实」而不是「来源为空」） */
function buildFallbackSources(
  payload: Record<string, unknown>,
  fallbackText: LocaleText
): NarrativeDataSource[] {
  const result = asRecord(payload.result) ?? {};
  const derived = asRecord(payload.derived) ?? {};
  const productMeta = asRecord(payload.productMeta) ?? {};
  const intelligence = asRecord(payload.intelligence) ?? {};
  const visual = asRecord(payload.visual) ?? {};

  const add = (
    ref: FallbackSourceRef,
    present: boolean,
    out: NarrativeDataSource[]
  ): void => {
    if (!present) return;
    out.push({ name: fallbackText.sourceNames[ref], ref, note: fallbackText.genericNote });
  };

  const out: NarrativeDataSource[] = [];
  add("result.basePrice", toFinite(result.basePrice) !== null && (toFinite(result.basePrice) as number) > 0, out);
  add("intelligence.model", asRecord(intelligence.model) !== null, out);
  add("intelligence.depreciation", asRecord(intelligence.depreciation) !== null, out);
  add("result.channelPrices", asRecord(result.channelPrices) !== null, out);
  add(
    "visual.perImage",
    Array.isArray(visual.perImage) && (visual.perImage as unknown[]).length > 0,
    out
  );
  add("productMeta.sellerAskingCny", toFinite(productMeta.sellerAskingCny) !== null, out);
  // 残值底线是按站内参数算出来的，属于「有依据」但不单独成源，故不列为 source
  void derived;

  return out;
}

/** 归一化整份叙述；结构性缺失（无 tldr / 无 keyInsight）判定为失败返回 null */
function normalizeNarrative(
  raw: Record<string, unknown>,
  input: GenerateValuationNarrativeInput,
  payload: Record<string, unknown>
): ValuationNarrative | null {
  const fallbackText = text(input.locale);
  const cn = isCnSite();

  // ── tldr ──
  const tldrRaw = Array.isArray(raw.tldr) ? raw.tldr : [];
  const tldr = tldrRaw
    .map((item) => cleanText(item, 200))
    .filter((item): item is string => item !== null)
    .slice(0, 5);

  // ── keyInsight ──
  const insightRaw = asRecord(raw.keyInsight);
  const headline = cleanText(insightRaw?.headline, 200);
  const detail = cleanText(insightRaw?.detail, 1200) ?? "";

  // tldr 与 keyInsight 是报告的骨架：缺任何一个都视为「模型没写报告」，返回 null
  if (tldr.length === 0 || !headline) return null;

  // ── marketAnchors ──
  const anchorsRaw = Array.isArray(raw.marketAnchors) ? raw.marketAnchors : [];
  const byAxis = new Map<MarketAnchorAxis, MarketAnchor>();
  for (const item of anchorsRaw) {
    const anchor = normalizeAnchor(item, fallbackText);
    if (!anchor) continue;
    // .cn 站点不出出口/目标市场轴位：国内用户用不上，且容易被误读成"官方海外报价"
    if (cn && (anchor.axis === "export_fob" || anchor.axis === "target_market_retail")) continue;
    if (!byAxis.has(anchor.axis)) byAxis.set(anchor.axis, anchor);
  }

  const mandatory: MarketAnchorAxis[] = ["new_equivalent", "domestic_used"];
  if (!cn) mandatory.push("export_fob");
  for (const axis of mandatory) {
    if (byAxis.has(axis)) continue;
    const fallbackAnchor = buildFallbackAnchor(axis, payload, fallbackText);
    if (fallbackAnchor) byAxis.set(axis, fallbackAnchor);
    else byAxis.set(axis, { axis, priceText: fallbackText.notFound, priceCny: null, basis: "not_found", note: "" });
  }

  // salvage 拿得到就补（站内残值底线是硬参数，属于可算轴位）
  if (!byAxis.has("salvage")) {
    const salvageAnchor = buildFallbackAnchor("salvage", payload, fallbackText);
    if (salvageAnchor) byAxis.set("salvage", salvageAnchor);
  }

  // 固定输出顺序，前端渲染稳定
  const marketAnchors = AXES.filter((axis) => byAxis.has(axis)).map((axis) => byAxis.get(axis) as MarketAnchor);
  if (marketAnchors.length === 0) return null;

  // ── openQuestions ──
  const questionsRaw = Array.isArray(raw.openQuestions) ? raw.openQuestions : [];
  const openQuestions: OpenQuestion[] = questionsRaw
    .map((item) => {
      const record = asRecord(item);
      const question = cleanText(record?.question, 300);
      if (!question) return null;
      return {
        question,
        affects: cleanText(record?.affects, 200) ?? "",
        impact: cleanText(record?.impact, 200) ?? "",
      };
    })
    .filter((item): item is OpenQuestion => item !== null)
    .slice(0, 5);

  // ── dataSources（白名单硬闸门 + 确定性兜底）──
  const sourcesRaw = Array.isArray(raw.dataSources) ? raw.dataSources : [];
  const allowed = new Set<string>(ALLOWED_SOURCE_REFS);
  const seen = new Set<string>();
  const dataSources: NarrativeDataSource[] = [];
  for (const item of sourcesRaw) {
    const record = asRecord(item);
    const ref = typeof record?.ref === "string" ? record.ref.trim() : "";
    if (!ref || !allowed.has(ref) || seen.has(ref)) continue;
    const name = cleanText(record?.name, 120) ?? ref;
    dataSources.push({ name, ref, note: cleanText(record?.note, 300) ?? "" });
    seen.add(ref);
    if (dataSources.length >= 8) break;
  }
  if (dataSources.length < 3) {
    for (const fallbackSource of buildFallbackSources(payload, fallbackText)) {
      if (dataSources.length >= 3) break;
      if (seen.has(fallbackSource.ref)) continue;
      dataSources.push(fallbackSource);
      seen.add(fallbackSource.ref);
    }
  }

  const narrative: ValuationNarrative = {
    tldr,
    keyInsight: { headline, detail },
    marketAnchors,
    openQuestions,
    dataSources,
  };

  // 国际站：补贴话题零容忍 —— 文本层确定性过滤（不依赖模型是否听话）
  if (!cn) return sanitizeSubsidyMentions(narrative, fallbackText);

  return narrative;
}

// ============================================================
// 主入口
// ============================================================

/**
 * 生成估值结论叙述。
 *
 * 契约：
 *   - 成功：`{ narrative, usage, raw }`
 *   - 任何失败（网络错、JSON 截断、结构不合格、模型不听话）：`{ narrative: null, usage }` —— **绝不抛异常**。
 *   - `finishReason === "length"`（被 max_tokens 截断）直接判失败：半截 JSON 解析出来的东西
 *     一定缺字段，宁可没有结论也不要给用户一份半截报告。
 *
 * 计费：内部 `recordUsage()` 归集 token（与 image/video-analyzer 同模式），
 * route 的 `drainUsage()` 会把视觉 token 与本层 token 合并算一次 cost。
 */
export async function generateValuationNarrative(
  input: GenerateValuationNarrativeInput
): Promise<GenerateValuationNarrativeOutput> {
  const emptyUsage: NarrativeUsage = { inputTokens: 0, outputTokens: 0 };

  try {
    const locale = input.locale;
    const payload = buildNarrativePayload(input);
    const model = getArkModelId();

    const response = await chatCompletionDoubao({
      model,
      maxTokens: NARRATIVE_MAX_TOKENS,
      timeoutMs: input.timeoutMs ?? NARRATIVE_DEFAULT_TIMEOUT_MS,
      messages: [
        { role: "system", content: withLanguage(NARRATIVE_SYSTEM_PROMPT, locale) },
        { role: "user", content: buildNarrativePrompt(payload, locale) },
      ],
    });

    const usage: NarrativeUsage = {
      inputTokens: response.usage?.prompt_tokens ?? ESTIMATED_TOKENS.input,
      outputTokens: response.usage?.completion_tokens ?? ESTIMATED_TOKENS.output,
    };

    // HTTP 一成功就记账：token 已被消耗，与后面 JSON 能不能用无关
    recordUsage(model, usage.inputTokens, usage.outputTokens, { estimated: !response.usage });

    const raw = typeof response.text === "string" ? response.text : "";

    if (response.finishReason === "length") {
      console.warn(
        `[ValuationNarrative] 输出被 max_tokens 截断（finishReason=length, maxTokens=${NARRATIVE_MAX_TOKENS}），放弃解析`
      );
      return { narrative: null, usage, raw };
    }

    const parsed = parseNarrativeJson(raw);
    if (!parsed) {
      console.warn(`[ValuationNarrative] 返回非 JSON（长度 ${raw.length}），已放弃解析`);
      return { narrative: null, usage, raw };
    }

    const narrative = normalizeNarrative(parsed, input, payload);
    if (!narrative) {
      console.warn("[ValuationNarrative] JSON 结构不合格（缺 tldr / keyInsight / 锚点），按失败处理");
      return { narrative: null, usage, raw };
    }

    return { narrative, usage, raw };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ValuationNarrative] 结论生成失败（不阻断估值）: ${message}`);
    return { narrative: null, usage: emptyUsage };
  }
}
