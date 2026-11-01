/**
 * 首页热门产品排序契约单测。
 *
 * 背景：首页「精选好机 · 全球直供」四卡片原来读的是 src/config/daily-report-ranking.ts
 * 里人工写死的 12 个产品 ID（无 orderBy）。生产库实测 .com 有 5 个 ID 已不存在、
 * .cn 只剩 4 个 → slice(1,5) 只切出 3 个 → 四列网格空一格。
 *
 * 老板 2026-11-01 拍板改为全动态排名：viewCount DESC → createdAt DESC → id DESC。
 * 这里把三级键的「顺序 + 方向」钉死，防止后人改回随机、删掉稳定键或误接 promotedUntil。
 */
import { describe, it, expect } from "vitest";

import {
  HOME_PRODUCT_ORDER_BY,
  HOME_PRODUCT_TAKE,
  HOME_CARD_COUNT,
  splitHomeProducts,
} from "../hot-products";

/** 构造带序号的假产品行，便于断言顺序未被打乱 */
function rows(n: number): Array<{ id: string; rank: number }> {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, rank: i + 1 }));
}

describe("splitHomeProducts：头条 1 台 + 四卡片 4 台", () => {
  it("5 行 → top 是第 1 个，hot 是第 2~5 个（长度 4、顺序不变）", () => {
    const { top, hot } = splitHomeProducts(rows(5));

    expect(top).toEqual({ id: "p1", rank: 1 });
    expect(hot).toHaveLength(4);
    expect(hot.map((r) => r.id)).toEqual(["p2", "p3", "p4", "p5"]);
  });

  it("3 行 → top 1 个 + hot 2 个（.cn 分库的真实情形，不再空一格占位）", () => {
    const { top, hot } = splitHomeProducts(rows(3));

    expect(top).toEqual({ id: "p1", rank: 1 });
    expect(hot.map((r) => r.id)).toEqual(["p2", "p3"]);
  });

  it("1 行 → top 1 个 + hot 空数组", () => {
    const { top, hot } = splitHomeProducts(rows(1));

    expect(top).toEqual({ id: "p1", rank: 1 });
    expect(hot).toEqual([]);
  });

  it("0 行 → top === null、hot === []", () => {
    const { top, hot } = splitHomeProducts([]);

    expect(top).toBeNull();
    expect(hot).toEqual([]);
  });

  it("超过 5 行也只取前 5 个（第 1 + 第 2~5）", () => {
    const { top, hot } = splitHomeProducts(rows(9));

    expect(top).toEqual({ id: "p1", rank: 1 });
    expect(hot.map((r) => r.id)).toEqual(["p2", "p3", "p4", "p5"]);
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

  it("末级是 id 稳定键（防止 viewCount 并列时刷新一次排名就变）", () => {
    const lastKey = Object.keys(HOME_PRODUCT_ORDER_BY[HOME_PRODUCT_ORDER_BY.length - 1])[0];
    expect(lastKey).toBe("id");
  });

  it("不接入 promotedUntil（付费置顶暂不参与排序）", () => {
    const keys = HOME_PRODUCT_ORDER_BY.map((o) => Object.keys(o)[0]);
    expect(keys).not.toContain("promotedUntil");
  });
});

describe("首页取量常量", () => {
  it("HOME_PRODUCT_TAKE === 5", () => {
    expect(HOME_PRODUCT_TAKE).toBe(5);
  });

  it("HOME_CARD_COUNT === 4", () => {
    expect(HOME_CARD_COUNT).toBe(4);
  });

  it("取量 = 头条位 1 + 卡片位 4（两者自洽）", () => {
    expect(1 + HOME_CARD_COUNT).toBe(HOME_PRODUCT_TAKE);
  });
});
