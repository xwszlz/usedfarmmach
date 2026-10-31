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

import { analyzeVideo, analyzeVideos, calculateVideoFactor, type VideoAnalysisResult } from "../video-analyzer";

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

// ─────────────────────────────────────────────────────────────
// analyzeVideos：多视频并行 + 异常优先聚合
// ─────────────────────────────────────────────────────────────

const VIDEO_URLS = [
  "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/v1.mp4",
  "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/v2.mp4",
  "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/v3.mp4",
];

/** 构造一次"模型正常返回"的 content 文本，用 overrides 指定该条视频的维度 */
function videoJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    qualityScore: 0.7,
    engineSoundStatus: "no_sound",
    mechanismSmoothness: "smooth",
    overallImpression: "good",
    analysis: "画面可辨，机器静止",
    confidence: 0.6,
    ...overrides,
  });
}

/** 按顺序为 N 条视频各排一个模型返回值（analyzeVideos 内部按 url 顺序并发发起） */
function queueModelResponses(texts: string[]): void {
  for (const text of texts) {
    chatMock.mockResolvedValueOnce({ text });
  }
}

describe("analyzeVideos：并行 + 异常优先聚合", () => {
  it("3 条视频是【并行】发起（并发度 3，不是串行）", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    chatMock.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // 留出真实的"调用在途"窗口：串行实现下并发度永远是 1
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return { text: videoJson() };
    });

    await analyzeVideos(VIDEO_URLS);
    expect(chatMock).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(3);
  });

  it("3 条中 1 条 jammed ⇒ 聚合为 jammed（异常优先）", async () => {
    queueModelResponses([
      videoJson({ mechanismSmoothness: "smooth" }),
      videoJson({ mechanismSmoothness: "jammed", analysis: "割台卡死，无法完成动作" }),
      videoJson({ mechanismSmoothness: "smooth" }),
    ]);

    const result = await analyzeVideos(VIDEO_URLS);
    expect(result.mechanismSmoothness).toBe("jammed");
    expect(result.degraded).toBe(false);
  });

  it("1 条 abnormal_smoke 混在 2 条 normal 里 ⇒ 聚合为 abnormal_smoke", async () => {
    queueModelResponses([
      videoJson({ engineSoundStatus: "normal" }),
      videoJson({ engineSoundStatus: "abnormal_smoke", analysis: "排气管冒黑烟" }),
      videoJson({ engineSoundStatus: "normal" }),
    ]);

    const result = await analyzeVideos(VIDEO_URLS);
    expect(result.engineSoundStatus).toBe("abnormal_smoke");
  });

  it("overallImpression 同样取最坏（poor > fair > good > excellent）", async () => {
    queueModelResponses([
      videoJson({ overallImpression: "excellent" }),
      videoJson({ overallImpression: "fair" }),
      videoJson({ overallImpression: "excellent" }),
    ]);

    const result = await analyzeVideos(VIDEO_URLS);
    expect(result.overallImpression).toBe("fair");
  });

  it("全部失败/降级 ⇒ degraded=true 且因子 1.0（中性，不加价）", async () => {
    chatMock.mockRejectedValue(new Error("upstream 500"));

    const result = await analyzeVideos(VIDEO_URLS);
    expect(result.degraded).toBe(true);
    expect(calculateVideoFactor(result)).toBe(1.0);
  });

  it("部分降级不影响其余：1 条失败 + 2 条正常 ⇒ 用正常的那两条聚合", async () => {
    chatMock.mockReset();
    chatMock
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ text: videoJson({ mechanismSmoothness: "sluggish" }) })
      .mockResolvedValueOnce({ text: videoJson({ mechanismSmoothness: "smooth" }) });

    const result = await analyzeVideos(VIDEO_URLS);
    expect(result.degraded).toBe(false);
    expect(result.mechanismSmoothness).toBe("sluggish");
  });

  it("qualityScore / confidence 取最大值（衡量画面清晰度，不是机器好坏）", async () => {
    queueModelResponses([
      videoJson({ qualityScore: 0.62, confidence: 0.55 }),
      videoJson({ qualityScore: 0.95, confidence: 0.9 }),
      videoJson({ qualityScore: 0.8, confidence: 0.7 }),
    ]);

    const result = await analyzeVideos(VIDEO_URLS);
    expect(result.qualityScore).toBeCloseTo(0.95, 5);
    expect(result.confidence).toBeCloseTo(0.9, 5);
  });

  it("analysis 逐条拼接并编号，单条超 200 字截断", async () => {
    const longText = "很长的分析".repeat(200); // 1000 字
    queueModelResponses([
      videoJson({ analysis: longText }),
      videoJson({ analysis: "第二条" }),
      videoJson({ analysis: "第三条" }),
    ]);

    const result = await analyzeVideos(VIDEO_URLS);
    const lines = result.analysis.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0].startsWith("视频1：")).toBe(true);
    expect(lines[1]).toBe("视频2：第二条");
    // 前缀「视频1：」+ 200 字 + 省略号「…」
    expect(lines[0].length).toBe("视频1：".length + 200 + 1);
    expect(lines[0].endsWith("…")).toBe(true);
  });

  it("超过上限只分析前 3 条（异常请求不会把墙钟拖穿）", async () => {
    chatMock.mockResolvedValue({ text: videoJson() });

    const result = await analyzeVideos([...VIDEO_URLS, `${VIDEO_URLS[0]}?x=4`, `${VIDEO_URLS[0]}?x=5`]);
    expect(chatMock).toHaveBeenCalledTimes(3);
    expect(result.hasVideo).toBe(true);
  });

  it("空数组 / 全空白 URL ⇒ 中性降级，一次模型都不调", async () => {
    const result = await analyzeVideos(["", "   "]);
    expect(chatMock).not.toHaveBeenCalled();
    expect(result.degraded).toBe(true);
    expect(calculateVideoFactor(result)).toBe(1.0);
  });
});

