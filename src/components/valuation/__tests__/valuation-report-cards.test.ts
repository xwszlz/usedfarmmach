/**
 * 「AI 视觉成色 / 折旧拆解」两卡的纯函数守卫
 * ─────────────────────────────────────────────
 * 这两块卡的取数口径是本轮「AI 估值报告太简单」修复的一部分，锁死三件事：
 *
 *   ① `toPercentInt`：后端 imageConfidence 有时是 0~1（0.87）有时是百分比（87），
 *      渲染必须统一成整数百分比，否则会出现「置信度 0.87%」这种荒谬数字；
 *   ② `conditionLabelFromScore`：后端没给 labelText 时按 10 分制分段兜底
 *      （≥8 优秀 / ≥6 良好 / ≥4 一般 / <4 较差），中英双语都要对；
 *   ③ `scoreColor`：分段配色与报告内其他评分条一致（绿/橙/红），空值为中性灰。
 *
 * 运行：`npx vitest run src/components/valuation`
 */
import { describe, expect, it } from "vitest";
import {
  conditionLabelFromScore,
  scoreColor,
  toPercentInt,
} from "@/components/valuation/valuation-report-section";

describe("toPercentInt · 置信度口径归一", () => {
  it("0~1 小数按百分比放大并取整（后端 imageConfidence=0.87 → 87）", () => {
    expect(toPercentInt(0.87)).toBe(87);
    expect(toPercentInt(0.5)).toBe(50);
    expect(toPercentInt(1)).toBe(100);
  });

  it("已是百分比的值原样取整（87 → 87，87.4 → 87）", () => {
    expect(toPercentInt(87)).toBe(87);
    expect(toPercentInt(87.4)).toBe(87);
    expect(toPercentInt(99.6)).toBe(100);
  });

  it("缺失/非法值返回 null（前端据此隐藏置信度，不显示 NaN%）", () => {
    expect(toPercentInt(null)).toBeNull();
    expect(toPercentInt(undefined)).toBeNull();
    expect(toPercentInt(Number.NaN)).toBeNull();
  });
});

describe("conditionLabelFromScore · 10 分制成色分段", () => {
  it("中文分段：≥8 优秀 / ≥6 良好 / ≥4 一般 / <4 较差", () => {
    expect(conditionLabelFromScore(9, true)).toBe("优秀");
    expect(conditionLabelFromScore(8, true)).toBe("优秀");
    expect(conditionLabelFromScore(7.5, true)).toBe("良好");
    expect(conditionLabelFromScore(6, true)).toBe("良好");
    expect(conditionLabelFromScore(5, true)).toBe("一般");
    expect(conditionLabelFromScore(4, true)).toBe("一般");
    expect(conditionLabelFromScore(3, true)).toBe("较差");
    expect(conditionLabelFromScore(0, true)).toBe("较差");
  });

  it("英文分段：.com 站不出现中文", () => {
    expect(conditionLabelFromScore(8.5, false)).toBe("Excellent");
    expect(conditionLabelFromScore(6, false)).toBe("Good");
    expect(conditionLabelFromScore(4, false)).toBe("Fair");
    expect(conditionLabelFromScore(2, false)).toBe("Poor");
  });

  it("没有视觉评分时显示「未评估」，不能凭空捏一个分数", () => {
    expect(conditionLabelFromScore(null, true)).toBe("未评估");
    expect(conditionLabelFromScore(null, false)).toBe("Not assessed");
  });
});

describe("scoreColor · 评分色板", () => {
  it("高分绿 / 中分橙 / 低分红 / 空值灰（与报告内六维评分条同一色板）", () => {
    expect(scoreColor(8)).toBe("#10b981");
    expect(scoreColor(6)).toBe("#f59e0b");
    expect(scoreColor(5.9)).toBe("#ef4444");
    expect(scoreColor(null)).toBe("#9ca3af");
  });
});
