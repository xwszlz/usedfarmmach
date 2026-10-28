/**
 * `scoreToConditionCode` / `normalizeConditionCode` / `conditionCodeLabelText` 的边界用例。
 *
 * 为什么单独成文件：`conditionCode` 是**下游前端做文案本地化的唯一依据**
 * （`.cn` / `.com` 都用它），一旦分段漂移，前端会把「较差」渲染成「优秀」。
 * 而它是纯函数，最容易用表驱动穷举边界 —— 放这里跑得快、失败点也最清楚。
 *
 * 分段契约（与 image-analyzer.ts#scoreToConditionCode 以及 prompt 里的评估标准一致）：
 *   9-10 → excellent   （≥9）
 *   7-8  → good        （≥7）
 *   5-6  → fair        （≥5）
 *   ≤4   → poor
 */
import { describe, it, expect } from "vitest";

import {
  CONDITION_CODES,
  conditionCodeLabelText,
  normalizeConditionCode,
  scoreToConditionCode,
  type ConditionCode,
} from "../image-analyzer";

describe("scoreToConditionCode：1-10 分 → 4 个英文枚举", () => {
  it.each([
    [10, "excellent"],
    [9, "excellent"],
    [8, "good"],
    [7, "good"],
    [6, "fair"],
    [5, "fair"],
    [4, "poor"],
    [1, "poor"],
    [0, "poor"],
    [11, "excellent"],
    [-1, "poor"],
  ] as Array<[number, ConditionCode]>)("%s 分 → %s", (score, expected) => {
    expect(scoreToConditionCode(score)).toBe(expected);
  });

  it("小数按区间落档（7.9 仍是 good，8.9 仍是 good，9.0 才升 excellent）", () => {
    expect(scoreToConditionCode(9.0)).toBe("excellent");
    expect(scoreToConditionCode(8.9)).toBe("good");
    expect(scoreToConditionCode(7.9)).toBe("good");
    expect(scoreToConditionCode(6.5)).toBe("fair");
    expect(scoreToConditionCode(4.9)).toBe("poor");
  });

  it("非法输入（NaN / Infinity）兜底为 fair，绝不抛异常", () => {
    expect(scoreToConditionCode(Number.NaN)).toBe("fair");
    expect(scoreToConditionCode(Number.POSITIVE_INFINITY)).toBe("fair");
    expect(scoreToConditionCode(Number.NEGATIVE_INFINITY)).toBe("fair");
    // 运行时可能是字符串/undefined（模型乱写），同样不能抛
    expect(scoreToConditionCode("8" as unknown as number)).toBe("good");
    expect(scoreToConditionCode(undefined as unknown as number)).toBe("fair");
  });

  it("穷举 -5..15 的整数与 0..10 的 0.5 步长：返回值只可能是那 4 个英文枚举", () => {
    const scores: number[] = [
      ...Array.from({ length: 21 }, (_, i) => i - 5),
      ...Array.from({ length: 21 }, (_, i) => i * 0.5),
    ];
    for (const score of scores) {
      const code = scoreToConditionCode(score);
      expect(CONDITION_CODES).toContain(code);
    }
  });

  it("单调性：分数越高，档位不下降", () => {
    const rank: Record<ConditionCode, number> = { poor: 0, fair: 1, good: 2, excellent: 3 };
    let previous = -1;
    for (let score = -2; score <= 13; score += 0.5) {
      const current = rank[scoreToConditionCode(score)];
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe("normalizeConditionCode：模型输出的兜底", () => {
  it("合法英文枚举原样通过（大小写/空白容错）", () => {
    expect(normalizeConditionCode("excellent", 5)).toBe("excellent");
    expect(normalizeConditionCode("  GOOD ", 5)).toBe("good");
    expect(normalizeConditionCode("Fair", 5)).toBe("fair");
    expect(normalizeConditionCode("poor", 9)).toBe("poor");
  });

  it("中文标签（旧 prompt 的 conditionLabel 写法）也能识别", () => {
    expect(normalizeConditionCode("优秀", 5)).toBe("excellent");
    expect(normalizeConditionCode("良好", 5)).toBe("good");
    expect(normalizeConditionCode("一般", 9)).toBe("fair");
    expect(normalizeConditionCode("较差", 9)).toBe("poor");
  });

  it("非法值一律按评分兜底，绝不透传未知字符串", () => {
    expect(normalizeConditionCode("TERRIBLE", 3)).toBe("poor");
    expect(normalizeConditionCode("", 8)).toBe("good");
    expect(normalizeConditionCode(null, 6)).toBe("fair");
    expect(normalizeConditionCode(42, 10)).toBe("excellent");
    expect(normalizeConditionCode(undefined, Number.NaN)).toBe("fair");
  });

  it("结果始终落在 4 个英文枚举内", () => {
    for (const raw of ["excellent", "良好", "???", null, 3, {}, ["good"]]) {
      expect(CONDITION_CODES).toContain(normalizeConditionCode(raw, 5));
    }
  });
});

describe("conditionCodeLabelText：8 语种本地化文案", () => {
  it("中文/英文文案正确", () => {
    expect(conditionCodeLabelText("excellent", "zh")).toBe("优秀");
    expect(conditionCodeLabelText("good", "zh")).toBe("良好");
    expect(conditionCodeLabelText("fair", "zh")).toBe("一般");
    expect(conditionCodeLabelText("poor", "zh")).toBe("较差");
    expect(conditionCodeLabelText("good", "en")).toBe("Good");
  });

  it("8 语种 × 4 枚举都有非空文案", () => {
    const locales = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"] as const;
    for (const locale of locales) {
      for (const code of CONDITION_CODES) {
        const value = conditionCodeLabelText(code, locale);
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("非法 code 兜底 fair，未知语种回落英文（绝不返回 undefined）", () => {
    expect(conditionCodeLabelText("weird" as ConditionCode, "zh")).toBe("一般");
    expect(conditionCodeLabelText(null, "zh")).toBe("一般");
    expect(conditionCodeLabelText("good", "ko" as never)).toBe("Good");
  });
});
