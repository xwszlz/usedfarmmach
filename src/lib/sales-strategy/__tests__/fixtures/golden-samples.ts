/**
 * 人工黄金样板 · 结构化基准数据（fixture）
 * ═══════════════════════════════════════════════════════════════════
 * 本文件为「人工黄金样板」的结构化基准，用于验证 AI 输出是否达到同等水准。数据来源：
 * deliverables/高端圆捆机4台-* 与 甜菜收获机2款-*（2026-10-22）。所有联系方式已脱敏为占位符。
 *
 * 用途（谁来读我）：
 *   1. `export.test.ts` / `emit.test.ts` / 新增 PDF 渲染测试：拿真实结构的 12 字段跑 buildPdf / buildExcel，
 *      断言"AI 输出达标后长这样"（PRD §7 A1–A5 / B1–B5 / C1–C3' / D1–D3 的对照样本）。
 *   2. QA 的黄金对照：`tldr.length === equipmentProfiles.length`、`axis ⊆ MARKET_AXIS`、
 *      `rejected.level >= TRIGGER_MIN_LEVEL[trigger]` 等结构断言可以直接对这两个常量跑。
 *
 * 三条硬纪律（改动前必读）：
 *   ① **只许填样板里有的值**。样板写「—」/未给的，这里就是 `null` 或字符串 `"未找到"` / `"—"`；
 *      宁可留空也不许用"合理估计"补齐 —— fixture 一旦注水，验收基准就废了。
 *   ② **零真实 PII**。样板中的电话/邮箱/人名/微信一律未落库，`candidateIds` 用虚构但格式合法的
 *      `dealer_golden_*` / `lead_golden_*`（PRD §2 ⑨：LLM 只拿 candidateId，不拿联系方式）。
 *   ③ **`equipment` 逐字一致**：同一台机器在 tldr / equipmentProfiles.name / marketAnchors /
 *      bestDestinations / marketRanking / todayCalls 里必须是同一个字符串，否则 Sheet2 的
 *      `机型` 列与 PDF 章节名会对不上（PRD §2 ① + §7 C3'）。
 *
 * 已记录的「样板与 PRD 硬规则张力」（故意保留样板口径，勿"修"成 PRD 形态，详见文件末尾 §注）：
 *   - `tldr[].bestChannel` 有三行是"国内优先 + 中亚走量"式双去向（PRD §2 ① 要求单一去向）；
 *   - `bestChannel` / `expectedPriceCny` / `why` 少数项超出 ≤20 / ≤24 / ≤60 字的版面软上限；
 *   - `rejected` 的 `trigger` 在缺具名依据时**故意留空**（PRD §3.4 规矩1：L3 必须附具名依据）。
 */

import type {
  ComplianceOwner,
  DataSourceName,
  DealerRole,
  MarketAxis,
  PriceBasisType,
  StrategyDecisionFields,
  Urgency,
} from "@/lib/sales-strategy/strategy-schema";

// ═══════════════════════════════════════════════════════════════════
// 一、机型名常量（唯一真相：所有 equipment 字段都引用这里，防拼错）
// ═══════════════════════════════════════════════════════════════════

/** 圆捆机 4 台 —— 名称与样板 TL;DR 表逐字一致（含年份括注） */
export const ROUND_BALER_NAMES = {
  anderson: "Anderson WB-55（2021）",
  kuhn3165: "Kuhn VBP 3165（2022 准新）",
  krone: "Krone CF 155 XC（2016）",
  kuhn2160: "Kuhn VBP 2160（2016）",
} as const;

/** 甜菜收获机 2 款 —— 名称与样板 TL;DR 表逐字一致 */
export const BEET_HARVESTER_NAMES = {
  te6: "FRANQUET TE6（6 行）",
  tbh35: "TOYONOKI TBH-35（1 垄）",
} as const;

// ═══════════════════════════════════════════════════════════════════
// 二、GOLDEN_ROUND_BALER —— 4 台高端圆捆机（样板 1:1 结构化）
// ═══════════════════════════════════════════════════════════════════

/**
 * 高端圆捆机 4 台的完整决策字段（12 字段全填，不省略）。
 *
 * 样板语境：上一单是 MASCAR CORSA 320（入门固定腔机，国内没人要、出口才值钱）；
 * 这一批是高端可变腔品牌机，**国内卖价比出口还高**，打法正好反过来。
 * Anderson WB-55 是唯一的「反逻辑」机型（只认国内），其余三台是通用高端牧草机。
 */
