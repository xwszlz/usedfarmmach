/**
 * 单元测试：区域聚合（T5）
 * 覆盖：多地区展开（一个经销商计入每个地区）/ 空 regions → 未标注 /
 *       排序（total↓ → A↓ → region 字典序）/ 分级计数 / ctx 影响分级
 */
import { describe, it, expect } from "vitest";
import { aggregateByRegion } from "@/lib/sales-strategy/region-stats";
import type { DealerPublic } from "@/lib/sales-strategy/types";

function dealer(overrides: Partial<DealerPublic> = {}): DealerPublic {
  return {
    id: "d",
    name: "测试",
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

/** 无 ctx 时 resolveGrade 直接沿用库内 grade，便于精确控制分桶 */
const FIXTURES: DealerPublic[] = [
  dealer({ id: "1", regions: ["北京", "天津"], grade: "A" }), // 北京 A, 天津 A
  dealer({ id: "2", regions: ["北京"], grade: "B" }), // 北京 B
  dealer({ id: "3", regions: ["北京"], grade: "A" }), // 北京 A
  dealer({ id: "4", regions: [], grade: "C" }), // 未标注 C
  dealer({ id: "5", regions: ["上海"], grade: "A" }), // 上海 A
  dealer({ id: "6", regions: ["上海"], grade: "B" }), // 上海 B
];

describe("aggregateByRegion", () => {
  it("多地区经销商计入每一个地区（不是只算一次）", () => {
    const stats = aggregateByRegion(FIXTURES);
    const beijing = stats.find((s) => s.region === "北京")!;
    const tianjin = stats.find((s) => s.region === "天津")!;
    // id=1 同时出现在北京与天津
    expect(beijing.total).toBe(3);
    expect(tianjin.total).toBe(1);
    expect(tianjin.A).toBe(1);
  });

  it("regions 为空 → 归入「未标注」", () => {
    const stats = aggregateByRegion(FIXTURES);
    const unknown = stats.find((s) => s.region === "未标注");
    expect(unknown).toBeTruthy();
    expect(unknown!.total).toBe(1);
    expect(unknown!.C).toBe(1);
  });

  it("分级计数正确（北京 A2/B1/C0，上海 A1/B1）", () => {
    const stats = aggregateByRegion(FIXTURES);
    const beijing = stats.find((s) => s.region === "北京")!;
    expect(beijing).toMatchObject({ total: 3, A: 2, B: 1, C: 0 });
    const shanghai = stats.find((s) => s.region === "上海")!;
    expect(shanghai).toMatchObject({ total: 2, A: 1, B: 1, C: 0 });
  });

  it("排序：total 降序 → A 降序 → region 字典序", () => {
    const stats = aggregateByRegion(FIXTURES);
    expect(stats.map((s) => s.region)).toEqual(["北京", "上海", "天津", "未标注"]);
  });

  it("传入 ctx 时按实时分级统计（授权+品牌命中 → A）", () => {
    const withCtxDealer = dealer({
      id: "x",
      regions: ["德国"],
      grade: null, // 无库内 grade，靠实时计算
      nature: "授权经销商",
      brands: ["CLAAS"],
      phoneMasked: "138****1111",
    });
    const stats = aggregateByRegion([withCtxDealer], { brand: "CLAAS" });
    const de = stats.find((s) => s.region === "德国")!;
    expect(de).toMatchObject({ total: 1, A: 1, B: 0, C: 0 });
  });
});
