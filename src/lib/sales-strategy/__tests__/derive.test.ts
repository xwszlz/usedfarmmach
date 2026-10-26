/**
 * 单元测试：降级归一化 + 方向归桶 + 优先级映射（N02）
 * ─────────────────────────────────────────────────────────
 * 覆盖：
 *   1. `gradeToPriority` 六种输入 → **永不返回 "S"**
 *   2. `normalizeAxis` 20+ 自由文本 → 结果必 ∈ MARKET_AXIS
 *   3. `splitCountryCity` 必须命中的用例 + 无法解析返回 null
 *   4. `enforceStars` 一票否决 / 越界 clamp / 非数字不抛错
 *   5. `normalizeDecisionFields(null | {})` → 字段全部落地（无 undefined）+ warnings 非空
 *   6. PRD §2 的逐条「为空时降级」专项断言
 */
import { describe, it, expect } from "vitest";
import {
  DIRECTION_ORDER,
  enforceStars,
  gradeToPriority,
  normalizeAxis,
  normalizeAxisEx,
  normalizeDecisionFields,
  resolveDirection,
  splitCountryCity,
  type DecisionEnv,
  type DirectionBucket,
  type NormalizedStrategy,
} from "@/lib/sales-strategy/derive";
import { MARKET_AXIS, PRIORITIES } from "@/lib/sales-strategy/strategy-schema";

// ═══════════════════════════════════════════════════════════
// 测试夹具
// ═══════════════════════════════════════════════════════════

/** 构造一个默认「外部检索成功」的环境 */
function env(overrides: Partial<DecisionEnv> = {}): DecisionEnv {
  return {
    productName: "Krone VBP 3165（2016）",
    brandName: "Krone",
    priceMinCny: 1_100_000,
    priceMaxCny: 1_600_000,
    webStatus: "ok",
    webNote: "",
    hasPriorStrategy: false,
    candidateCount: 12,
    evidenceUrls: ["https://example.com/krone-vbp3165"],
    ...overrides,
  };
}

/** 断言 NormalizedStrategy 的每一个顶层字段都不是 undefined */
function expectAllFieldsDefined(r: NormalizedStrategy): void {
  for (const [key, value] of Object.entries(r)) {
    expect(value, `字段 ${key} 不得为 undefined`).not.toBeUndefined();
  }
}

// ═══════════════════════════════════════════════════════════
// 1. gradeToPriority —— 永不返回 S
// ═══════════════════════════════════════════════════════════

describe("gradeToPriority — A→A / B→B / C→C，永不外推 S", () => {
  const cases: Array<[string | null | undefined, string]> = [
    ["A", "A"],
    ["B", "B"],
    ["C", "C"],
    [null, "C"],
    ["", "C"],
    // grade 语义冻结为 A/B/C；S 落在 grade 位属数据污染 ⇒ 降一档，绝不回传 S
    ["S", "A"],
  ];

  for (const [input, expected] of cases) {
    it(`gradeToPriority(${JSON.stringify(input)}) === "${expected}"`, () => {
      const p = gradeToPriority(input);
      expect(p).toBe(expected);
      expect(p).not.toBe("S");
    });
  }

  it("任何输入都绝不返回 S（穷举 + 乱码）", () => {
    const inputs: Array<string | null | undefined> = [
      "A",
      "B",
      "C",
      "S",
      "s",
      null,
      undefined,
      "",
      "  ",
      "黄金",
      "A1",
      "SS",
      "--",
    ];
    for (const input of inputs) {
      const p = gradeToPriority(input);
      expect(p).not.toBe("S");
      expect(PRIORITIES).toContain(p);
    }
  });

  it("小写输入归一化后同样命中（a → A）", () => {
    expect(gradeToPriority("a")).toBe("A");
    expect(gradeToPriority(" b ")).toBe("B");
  });
});

// ═══════════════════════════════════════════════════════════
// 2. normalizeAxis —— 任意自由文本必落 5 枚举之一
// ═══════════════════════════════════════════════════════════

describe("normalizeAxis — 服务端二次归桶，永不抛错、永不返回非枚举值", () => {
  /** 20+ 条自由文本（含乱码 / 英文 / 空串 / 非法 axis） */
  const samples: Array<{ market: string; axis: unknown }> = [
    { market: "", axis: "" },
    { market: "null", axis: 123 },
    { market: "乱码!@#$%^&*()", axis: "???" },
    { market: "国内", axis: "" },
    { market: "中国", axis: "" },
    { market: "CN", axis: "" },
    { market: "欧洲", axis: "" },
    { market: "EU", axis: "" },
    { market: "德国", axis: "" },
    { market: "Netherlands", axis: "" },
    { market: "中亚", axis: "" },
    { market: "俄罗斯", axis: "" },
    { market: "Uzbekistan", axis: "" },
    { market: "CIS", axis: "" },
    { market: "非洲中东澳新", axis: "" },
    { market: "南非", axis: "" },
    { market: "South Africa", axis: "" },
    { market: "迪拜", axis: "" },
    { market: "巴西", axis: "" },
    { market: "澳大利亚", axis: "" },
    { market: "新机对标", axis: "" },
    { market: "新机价", axis: "" },
    { market: "原厂", axis: "" },
    { market: "new machine price", axis: "" },
    { market: "美国", axis: "" },
    { market: "北美", axis: "" },
    { market: "Atlantis 虚构地", axis: "" },
    { market: "智利", axis: "南非" },
    { market: "欧洲", axis: "国内" },
    { market: "", axis: "新机价" },
  ];

  it("全部结果 ∈ MARKET_AXIS（不可能落出枚举）", () => {
    for (const s of samples) {
      const axis = normalizeAxis(s.market, s.axis);
      expect(MARKET_AXIS, `market=${s.market} axis=${String(s.axis)}`).toContain(axis);
    }
  });

  it("合法 axis 直接命中（优先级最高）", () => {
    expect(normalizeAxis("南非", "国内")).toBe("国内");
    expect(normalizeAxis("", "新机对标")).toBe("新机对标");
  });

  it("axis 非法时按 axis 文本归桶（LLM 把国名当 axis）", () => {
    expect(normalizeAxis("欧洲", "智利")).toBe("非洲中东澳新");
    expect(normalizeAxis("", "新机价")).toBe("新机对标");
    // 内蒙古必须命中「国内」，不能被 CIS_RE 的「蒙古」抢走
    expect(normalizeAxis("内蒙古", "内蒙")).toBe("国内");
  });

  it("axis 无法识别时回落 market 文本", () => {
    expect(normalizeAxis("乌兹别克斯坦 塔什干", "xxx")).toBe("中亚");
    expect(normalizeAxis("德国 Bayern", undefined)).toBe("欧洲");
    expect(normalizeAxis("荷兰 Drenthe", null)).toBe("欧洲");
  });

  it("全部无法识别 ⇒ 落残差轴（PRD §4.1.1「其他」在价格轴上的落点）", () => {
    expect(normalizeAxis("", "")).toBe("非洲中东澳新");
    expect(normalizeAxis("乱码!@#$%", 123)).toBe("非洲中东澳新");
    // 北美 = 「其他」桶
    expect(normalizeAxis("美国", "")).toBe("非洲中东澳新");
  });
});