// ─────────────────────────────────────────────────────────────
// 自有域名白名单：视频 URL 会被交给**方舟服务端**去抓取
// ─────────────────────────────────────────────────────────────
describe("视频 URL 白名单（不把任意 URL 交给第三方模型抓取）", () => {
  it("[自有OSS视频, evil.com视频] ⇒ 只对自有那条发起调用，且不抛错", async () => {
    chatMock.mockResolvedValue({ text: videoJson() });
    const evil = "https://evil.example.com/x.mp4";

    await expect(analyzeVideos([VIDEO_URLS[0], evil])).resolves.toBeDefined();

    // 只发起了一次模型调用（恶意的那个连并发都不该起）
    expect(chatMock).toHaveBeenCalledTimes(1);
    const params = chatMock.mock.calls[0][0] as { messages: Array<{ content: Array<Record<string, any>> }> };
    const videoParts = params.messages[0].content.filter((part) => part.type === "video_url");
    expect(videoParts).toHaveLength(1);
    expect(videoParts[0].video_url.url).toBe(VIDEO_URLS[0]);
  });

  it("全部非自有 ⇒ 中性降级 + 零模型调用", async () => {
    const result = await analyzeVideos([
      "https://evil.example.com/a.mp4",
      `http://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/b.mp4`, // 同域但 http：也要拒
      `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com.evil.tld/c.mp4`, // 后缀域名攻击
    ]);
    expect(chatMock).not.toHaveBeenCalled();
    expect(result.degraded).toBe(true);
    expect(calculateVideoFactor(result)).toBe(1.0);
  });

  it("analyzeVideo 直接调非自有 URL ⇒ 零调用 + 中性降级（库层兜底，不依赖调用方先过滤）", async () => {
    const result = await analyzeVideo("https://evil.example.com/x.mp4");
    expect(chatMock).not.toHaveBeenCalled();
    expect(result.degraded).toBe(true);
    expect(calculateVideoFactor(result)).toBe(1.0);
  });

  it("自有 URL 仍然照常分析（不能因为加白名单把功能弄坏）", async () => {
    chatMock.mockResolvedValue({ text: videoJson({ engineSoundStatus: "normal" }) });
    const result = await analyzeVideo(VIDEO_URLS[0]);
    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(result.engineSoundStatus).toBe("normal");
    expect(result.degraded).toBeUndefined();
  });
});
