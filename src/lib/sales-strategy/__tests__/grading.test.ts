/**
 * 单元测试：A/B/C 分级（T5）
 * 覆盖：A（授权+品牌命中）/ A（授权+有 ctx 但品牌不命中→B）/ A（授权+无 ctx）/
 *       B（非授权+有联系方式）/ C（无联系方式）/ C（tags 电话占位）/ C（tags 自家·禁外呼）/
 *       resolveGrade（有 ctx 走实时 / 无 ctx 用库内 grade / grade=null 兜底）
 */
import { describe, it, expect } from "vitest";
import { gradeDealer, resolveGrade, type GradeContext } from "@/lib/sales-strategy/grading";
import type { DealerPublic } from "@/lib/sales-strategy/types";

/** 构造一个合法 DealerPublic（默认：无联系方式、无授权、无 grade） */
function dealer(overrides: Partial<DealerPublic> = {}): DealerPublic {
  return {
    id: "d1",
    name: "测试经销商",
    brands: [],
    models: [],
    regions: [],
    nature: null,
    grade: null,
    sourceUrl: null,
    partition: "cn",
    phoneMasked: "",
    wechatMasked: "",
    emailMasked: "",
    tags: [],
    ...overrides,
  };
}

const CONTACT = { phoneMasked: "138****1111" } as const;

describe("gradeDealer — A 级", () => {
  it("授权经销商 + 品牌命中 → A", () => {
    const d = dealer({ nature: "授权经销商", brands: ["CLAAS"], ...CONTACT });
    expect(gradeDealer(d, { brand: "CLAAS" })).toBe("A");
  });

  it("授权经销商 + 品牌命中（大小写/空白归一化）→ A", () => {
    const d = dealer({ nature: "授权经销商", brands: ["claas "], ...CONTACT });
    expect(gradeDealer(d, { brand: "CLAAS" })).toBe("A");
  });

  it("授权经销商 + 机型命中 → A", () => {
    const d = dealer({ nature: "授权经销商", models: ["AXION 850"], ...CONTACT });
    expect(gradeDealer(d, { model: "axion850" })).toBe("A");
  });

  it("授权经销商 + 有 ctx 但品牌/机型都不命中 → B", () => {
    const d = dealer({ nature: "授权经销商", brands: ["Kubota"], ...CONTACT });
    expect(gradeDealer(d, { brand: "CLAAS" })).toBe("B");
  });

  it("授权经销商 + 无 ctx → A", () => {
    const d = dealer({ nature: "授权经销商", brands: [], ...CONTACT });
    expect(gradeDealer(d)).toBe("A");
  });
});

describe("gradeDealer — B 级", () => {
  it("非授权经销商 + 有联系方式 → B", () => {
    const d = dealer({ nature: "二手商", emailMasked: "zh***@qq.com" });
    expect(gradeDealer(d)).toBe("B");
  });
});

describe("gradeDealer — C 级（不可外呼，优先级最高）", () => {
  it("无任何联系方式 → C（即便授权）", () => {
    const d = dealer({ nature: "授权经销商", phoneMasked: "", wechatMasked: "", emailMasked: "" });
    expect(gradeDealer(d)).toBe("C");
  });

  it("tags 含「电话占位」→ C（即便有脱敏值）", () => {
    const d = dealer({ nature: "授权经销商", brands: ["CLAAS"], tags: ["电话占位"], ...CONTACT });
    expect(gradeDealer(d, { brand: "CLAAS" })).toBe("C");
  });

  it("tags 含「自家·禁外呼」→ C", () => {
    const d = dealer({ nature: "二手商", tags: ["自家·禁外呼"], ...CONTACT });
    expect(gradeDealer(d)).toBe("C");
  });
});

describe("resolveGrade — 上下文优先 / 库内 grade 兜底", () => {
  it("有 ctx → 以实时计算为准（覆盖库内 grade=B）", () => {
    const d = dealer({ nature: "授权经销商", brands: ["CLAAS"], grade: "B", ...CONTACT });
    expect(resolveGrade(d, { brand: "CLAAS" })).toBe("A");
  });

  it("无 ctx → 沿用库内 grade=A（即便非授权）", () => {
    const d = dealer({ nature: "二手商", grade: "A", ...CONTACT });
    expect(resolveGrade(d)).toBe("A");
  });

  it("无 ctx 且 grade=null → 实时兜底计算（二手商+有联系方式 → B）", () => {
    const d = dealer({ nature: "二手商", grade: null, ...CONTACT });
    expect(resolveGrade(d)).toBe("B");
  });
});
