/**
 * 单测：AI 销售策略 prompt 层的「输出质量」防线（T14）
 * ─────────────────────────────────────────────────────────
 * 覆盖本次修复中被"藏"在 prompt.ts 里的四件事（都是 `.com` 上策略不能用的直接成因）：
 *   ① `parseStrategyResultDetailed`：**截断的 JSON 要能补全**（旧实现直接丢成 `{}`）
 *   ② `sanitizeStrategy`：字段类型白名单（防前端 `.map()` 白屏）
 *   ③ `isStrategyEmpty`：实质空判定（路由据此在**扣费之前**返回 502）
 *   ④ `buildStrategyMessages`：图片真的进模型 + 8 语种语言指令 + 枚举不可翻译约束
 *
 * 运行：npx vitest run src/lib/sales-strategy/__tests__/prompt-quality.test.ts
 */
import { describe, it, expect } from "vitest";
import {
  buildStrategyMessages,
  isStrategyEmpty,
  parseStrategyResult,
  parseStrategyResultDetailed,
  sanitizeStrategy,
  STRATEGY_ENUM_LOCK_PROMPT,
} from "@/lib/sales-strategy/prompt";

/** 满足 `StrategyContext` 的最小上下文（本文件不验证检索内容，只验证消息组装） */
const CTX = {
  product: null,
  candidates: [
    {
      id: "lead_abc",
      type: "lead" as const,
      name: "潜在买家",
      brand: "CLAAS",
      model: "Jaguar 970",
      region: "EU",
      source: "lead_pool",
    },
  ],
  similarProducts: [],
  benchmarks: [],
  dailyReport: null,
  portSuggestion: "",
  marketIntel: [],
  realtimeExternal: false,
};

describe("① parseStrategyResultDetailed：截断 JSON 必须能补全（不再丢成 {}）", () => {
  it("完整 JSON ⇒ 原样解析，truncated=false, repaired=false", () => {
    const outcome = parseStrategyResultDetailed('{"summary":"中亚优先","readout":"一句话"}');
    expect(outcome.strategy.summary).toBe("中亚优先");
    expect(outcome.truncated).toBe(false);
    expect(outcome.repaired).toBe(false);
  });

  it("被截断在对象中间（少了闭合 }) ⇒ 补全成功，标记 truncated + repaired", () => {
    // 模拟 max_tokens 砍在 bestDestinations 中间
    const truncated = '{"summary":"中亚优先","bestDestinations":[{"equipment":"X","market":["乌兹别克"]';
    const outcome = parseStrategyResultDetailed(truncated);
    expect(outcome.truncated).toBe(true);
    expect(outcome.repaired).toBe(true);
    expect(outcome.strategy.summary).toBe("中亚优先");
    expect(Array.isArray(outcome.strategy.bestDestinations)).toBe(true);
    // 补全只补结构，不凭空造字段值
    expect(outcome.strategy.bestDestinations?.[0]?.equipment).toBe("X");
  });

  it("被截断在字符串中间 ⇒ 仍能解析出已完整的字段（不整段丢弃）", () => {
    const truncated = '{"summary":"中亚优先","readout":"国内价格见下';
    const outcome = parseStrategyResultDetailed(truncated);
    expect(outcome.strategy.summary).toBe("中亚优先");
    expect(outcome.truncated).toBe(true);
  });

  it("被截断在键名中间 ⇒ 回退到上一个完整成员，不抛错", () => {
    const truncated = '{"summary":"中亚优先","marketAnchors":[{"axis":"国内"}],"rea';
    const outcome = parseStrategyResultDetailed(truncated);
    expect(outcome.strategy.summary).toBe("中亚优先");
    expect(Array.isArray(outcome.strategy.marketAnchors)).toBe(true);
  });

  it("真失败（根本不是 JSON）⇒ 返回 {}，由路由判空兜住（补全不能掩盖真失败）", () => {
    const outcome = parseStrategyResultDetailed("抱歉，我无法完成这个请求。");
    expect(outcome.strategy).toEqual({});
    expect(isStrategyEmpty(outcome.strategy)).toBe(true);
  });

  it("兼容 ```json 围栏（截断在围栏内也能补全）", () => {
    const fenced = '```json\n{"summary":"围栏内","tldr":[{"equipment":"X"';
    const outcome = parseStrategyResultDetailed(fenced);
    expect(outcome.strategy.summary).toBe("围栏内");
    expect(outcome.truncated).toBe(true);
  });

  it("兼容前后杂文（取第一个 { 到配对的 }）", () => {
    const noisy = '好的，以下是策略：\n{"summary":"杂文版"}\n希望有帮助。';
    expect(parseStrategyResult(noisy).summary).toBe("杂文版");
  });

  it("空串 / 非字符串入参 ⇒ {}", () => {
    expect(parseStrategyResultDetailed("").strategy).toEqual({});
    expect(parseStrategyResultDetailed(undefined as unknown as string).strategy).toEqual({});
  });
});