export const GOLDEN_ROUND_BALER = {
  // ─────────────────────────────────────────────────────────────
  // ① tldr —— 4 行 = 4 个机型（PRD §2 ①）
  // ─────────────────────────────────────────────────────────────
  tldr: [
    {
      equipment: ROUND_BALER_NAMES.anderson,
      bestChannel: "国内（唯一正解）",
      expectedPriceCny: "110–160 万（推算）",
      why: "国内柠条平茬是「三北」工程国家级刚需，新机美国卖 $125,000；欧洲/北美/亚非根本卖不上价",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn3165,
      bestChannel: "国内优先 + 中亚走量",
      expectedPriceCny: "国内 50–70 万 / 中亚 FOB ≈35–43 万",
      why: "准新、法系保值最强，欧洲二手都挂 €32.8k 净价，乌兹/哈国对 Kuhn 认知极高",
    },
    {
      equipment: ROUND_BALER_NAMES.krone,
      bestChannel: "国内 + 中亚并行",
      expectedPriceCny: "国内 30–45 万 / 中亚 FOB ≈31–37 万",
      why: "德系高端，国内新机报价 98–130 万；10 年机龄国内须折价，中亚可同步铺",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn2160,
      bestChannel: "国内为主 + 中亚兜底",
      expectedPriceCny: "国内 30–45 万 / 中亚 FOB ≈26–31 万",
      why: "上一代机型，国内 30–45 万区间有成熟买家池，中亚 FOB 仅作兜底",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ② keyInsight —— 恰好 1 个，对比结构（PRD §2 ②）
  // ─────────────────────────────────────────────────────────────
  keyInsight: {
    headline: "这批高端机别照 MASCAR 打法，国内比出口还高",
    body:
      "MASCAR CORSA 320 是入门固定腔机，国内没人要、出口中亚才值钱；" +
      "这批是高端可变腔品牌机，国内新机报价极高（Krone 98–130 万）、二手也水涨船高——" +
      "国内卖价比出口还高，且不用办出口认证、回款快。" +
      "所以打法是「国内为主，中亚/澳新/阿联酋走量兜底」，和 MASCAR 正好反过来。",
    // 有明确历史对照基线（MASCAR CORSA 320 那单），故允许填写
    contrastWithPrior: "MASCAR CORSA 320",
  },

  // ─────────────────────────────────────────────────────────────
  // ③ equipmentProfiles —— 4 条 = 4 个机型（PRD §2 ③）
  //    weightKg 仅 Anderson 有明确来源（6500 kg），其余不许估 ⇒ null
  // ─────────────────────────────────────────────────────────────
  equipmentProfiles: [
    {
      name: ROUND_BALER_NAMES.anderson,
      brandCountry: "加拿大 Anderson",
      type: "牵引式柠条/灌木专用生物质打捆机",
      spec: "草捆 1.2×1.2 m 木本生物质捆",
      power: "160–250 马力（牵引式，PTO）",
      weightKg: 6500,
      condition: "2021 / 准新（包数未找到）",
      positioning: "小众专用，竞争对手极少（买家池也极小）",
    },
    {
      name: ROUND_BALER_NAMES.kuhn3165,
      brandCountry: "法国 Kuhn",
      type: "通用牧草圆捆机（可变腔高端）",
      spec: "草捆 1.65 m 宽",
      power: "中大型拖拉机（牵引式，马力未找到）",
      weightKg: null,
      condition: "2022 / 约 3000 包（准新）",
      positioning: "法系保值最强，机龄最轻",
    },
    {
      name: ROUND_BALER_NAMES.krone,
      brandCountry: "德国 Krone",
      type: "通用牧草圆捆机（可变腔）",
      // 样板草捆尺寸格为「—」
      spec: "—",
      power: "中大型拖拉机（牵引式，马力未找到）",
      weightKg: null,
      condition: "2016 / 约 5000 包",
      positioning: "德系高端，机龄 10 年须折价",
    },
    {
      name: ROUND_BALER_NAMES.kuhn2160,
      brandCountry: "法国 Kuhn",
      type: "通用牧草圆捆机（可变腔上代）",
      spec: "草捆 1.6 m 宽",
      power: "中大型拖拉机（牵引式，马力未找到）",
      weightKg: null,
      condition: "2016 / 包数未找到",
      positioning: "上一代机型，国内买家池成熟",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ④ marketAnchors —— 4 机型 × 5 轴（样板 §2 那张表逐格拆分）
  //    axis ⊆ MARKET_AXIS；basisType ⊆ PRICE_BASIS_TYPES
  //    priceCny 取区间中位（汇率：EUR 7.8 / USD 7.15）
  // ─────────────────────────────────────────────────────────────
  marketAnchors: [
    // ── Anderson WB-55：国内 >> 一切 ──
    {
      equipment: ROUND_BALER_NAMES.anderson,
      axis: "国内" satisfies MarketAxis,
      market: "中国国内（内蒙古柠条平茬带）",
      priceText: "110–160 万（推算）",
      priceCny: 1_350_000,
      basisType: "推算" satisfies PriceBasisType,
      note: "国产同类自走机 × 进口品牌溢价 1.3–1.8 × 准新 0.8–0.9 折，须向绿友机械询价确认",
    },
    {
      equipment: ROUND_BALER_NAMES.anderson,
      axis: "欧洲" satisfies MarketAxis,
      market: "欧洲",
      priceText: "€10k ≈ 7.8 万（2011–12 老机）",
      priceCny: 78_000,
      basisType: "欧洲二手净价" satisfies PriceBasisType,
      note: "仅 2011–12 老机挂牌，非同代可比，价差把锚点砸死",
    },
    {
      equipment: ROUND_BALER_NAMES.anderson,
      axis: "中亚" satisfies MarketAxis,
      market: "中亚（乌兹别克/哈萨克）",
      priceText: "不建议",
      priceCny: null,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "牵引式须配 160–250 马力拖拉机，当地买家普遍不具备",
    },
    {
      equipment: ROUND_BALER_NAMES.anderson,
      axis: "非洲中东澳新" satisfies MarketAxis,
      market: "非洲/中东/澳新",
      priceText: "不建议（小众）",
      priceCny: null,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "木本生物质专用机，当地无柠条作物，买家池近零",
    },
    {
      equipment: ROUND_BALER_NAMES.anderson,
      axis: "新机对标" satisfies MarketAxis,
      market: "美国新机（Anderson 原厂报价）",
      priceText: "美国新机 $125,000 ≈ 89 万",
      priceCny: 893_750,
      basisType: "新机对标" satisfies PriceBasisType,
      note: "原厂新机价，构成国内二手价的估值上限",
    },

    // ── Kuhn VBP 3165：国内优先 + 中亚走量 ──
    {
      equipment: ROUND_BALER_NAMES.kuhn3165,
      axis: "国内" satisfies MarketAxis,
      market: "中国国内",
      priceText: "50–70 万（估）",
      priceCny: 600_000,
      basisType: "国内二手估" satisfies PriceBasisType,
      note: "准新机，国内认知度高，按 50–70 万级谈",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn3165,
      axis: "欧洲" satisfies MarketAxis,
      market: "欧洲",
      priceText: "€32.8k ≈ 25.6 万（含税 €39k）",
      priceCny: 255_840,
      basisType: "欧洲二手净价" satisfies PriceBasisType,
      note: "净价不含 VAT；2018 老机欧洲挂 €39.5k，保值最强",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn3165,
      axis: "中亚" satisfies MarketAxis,
      market: "中亚（乌兹别克/哈萨克）",
      priceText: "€45–55k ≈ 35–43 万",
      priceCny: 390_000,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "走量兜底价，乌兹/哈国对 Kuhn 认知极高",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn3165,
      axis: "非洲中东澳新" satisfies MarketAxis,
      market: "阿联酋/澳新",
      priceText: "≈ $45k ≈ 32 万",
      priceCny: 321_750,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "阿联酋高端品牌溢价明显；澳新须预留 BMSB 熏蒸",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn3165,
      axis: "新机对标" satisfies MarketAxis,
      market: "中国国内新机（经销商报价）",
      priceText: "国内新机 40 万+；VBP2265 二手出厂价 72 万",
      priceCny: 400_000,
      basisType: "新机对标" satisfies PriceBasisType,
      note: "同品牌上代准新机出厂价 72 万，支撑准新机溢价",
    },

    // ── Krone CF 155 XC：国内 + 中亚并行 ──
    {
      equipment: ROUND_BALER_NAMES.krone,
      axis: "国内" satisfies MarketAxis,
      market: "中国国内（内蒙古/新疆/甘肃）",
      priceText: "30–45 万",
      priceCny: 375_000,
      basisType: "国内二手估" satisfies PriceBasisType,
      note: "机龄 10 年，牧草/青贮大省有买家，须合理折价",
    },
    {
      equipment: ROUND_BALER_NAMES.krone,
      axis: "欧洲" satisfies MarketAxis,
      market: "欧洲",
      priceText: "€25–28k ≈ 19.5–21.8 万",
      priceCny: 206_500,
      basisType: "欧洲二手净价" satisfies PriceBasisType,
      note: "欧洲同档供给极大、价格内卷",
    },
    {
      equipment: ROUND_BALER_NAMES.krone,
      axis: "中亚" satisfies MarketAxis,
      market: "中亚（乌兹别克/哈萨克）",
      priceText: "€40–48k ≈ 31–37 万",
      priceCny: 340_000,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "据欧洲二手倒推，需落地验证；可与国内同步铺",
    },
    {
      equipment: ROUND_BALER_NAMES.krone,
      axis: "非洲中东澳新" satisfies MarketAxis,
      market: "南非/新西兰/阿联酋",
      priceText: "南非 $48–56k ≈ 34–40 万",
      priceCny: 370_000,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "南非 34–40 万、新西兰 15–24 万、阿联酋有溢价",
    },
    {
      equipment: ROUND_BALER_NAMES.krone,
      axis: "新机对标" satisfies MarketAxis,
      market: "中国国内新机（经销商报价）",
      priceText: "国内新机 98–130 万",
      priceCny: 1_140_000,
      basisType: "新机对标" satisfies PriceBasisType,
      note: "新机价差支撑二手 30–45 万的合理性",
    },

    // ── Kuhn VBP 2160：国内为主 + 中亚兜底 ──
    {
      equipment: ROUND_BALER_NAMES.kuhn2160,
      axis: "国内" satisfies MarketAxis,
      market: "中国国内",
      priceText: "30–45 万",
      priceCny: 375_000,
      basisType: "国内二手估" satisfies PriceBasisType,
      note: "上一代机型，国内 30–45 万区间可成交",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn2160,
      axis: "欧洲" satisfies MarketAxis,
      market: "欧洲",
      priceText: "€22–29k ≈ 17–22.6 万",
      priceCny: 198_000,
      basisType: "欧洲二手净价" satisfies PriceBasisType,
      note: "上代机型在欧洲无稀缺性，供给大",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn2160,
      axis: "中亚" satisfies MarketAxis,
      market: "中亚（乌兹别克/哈萨克）",
      priceText: "€33–40k ≈ 26–31 万",
      priceCny: 285_000,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "作兜底，不主推",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn2160,
      axis: "非洲中东澳新" satisfies MarketAxis,
      market: "非洲/中东/澳新",
      // 样板该格为「—」（该机型不适用此市场）
      priceText: "—",
      priceCny: null,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "样板未覆盖该机型此市场，未做估算",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn2160,
      axis: "新机对标" satisfies MarketAxis,
      market: "中国国内新机（已停产上代）",
      priceText: "未找到",
      priceCny: null,
      basisType: "新机对标" satisfies PriceBasisType,
      note: "上一代机型已无在售新机对标价",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑤ readout —— 1 句，含排序关系 + 点名反逻辑机型（PRD §2 ⑤）
  // ─────────────────────────────────────────────────────────────
  readout:
    "三台通用机的「国内二手价 ≧ 中亚 FOB ≧ 欧洲二手净价」。Anderson 则是「国内 >> 一切」——它是唯一的「反逻辑」机型。",

  // ─────────────────────────────────────────────────────────────
  // ⑥ bestDestinations —— 每机型恰好 1 条；market 数组序即优先级
  //    calcChain 条件必填（该条出现价格数字 ⇒ 必填，且含 × 或 ≈）
  // ═══════════════════════════════════════════════════════════════════
  bestDestinations: [
    // ── Anderson：只认国内，且必须挂 L2 级否决（千万别出口） ──
    {
      equipment: ROUND_BALER_NAMES.anderson,
      market: ["国内"],
      basis:
        "国内柠条平茬是「三北」工程国家级刚需：仅内蒙古达茂旗 2025 年平茬 3.2 万亩预算 640 万、" +
        "固阳县 320 万（政府采购网）；采购方 = 林草局招标 + 生物质/饲料公司 + 治沙承包商",
      calcChain:
        "国产同类自走机 × 进口品牌溢价 1.3–1.8 × 准新 0.8–0.9 折 ≈ 110–160 万，须向绿友机械询价确认",
      channelIds: ["dealer_golden_001", "dealer_golden_002"],
      rejected: [
        {
          market: "欧洲",
          reason:
            "千万别出口欧洲：同系列仅 2011–12 老机挂 €10k ≈ 7.8 万，仅为国内推算价的 6%，价差远超 40%",
          level: "L2",
          trigger: "R2",
        },
        {
          market: "北美（美/加）",
          reason:
            "放弃北美：原厂 Anderson 就在加拿大，原厂就在该地、根本不缺这台；美国新机 $125,000 已构成价格天花板",
          level: "L2",
          trigger: "R4",
        },
        {
          market: "中亚（乌兹别克/哈萨克）",
          reason:
            "千万别出口中亚：牵引式须配 160–250 马力拖拉机，当地买家普遍不具备，配套门槛成本吞噬毛利",
          level: "L2",
          trigger: "R5",
        },
        {
          market: "非洲中东澳新",
          reason:
            "放弃：木本生物质专用机，当地既无柠条作物也无 160–250 马力拖拉机配套，买家池近零（规格/作物不兼容）",
          level: "L2",
          trigger: "R3",
        },
      ],
    },

    // ── Kuhn VBP 3165：国内优先 + 中亚走量 ──
    {
      equipment: ROUND_BALER_NAMES.kuhn3165,
      market: ["国内", "中亚（乌兹别克/哈萨克）"],
      basis:
        "机龄最新（2022 / 约 3000 包）、法系保值最强（2018 老机欧洲挂 €39.5k），国内认知度高，准新机可谈 50–70 万级；" +
        "中亚 FOB €45–55k 走量，乌兹/哈国对 Kuhn 认知极高",
      calcChain:
        "欧洲二手净价 €32.8k × 7.8 ≈ 25.6 万 + 准新溢价（机龄 4 年、3000 包）≈ 国内 50–70 万；中亚 FOB €45–55k × 7.8 ≈ 35–43 万",
      channelIds: ["dealer_golden_010", "dealer_golden_011"],
      rejected: [
        {
          market: "巴西",
          reason:
            "禁入巴西：Gecex 512/23 决议禁止二手资本货物进口，二手农机在禁止范围内，无合规通道",
          level: "L3",
          trigger: "R1",
        },
        {
          // 样板对该国的判定是「物流结算风险」，无具名禁令 ⇒ 按 PRD §3.4 规矩1（L3 必须附具名依据）
          // 降为 L2 措辞，且不挂 trigger（缺省时渲染层按 reason 措辞反推）
          market: "伊拉克",
          reason:
            "放弃伊拉克：物流与结算风险不可控（无安全回款路径），样板判定为不推荐，且无具名禁令可支撑 L3",
          level: "L2",
        },
      ],
    },

    // ── Krone CF 155 XC：国内 + 中亚并行 ──
    {
      equipment: ROUND_BALER_NAMES.krone,
      market: ["国内", "中亚（乌兹别克/哈萨克）"],
      basis:
        "国内新机报价 98–130 万，2016 年二手在内蒙古/新疆/甘肃牧草青贮带仍有买家；" +
        "中亚 FOB €40–48k 可与国内同步铺，Krone 在中亚认知度仅次于 Kuhn",
      calcChain:
        "国内新机 98–130 万 ÷ 机龄 10 年折旧 ≈ 30–45 万；中亚 FOB €40–48k × 7.8 ≈ 31–37 万",
      channelIds: ["dealer_golden_020", "dealer_golden_021"],
      rejected: [
        {
          market: "欧洲",
          reason:
            "不建议欧洲：€25–28k ≈ 19.5–21.8 万，同档二手供给极大、价格内卷，仅 VBP 3165 的保值值得推",
          level: "L1",
        },
        {
          market: "北美（美/加）",
          reason:
            "放弃北美：北美以固定腔/大直径机型为主，Deutz 系配件网络弱，可变腔机维护成本高（腔型与主流规格不兼容）",
          level: "L2",
          trigger: "R3",
        },
      ],
    },

    // ── Kuhn VBP 2160：国内为主，中亚兜底 ──
    {
      equipment: ROUND_BALER_NAMES.kuhn2160,
      market: ["国内", "中亚（乌兹别克/哈萨克）"],
      basis:
        "上一代机型，国内 30–45 万区间有成熟买家池（Kuhn 在国内认知度高、配件好找）；" +
        "中亚 FOB €33–40k 仅作兜底，不主推",
      calcChain:
        "欧洲二手净价 €22–29k × 7.8 ≈ 17–22.6 万 + 国内买家池溢价 ≈ 30–45 万；中亚 FOB €33–40k × 7.8 ≈ 26–31 万",
      channelIds: ["dealer_golden_010"],
      rejected: [
        {
          market: "欧洲",
          reason:
            "放弃欧洲：€22–29k ≈ 17–22.6 万，仅为国内估价 37.5 万的中位 53%，价差 >40% 且上代机型在欧洲无稀缺性",
          level: "L2",
          trigger: "R2",
        },
        {
          market: "北美（美/加）",
          reason:
            "放弃北美：上代可变腔机在北美无配件优势，且被美式大圆捆机压价（腔型与主流规格不兼容）",
          level: "L2",
          trigger: "R3",
        },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑦ marketRanking —— 全局排名（equipment = null），5 条 ★5→★3
  //    样板注明：Anderson WB-55 不参与此排名（它只认国内）
  //    complianceCost 含「禁入/不兼容/放弃」⇒ stars 必 ≤1（本组无此情形）
  // ─────────────────────────────────────────────────────────────
  marketRanking: [
    {
      equipment: null,
      rank: 1,
      market: "中国国内",
      stars: 5,
      factors: {
        unitPrice: "优（二手 30–160 万覆盖全部 4 台，单价最高）",
        liquidity: "优（内蒙古/新疆/甘肃有成熟买家池 + 林草局招标）",
        paymentSpeed: "优（境内交易 30–60 天回款）",
        complianceCost: "优（无需出口认证、零关税、零植检）",
      },
      note: "四台机器（含 Anderson）的最优去向都在这里",
    },
    {
      equipment: null,
      rank: 2,
      market: "中亚（乌兹别克 ≈ 哈萨克）",
      stars: 4,
      factors: {
        unitPrice: "优（FOB €33–55k，接近国内价）",
        liquidity: "中（Kuhn/Krone 认知极高，但单笔量小）",
        paymentSpeed: "中（信用证/预付，需第三方担保）",
        complianceCost: "中（GOST-UZ/EAC 须发货前 2–3 月办妥）",
      },
      note: "认证是唯一门槛，到口岸补不了只能退运",
    },
    {
      equipment: null,
      rank: 3,
      market: "阿联酋 / 澳新",
      stars: 4,
      factors: {
        unitPrice: "优（高端品牌溢价明显）",
        liquidity: "中（阿联酋 Krone 有独家代理 Al Shirawi，渠道现成；澳新经销商分散）",
        paymentSpeed: "优（阿联酋美元结算快）",
        complianceCost: "中（澳新须 BMSB 熏蒸 + 整机清洁，洗费 $5k–15k）",
      },
      note: "渠道现成但需预留熏蒸时间",
    },
    {
      equipment: null,
      rank: 4,
      market: "欧洲",
      stars: 3,
      factors: {
        unitPrice: "差（同档二手供给极大，€10–33k 内卷）",
        liquidity: "中（买家池大但压价狠）",
        paymentSpeed: "优（欧洲付款规范）",
        complianceCost: "中（逆向运回欧洲的物流 + CE 一致性成本约占货值 20%）",
      },
      note: "仅 VBP 3165 保值值得推，其他机型欧洲供给极大",
    },
    {
      equipment: null,
      rank: 5,
      market: "埃塞俄比亚",
      stars: 3,
      factors: {
        unitPrice: "中（终端购买力有限）",
        liquidity: "差（买家池小，靠招标）",
        paymentSpeed: "差（结算渠道弱、外汇管制）",
        complianceCost: "优（农机免关税 + 免 VAT）",
      },
      note: "政策最友好，但结算弱，只能作补充",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑧ accessTrafficLight —— 三灯各 1–8 且互斥（样板「准入红绿灯」逐条拆分）
  //    注：样板把「秘鲁/哥伦比亚/乌兹别克」同时列在 🟢 与 🟡，PRD §7 A5 要求互斥，
  //    此处按"已确认可进"归 🟢，需要许可的归 🟡，一国只出现一次。
  // ─────────────────────────────────────────────────────────────
  accessTrafficLight: {
    friendly: [
      "埃塞俄比亚（农机免关税免 VAT）",
      "阿联酋（5% 关税、Krone 代理 Al Shirawi 现成）",
      "阿曼（二手农机无特别许可）",
      "智利（行距 50cm 兼容，仅需常规植检）",
      "秘鲁（可进，需西语单证）",
      "哥伦比亚（可进，需装运前检验）",
      "沙特（需 SABER 认证）",
    ],
    needPermit: [
      "南非（ITAC 全二手需 permit）",
      "肯尼亚（PVoC 装运前检验）",
      "坦桑尼亚（TBS 装运前检验）",
      "摩洛哥（需进口许可）",
      "尼日利亚（SONCAP 认证）",
      "乌兹别克（GOST-UZ/EAC 须发货前 2–3 月办妥）",
      "阿根廷（SIMI 严审）",
      "澳新（BMSB 熏蒸 + 整机清洁）",
    ],
    forbidden: [
      "巴西（Gecex 512/23 禁二手资本货物）",
      "伊拉克（物流与结算风险）",
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // ⑨ todayCalls —— 按机型分组，共 4 条（每机型 1–5、总 ≤15）
  //    candidateIds 为虚构但格式合法的 id（真实 dealer id 不入 fixture）
  // ═══════════════════════════════════════════════════════════════════
  todayCalls: [
    {
      equipment: ROUND_BALER_NAMES.anderson,
      candidateIds: ["dealer_golden_001"],
      role: "授权经销" satisfies DealerRole,
      whyToday:
        "国内总渠道（Anderson 中国代理），本周询价窗口，拿到报价才能把 110–160 万区间收敛成一行",
    },
    {
      equipment: ROUND_BALER_NAMES.anderson,
      candidateIds: ["lead_golden_004", "lead_golden_005"],
      role: "终端" satisfies DealerRole,
      whyToday:
        "柠条颗粒厂 2026 春季平茬采购预算已下拨，现在抱价才能卡进政府采购流程",
    },
    {
      equipment: ROUND_BALER_NAMES.kuhn3165,
      candidateIds: ["dealer_golden_010"],
      role: "进口商" satisfies DealerRole,
      whyToday:
        "GOST-UZ/EAC 认证须发货前 2–3 月办妥，今天不启动就赶不上本季中亚走量窗口",
    },
    {
      equipment: ROUND_BALER_NAMES.krone,
      candidateIds: ["dealer_golden_020"],
      role: "授权经销" satisfies DealerRole,
      whyToday:
        "该经销在售库存有缺口、愿吃 2016 机龄整机，报价有效期仅本周（下周新机到货会压价）",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑩ complianceTasks —— 6 条（样板 §6 表格逐行），含 1 条 owner="老板"
  // ═══════════════════════════════════════════════════════════════════
  complianceTasks: [
    {
      item: "向绿友机械确认 Anderson WB-55 国内询价（决定 110–160 万区间落点）",
      owner: "业务" satisfies ComplianceOwner,
      deadline: "本周",
    },
    {
      item: "启动乌兹别克 GOST-UZ/EAC 认证（发货前 2–3 月办妥，到口岸补不了只能退运）",
      owner: "外贸" satisfies ComplianceOwner,
      deadline: "立刻",
    },
    {
      item: "核实乌兹别克 HS 843340 关税口径（12%+12% vs 5–10%+15%，签约前书面确认）",
      owner: "清关行" satisfies ComplianceOwner,
      deadline: "签约前",
    },
    {
      item: "制定澳新 BMSB 熏蒸 + 整机清洁方案（预留洗费 $5k–15k）",
      owner: "物流" satisfies ComplianceOwner,
      deadline: "出货前",
    },
    {
      item: "确认埃塞俄比亚进口许可路径（农机免关税免 VAT）",
      owner: "外贸" satisfies ComplianceOwner,
      deadline: "出口前",
    },
    {
      item: "确认 4 台实际采购成本（决定利润与价格区间能否收敛）",
      owner: "老板" satisfies ComplianceOwner,
      deadline: "立刻",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑪ openQuestions —— 3 条（样板 §7），≥1 条 affects 含「定价」
  // ═══════════════════════════════════════════════════════════════════
  openQuestions: [
    {
      question: "这 4 台的实际到手成本是多少？有了它价格区间可直接定位到一行，利润立现",
      affects: "定价",
      urgency: "立刻" satisfies Urgency,
    },
    {
      question:
        "Anderson WB-55 的真实机况与配套拖拉机情况？牵引式需 160–250 马力拖拉机，是否带拖拉机影响报价",
      affects: "机况",
      urgency: "本周" satisfies Urgency,
    },
    {
      question: "这批货是否已买断？决定是算卖价还是算买价",
      affects: "是否买断",
      urgency: "立刻" satisfies Urgency,
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑫ dataSources —— 样板附录四路调研 + 来源声明（3–12 条）
  // ═══════════════════════════════════════════════════════════════════
  dataSources: [
    {
      name: "Web检索" satisfies DataSourceName,
      ref:
        "deliverables/高端圆捆机4台-价格与渠道排名-2026-10-22.md 附录四路调研（w1_europe / w2_cis / w3_africa_me_latam / w4_china_namerica_biomass）",
      note: "价格与电话逐条附来源，未查到的标「未找到」",
    },
    {
      name: "站内基准价" satisfies DataSourceName,
      ref: "Agriaffaires / Mascus / Agroline 镜像 / Tec24 / Technikboerse / Machinio 二手挂牌（欧洲二手净价口径，不含 VAT）",
      note: "欧洲价均为二手净价",
    },
    {
      name: "原厂官网" satisfies DataSourceName,
      ref: "Anderson / Kuhn / Krone 官网机型规格与配套动力（Anderson WB-55 需 160–250 马力）",
    },
    {
      name: "政府采购网" satisfies DataSourceName,
      ref: "中国政府采购网：内蒙古达茂旗 2025 年柠条平茬 3.2 万亩预算 640 万、固阳县 320 万",
    },
    {
      name: "海关税务" satisfies DataSourceName,
      ref: "乌兹别克 HS 843340 关税口径、蒙古中蒙 FTA FORM E 零关税、巴西 Gecex 512/23 决议公开文本",
    },
    {
      name: "站内同类在售" satisfies DataSourceName,
      ref: "deliverables/高端圆捆机4台-全球渠道联系表-2026-10-22.xlsx（91 行渠道，联系方式已脱敏）",
    },
  ],
} satisfies StrategyDecisionFields;

// ═══════════════════════════════════════════════════════════════════
// 三、GOLDEN_BEET_HARVESTER —— 2 款甜菜收获机（核心差别：分机型分开排名）
// ═══════════════════════════════════════════════════════════════════

/**
 * 甜菜收获机 2 款的完整决策字段。
 *
 * 与圆捆机那份的**结构差别**（QA 要重点断言的差异点）：
 *   - `marketRanking` 的 `equipment` **必须填**（TE6 一组 5 条 / TBH-35 一组 3 条，两组各自 rank 从 1 连续）；
 *   - 两台机器市场完全不重叠，`bestDestinations[].market` 首选一国/一区，不能合并成一套逻辑。
 *
 * 样板语境：甜菜收获机是单一作物专用机，市场小、买家专业、行距/认证卡得死，
 * 不能套用"国内 vs 出口"的简单逻辑。
 */
export const GOLDEN_BEET_HARVESTER = {
  // ─────────────────────────────────────────────────────────────
  // ① tldr —— 2 行 = 2 个机型
  // ─────────────────────────────────────────────────────────────
  tldr: [
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      bestChannel: "西欧本地（法/德/荷/丹）",
      expectedPriceCny: "西欧 23–55 万（2014 好机取高）",
      why: "45cm 行距 + CE + 法国原产，西欧最契合；智利可报 107–143 万但运费/植检侵蚀净利",
    },
    {
      equipment: BEET_HARVESTER_NAMES.tbh35,
      bestChannel: "中国国内小地块",
      expectedPriceCny: "中国 18–35 万（推算）",
      why: "国内小地块刚需 + 进口加价，国产汉森装载机要 70–78 万，转售价高于日本 14–28 万",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ② keyInsight —— 与上几批圆捆机/牧草机的根本区别
  // ─────────────────────────────────────────────────────────────
  keyInsight: {
    headline: "别套用国内 vs 出口：甜菜机得按机型分市场排",
    body:
      "上几批圆捆机/牧草机是通用机，市场重叠、全球一个价逻辑，说「国内 vs 出口」就够了；" +
      "甜菜收获机是单一作物专用机，市场小、买家专业、行距与认证卡得死——" +
      "FRANQUET TE6 是欧洲 6 行标准量级，但北美 22 英寸行距根本不兼容；" +
      "TOYONOKI TBH-35 是北海道 1 垄专用机，只有小地块/日本体系能消化。" +
      "所以两台机器得各排一套市场，不能共用一套结论。",
    contrastWithPrior: "高端圆捆机 4 台（2026-10-22）",
  },

  // ─────────────────────────────────────────────────────────────
  // ③ equipmentProfiles —— 2 条
  // ─────────────────────────────────────────────────────────────
  equipmentProfiles: [
    {
      name: BEET_HARVESTER_NAMES.te6,
      brandCountry: "法国 Franquet（Guignicourt）",
      type: "6 行牵引式甜菜收获机（拖拉机 PTO 驱动）",
      spec: "行距 45 cm（欧标）/ 大料箱（绿机身 + 黄料箱）",
      power: "中大型拖拉机（牵引式，PTO，马力未找到）",
      weightKg: null,
      condition: "年份铭牌模糊（20?4，疑 2004 或 2014）/ 工时未找到",
      positioning: "欧洲甜菜主产区的「第二台/预算机」",
    },
    {
      name: BEET_HARVESTER_NAMES.tbh35,
      brandCountry: "日本 東洋農機（北海道帯広，1909 创业）",
      type: "1 垄牵引式小型甜菜收获机（非自走）",
      spec: "行距 60–66 cm / 料箱 5.8 m³（BIG RUGGER Q-13，白料箱 + 红机架）",
      power: "约 51.5–70 PS 拖拉机（牵引式，PTO）",
      weightKg: null,
      condition: "制造番号 080013，推测 1980s–2000s 初 / 工时未找到",
      positioning: "超小众，仅北海道小地块体系能消化",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ④ marketAnchors —— TE6 6 格 + TBH-35 4 格（每机型 3–8 格）
  //    南美/北美/日本无对应轴 ⇒ 按 RESIDUAL_MARKET_AXIS 落「非洲中东澳新」并注明轴未归类
  // ═══════════════════════════════════════════════════════════════════
  marketAnchors: [
    // ── FRANQUET TE6 ──
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      axis: "欧洲" satisfies MarketAxis,
      market: "西欧本地（法/德/荷/丹）",
      priceText: "€30–70k ≈ 23–55 万",
      priceCny: 390_000,
      basisType: "欧洲二手净价" satisfies PriceBasisType,
      note: "2014 好机取高；竞品 Grimme Maxtron 620(2015–17) 实拍 €60–154k",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      axis: "非洲中东澳新" satisfies MarketAxis,
      market: "智利",
      priceText: "可报 $150k–200k ≈ 107–143 万",
      priceCny: 1_250_000,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "行距 50cm 与 45cm 接近兼容（轴未归类：南美）；从中国起运须 APHIS 蒸汽清洗",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      axis: "中亚" satisfies MarketAxis,
      market: "土耳其/哈萨克",
      priceText: "现实目标 €60–140k ≈ 47–109 万",
      priceCny: 780_000,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "同档 6 行挂牌 €160–195k ≈ 125–152 万，多为 Holmer/ROPA 竞品",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      axis: "中亚" satisfies MarketAxis,
      market: "乌克兰/哈萨克二手商",
      priceText: "目标 €60–140k ≈ 47–109 万",
      priceCny: 780_000,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "走量刚需、不溢价，靠中国采购成本 + 物流取胜",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      axis: "非洲中东澳新" satisfies MarketAxis,
      market: "北美（美/加）",
      priceText: "Amity 二手 $40k–120k ≈ 29–86 万",
      priceCny: 575_000,
      basisType: "推算" satisfies PriceBasisType,
      note: "仅作反面参考（轴未归类：北美）；22 英寸行距不兼容，放弃",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      axis: "新机对标" satisfies MarketAxis,
      market: "中国高端进口（Rexor 620 到岸）",
      priceText: "¥130–260 万（到岸）",
      priceCny: 1_950_000,
      basisType: "新机对标" satisfies PriceBasisType,
      note: "量极小，仅新疆/内蒙大农场，非 TE6 档",
    },

    // ── TOYONOKI TBH-35 ──
    {
      equipment: BEET_HARVESTER_NAMES.tbh35,
      axis: "非洲中东澳新" satisfies MarketAxis,
      market: "日本国内（北海道）",
      priceText: "¥3–6M 日元 ≈ 14–28 万（极佳态上限）",
      priceCny: 210_000,
      basisType: "推算" satisfies PriceBasisType,
      note: "价最稳但买家池小（仅十胜/网走甜菜农户）；轴未归类：日本",
    },
    {
      equipment: BEET_HARVESTER_NAMES.tbh35,
      axis: "国内" satisfies MarketAxis,
      market: "中国国内（新疆/内蒙/黑龙江小地块）",
      priceText: "¥18–35 万（推算转售价）",
      priceCny: 265_000,
      basisType: "国内二手估" satisfies PriceBasisType,
      note: "进口税 8%+9% + 小田刚需，转售价高于日本国内",
    },
    {
      equipment: BEET_HARVESTER_NAMES.tbh35,
      axis: "中亚" satisfies MarketAxis,
      market: "出口 FOB（给日方）",
      priceText: "¥2.5–4.5M 日元 ≈ 12–21 万",
      priceCny: 165_000,
      basisType: "FOB建议" satisfies PriceBasisType,
      note: "低于国内转售价 1–2 成",
    },
    {
      equipment: BEET_HARVESTER_NAMES.tbh35,
      axis: "非洲中东澳新" satisfies MarketAxis,
      market: "韩国/东南亚",
      priceText: "不建议（甜菜需求弱）",
      priceCny: null,
      basisType: "推算" satisfies PriceBasisType,
      note: "排名 ★2，仅作兜底；无甜菜糖厂配套",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑤ readout —— 1 句：两台机器方向相反
  // ─────────────────────────────────────────────────────────────
  readout:
    "TE6 的挂牌最高在智利/土耳其（107–152 万）但净利在西欧最高；TBH-35 则「中国转售价 > 日本国内价」，两台方向相反。",

  // ─────────────────────────────────────────────────────────────
  // ⑥ bestDestinations —— 每机型 1 条
  // ═══════════════════════════════════════════════════════════════════
  bestDestinations: [
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      market: ["西欧（法/德/荷/丹）", "智利", "土耳其/哈萨克"],
      basis:
        "45cm 行距、CE 认证、法国原产，与西欧承包商完全契合；经 Beverdam/MERKANTIL/Danish Agro 专业商或 Ritchie Bros 拍卖出手，" +
        "净价最高、摩擦最小；智利行距 50cm 兼容可报高价，土耳其/哈萨克走量",
      calcChain:
        "西欧挂牌 €30–70k × 7.8 ≈ 23–55 万，扣境内短途物流（货值 4–6%）≈ 净得 23–55 万；" +
        "智利 $150–200k × 7.15 ≈ 107–143 万，扣海运 + APHIS 蒸汽清洗 ≈ 净得低于西欧",
      channelIds: ["dealer_golden_101", "dealer_golden_102", "dealer_golden_104"],
      rejected: [
        {
          market: "北美（美/加）",
          reason:
            "放弃北美：22 英寸（≈56cm）行距与 TE6 的 45cm 根本不兼容，且被美式 Amity 二手 $40k–120k 压价，出手慢（硬性规格冲突）",
          level: "L2",
          trigger: "R3",
        },
        {
          // 样板原句是「对俄出口暂缓（2026 回收税暴涨吞噬利润）」：属"可暂缓"档，
          // 且回收税无具名编号（L3 需具名依据）⇒ L1 措辞，不挂 trigger
          market: "俄罗斯",
          reason:
            "俄罗斯可暂缓：2026 年回收税（утильсбор）暴涨吞噬利润，等税费口径明朗再评估；同期卢布结算路径不通",
          level: "L1",
        },
      ],
    },
    {
      equipment: BEET_HARVESTER_NAMES.tbh35,
      market: ["中国国内（新疆/内蒙/黑龙江）", "日本国内（北海道）"],
      basis:
        "中国新疆/内蒙/黑龙江小地块对「小型、灵活、便宜」的甜菜机有真实刚需，国产汉森装载机要 70–78 万，" +
        "TBH-35 进口转售 18–35 万极具性价比；机器若仍在日本，先经東洋農機原厂/芽室中古センター寄售询价",
      calcChain:
        "日本 FOB ¥2.5–4.5M 日元 ≈ 12–21 万 + 进口税（8% + 9%）+ 海运 ≈ 到岸 15–25 万 → 国内转售 18–35 万（高于日本国内 14–28 万）",
      channelIds: ["dealer_golden_110", "dealer_golden_111"],
      rejected: [
        {
          market: "韩国/东南亚",
          reason:
            "不建议优先韩国/东南亚：甜菜种植面积小、无甜菜糖厂配套，二手渠道几乎为零，物流成本占比高于毛利",
          level: "L1",
        },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑦ marketRanking —— **分机型两组**（本份与圆捆机那单的核心差别）
  //    TE6 组 5 条 rank 1–5；TBH-35 组 3 条 rank 1–3；equipment 必填
  // ═══════════════════════════════════════════════════════════════════
  marketRanking: [
    // ── FRANQUET TE6 组 ──
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      rank: 1,
      market: "西欧（法/德/荷/丹）",
      stars: 5,
      factors: {
        unitPrice: "优（€30–70k ≈ 23–55 万，本机型最高净价）",
        liquidity: "优（法/德/荷/丹承包商需求稳定，Beverdam/MERKANTIL/Danish Agro 现成）",
        paymentSpeed: "优（欧盟境内 30 天回款）",
        complianceCost: "优（CE 铭牌齐 + 45cm 行距已适配，零额外认证）",
      },
      note: "净价最高、运输最近、摩擦最小",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      rank: 2,
      market: "智利",
      stars: 4,
      factors: {
        unitPrice: "优（可报 $150–200k ≈ 107–143 万）",
        liquidity: "中（IANSA 等糖业集团刚需，但单笔量小）",
        paymentSpeed: "中（信用证结算，30% 预付款）",
        complianceCost: "中（从中国起运须 APHIS 蒸汽清洗，约占货值 5–8%）",
      },
      note: "挂牌最高但运输 + 检疫吃净利",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      rank: 3,
      market: "土耳其 / 哈萨克",
      stars: 4,
      factors: {
        unitPrice: "优（同档挂牌 €160–195k，TE6 现实目标 €60–140k）",
        liquidity: "中（糖厂/二手商走量，压价）",
        paymentSpeed: "中（预付 + 尾款，需信用证）",
        complianceCost: "中（土耳其强制植检 + 整机清洗，预留 1–2 周）",
      },
      note: "走量市场，植检是唯一前置",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      rank: 4,
      market: "乌克兰二手商",
      stars: 3,
      factors: {
        unitPrice: "中（€60–140k ≈ 47–109 万，不溢价）",
        liquidity: "中（走量刚需）",
        paymentSpeed: "差（预付比例低、结算周期长）",
        complianceCost: "中（二手农机进口许可 + 植检）",
      },
      note: "靠中国采购成本取胜，不靠溢价",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      rank: 5,
      market: "北美（美/加）",
      stars: 1,
      factors: {
        unitPrice: "差（被美式 Amity 二手 $40k–120k 压价）",
        liquidity: "差（买家不认 45cm 行距）",
        paymentSpeed: "差（出手慢）",
        complianceCost: "差（22 英寸行距不兼容，放弃）",
      },
      note: "硬性规格冲突，只作反面参考",
    },

    // ── TOYONOKI TBH-35 组 ──
    {
      equipment: BEET_HARVESTER_NAMES.tbh35,
      rank: 1,
      market: "中国国内小地块",
      stars: 5,
      factors: {
        unitPrice: "优（转售 18–35 万，高于日本 14–28 万）",
        liquidity: "优（新疆/内蒙/黑龙江小地块真刚需，众联可收机代销）",
        paymentSpeed: "优（境内现款/短账期）",
        complianceCost: "优（境内销售无需出口认证，CCIC 与进口许可由有资质进口商承担）",
      },
      note: "刚需 + 进口加价，转售价高于日本国内",
    },
    {
      equipment: BEET_HARVESTER_NAMES.tbh35,
      rank: 2,
      market: "日本北海道",
      stars: 4,
      factors: {
        unitPrice: "中（¥3–6M 日元 ≈ 14–28 万）",
        liquidity: "中（仅十胜/网走甜菜农户，买家池小）",
        paymentSpeed: "优（日本商社信用，回款稳）",
        complianceCost: "中（需经出口商拼柜，日方出口手续）",
      },
      note: "价稳但买家池小",
    },
    {
      equipment: BEET_HARVESTER_NAMES.tbh35,
      rank: 3,
      market: "韩国/东南亚",
      stars: 2,
      factors: {
        unitPrice: "差（甜菜需求弱，无甜菜糖厂配套）",
        liquidity: "差（二手渠道几乎为零）",
        paymentSpeed: "中（韩国有代理可结算）",
        complianceCost: "中（海运短、常规植检）",
      },
      note: "仅作兜底，不建议优先",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑧ accessTrafficLight —— 三灯互斥（从样板 §3/§6 的准入与前置要求反推）
  // ═══════════════════════════════════════════════════════════════════
  accessTrafficLight: {
    friendly: [
      "西欧（法/德/荷/丹：CE 铭牌齐、45cm 行距确认即可）",
      "哈萨克（二手商直接对标，走量刚需）",
      "日本（東洋農機原厂/芽室中古センター寄售通道现成）",
      "乌克兰（Zimertal 等二手商现成，压价但可成交）",
    ],
    needPermit: [
      "中国（旧机电 CCIC 装运前检验 + 进口许可证 + 彻底去土清洗）",
      "土耳其（官方植物检疫证书 + 整机清洗，2023-03 起强制，预留 1–2 周）",
      "智利（从中国起运须 APHIS 蒸汽清洗证书；从欧盟起运走 FMD-free 简易程序）",
    ],
    forbidden: [
      "俄罗斯（2026 回收税暴涨吞噬利润）",
      "北美（22 英寸行距不兼容 TE6 45cm）",
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // ⑨ todayCalls —— 4 条（TE6 3 条 + TBH-35 1 条）
  // ═══════════════════════════════════════════════════════════════════
  todayCalls: [
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      candidateIds: ["dealer_golden_101"],
      role: "二手商" satisfies DealerRole,
      whyToday:
        "该商行常年驻 Mascus 挂多台甜菜机，本周有回欧洲的拼柜窗口，晚一周运费涨一档",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      candidateIds: ["lead_golden_103"],
      role: "终端" satisfies DealerRole,
      whyToday:
        "智利糖业集团已用 ROPA 欧式机、50cm 兼容，须赶在其下一播季前完成 APHIS 蒸汽清洗预约",
    },
    {
      equipment: BEET_HARVESTER_NAMES.te6,
      candidateIds: ["dealer_golden_104"],
      role: "进口商" satisfies DealerRole,
      whyToday:
        "土耳其 2023-03 起强制官方植检 + 整机清洗，需预留 1–2 周，现在启动才赶得上糖厂招标",
    },
    {
      equipment: BEET_HARVESTER_NAMES.tbh35,
      candidateIds: ["dealer_golden_110"],
      role: "进口商" satisfies DealerRole,
      whyToday:
        "东洋中国总代理收机代销，旧机电 CCIC 装运前检验要排队，本周递交才不压港",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑩ complianceTasks —— 7 条（样板 §6 表格逐行），含老板 1 条 + 对俄暂缓 1 条
  // ═══════════════════════════════════════════════════════════════════
  complianceTasks: [
    {
      item: "核实 TE6 确切年份（2004 vs 2014）与工时——定价差近一倍",
      owner: "业务" satisfies ComplianceOwner,
      deadline: "本周",
    },
    {
      item: "西欧出货前核对 CE 铭牌齐全、行距 45cm 确认",
      owner: "业务" satisfies ComplianceOwner,
      deadline: "出货前",
    },
    {
      item: "办理土耳其出口官方植物检疫证书 + 整机清洗（2023-03 起强制，预留 1–2 周）",
      owner: "外贸" satisfies ComplianceOwner,
      deadline: "发货前",
    },
    {
      item: "智利改从欧盟起运走 FMD-free 简易程序；若从中国起运须取得 APHIS 蒸汽清洗证书",
      owner: "外贸" satisfies ComplianceOwner,
      deadline: "发货前",
    },
    {
      item: "暂缓对俄出口（2026 回收税暴涨吞噬利润），待税费口径明朗再评估",
      owner: "外贸" satisfies ComplianceOwner,
      deadline: "出口前",
    },
    {
      item: "TBH-35 进中国：旧机电 CCIC 装运前检验 + 进口许可证 + 彻底去土清洗，走有资质进口商",
      owner: "进口商" satisfies ComplianceOwner,
      deadline: "进口前",
    },
    {
      item: "确认 2 台实际采购成本 + 机器当前所在国（决定起运港与检疫路径）",
      owner: "老板" satisfies ComplianceOwner,
      deadline: "立刻",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑪ openQuestions —— 4 条，含「TE6 年份 2004 vs 2014，定价差一倍」
  // ═══════════════════════════════════════════════════════════════════
  openQuestions: [
    {
      question: "TE6 的确切年份与工时？2004 老机估 €50–80k，2014 好机估 €60–70k，定价差近一倍",
      affects: "定价",
      urgency: "立刻" satisfies Urgency,
    },
    {
      question: "这批机器现在在哪（欧盟/中国/日本）？决定起运港、检疫路径、能否走 CE 简易程序",
      affects: "起运港",
      urgency: "本周" satisfies Urgency,
    },
    {
      question: "实际到手成本是多少？有了它利润立现",
      affects: "定价",
      urgency: "立刻" satisfies Urgency,
    },
    {
      question: "TBH-35 有几台、是否已在国内？在国内直接走总代理/小地块渠道，不必走日本出口",
      affects: "渠道选择",
      urgency: "本周" satisfies Urgency,
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // ⑫ dataSources
  // ═══════════════════════════════════════════════════════════════════
  dataSources: [
    {
      name: "Web检索" satisfies DataSourceName,
      ref:
        "deliverables/甜菜收获机2款-价格与渠道排名-2026-10-22.md 附录四路调研（_tmp_beet/w1_europe / w2_cis_mena / w3_americas_china / w4_japan_korea）",
      note: "价格与电话逐条附来源，未查到标「未公开」",
    },
    {
      name: "站内基准价" satisfies DataSourceName,
      ref: "Mascus / Agriaffaires / Agroline 镜像（agronetto.com / agroline.cn / agroline-az.com）二手挂牌",
      note: "实际成交通常下浮 10–20%",
    },
    {
      name: "原厂官网" satisfies DataSourceName,
      ref: "Franquet（Guignicourt）/ 東洋農機（北海道帯広）/ Holmer / Grimme / ROPA 官网机型与行距规格",
    },
    {
      name: "海关税务" satisfies DataSourceName,
      ref: "土耳其 2023-03 强制植检与整机清洗规定、中国旧机电 CCIC 装运前检验、2026 俄联邦回收税（утильсбор）调价",
    },
    {
      name: "市场情报" satisfies DataSourceName,
      ref: "糖厂官网：Tereos / Südzucker / Konya Şeker / COSUMAR / 中粮糖业 / 冠农",
    },
    {
      name: "站内同类在售" satisfies DataSourceName,
      ref: "deliverables/甜菜收获机2款-全球渠道联系表-2026-10-22.xlsx（109 行渠道，联系方式已脱敏）",
    },
  ],
} satisfies StrategyDecisionFields;

// ═══════════════════════════════════════════════════════════════════
// 四、注：本 fixture 保留的「样板口径 vs PRD 硬规则」张力（给 QA / 渲染层看）
// ═══════════════════════════════════════════════════════════════════
//
// 1. `tldr[].bestChannel`：圆捆机后三行是"国内优先 + 中亚走量"式**双去向**，
//    PRD §2 ① 要求单一去向（禁"多渠道"）。样板原文如此，**按样板保留**——
//    回传事实真相优先于迎合版面规则；渲染层不因此报错（该字段只做展示）。
//
// 2. `rejected` 的 `trigger` 缺省：伊拉克（物流结算风险）、俄罗斯（回收税暂缓）、
//    韩国/东南亚 三处**故意不挂 trigger**。理由：PRD §3.4 规矩1「L3 必须附具名依据」，
//    这三处样板只给了风险描述或"暂缓"措辞，无具名禁令/编号 ⇒ 只能落在 L1/L2，
//    且不挂 trigger（缺省时渲染层按 `reason` 措辞反推，PRD §3.1）。
//    凡挂了 trigger 的条目，`level >= TRIGGER_MIN_LEVEL[trigger]` 全部成立（已自查）。
//
// 3. `marketAnchors` 里 `priceText: "不建议"` 的市场（Anderson 中亚/非洲中东澳新、
//    TBH-35 韩国/东南亚）**都挂了对应 `rejected`**，符合 PRD §2 ④「不建议必须挂 rejected」。
//
// 4. R2（价格倒挂）若**机械化**判定，会与人工样板冲突：三台通用机的"欧洲二手净价"
//    天然只有国内估价的 40–55%（< 60%），但样板并不因此否决欧洲（它只是采购侧锚点，
//    不是卖出市场）。故本 fixture 只在**确实否决该市场**时才挂 R2 —— QA 请断言
//    「trigger→level 一致性」，不要断言「R2 命中的每个市场都必须出现在 rejected」。
//
// 5. `equipmentProfiles[].weightKg`：全表只有 Anderson WB-55 填了 6500 kg（样板明示），
//    其余 5 台一律 `null`（PRD §2 ③ + §6.4：重量禁止估算，估错会误导运费报价）。
