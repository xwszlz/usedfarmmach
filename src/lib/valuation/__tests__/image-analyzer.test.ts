/**
 * image-analyzer.ts 单元测试（vitest 版）
 *
 * 历史：本文件原先是「console.log + 自定义 assert」脚本，且降级用例依赖真实 axios
 * 网络失败 —— 在 vitest 下会挂住整个 run（无 test suite + 真实网络请求）。
 * 2026-11 改为标准 vitest：原有断言逐条保留，网络全部 mock（axios / fetch），
 * 并补上本次新增的 `perImage` 逐图明细与 `conditionCode` 英文枚举用例。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ark-client 内部 `import axios from "axios"` 后调 axios.post —— 只替换这一层
vi.mock("axios", () => ({ default: { post: vi.fn() } }));

// 图片下载现在要过 SSRF 守卫：守卫会解析主机名判内网段。
// 这里固定返回公网地址，保证测试**不依赖真实 DNS/网络**（否则内网构建机/离线环境会红）。
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import axios from "axios";

import {
  analyzeProductImage,
  analyzeProductImages,
  CONDITION_CODES,
  MAX_ANALYZE_IMAGES,
  visualScoreToConditionFactor,
} from "../image-analyzer";

const postMock = vi.mocked(axios.post);

/** 构造一次豆包视觉成功响应（OpenAI 兼容） */
function llmResponse(payload: Record<string, unknown>) {
  return {
    data: {
      choices: [{ message: { content: JSON.stringify(payload) } }],
      usage: { prompt_tokens: 1200, completion_tokens: 180 },
    },
  };
}

/** 从 mock 调用里取出 prompt 正文 */
function promptOf(callIndex = 0): string {
  const body = postMock.mock.calls[callIndex][1] as {
    messages: Array<{ content: Array<{ type: string; text?: string }> }>;
  };
  return body.messages[0].content.find((c) => c.type === "text")?.text ?? "";
}