describe("② sanitizeStrategy：字段类型白名单（防白屏）", () => {
  it("数组字段收到字符串 / 对象 ⇒ 落空数组（前端 .map 不再抛错）", () => {
    const dirty = {
      targetMarkets: "俄罗斯", // 模型偶尔返回字符串
      channels: { a: 1 }, // 或对象
      actionChecklist: null,
      tldr: 42,
      marketAnchors: "无",
    };
    const clean = sanitizeStrategy(dirty);
    expect(clean.targetMarkets).toEqual([]);
    expect(clean.channels).toEqual([]);
    expect(clean.actionChecklist).toEqual([]);
    expect(clean.tldr).toEqual([]);
    expect(clean.marketAnchors).toEqual([]);
  });

  it("数组里的非对象元素被丢弃（不允许字符串混进对象数组）", () => {
    const clean = sanitizeStrategy({ targetMarkets: [{ market: "RU" }, "垃圾", 42, null] });
    expect(clean.targetMarkets).toHaveLength(1);
    expect(clean.targetMarkets?.[0]?.market).toBe("RU");
  });

  it("字符串字段收到非字符串 ⇒ 落空串", () => {
    const clean = sanitizeStrategy({ summary: { a: 1 }, readout: ["x"] });
    expect(clean.summary).toBe("");
    expect(clean.readout).toBe("");
  });

  it("对象字段收到数组 / 字符串 ⇒ undefined（渲染层按空处理，不会把数组当对象读属性）", () => {
    const clean = sanitizeStrategy({
      priceRange: [1, 2],
      compliance: "无",
      responsibility: null,
      keyInsight: "x",
      accessTrafficLight: 1,
    });
    expect(clean.priceRange).toBeUndefined();
    expect(clean.compliance).toBeUndefined();
    expect(clean.responsibility).toBeUndefined();
    expect(clean.keyInsight).toBeUndefined();
    expect(clean.accessTrafficLight).toBeUndefined();
  });

  it("bestDestinations[].market 收到标量 ⇒ 归一为字符串数组（join 崩点）", () => {
    const clean = sanitizeStrategy({
      bestDestinations: [
        { equipment: "X", market: "乌兹别克", basis: "b", rejected: [{ market: "欧盟", reason: "r", level: "L3" }] },
      ],
    });
    expect(clean.bestDestinations?.[0]?.market).toEqual([]);
    expect(clean.bestDestinations?.[0]?.rejected?.[0]?.level).toBe("L3");
  });

  it("bestDestinations[].market 是字符串数组 ⇒ 保留；candidateIds 非数组 ⇒ 空数组", () => {
    const clean = sanitizeStrategy({
      bestDestinations: [{ equipment: "X", market: ["乌兹别克", "哈萨克"], channelIds: "lead_abc" }],
      todayCalls: [{ equipment: "X", candidateIds: "lead_abc", role: "进口商", whyToday: "w" }],
    });
    expect(clean.bestDestinations?.[0]?.market).toEqual(["乌兹别克", "哈萨克"]);
    expect(clean.bestDestinations?.[0]?.channelIds).toEqual([]);
    expect(clean.todayCalls?.[0]?.candidateIds).toEqual([]);
  });

  it("accessTrafficLight 三灯只保留字符串（数字混入会渲染成空白格）", () => {
    const clean = sanitizeStrategy({
      accessTrafficLight: { friendly: ["俄罗斯", 1, null], needPermit: "土耳其", forbidden: [] },
    });
    expect(clean.accessTrafficLight?.friendly).toEqual(["俄罗斯"]);
    expect(clean.accessTrafficLight?.needPermit).toEqual([]);
    expect(clean.accessTrafficLight?.forbidden).toEqual([]);
  });

  it("入参是 null / 数组 / 字符串 ⇒ 返回字段齐全的空策略（永不抛错）", () => {
    for (const bad of [null, undefined, [], "x", 42]) {
      const clean = sanitizeStrategy(bad);
      expect(clean.summary).toBe("");
      expect(clean.targetMarkets).toEqual([]);
      expect(clean.dataSources).toEqual([]);
    }
  });

  it("合法字段原样保留（清洗不等于清空）", () => {
    const src = {
      summary: "中亚优先",
      targetMarkets: [{ market: "乌兹别克", priority: "高", rationale: "r" }],
      marketAnchors: [{ equipment: "X", axis: "国内", market: "中国", priceText: "¥10万", basisType: "国内二手估" }],
      accessTrafficLight: { friendly: ["俄罗斯"], needPermit: [], forbidden: [] },
    };
    const clean = sanitizeStrategy(src);
    expect(clean.summary).toBe("中亚优先");
    expect(clean.targetMarkets).toHaveLength(1);
    expect(clean.marketAnchors).toHaveLength(1);
    expect(clean.marketAnchors?.[0]?.axis).toBe("国内");
    expect(clean.accessTrafficLight?.friendly).toEqual(["俄罗斯"]);
  });
});

