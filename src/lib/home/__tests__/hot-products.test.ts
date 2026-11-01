/**
 * 首页热门产品排序契约单测。
 *
 * 背景：首页「精选好机 · 全球直供」四卡片原来读的是 src/config/daily-report-ranking.ts
 * 里人工写死的 12 个产品 ID（无 orderBy）。生产库实测 .com 有 5 个 ID 已不存在、
 * .cn 只剩 4 个 → slice(1,5) 只切出 3 个 → 四列网格空一格。
 *
 * 老板 2026-11-01 拍板改为全动态排名：viewCount DESC → createdAt DESC → id DESC。
 *
 * 另一层回归防线（本次补）：`<HeroSection topProduct={...} />` 在 aadeb32 已从首页移除，
 * 首页**没有头条位**，所以「取量必须等于卡片位数量」。历史上 take:5 + slice(1,5) 的组合
 * 会把浏览量第 1 的机器（CLAAS 980，70 次）跳过头名，让只有 17 次浏览的机器上卡。
 * HOME_PRODUCT_TAKE === HOME_CARD_COUNT 这条断言就是为了防止「多取再丢弃」复活。
 */
import { describe, it, expect } from "vitest";

import {
  HOME_PRODUCT_ORDER_BY,
  HOME_PRODUCT_TAKE,
  HOME_CARD_COUNT,
  pickHomeCards,
} from "../hot-products";

/** 构造带序号的假产品行，便于断言顺序未被打乱 */
function rows(n: number): Array<{ id: string; rank: number }> {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, rank: i + 1 }));
}

describe("pickHomeCards：浏览量前 4 台上卡，不跳过头名", () => {
  it("4 个元素 → 返回全部 4 个，顺序不变", () => {
    const out = pickHomeCards(rows(4));

    expect(out).toHaveLength(4);
    expect(out.map((r) => r.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("6 个元素 → 只返回前 4 个（不能返回后 4 个、不能反转）", () => {
    const out = pickHomeCards(rows(6));

    expect(out).toHaveLength(4);
    expect(out.map((r) => r.id)).toEqual(["p1", "p2", "p3", "p4"]);
    // 反向断言：第 1 名（浏览量最高的那台）必须在，第 5/6 名必须不在
    expect(out.map((r) => r.id)).toContain("p1");
    expect(out.map((r) => r.id)).not.toContain("p5");
    expect(out.map((r) => r.id)).not.toContain("p6");
  });

  it("3 个元素 → 返回 3 个（.cn 分库的真实情形，自然收敛不补空卡）", () => {
    const out = pickHomeCards(rows(3));

    expect(out.map((r) => r.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("0 个元素 → 返回 []（不是 undefined）", () => {
    const out = pickHomeCards([]);

    expect(out).toEqual([]);
    expect(Array.isArray(out)).toBe(true);
  });

  it("不修改入参（原数组长度不变）", () => {
    const input = rows(6);
    pickHomeCards(input);

    expect(input).toHaveLength(6);
    expect(input.map((r) => r.id)).toEqual(["p1", "p2", "p3", "p4", "p5", "p6"]);
  });

  it("返回的是新数组（改动结果不影响入参）", () => {
    const input = rows(6);
    const out = pickHomeCards(input);
    out.pop();

    expect(input).toHaveLength(6);
  });
});

describe("HOME_PRODUCT_ORDER_BY：三级排序契约", () => {
  it("恰好 3 级键，顺序为 viewCount → createdAt → id", () => {
    expect(HOME_PRODUCT_ORDER_BY).toHaveLength(3);

    const keys = HOME_PRODUCT_ORDER_BY.map((o) => Object.keys(o)[0]);
    expect(keys).toEqual(["viewCount", "createdAt", "id"]);
  });

  it("三级键方向全部为 desc", () => {
    for (const orderBy of HOME_PRODUCT_ORDER_BY) {
      const dir = Object.values(orderBy)[0];
      expect(dir).toBe("desc");
    }
  });

  it("数组长度严格为 3、最后一个元素的 key 严格是 id（稳定键不许被删）", () => {
    expect(HOME_PRODUCT_ORDER_BY).toHaveLength(3);
    const last = HOME_PRODUCT_ORDER_BY[HOME_PRODUCT_ORDER_BY.length - 1];
    expect(Object.keys(last)).toEqual(["id"]);
  });

  it("不接入 promotedUntil（付费置顶暂不参与排序）", () => {
    const keys = HOME_PRODUCT_ORDER_BY.map((o) => Object.keys(o)[0]);
    expect(keys).not.toContain("promotedUntil");
  });
});

describe("首页取量常量", () => {
  it("HOME_CARD_COUNT === 4", () => {
    expect(HOME_CARD_COUNT).toBe(4);
  });

  it("HOME_PRODUCT_TAKE === HOME_CARD_COUNT（核心回归防线：取量必须等于卡片数）", () => {
    expect(HOME_PRODUCT_TAKE).toBe(HOME_CARD_COUNT);
  });

  it("HOME_PRODUCT_TAKE === 4（不是 5，5 会多取再丢弃、跳过头名）", () => {
    expect(HOME_PRODUCT_TAKE).toBe(4);
    expect(HOME_PRODUCT_TAKE).not.toBe(5);
  });
});