beforeEach(() => {
  postMock.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => Buffer.from("fake-image-bytes"),
      headers: { get: () => "image/jpeg" },
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("visualScoreToConditionFactor 映射（既有断言，逐条保留）", () => {
  it.each([
    [9, 1.05],
    [10, 1.05],
    [8, 1.0],
    [7, 0.98],
    [6, 0.95],
    [5, 0.9],
    [4, 0.85],
    [3, 0.78],
    [1, 0.7],
    [2, 0.7],
    [0, 0.7],
    [11, 1.05],
  ])("%s 分 → %s", (score, expected) => {
    expect(Math.abs(visualScoreToConditionFactor(score) - expected)).toBeLessThan(0.001);
  });
});

describe("无图片输入", () => {
  it("返回全 0 + 空 perImage，且不调用模型", async () => {
    const result = await analyzeProductImages([]);
    expect(result.visualConditionScore).toBe(0);
    expect(result.usedV4Condition).toBe(false);
    expect(result.imageConfidence).toBe(0);
    expect(result.perImage).toEqual([]);
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe("正常路径（豆包视觉返回结构化 JSON）", () => {
  it("评分/置信度/conditionCode 正确解析", async () => {
    postMock.mockResolvedValue(
      llmResponse({
        conditionScore: 8,
        conditionCode: "good",
        conditionLabel: "良好",
        analysis: "设备外观良好，有轻微使用痕迹",
        confidence: 0.85,
      }) as never
    );

    const result = await analyzeProductImages(["https://example.com/test.jpg"]);
    expect(result.visualConditionScore).toBe(8);
    expect(result.usedV4Condition).toBe(true);
    expect(Math.abs(result.imageConfidence - 0.85)).toBeLessThan(0.001);
    expect(result.conditionCode).toBe("good");
    expect(result.perImage).toHaveLength(1);
    expect(result.perImage![0]).toEqual({
      score: 8,
      label: "good",
      analysis: "设备外观良好，有轻微使用痕迹",
      confidence: 0.85,
    });
  });

  it("conditionLabel（中文，向后兼容字段）保持原样不被改写", async () => {
    postMock.mockResolvedValue(
      llmResponse({
        conditionScore: 6,
        conditionCode: "fair",
        conditionLabel: "一般",
        analysis: "x",
        confidence: 0.6,
      }) as never
    );
    const single = await analyzeProductImage("https://example.com/a.jpg");
    expect(single.conditionLabel).toBe("一般");
    expect(single.conditionCode).toBe("fair");
  });
});

describe("perImage 逐图明细（本次新增：过去只留加权最高那张的 analysis）", () => {
  it("3 张图 → perImage 长度 3，顺序与入参一致，每项含 score/label/analysis/confidence", async () => {
    postMock
      .mockResolvedValueOnce(
        llmResponse({
          conditionScore: 9,
          conditionCode: "excellent",
          conditionLabel: "优秀",
          analysis: "接近全新",
          confidence: 0.9,
        }) as never
      )
      .mockResolvedValueOnce(
        llmResponse({
          conditionScore: 6,
          conditionCode: "fair",
          conditionLabel: "一般",
          analysis: "轻度锈蚀",
          confidence: 0.7,
        }) as never
      )
      .mockResolvedValueOnce(
        llmResponse({
          conditionScore: 4,
          conditionCode: "poor",
          conditionLabel: "较差",
          analysis: "轮胎磨损严重",
          confidence: 0.8,
        }) as never
      );

    const urls = ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"];
    const result = await analyzeProductImages(urls);

    expect(result.perImage).toHaveLength(urls.length);
    expect(result.perImage!.map((item) => item.score)).toEqual([9, 6, 4]);
    expect(result.perImage!.map((item) => item.label)).toEqual(["excellent", "fair", "poor"]);
    expect(result.perImage!.map((item) => item.analysis)).toEqual(["接近全新", "轻度锈蚀", "轮胎磨损严重"]);
    for (const item of result.perImage!) {
      expect(typeof item.score).toBe("number");
      expect(CONDITION_CODES).toContain(item.label);
      expect(typeof item.analysis).toBe("string");
      expect(typeof item.confidence).toBe("number");
    }
    // 聚合语义不变：平均分四舍五入到 1 位；analysis 仍是加权最高那张
    expect(result.visualConditionScore).toBe(6.3);
    expect(result.visualConditionAnalysis).toBe("接近全新");
  });

  it("传 5 张 → 实际发出 5 次视觉调用，perImage 长度 5（对齐前端 MAX_IMAGES=5）", async () => {
    postMock.mockResolvedValue(
      llmResponse({
        conditionScore: 7,
        conditionCode: "good",
        conditionLabel: "良好",
        analysis: "ok",
        confidence: 0.8,
      }) as never
    );
    const urls = Array.from({ length: 5 }, (_, i) => `https://example.com/${i + 1}.jpg`);
    const result = await analyzeProductImages(urls);
    expect(postMock).toHaveBeenCalledTimes(5);
    expect(result.perImage).toHaveLength(5);
    // 每张图都是独立一次调用（独立计费），不是把 5 张塞进一次请求
    for (let i = 0; i < 5; i += 1) {
      const body = postMock.mock.calls[i][1] as {
        messages: Array<{ content: Array<{ type: string }> }>;
      };
      expect(body.messages[0].content.filter((c) => c.type === "image_url")).toHaveLength(1);
    }
  });

  it("传 7 张 → 只取前 5 张（成本上限，第 6/7 张不扣费）", async () => {
    // fetch 把 URL 本身当图片字节返回，便于从 base64 反解出「这一枪打的是哪张图」
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        arrayBuffer: async () => Buffer.from(String(url)),
        headers: { get: () => "image/jpeg" },
      }))
    );
    postMock.mockResolvedValue(
      llmResponse({
        conditionScore: 7,
        conditionCode: "good",
        conditionLabel: "良好",
        analysis: "ok",
        confidence: 0.8,
      }) as never
    );
    const urls = Array.from({ length: 7 }, (_, i) => `https://example.com/${i + 1}.jpg`);
    const result = await analyzeProductImages(urls);
    expect(postMock).toHaveBeenCalledTimes(5);
    expect(result.perImage).toHaveLength(5);

    // 从 base64 还原每枪对应的原始 URL，确认是「前 5 张、顺序不变」
    const decoded = postMock.mock.calls.map((call) => {
      const body = call[1] as {
        messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>;
      };
      const image = body.messages[0].content.find((c) => c.type === "image_url");
      const dataUrl = image?.image_url?.url ?? "";
      const base64 = dataUrl.split(",")[1] ?? "";
      return Buffer.from(base64, "base64").toString();
    });
    expect(decoded).toHaveLength(5);
    for (let i = 0; i < 5; i += 1) {
      expect(decoded).toContain(`https://example.com/${i + 1}.jpg`);
    }
    expect(decoded.some((url) => url.includes("/6.jpg"))).toBe(false);
    expect(decoded.some((url) => url.includes("/7.jpg"))).toBe(false);
  });

  it("MAX_ANALYZE_IMAGES 就是 5（前端 MAX_IMAGES 的同源常量，防止两边再次漂移）", () => {
    expect(MAX_ANALYZE_IMAGES).toBe(5);
  });

  it("data URI 直接透传，不额外 fetch（国产渠道零收费回归点）", async () => {
    const fetched: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        fetched.push(url);
        return { ok: true, arrayBuffer: async () => Buffer.from("x"), headers: { get: () => "image/jpeg" } };
      })
    );
    postMock.mockResolvedValue(
      llmResponse({
        conditionScore: 8,
        conditionCode: "good",
        conditionLabel: "良好",
        analysis: "ok",
        confidence: 0.8,
      }) as never
    );

    await analyzeProductImages(["data:image/jpeg;base64,AAAA"]);
    expect(fetched).toEqual([]);
    expect(postMock).toHaveBeenCalledTimes(1);
    // 图片真的被放进了视觉请求体
    const body = postMock.mock.calls[0][1] as { messages: Array<{ content: Array<{ type: string }> }> };
    expect(body.messages[0].content.some((c) => c.type === "image_url")).toBe(true);
  });
});