// ═══════════════════════════════════════════════════════════
// 2b. normalizeAxisEx —— 残差标记（渲染层据此把该格踢出价格列）
// ═══════════════════════════════════════════════════════════

describe("normalizeAxisEx — 区分「关键词真命中」与「兜底残差」", () => {
  it("「北美」⇒ { 非洲中东澳新, residual: true }（兜底，必须进备注列）", () => {
    expect(normalizeAxisEx("北美", "")).toEqual({ axis: "非洲中东澳新", residual: true });
  });

  it("「日本」⇒ residual: true（不在 §4.1.1 任何桶内）", () => {
    expect(normalizeAxisEx("日本", "")).toEqual({ axis: "非洲中东澳新", residual: true });
  });

  it("「南非」⇒ residual: false（非洲关键词真命中，可进价格列）", () => {
    expect(normalizeAxisEx("南非", "")).toEqual({ axis: "非洲中东澳新", residual: false });
  });

  it("「埃塞俄比亚」⇒ residual: false（非洲关键词真命中）", () => {
    expect(normalizeAxisEx("埃塞俄比亚", "")).toEqual({ axis: "非洲中东澳新", residual: false });
  });

  it("合法 axis / 关键词真命中的其余四轴 residual 均为 false", () => {
    expect(normalizeAxisEx("南非", "国内")).toEqual({ axis: "国内", residual: false });
    expect(normalizeAxisEx("德国 Bayern", "")).toEqual({ axis: "欧洲", residual: false });
    expect(normalizeAxisEx("乌兹别克", "")).toEqual({ axis: "中亚", residual: false });
    expect(normalizeAxisEx("", "新机价")).toEqual({ axis: "新机对标", residual: false });
  });

  it("normalizeAxis 与 normalizeAxisEx(...).axis 恒等（薄封装）", () => {
    for (const s of [
      { market: "北美", axis: "" },
      { market: "南非", axis: "" },
      { market: "乱码", axis: undefined },
      { market: "", axis: "欧洲" },
    ]) {
      expect(normalizeAxis(s.market, s.axis)).toBe(normalizeAxisEx(s.market, s.axis).axis);
    }
  });

  it("normalizeDecisionFields 把 residual 透传到 axisResidual 并告警", () => {
    const r = normalizeDecisionFields(
      {
        marketAnchors: [
          {
            equipment: "Krone VBP 3165（2016）",
            axis: "北美" as never,
            market: "美国",
            priceText: "US$48k ≈ 34 万",
            priceCny: 340000,
            basisType: "推算",
          },
          {
            equipment: "Krone VBP 3165（2016）",
            axis: "非洲中东澳新",
            market: "南非",
            priceText: "R 500k ≈ 20 万",
            priceCny: 200000,
            basisType: "推算",
          },
        ],
      },
      env()
    );
    expect(r.marketAnchors[0]).toMatchObject({ axis: "非洲中东澳新", axisResidual: true });
    expect(r.marketAnchors[1]).toMatchObject({ axis: "非洲中东澳新", axisResidual: false });
    expect(r.warnings.some((w) => w.includes("axisResidual"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. splitCountryCity —— 复用 location-parser，不猜
// ═══════════════════════════════════════════════════════════

describe("splitCountryCity — 国别/城市拆分（复用 parseLocationText）", () => {
  it("「荷兰 Drenthe」→ { 荷兰, Drenthe }", () => {
    expect(splitCountryCity("荷兰 Drenthe", "intl")).toEqual({
      country: "荷兰",
      city: "Drenthe",
    });
  });

  it("「内蒙古 呼和浩特」（cn）→ { 中国, 呼和浩特 }", () => {
    expect(splitCountryCity("内蒙古 呼和浩特", "cn")).toEqual({
      country: "中国",
      city: "呼和浩特",
    });
  });

  it("「河北石家庄」（cn）→ { 中国, 石家庄 }", () => {
    expect(splitCountryCity("河北石家庄", "cn")).toEqual({
      country: "中国",
      city: "石家庄",
    });
  });

  it("只有国名 ⇒ city 为 null", () => {
    expect(splitCountryCity("德国", "intl")).toEqual({ country: "德国", city: null });
    expect(splitCountryCity("南非", "intl")).toEqual({ country: "南非", city: null });
  });

  it("英文国名 ⇒ 也能拆出城市", () => {
    expect(splitCountryCity("Germany Bavaria", "intl")).toEqual({
      country: "德国",
      city: "Bavaria",
    });
  });

  // 中文名必须整趟优先于任何英文名（否则「美国 Georgia」会被格鲁吉亚的英文名抢走）
  it("中文名优先于他国英文名：「美国 Georgia」→ 美国，不是格鲁吉亚", () => {
    expect(splitCountryCity("美国 Georgia", "intl")).toEqual({
      country: "美国",
      city: "Georgia",
    });
  });

  it("一个国家的英文名不被另一个国家的中文名截断：「罗马尼亚 Cluj」→ 罗马尼亚", () => {
    expect(splitCountryCity("罗马尼亚 Cluj", "intl")).toEqual({
      country: "罗马尼亚",
      city: "Cluj",
    });
  });

  it("英文名前缀歧义（Austria / Australia）：「澳大利亚 Perth」→ 澳大利亚", () => {
    expect(splitCountryCity("澳大利亚 Perth", "intl")).toEqual({
      country: "澳大利亚",
      city: "Perth",
    });
  });

  it("无法解析 ⇒ 双 null（不猜）", () => {
    expect(splitCountryCity(null, "intl")).toEqual({ country: null, city: null });
    expect(splitCountryCity("", "cn")).toEqual({ country: null, city: null });
    expect(splitCountryCity("XYZ123 乱码", "intl")).toEqual({ country: null, city: null });
    // 境内库但解析不出中国行政区划 ⇒ 不硬塞「中国」
    expect(splitCountryCity("某不知名农场", "cn")).toEqual({ country: null, city: null });
  });

  // ── T06 实测缺口回补：生产表 INTERNATIONAL_COUNTRIES 只有 32 国，缺丹麦/奥地利 ──
  // 这两国在 PRD §4.1.1 属「欧洲」桶，解析成 null 会让 Excel「方向」落到「其他」、排序被推到表尾。
  describe("补充国别表（生产表缺失国）", () => {
    it("「丹麦」→ { 丹麦, null }（生产表缺失，走本模块补充表）", () => {
      expect(splitCountryCity("丹麦", "intl")).toEqual({ country: "丹麦", city: null });
    });

    it("「丹麦奥尔堡」→ { 丹麦, 奥尔堡 }（国名+城市连写也能拆）", () => {
      expect(splitCountryCity("丹麦奥尔堡", "intl")).toEqual({
        country: "丹麦",
        city: "奥尔堡",
      });
    });

    it("「丹麦 Rødding」→ { 丹麦, Rødding }（空格分隔 + 非 ASCII 城市名）", () => {
      expect(splitCountryCity("丹麦 Rødding", "intl")).toEqual({
        country: "丹麦",
        city: "Rødding",
      });
    });

    it("「奥地利」→ { 奥地利, null }", () => {
      expect(splitCountryCity("奥地利", "intl")).toEqual({ country: "奥地利", city: null });
    });

    it("英文名同样可匹配：Denmark / Austria", () => {
      expect(splitCountryCity("Denmark Aarhus", "intl")).toEqual({
        country: "丹麦",
        city: "Aarhus",
      });
      expect(splitCountryCity("Austria", "intl")).toEqual({ country: "奥地利", city: null });
    });

    it("最长国名优先：印度尼西亚不被误判成印度（既有隐患顺带修正）", () => {
      expect(splitCountryCity("印度尼西亚", "intl")).toEqual({
        country: "印度尼西亚",
        city: null,
      });
    });
  });

  describe("N02b 验收补充（#77 指定用例 + ISO 两字母负向用例）", () => {
    it("补充表更多国家可识别：瑞典 / 新西兰 / 智利 / 阿塞拜疆", () => {
      expect(splitCountryCity("瑞典", "intl")).toEqual({ country: "瑞典", city: null });
      expect(splitCountryCity("新西兰", "intl")).toEqual({ country: "新西兰", city: null });
      expect(splitCountryCity("智利", "intl")).toEqual({ country: "智利", city: null });
      expect(splitCountryCity("阿塞拜疆", "intl")).toEqual({ country: "阿塞拜疆", city: null });
    });

    it("前缀包含：印度 与 印度尼西亚 各自正确（短名不得抢长名）", () => {
      expect(splitCountryCity("印度", "intl")).toEqual({ country: "印度", city: null });
      expect(splitCountryCity("印度尼西亚", "intl")).toEqual({
        country: "印度尼西亚",
        city: null,
      });
    });

    it("前缀包含 + 连写：印度尼西亚雅加达 ⇒ 先切长国名再取城市", () => {
      expect(splitCountryCity("印度尼西亚雅加达", "intl")).toEqual({
        country: "印度尼西亚",
        city: "雅加达",
      });
    });

    it("ISO 两字母禁子串：MINSK 不得被判成 IN（印度）", () => {
      const r = splitCountryCity("MINSK", "intl");
      expect(r.country).not.toBe("印度");
      expect(r).toEqual({ country: null, city: null });
    });

    it("ISO 两字母独立 token 仍可命中：DE / DE, Bavaria", () => {
      expect(splitCountryCity("DE", "intl")).toEqual({ country: "德国", city: null });
      expect(splitCountryCity("DE Bavaria", "intl")).toEqual({
        country: "德国",
        city: "Bavaria",
      });
    });

    it("「德国」这类只有国名的行：city 必须为 null（不是解析失败，是数据本身没城市）", () => {
      expect(splitCountryCity("德国", "intl")).toEqual({ country: "德国", city: null });
      expect(splitCountryCity("波兰", "intl")).toEqual({ country: "波兰", city: null });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 4. enforceStars —— clamp + 一票否决，不做加权
// ═══════════════════════════════════════════════════════════

describe("enforceStars — 只 clamp 与一票否决，不做加权计算", () => {
  it("合规成本命中「禁止」⇒ 强制压到 1", () => {
    expect(enforceStars(5, { complianceCost: "法规禁止出口" })).toBe(1);
    expect(enforceStars(4, { complianceCost: "禁入（Gecex 512/23）" })).toBe(1);
    expect(enforceStars(5, { complianceCost: "规格不兼容" })).toBe(1);
    expect(enforceStars(5, { complianceCost: "建议放弃" })).toBe(1);
  });

  it("越界 clamp 到 [1,5]", () => {
    expect(enforceStars(9)).toBe(5);
    expect(enforceStars(0)).toBe(1);
    expect(enforceStars(-3)).toBe(1);
    expect(enforceStars(6)).toBe(5);
    expect(enforceStars(3.4)).toBe(3);
    expect(enforceStars(3.6)).toBe(4);
  });

  it("非数字不抛错，落中性档 3", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => enforceStars("abc" as any)).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(enforceStars("abc" as any)).toBe(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(enforceStars(undefined as any)).toBe(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(enforceStars(null as any, null)).toBe(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(enforceStars({} as any)).toBe(3);
  });

  it("数字字符串可解析", () => {
    expect(enforceStars("4")).toBe(4);
    expect(enforceStars("5.4")).toBe(5);
  });

  it("因子未命中的合规成本不改变星级", () => {
    expect(enforceStars(5, { complianceCost: "优（无关税）" })).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. resolveDirection —— PRD §4.1.1 五桶
// ═══════════════════════════════════════════════════════════

describe("resolveDirection — 5 桶归桶（含北美→其他、CN→中国国内）", () => {
  it("DIRECTION_ORDER 顺序 = Sheet1 排序键", () => {
    expect(DIRECTION_ORDER).toEqual([
      "中国国内",
      "欧洲",
      "中亚独联体",
      "非洲中东南美澳新",
      "其他",
    ]);
  });

  const cases: Array<[Parameters<typeof resolveDirection>[0], DirectionBucket]> = [
    [{ partition: "cn" }, "中国国内"],
    [{ partition: "cn", country: "河北" }, "中国国内"],
    [{ partition: "intl", country: "中国" }, "中国国内"],
    [{ partition: "intl", country: "德国" }, "欧洲"],
    [{ partition: "intl", country: "荷兰" }, "欧洲"],
    [{ partition: "intl", country: "波兰" }, "欧洲"],
    [{ partition: "intl", country: "乌兹别克斯坦" }, "中亚独联体"],
    [{ partition: "intl", country: "俄罗斯" }, "中亚独联体"],
    // 补充国别表（生产表缺国）里也必须有对应方向桶，否则「方向」列错
    [{ partition: "intl", country: "丹麦" }, "欧洲"],
    [{ partition: "intl", country: "奥地利" }, "欧洲"],
    [{ partition: "intl", country: "摩尔多瓦" }, "中亚独联体"],
    [{ partition: "intl", country: "埃塞俄比亚" }, "非洲中东南美澳新"],
    [{ partition: "intl", country: "新西兰" }, "非洲中东南美澳新"],
    [{ partition: "intl", country: "南非" }, "非洲中东南美澳新"],
    [{ partition: "intl", country: "阿联酋" }, "非洲中东南美澳新"],
    [{ partition: "intl", country: "巴西" }, "非洲中东南美澳新"],
    [{ partition: "intl", country: "澳大利亚" }, "非洲中东南美澳新"],
    // 北美归「其他」（PRD §4.1.1）
    [{ partition: "intl", country: "美国" }, "其他"],
    [{ partition: "intl", country: "加拿大" }, "其他"],
    [{ partition: "intl", country: "日本" }, "其他"],
    [{ partition: "intl", regions: ["东非"] }, "非洲中东南美澳新"],
    [{ partition: "intl", regions: ["EU"] }, "欧洲"],
    [{ partition: "intl" }, "其他"],
    [{ partition: "intl", country: "Atlantis" }, "其他"],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${expected}`, () => {
      expect(resolveDirection(input)).toBe(expected);
    });
  }

  it("结果必 ∈ DIRECTION_ORDER（永不抛错、永不 undefined）", () => {
    const garbage: Array<Parameters<typeof resolveDirection>[0]> = [
      { partition: "intl", country: null, regions: undefined },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { partition: "intl", country: 123 as any, regions: "x" as any },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { partition: "xx" as any, country: "" },
    ];
    for (const g of garbage) {
      expect(DIRECTION_ORDER).toContain(resolveDirection(g));
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 6. normalizeDecisionFields —— 空输入也不留 undefined
// ═══════════════════════════════════════════════════════════

describe("normalizeDecisionFields — 空输入全字段落地", () => {
  for (const input of [null, undefined, {}, { tldr: null }]) {
    it(`input=${JSON.stringify(input)} ⇒ 每个字段都不是 undefined 且 warnings 非空`, () => {
      const r = normalizeDecisionFields(input as never, env({ webStatus: "disabled" }));
      expectAllFieldsDefined(r);
      expect(r.warnings.length).toBeGreaterThan(0);
      expect(r.tldr.length).toBeGreaterThanOrEqual(1);
      expect(r.equipmentProfiles.length).toBe(r.tldr.length);
      expect(r.complianceTasks.length).toBeGreaterThanOrEqual(3);
      expect(r.complianceTasks.some((t) => t.owner === "老板")).toBe(true);
      expect(r.openQuestions.some((q) => q.affects.includes("定价"))).toBe(true);
      expect(r.dataSources.length).toBeGreaterThanOrEqual(3);
    });
  }

  it("字段类型错乱也不抛错", () => {
    const garbage = {
      tldr: "not-an-array",
      keyInsight: 42,
      equipmentProfiles: [null, { name: 123 }],
      marketAnchors: [{ market: null, axis: {}, priceCny: "abc" }],
      bestDestinations: [{ market: "南非", rejected: "oops" }],
      marketRanking: [{ rank: "x", market: 1, stars: "abc" }],
      accessTrafficLight: "nope",
      todayCalls: [{ candidateIds: "lead_1" }],
      complianceTasks: [{ item: null, owner: "外星人", deadline: 3 }],
      openQuestions: [{ question: 1, urgency: "???" }],
      dataSources: [null, { name: "不存在的来源", ref: "" }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => normalizeDecisionFields(garbage as any, env())).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = normalizeDecisionFields(garbage as any, env());
    expectAllFieldsDefined(r);
    expect(r.marketRanking[0].stars).toBe(3); // 非数字 ⇒ 中性档
    expect(r.marketRanking[0].rank).toBe(1); // 非法 rank ⇒ 按组内序号
    expect(r.todayCalls[0].candidateIds).toEqual(["lead_1"]); // 字符串兼容为数组
  });
});

// ═══════════════════════════════════════════════════════════
// 7. PRD §2 逐条「为空时降级」专项断言
// ═══════════════════════════════════════════════════════════

describe("normalizeDecisionFields — PRD §2 降级规则专项", () => {
  // ① tldr 为空 ⇒ 用 summary + priceRange 合成 1 行，并告警
  it("① tldr 缺失 ⇒ 合成 1 行（equipment/price/why 全部落地）+ 告警", () => {
    const r = normalizeDecisionFields(
      {},
      env({ summary: "国内需求弱，出口更值钱", priceRange: "110–160 万" })
    );
    expect(r.tldr).toHaveLength(1);
    expect(r.tldr[0].equipment).toBe("Krone VBP 3165（2016）");
    expect(r.tldr[0].expectedPriceCny).toBe("110–160 万");
    expect(r.tldr[0].why).toBe("国内需求弱，出口更值钱");
    expect(r.tldr[0].bestChannel).toBeTruthy();
    expect(r.warnings.some((w) => w.includes("一页结论"))).toBe(true);
  });

  it("① tldr 缺失且无 priceRange ⇒ 用 priceMin/Max 合成「¥110–160 万」", () => {
    const r = normalizeDecisionFields({}, env());
    expect(r.tldr[0].expectedPriceCny).toBe("¥110–160 万");
  });

  // ② keyInsight 缺失 ⇒ null（整段不渲染），不留空标题
  it("② keyInsight 缺失 ⇒ null；缺 headline 也视为 null", () => {
    expect(normalizeDecisionFields({}, env()).keyInsight).toBeNull();
    const r = normalizeDecisionFields({ keyInsight: { headline: "只有标题" } } as never, env());
    expect(r.keyInsight).toBeNull();
    expect(r.warnings.some((w) => w.includes("keyInsight"))).toBe(true);
  });

  // ② contrastWithPrior 无基线 ⇒ 必须丢弃（最高频编造点）
  it("② contrastWithPrior 存在但无 priorStrategy ⇒ 丢弃该子字段 + 告警", () => {
    const r = normalizeDecisionFields(
      {
        keyInsight: {
          headline: "别按上一单的打法",
          body: "上一单是入门机走出口，这批高端机国内反而更高",
          contrastWithPrior: "对比上一单 MASCAR CORSA320",
        },
      },
      env({ hasPriorStrategy: false })
    );
    expect(r.keyInsight).not.toBeNull();
    expect(r.keyInsight?.contrastWithPrior).toBeNull();
    expect(r.warnings.some((w) => w.includes("contrastWithPrior"))).toBe(true);
  });

  it("② 有 priorStrategy 时 contrastWithPrior 保留", () => {
    const r = normalizeDecisionFields(
      {
        keyInsight: {
          headline: "别按上一单的打法",
          body: "上一单走出口，这批国内更高",
          contrastWithPrior: "对比上一单 MASCAR CORSA320",
        },
      },
      env({ hasPriorStrategy: true })
    );
    expect(r.keyInsight?.contrastWithPrior).toBe("对比上一单 MASCAR CORSA320");
  });

  // ③ equipmentProfiles 缺失 ⇒ 占位行，且与 tldr 行数一致（T10 A2 前置条件）
  it("③ equipmentProfiles 缺失 ⇒ 占位行，条数 = tldr 行数", () => {
    const r = normalizeDecisionFields({}, env());
    expect(r.equipmentProfiles).toHaveLength(r.tldr.length);
    expect(r.equipmentProfiles[0].name).toBe(r.tldr[0].equipment);
    expect(r.equipmentProfiles[0].spec).toBe("—");
    expect(r.warnings.some((w) => w.includes("参数未找到"))).toBe(true);
  });

  // ④ marketAnchors：axis 二次归桶 + 非 ok 时「新机对标」强制降级
  it("④ axis 由服务端二次归桶（LLM 把「南非」当 axis）", () => {
    const r = normalizeDecisionFields(
      {
        marketAnchors: [
          {
            equipment: "Krone VBP 3165（2016）",
            axis: "南非" as never,
            market: "南非",
            priceText: "R 500k ≈ 20 万",
            priceCny: 200000,
            basisType: "推算",
          },
        ],
      },
      env()
    );
    expect(r.marketAnchors[0].axis).toBe("非洲中东澳新");
  });

  it("④ 非 ok 时「新机对标」格强制「未找到」+ priceCny=null", () => {
    const r = normalizeDecisionFields(
      {
        marketAnchors: [
          {
            equipment: "Krone VBP 3165（2016）",
            axis: "新机对标",
            market: "新机价",
            priceText: "€45k ≈ 35 万",
            priceCny: 350000,
            basisType: "新机对标",
          },
        ],
      },
      env({ webStatus: "timeout" })
    );
    expect(r.marketAnchors[0].priceText).toContain("未接入外部检索");
    expect(r.marketAnchors[0].priceCny).toBeNull();
    expect(r.marketAnchors[0].basisType).toBe("新机对标");
    expect(r.warnings.some((w) => w.includes("新机对标"))).toBe(true);
  });

  it("④ ok 时「新机对标」格原样保留", () => {
    const r = normalizeDecisionFields(
      {
        marketAnchors: [
          {
            equipment: "X",
            axis: "新机对标",
            market: "新机价",
            priceText: "€45k ≈ 35 万",
            priceCny: 350000,
            basisType: "新机对标",
          },
        ],
      },
      env({ webStatus: "ok" })
    );
    expect(r.marketAnchors[0].priceText).toBe("€45k ≈ 35 万");
    expect(r.marketAnchors[0].priceCny).toBe(350000);
  });

  it("④ 价格缺失 ⇒ priceText「未找到」+ note「已检索未获取」，不删格", () => {
    const r = normalizeDecisionFields(
      {
        marketAnchors: [
          { equipment: "X", axis: "欧洲", market: "德国", priceText: "", basisType: "欧洲二手净价" },
        ],
      },
      env()
    );
    expect(r.marketAnchors).toHaveLength(1);
    expect(r.marketAnchors[0].priceText).toBe("未找到");
    expect(r.marketAnchors[0].note).toBe("已检索未获取");
    expect(r.marketAnchors[0].priceCny).toBeNull();
  });

  // ⑤ readout 缺失 ⇒ null（不渲染该行）
  it("⑤ readout 缺失 ⇒ null", () => {
    expect(normalizeDecisionFields({}, env()).readout).toBeNull();
    expect(normalizeDecisionFields({ readout: "  " }, env()).readout).toBeNull();
    expect(normalizeDecisionFields({ readout: "国内 ≧ 中亚 FOB" }, env()).readout).toBe(
      "国内 ≧ 中亚 FOB"
    );
  });

  // ⑥/⑦ bestDestinations 缺失 ⇒ 用 marketRanking 首位合成并标注
  it("⑥ bestDestinations 缺失 ⇒ 由 marketRanking 首位推导 + 标注", () => {
    const r = normalizeDecisionFields(
      {
        marketRanking: [
          { equipment: "A 机", rank: 1, market: "乌兹别克", stars: 5 },
          { equipment: "A 机", rank: 2, market: "哈萨克", stars: 3 },
        ],
      },
      env()
    );
    expect(r.bestDestinations).toHaveLength(1);
    expect(r.bestDestinations[0].market).toEqual(["乌兹别克"]);
    expect(r.bestDestinations[0].basis).toContain("结论由");
    expect(r.warnings.some((w) => w.includes("推导"))).toBe(true);
  });

  it("⑥ market 为字符串（LLM 高频错法）⇒ 归一为数组", () => {
    const r = normalizeDecisionFields(
      { bestDestinations: [{ equipment: "X", market: "南非" as never, basis: "有买家池" }] },
      env()
    );
    expect(r.bestDestinations[0].market).toEqual(["南非"]);
  });

  // ⑦ marketRanking：stars clamp + 合规一票否决
  it("⑦ stars 越界 clamp、complianceCost 命中禁入 ⇒ 1 星", () => {
    const r = normalizeDecisionFields(
      {
        marketRanking: [
          { rank: 1, market: "巴西", stars: 5, factors: { unitPrice: "优（…）", liquidity: "中（…）", paymentSpeed: "中（…）", complianceCost: "禁入（Gecex 512/23）" } },
          { rank: 2, market: "德国", stars: 9 as never },
        ],
      },
      env()
    );
    expect(r.marketRanking[0].stars).toBe(1);
    expect(r.marketRanking[1].stars).toBe(5);
  });

  it("⑦ marketRanking 缺失 ⇒ 空数组 + 告警（保留章标题）", () => {
    const r = normalizeDecisionFields({}, env());
    expect(r.marketRanking).toEqual([]);
    expect(r.warnings.some((w) => w.includes("市场排名"))).toBe(true);
  });

  // ⑧ 三灯互斥 + 空灯告警
  it("⑧ 跨灯重复市场按 forbidden > needPermit > friendly 去重", () => {
    const r = normalizeDecisionFields(
      {
        accessTrafficLight: {
          friendly: ["德国", "巴西"],
          needPermit: ["巴西"],
          forbidden: ["巴西"],
        },
      },
      env()
    );
    expect(r.accessTrafficLight.forbidden).toEqual(["巴西"]);
    expect(r.accessTrafficLight.needPermit).toEqual([]);
    expect(r.accessTrafficLight.friendly).toEqual(["德国"]);
    expect(r.warnings.some((w) => w.includes("红绿灯"))).toBe(true);
  });

  it("⑧ 某灯为空 ⇒ 保留三色标题并告警（不隐藏）", () => {
    const r = normalizeDecisionFields(
      { accessTrafficLight: { friendly: ["德国"], needPermit: [], forbidden: [] } },
      env()
    );
    expect(r.accessTrafficLight.friendly).toEqual(["德国"]);
    expect(r.warnings.some((w) => w.includes("灯位为空"))).toBe(true);
  });

  // ⑨ todayCalls：candidateIds 为空 ⇒ 整条丢弃
  it("⑨ candidateIds 全空的条目被丢弃 + 今日无可用电话文案", () => {
    const r = normalizeDecisionFields(
      {
        todayCalls: [
          { equipment: "X", candidateIds: [], role: "授权经销", whyToday: "询价窗口本周关闭" },
        ],
      },
      env({ candidateCount: 0 })
    );
    expect(r.todayCalls).toEqual([]);
    expect(r.warnings.some((w) => w.includes("今日无可用电话"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("整条丢弃"))).toBe(true);
  });

  it("⑨ 合法 candidateIds 保留，非法 role 落「终端」", () => {
    const r = normalizeDecisionFields(
      {
        todayCalls: [
          { equipment: "X", candidateIds: ["dealer_1", "lead_2"], role: "外星人" as never, whyToday: "认证周期 2 月" },
        ],
      },
      env()
    );
    expect(r.todayCalls).toHaveLength(1);
    expect(r.todayCalls[0].role).toBe("终端");
    expect(r.todayCalls[0].candidateIds).toEqual(["dealer_1", "lead_2"]);
  });

  // ⑩ complianceTasks：缺失 ⇒ 由合规提示转换，必须含「老板」
  it("⑩ complianceTasks 缺失 ⇒ 由 compliance 转换 + 含 owner=老板", () => {
    const r = normalizeDecisionFields(
      {},
      env({
        compliance: { dataExport: "需商检与出口报关单", crossBorder: "跨境结算走对公" },
      })
    );
    expect(r.complianceTasks.length).toBeGreaterThanOrEqual(3);
    expect(r.complianceTasks.some((t) => t.owner === "老板")).toBe(true);
    expect(r.complianceTasks.some((t) => t.item.includes("报关"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("自动转换"))).toBe(true);
  });

  // ⑩ compliance.notes vs note：规范名 notes（与 prompt.ts 的 LLM 输出一致）
  it("⑩ 只给 compliance.notes（线上真实形态）⇒ 被消费为「核实合规提示」项", () => {
    const r = normalizeDecisionFields(
      {},
      env({ compliance: { notes: "需商检 + 出口报关单，目的国需 EAC 认证" } })
    );
    expect(r.complianceTasks.some((t) => t.item.includes("EAC 认证"))).toBe(true);
    expect(r.complianceTasks.some((t) => t.item.startsWith("核实合规提示："))).toBe(true);
    expect(r.complianceTasks.some((t) => t.owner === "老板")).toBe(true);
  });

  it("⑩ 只给 compliance.note（旧写法）⇒ 仍能取到（向后兼容）", () => {
    const r = normalizeDecisionFields({}, env({ compliance: { note: "旧版单数写法：需熏蒸" } }));
    expect(r.complianceTasks.some((t) => t.item.includes("熏蒸"))).toBe(true);
  });

  it("⑩ notes 与 note 同时给 ⇒ notes 优先（不被旧字段覆盖）", () => {
    const r = normalizeDecisionFields(
      {},
      env({ compliance: { notes: "规范名内容", note: "旧字段内容" } })
    );
    expect(r.complianceTasks.some((t) => t.item.includes("规范名内容"))).toBe(true);
    expect(r.complianceTasks.some((t) => t.item.includes("旧字段内容"))).toBe(false);
  });

  it("⑩ 有清单但缺「老板」⇒ 自动补齐；status 缺省「未开始」", () => {
    const r = normalizeDecisionFields(
      {
        complianceTasks: [
          { item: "核实 HS843340 关税口径", owner: "外贸", deadline: "出口前" },
          { item: "确认目的港运费", owner: "物流", deadline: "本周" },
          { item: "核实乌兹 GOST-UZ 认证", owner: "业务", deadline: "发货前" },
        ],
      },
      env()
    );
    expect(r.complianceTasks.some((t) => t.owner === "老板")).toBe(true);
    expect(r.complianceTasks.every((t) => t.status === "未开始")).toBe(true);
    expect(r.warnings.some((w) => w.includes("确认实际采购成本"))).toBe(true);
  });

  it("⑩ 非 ok 时 deadline 不得给具体月数 ⇒ 改「出口前」", () => {
    const r = normalizeDecisionFields(
      {
        complianceTasks: [
          { item: "办理 EAC 认证", owner: "外贸", deadline: "2–3 月" },
          { item: "确认采购成本", owner: "老板", deadline: "立刻" },
          { item: "订舱", owner: "物流", deadline: "本周" },
        ],
      },
      env({ webStatus: "timeout" })
    );
    expect(r.complianceTasks[0].deadline).toBe("出口前");
    expect(r.complianceTasks[1].deadline).toBe("立刻");
  });

  // ⑪ openQuestions：缺失 ⇒ 补成本项；非 ok ⇒ 追加「未接入检索」项
  it("⑪ openQuestions 缺失 ⇒ 补「实际到手成本」；非 ok 追加外部检索确认项", () => {
    const r = normalizeDecisionFields({}, env({ webStatus: "disabled" }));
    expect(r.openQuestions.some((q) => q.affects.includes("定价"))).toBe(true);
    expect(r.openQuestions.some((q) => q.question.includes("未接入外部检索"))).toBe(true);
  });

  it("⑪ 有清单但无「定价」项 ⇒ 追加强制项", () => {
    const r = normalizeDecisionFields(
      {
        openQuestions: [{ question: "是否买断这批货？", affects: "是否买断", urgency: "本周" }],
      },
      env({ webStatus: "ok" })
    );
    expect(r.openQuestions.some((q) => q.affects.includes("定价"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("定价"))).toBe(true);
  });

  // ⑫ dataSources：非 ok 必须有 Web检索 一条；不足 3 条补站内
  it("⑫ 非 ok 时 dataSources 必须含 Web检索（ref=—）", () => {
    const r = normalizeDecisionFields({}, env({ webStatus: "timeout" }));
    const web = r.dataSources.find((d) => d.name === "Web检索");
    expect(web).toBeDefined();
    expect(web?.ref).toBe("—");
    expect(web?.note).toContain("检索超时");
  });

  it("⑫ ok 时 Web检索 带 URL", () => {
    const r = normalizeDecisionFields({}, env({ webStatus: "ok" }));
    const web = r.dataSources.find((d) => d.name === "Web检索");
    expect(web?.ref).toContain("https://example.com");
  });

  it("⑫ ref 为空的数据来源被丢弃，非法 name 归入「站内行情」", () => {
    const r = normalizeDecisionFields(
      {
        dataSources: [
          { name: "站内行情", ref: "Product?brand=Krone" },
          { name: "站内基准价", ref: "" },
          { name: "月球来源" as never, ref: "moon://price" },
        ],
      },
      env({ webStatus: "ok" })
    );
    expect(r.dataSources.every((d) => d.ref.length > 0)).toBe(true);
    expect(r.dataSources.some((d) => d.ref === "moon://price" && d.name === "站内行情")).toBe(true);
    expect(r.warnings.some((w) => w.includes("名称非法"))).toBe(true);
  });

  // 否决：level 反推 / L3 压档 / 全员 L1 告警
  it("否决：缺 level 时按 trigger 最低档反推", () => {
    const r = normalizeDecisionFields(
      {
        bestDestinations: [
          {
            equipment: "X",
            market: ["巴西"],
            basis: "Gecex 512/23 禁止二手资本货物进口",
            rejected: [{ market: "巴西", reason: "Gecex 512/23 决议禁止二手资本货物进口", trigger: "R1" }],
          },
        ],
      },
      env({ webStatus: "ok" })
    );
    expect(r.bestDestinations[0].rejected[0].level).toBe("L3");
  });

  it("否决：非 ok 时 L3 被压到 L2 并告警（无具名法规不许用强措辞）", () => {
    const r = normalizeDecisionFields(
      {
        bestDestinations: [
          {
            equipment: "X",
            market: ["巴西"],
            basis: "法规禁止进口",
            rejected: [{ market: "巴西", reason: "禁入巴西：Gecex 512/23", level: "L3" }],
          },
        ],
      },
      env({ webStatus: "timeout" })
    );
    expect(r.bestDestinations[0].rejected[0].level).toBe("L2");
    expect(r.warnings.some((w) => w.includes("降为 L2"))).toBe(true);
  });

  it("否决：全为 L1 ⇒ 告警「措辞最软」", () => {
    const r = normalizeDecisionFields(
      {
        bestDestinations: [
          {
            equipment: "X",
            market: ["中亚"],
            basis: "FOB 仅比国内低 8%",
            rejected: [{ market: "中亚", reason: "不建议出口中亚：FOB 仅比国内低 8%", level: "L1" }],
          },
        ],
      },
      env({ webStatus: "ok" })
    );
    expect(r.warnings.some((w) => w.includes("L1"))).toBe(true);
  });

  it("否决：完全没有 rejected ⇒ 告警「未生成否决建议」", () => {
    const r = normalizeDecisionFields(
      { bestDestinations: [{ equipment: "X", market: ["南非"], basis: "有买家池" }] },
      env({ webStatus: "ok" })
    );
    expect(r.bestDestinations[0].rejected).toEqual([]);
    expect(r.warnings.some((w) => w.includes("未生成否决建议"))).toBe(true);
  });

  it("否决：同机型内 market 去重且上限 4 条", () => {
    const r = normalizeDecisionFields(
      {
        bestDestinations: [
          {
            equipment: "X",
            market: ["南非"],
            basis: "…",
            rejected: [
              { market: "巴西", reason: "禁入巴西：Gecex 512/23", level: "L3" },
              { market: "巴西", reason: "重复条目", level: "L2" },
              { market: "德国", reason: "原厂就在德国，不缺这台", level: "L2" },
              { market: "中亚", reason: "认证成本吞噬利润 62%", level: "L2" },
              { market: "俄罗斯", reason: "回收税暴涨", level: "L3" },
              { market: "土耳其", reason: "门槛高", level: "L1" },
            ],
          },
        ],
      },
      env({ webStatus: "ok" })
    );
    const markets = r.bestDestinations[0].rejected.map((x) => x.market);
    expect(new Set(markets).size).toBe(markets.length);
    expect(markets.length).toBeLessThanOrEqual(4);
  });

  // §6.4：weightKg 无外部来源一律 null
  it("§6.4 非 ok 时 weightKg 一律置空", () => {
    const profiles = [
      {
        name: "Krone VBP 3165（2016）",
        brandCountry: "德国 Krone",
        type: "牵引式可变腔",
        spec: "1.2×1.5 m",
        power: "160–250 马力（牵引式，PTO）",
        weightKg: 4200,
        condition: "2016 / 约 5000 包",
        positioning: "法系保值最强",
      },
    ];
    const okRes = normalizeDecisionFields({ equipmentProfiles: profiles }, env({ webStatus: "ok" }));
    expect(okRes.equipmentProfiles[0].weightKg).toBe(4200);

    const degraded = normalizeDecisionFields({ equipmentProfiles: profiles }, env({ webStatus: "timeout" }));
    expect(degraded.equipmentProfiles[0].weightKg).toBeNull();
    expect(degraded.warnings.some((w) => w.includes("weightKg"))).toBe(true);
  });
});
