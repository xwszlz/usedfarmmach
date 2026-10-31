/**
 * `/api/agents/seller-helper/recognize` —— `data.workingHours` 的「空 vs 零」回归用例
 *
 * 被锁死的 Bug（2026-10-31，origin/main 409ba5b 之前）：
 *
 *   workingHours: recognized.workingHours || null
 *
 * 视觉识别对「全新机 / 刚试机」的机器会读出 0 小时（仪表盘读数就是 0），而 `0` 在 JS 里是
 * falsy ⇒ 走 `: null` 分支，响应里变成 null ⇒ 前端回填空 ⇒ 一路 null 进库。
 * 结果就是：**越新的机器，工时字段越会被抹掉**，而这恰恰是最该写 0 的场景。
 *
 * 本文件从 POST 入口打进去（不用单独导出内部函数），锁的是**响应体的真实取值**，
 * 覆盖链路里的三层：模型返回 → parseAIResponse → buildSuccessResponse。
 *
 * 修法：`toNullableWorkingHours()`，口径与 `PUT /api/seller/products/[id]`、
 * `/api/internal/products` 的 `finalWorkingHours` 一致：空 → null，有限数字 → 数字（含 0），
 * 非法数字（"abc" / NaN / Infinity）→ null。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { chatMock, deductMock } = vi.hoisted(() => ({
  chatMock: vi.fn(),
  deductMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: async () => ({ id: "user-1", country: "CN" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: { findMany: async () => [] },
    category: { findMany: async () => [] },
  },
}));

// ⚠️ 这里**故意不 mock** `@/lib/ai/multimodal`：
//    路由的图片/视频消息体现在完全复用该共享模块，而共享 `buildDoubaoContent` 对
//    `data:` 开头的输入是原样透传（不发起任何下载）⇒ 本用例全程走真实实现，
//    顺带覆盖「路由 → 共享 buildDoubaoContent」这条接线。
//    若将来本用例改用 http(s) 图片 URL，必须先 mock `@/lib/net/download-image`
//    （`downloadGuardedImage`），否则测试会真的出网。

vi.mock("@/lib/ai/ark-client", () => ({
  chatCompletionDoubao: chatMock,
  getArkModelId: () => "test-model",
}));

vi.mock("@/lib/credits/usage-collector", () => ({
  recordUsage: () => {},
  drainUsage: () => [],
  ESTIMATED_TOKENS: { input: 100, output: 100 },
}));

vi.mock("@/lib/credits/spend", () => ({
  computeAiCost: () => ({ points: 0 }),
  deductCredits: deductMock,
}));

vi.mock("@/lib/agents/seller-helper/resolve-brand", () => ({
  resolveBrand: async () => ({ matched: false, brandId: null, displayName: null }),
}));

vi.mock("@/lib/agents/seller-helper/resolve-category", () => ({
  resolveCategory: async () => ({ matched: false, categoryId: null, displayName: null }),
  getCategorySynonymPrompt: () => "",
}));

import { POST } from "../route";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+7g0AAAAASUVORK5CYII=";

/** 让模型「返回」一段识别 JSON，然后调一次 POST，取响应体里的 data */
async function recognizeWith(payloadFromModel: Record<string, unknown>) {
  chatMock.mockResolvedValue({ text: JSON.stringify(payloadFromModel) });
  const req = new NextRequest("http://localhost/api/agents/seller-helper/recognize", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-token" },
    body: JSON.stringify({ imageDataUris: [TINY_PNG] }),
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.data as Record<string, unknown>;
}

beforeEach(() => {
  chatMock.mockReset();
  deductMock.mockReset();
  deductMock.mockResolvedValue({ ok: true, required: 0, credits: 999 });
});

describe("data.workingHours：0 必须保留（核心回归）", () => {
  it("模型返回数字 0（全新机）⇒ 响应里是 0，不是 null", async () => {
    const data = await recognizeWith({ brand: "John Deere", modelName: "6M", workingHours: 0 });
    expect(data.workingHours).toBe(0);
    expect(data.workingHours).not.toBeNull();
    expect(typeof data.workingHours).toBe("number");
  });

  it("模型返回字符串 \"0\" ⇒ 响应里是数字 0", async () => {
    const data = await recognizeWith({ brand: "John Deere", modelName: "6M", workingHours: "0" });
    expect(data.workingHours).toBe(0);
    expect(typeof data.workingHours).toBe("number");
  });

  it("模型返回 3200 ⇒ 3200", async () => {
    const data = await recognizeWith({ brand: "John Deere", modelName: "6M", workingHours: 3200 });
    expect(data.workingHours).toBe(3200);
  });

  it("模型没给该字段 ⇒ null", async () => {
    const data = await recognizeWith({ brand: "John Deere", modelName: "6M" });
    expect(data.workingHours).toBeNull();
  });

  it("模型返回空串 \"\" ⇒ null", async () => {
    const data = await recognizeWith({ brand: "John Deere", modelName: "6M", workingHours: "" });
    expect(data.workingHours).toBeNull();
  });

  it("模型返回 \"abc\" ⇒ null（不把 NaN 透给前端）", async () => {
    const data = await recognizeWith({ brand: "John Deere", modelName: "6M", workingHours: "abc" });
    expect(data.workingHours).toBeNull();
    expect(Number.isNaN(data.workingHours)).toBe(false);
  });

  it("模型返回 \"Infinity\" ⇒ null", async () => {
    const data = await recognizeWith({ brand: "John Deere", modelName: "6M", workingHours: "Infinity" });
    expect(data.workingHours).toBeNull();
  });
});