describe("③ isStrategyEmpty：实质空判定（路由据此在扣费前返回 502）", () => {
  it("{} / null / 非对象 ⇒ 空", () => {
    expect(isStrategyEmpty({})).toBe(true);
    expect(isStrategyEmpty(null)).toBe(true);
    expect(isStrategyEmpty([])).toBe(true);
    expect(isStrategyEmpty("x")).toBe(true);
  });

  it("只有空白字符串 / 空数组 ⇒ 空（不算内容）", () => {
    expect(isStrategyEmpty({ summary: "   ", readout: "", targetMarkets: [], tldr: [] })).toBe(true);
  });

  it("字段类型非法（如 targetMarkets 是字符串）⇒ 仍判空（不能被脏类型骗成「有内容」）", () => {
    expect(isStrategyEmpty({ targetMarkets: "俄罗斯" })).toBe(true);
    expect(isStrategyEmpty({ accessTrafficLight: { friendly: [], needPermit: [], forbidden: [] } })).toBe(true);
  });

  it("任一字段有实质内容 ⇒ 非空（12 个新字段 / 9 个老字段都算）", () => {
    expect(isStrategyEmpty({ summary: "中亚优先" })).toBe(false);
    expect(isStrategyEmpty({ tldr: [{ equipment: "X" }] })).toBe(false);
    expect(isStrategyEmpty({ readout: "一句话读图" })).toBe(false);
    expect(isStrategyEmpty({ keyInsight: { headline: "h", body: "b" } })).toBe(false);
    expect(isStrategyEmpty({ accessTrafficLight: { friendly: ["俄罗斯"], needPermit: [], forbidden: [] } })).toBe(
      false
    );
    expect(isStrategyEmpty({ marketAnchors: [{ axis: "国内" }] })).toBe(false);
  });
});

describe("④ buildStrategyMessages：图片进模型 + 语种指令 + 枚举锁", () => {
  it("无媒体时 user.content 是纯字符串（保持既有形态，便于日志排障）", async () => {
    const messages = await buildStrategyMessages({ ctx: CTX as never, text: "2014 FRANQUET TE6", locale: "zh" });
    const user = messages.find((m) => m.role === "user");
    expect(typeof user?.content).toBe("string");
    expect(String(user?.content)).toContain("【卖家补充】2014 FRANQUET TE6");
  });

  it("有图片时 user.content 是**多模态数组**，且图片真的在数组里（旧实现完全忽略图片）", async () => {
    const messages = await buildStrategyMessages({
      ctx: CTX as never,
      // 只传图不传字：这正是路由守卫允许、而旧 prompt 完全没用到的输入形态
      text: undefined,
      locale: "zh",
      imageUrls: ["data:image/jpeg;base64,AAAA"],
    });
    const user = messages.find((m) => m.role === "user");
    expect(Array.isArray(user?.content)).toBe(true);
    const parts = user?.content as Array<Record<string, unknown>>;
    expect(parts[0]?.type).toBe("text");
    expect(String(parts[0]?.text)).toContain("随附媒体");
    expect(parts.some((p) => p.type === "image_url")).toBe(true);
    // 文字部分要明确告诉模型"有图可看"，否则模型不知道要去识别设备
    expect(String(parts[0]?.text)).toContain("图片 1 张");
  });

  it("8 语种：system prompt 追加对应语言指令（ru / en / ar 抽样）", async () => {
    const ru = await buildStrategyMessages({ ctx: CTX as never, text: "x", locale: "ru" });
    const ruSys = String(ru.find((m) => m.role === "system")?.content);
    expect(ruSys).toContain("Русский");

    const ar = await buildStrategyMessages({ ctx: CTX as never, text: "x", locale: "ar" });
    expect(String(ar.find((m) => m.role === "system")?.content)).toContain("العربية");

    const en = await buildStrategyMessages({ ctx: CTX as never, text: "x", locale: "en" });
    expect(String(en.find((m) => m.role === "system")?.content)).toContain("English");
  });

  it("非法 / 缺省 locale ⇒ 回落 zh（绝不把怪值拼进 prompt）", async () => {
    const messages = await buildStrategyMessages({ ctx: CTX as never, text: "x", locale: "xx-YY" });
    expect(String(messages.find((m) => m.role === "system")?.content)).toContain("简体中文");
  });

  it("system prompt 必含「枚举字段不可翻译」硬约束（PDF/Excel 按字面量精确匹配）", async () => {
    const messages = await buildStrategyMessages({ ctx: CTX as never, text: "x", locale: "ru" });
    const sys = String(messages.find((m) => m.role === "system")?.content);
    expect(sys).toContain(STRATEGY_ENUM_LOCK_PROMPT);
    expect(sys).toContain("枚举字段不可翻译");
    // 三个下游按字符串精确匹配的枚举必须在约束里点名
    expect(sys).toContain("marketAnchors[].axis");
    expect(sys).toContain("marketAnchors[].basisType");
    expect(sys).toContain("urgency");
  });
});