describe("conditionCode 只能是 4 个英文枚举之一（非法值兜底）", () => {
  it.each([
    ["模型给了合法英文", "excellent", 9, "excellent"],
    ["大小写混杂", " GOOD ", 7, "good"],
    ["模型给了中文标签", "优秀", 9, "excellent"],
    ["模型给了非法词", "TERRIBLE", 3, "poor"],
    ["模型没给", undefined, 8, "good"],
    ["模型给了数字", 7, 7, "good"],
  ])("%s → %s", async (_title, rawCode, score, expected) => {
    postMock.mockResolvedValue(
      llmResponse({
        conditionScore: score,
        conditionCode: rawCode,
        conditionLabel: "x",
        analysis: "x",
        confidence: 0.8,
      }) as never
    );
    const result = await analyzeProductImage("https://example.com/a.jpg");
    expect(result.conditionCode).toBe(expected);
    expect(CONDITION_CODES).toContain(result.conditionCode);
  });
});

describe("降级逻辑（视觉模型不可用）", () => {
  it("axios 报错 → 默认成色 5 分 / usedV4Condition=false / conditionCode=fair", async () => {
    postMock.mockRejectedValue(new Error("ECONNREFUSED") as never);
    const result = await analyzeProductImages(["https://example.com/test.jpg"]);
    expect(result.visualConditionScore).toBe(5);
    expect(result.usedV4Condition).toBe(false);
    expect(result.conditionCode).toBe("fair");
    expect(result.perImage).toHaveLength(1);
    expect(result.perImage![0].label).toBe("fair");
  });

  it("模型返回无法解析的文本 → 该图降级为默认分，不抛异常", async () => {
    postMock.mockResolvedValue({
      data: { choices: [{ message: { content: "我觉得还行吧" } }], usage: { prompt_tokens: 10, completion_tokens: 5 } },
    } as never);
    const result = await analyzeProductImages(["https://example.com/test.jpg"]);
    expect(result.visualConditionScore).toBe(5);
    expect(result.usedV4Condition).toBe(false);
  });
});

describe("prompt 契约：conditionCode 字段 + 语言指令", () => {
  it("prompt 里写明 conditionCode 四个英文枚举", async () => {
    postMock.mockResolvedValue(
      llmResponse({
        conditionScore: 7,
        conditionCode: "good",
        conditionLabel: "良好",
        analysis: "ok",
        confidence: 0.8,
      }) as never
    );
    await analyzeProductImage("https://example.com/a.jpg", "en");
    const promptText = promptOf();
    expect(promptText).toContain("conditionCode");
    expect(promptText).toContain("excellent / good / fair / poor");
  });

  it("locale 决定语言指令（ru → Русский，且要求枚举不翻译）", async () => {
    postMock.mockResolvedValue(
      llmResponse({
        conditionScore: 7,
        conditionCode: "good",
        conditionLabel: "良好",
        analysis: "ok",
        confidence: 0.8,
      }) as never
    );
    await analyzeProductImage("https://example.com/a.jpg", "ru");
    const promptText = promptOf();
    expect(promptText).toContain("Русский");
    expect(promptText).toContain("OUTPUT LANGUAGE");
  });

  it("默认 locale=zh 同样注入简体中文指令（8 语种不搞特例）", async () => {
    postMock.mockResolvedValue(
      llmResponse({
        conditionScore: 7,
        conditionCode: "good",
        conditionLabel: "良好",
        analysis: "ok",
        confidence: 0.8,
      }) as never
    );
    await analyzeProductImage("https://example.com/a.jpg");
    expect(promptOf()).toContain("简体中文");
  });
});
