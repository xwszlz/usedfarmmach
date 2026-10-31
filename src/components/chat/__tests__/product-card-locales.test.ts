/**
 * 聊天产品卡片（`src/components/chat/product-card.tsx`）的货币/套利文案回归。
 *
 * 线上缺陷（P1 错译）：
 *  - `pt` 槽位里塞的是西班牙语 "Precio Doméstico"，葡语应为 "Preço Doméstico"；
 *  - `fr` 的 "Prix Domestic" 缺重音，正确写法是 "Prix Domestique"。
 *
 * 该组件在首页热销机区块与全站产品卡片中渲染，两条错译会直接暴露给对应语种买家。
 */
import { describe, expect, it, vi } from "vitest";
import React from "react";

// 被测模块顶层 import 了 lucide-react，node 环境下用最小替身替代
vi.mock("lucide-react", () => {
  const Icon = () => React.createElement("span");
  return {
    __esModule: true,
    ChevronRight: Icon,
    TrendingUp: Icon,
    Truck: Icon,
  };
});

import { CURRENCY_LABELS } from "../product-card";

describe("product-card CURRENCY_LABELS", () => {
  it("pt 的价格标签是葡语 Preço Doméstico（不是西语 Precio）", () => {
    expect(CURRENCY_LABELS.pt.price).toBe("Preço Doméstico");
    expect(CURRENCY_LABELS.pt.price).not.toContain("Precio");
  });

  it("fr 的价格标签是 Prix Domestique（带重音，不是 Prix Domestic）", () => {
    expect(CURRENCY_LABELS.fr.price).toBe("Prix Domestique");
    expect(CURRENCY_LABELS.fr.price).not.toContain('Domestic"');
    expect(CURRENCY_LABELS.fr.price).not.toMatch(/Domestic$/);
  });

  it("8 个语种的 price / profit 均存在且非空", () => {
    for (const locale of ["zh", "en", "ru", "es", "pt", "fr", "ar", "hi"]) {
      const entry = CURRENCY_LABELS[locale];
      expect(entry, `缺少语种 ${locale} 的文案`).toBeDefined();
      expect(entry.price.trim().length, `${locale}.price 不能为空`).toBeGreaterThan(0);
      expect(entry.profit.trim().length, `${locale}.profit 不能为空`).toBeGreaterThan(0);
    }
  });

  it("同一语种内 price 与 profit 不重复；各语种之间不被跨语言误填", () => {
    for (const locale of ["zh", "en", "ru", "es", "pt", "fr", "ar", "hi"]) {
      expect(CURRENCY_LABELS[locale].price).not.toBe(CURRENCY_LABELS[locale].profit);
    }
    // es 的正确写法保留（本次只改 pt / fr，es 不动）
    expect(CURRENCY_LABELS.es.price).toBe("Precio Doméstico");
  });
});
