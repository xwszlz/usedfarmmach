/**
 * `@/lib/valuation/video-analyzer` —— 视频因子「降级必须中性」回归用例
 *
 * 被锁死的 Bug（2026-11，origin/main ef680d4 之前）：
 *
 *   降级默认值 = { hasVideo: true, qualityScore: 0.3, engineSoundStatus: "no_sound",
 *                  mechanismSmoothness: "smooth", overallImpression: "good" }
 *   代入 calculateVideoFactor 的打分表：smooth ⇒ +0.02，其余均 0
 *   ⇒ videoFactor = 1.02
 *
 * 也就是说：**视频分析失败（模型挂了 / 超时 / 返回乱码）反而给估值加价 2%**。
 * 赔率方向错了 —— 越没看清，车越贵。
 *
 * 修法：`VideoAnalysisResult.degraded` 显式标记降级，`calculateVideoFactor` 首行短路返回 1.0。
 * 本文件同时守住"正向能力没修坏"：真的分析成功时该加分照加。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { chatMock } = vi.hoisted(() => ({ chatMock: vi.fn() }));

vi.mock("@/lib/ai/ark-client", () => ({
  chatCompletionDoubao: chatMock,
  getArkVideoModelId: () => "test-video-model",
}));

vi.mock("@/lib/credits/usage-collector", () => ({
  recordUsage: () => {},
  drainUsage: () => [],
  ESTIMATED_TOKENS: { input: 100, output: 100 },
}));

import { analyzeVideo, calculateVideoFactor, type VideoAnalysisResult } from "../video-analyzer";

/** 降级默认结果（与 getDefaultAnalysis 同形），`degraded` 必须为 true */
const DEGRADED: VideoAnalysisResult = {
  hasVideo: true,
  degraded: true,
  qualityScore: 0.3,
  engineSoundStatus: "no_sound",
  mechanismSmoothness: "smooth",
  overallImpression: "good",
  analysis: "视频分析服务暂不可用，使用基准估值",
  confidence: 0.2,
};

/** 一份"真的分析成功"的优良结果，用于确认正向加分未被误伤 */
const HEALTHY: VideoAnalysisResult = {
  hasVideo: true,
  qualityScore: 0.9,
  engineSoundStatus: "normal",
  mechanismSmoothness: "smooth",
  overallImpression: "excellent",
  analysis: "发动机运转平稳，割台动作流畅",
  confidence: 0.85,
};

beforeEach(() => {
  chatMock.mockReset();
});

describe("calculateVideoFactor：降级必须中性（核心回归）", () => {
  it("degraded 结果 ⇒ 因子恰好 1.0（不得加价）", () => {
    expect(calculateVideoFactor(DEGRADED)).toBe(1.0);
  });

  it("降级字段即便被人改成「看起来很好」的取值，只要 degraded 仍恒为 1.0", () => {
    // 锁的是"不依赖因子表数值"这件事：谁把 smooth/good 的分值调大都不会重新开始偷偷加价
    const tampered: VideoAnalysisResult = {
      ...DEGRADED,
      qualityScore: 0.95,
      engineSoundStatus: "normal",
      mechanismSmoothness: "smooth",
      overallImpression: "excellent",
    };
    expect(calculateVideoFactor(tampered)).toBe(1.0);
  });

  it("无视频 ⇒ 1.0（不含 degraded 字段也不行，走 hasVideo 短路）", () => {
    expect(calculateVideoFactor({ ...HEALTHY, hasVideo: false })).toBe(1.0);
  });

  it("健康结果 ⇒ 因子 > 1.0（正向能力未被修坏）", () => {
    // 0.9 ≥ 0.85 ⇒ +0.02 +0.01；normal ⇒ +0.03；smooth ⇒ +0.02；excellent ⇒ +0.02 = 1.10 → 夹到 1.08
    expect(calculateVideoFactor(HEALTHY)).toBe(1.08);
  });

  it("明显缺陷结果 ⇒ 因子 < 1.0（扣价方向仍然有效）", () => {
    const bad: VideoAnalysisResult = {
      hasVideo: true,
      qualityScore: 0.7,
      engineSoundStatus: "abnormal_smoke",
      mechanismSmoothness: "jammed",
      overallImpression: "poor",
      analysis: "冒黑烟，割台卡顿",
      confidence: 0.8,
    };
    // 1.0 + 0.02(质量≥0.6) - 0.08(冒烟) - 0.06(卡顿) - 0.04(poor) = 0.84 → 夹到 0.92
    expect(calculateVideoFactor(bad)).toBe(0.92);
  });
});

describe("analyzeVideo：失败/不可解析都走中性降级", () => {
  it("模型调用抛错 ⇒ degraded=true 且因子 1.0", async () => {
    chatMock.mockRejectedValue(new Error("upstream 500"));
    const result = await analyzeVideo("https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/demo.mp4");
    expect(result.degraded).toBe(true);
    expect(calculateVideoFactor(result)).toBe(1.0);
  });

  it("模型回了纯文本（解析不出任何维度）⇒ degraded=true 且因子 1.0", async () => {
    chatMock.mockResolvedValue({ text: "抱歉，我无法分析这段视频。" });
    const result = await analyzeVideo("https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/demo.mp4");
    expect(result.degraded).toBe(true);
    expect(calculateVideoFactor(result)).toBe(1.0);
  });

  it("模型回了空对象 {} ⇒ degraded=true 且因子 1.0", async () => {
    chatMock.mockResolvedValue({ text: "{}" });
    const result = await analyzeVideo("https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/demo.mp4");
    expect(result.degraded).toBe(true);
    expect(calculateVideoFactor(result)).toBe(1.0);
  });

  it("模型正常返回 ⇒ 不是降级，且因子按实际维度计算", async () => {
    chatMock.mockResolvedValue({
      text: JSON.stringify({
        qualityScore: 0.9,
        engineSoundStatus: "normal",
        mechanismSmoothness: "smooth",
        overallImpression: "excellent",
        analysis: "运转平稳",
        confidence: 0.9,
      }),
    });
    const result = await analyzeVideo("https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/demo.mp4");
    expect(result.degraded).toBeUndefined();
    expect(calculateVideoFactor(result)).toBe(1.08);
  });
});
