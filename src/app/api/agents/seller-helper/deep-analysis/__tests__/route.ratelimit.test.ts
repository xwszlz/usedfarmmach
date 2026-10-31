/**
 * 深度分析限流 —— **用真实 `@/lib/rate-limit` 模块**（不 mock）
 *
 * 为什么单开一个文件：`rateLimit` 的计数是**进程级状态**，如果把真模块放进
 * `route.test.ts`，前面十几个用例会把配额吃光、后面的用例全部 429（假红）。
 * 所以：`route.test.ts` 把限流 mock 成永远放行，**真实行为集中在本文件验**。
 *
 * 本文件锁定三个契约：
 *   ① 上限内放行（3 次 / 10 分钟，按 userId）
 *   ② 第 4 次返回 429 `RATE_LIMITED` + `Retry-After` 头
 *   ③ 被限流的那一次**不得调用模型**（限流也必须在花钱之前）
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  calls: [] as Array<{ messages: Array<{ role: string; content: unknown }> }>,
}));

vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: () => "fake-token",
  verifyToken: () => ({ userId: "rl-user-1" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: async () => ({ credits: 1_000_000 }) } },
}));

vi.mock("@/lib/credits/spend", () => ({
  computeAiCost: () => ({ points: 12, model: "doubao-seed-2-1-pro" }),
  deductCredits: async (_userId: string, points: number) => ({
    ok: true,
    credits: 988,
    required: points,
  }),
}));

vi.mock("@/lib/credits/fx", () => ({
  getBillingCountry: async () => "CN",
  getLocaleOfCountry: () => null,
}));

vi.mock("@/lib/ai/ark-client", () => ({
  getArkModelId: () => "doubao-seed-2-1-pro",
  chatCompletionDoubao: async (params: { messages: Array<{ role: string; content: unknown }> }) => {
    state.calls.push({ messages: params.messages });
    return {
      text:
        "## 设备识别\n- 品牌 John Deere\n- 具体型号 8R 410\n\n" +
        "## 技术参数解读\n额定马力 410 HP，排量 9.0 L，六缸发动机，四驱，液压流量 120 L/min。",
      finishReason: "stop",
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    };
  },
}));

vi.mock("@/config/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/site")>();
  return { ...actual, isCnSite: () => false, isComSite: () => true };
});

const DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

function makeRequest(body: Record<string, unknown>): NextRequest {
  const h = new Headers();
  return { headers: h, json: async () => body } as unknown as NextRequest;
}

async function post(): Promise<Response> {
  const { POST } = await import("../route");
  return POST(makeRequest({ imageDataUris: [DATA_URI], locale: "zh" }));
}

beforeEach(() => {
  state.calls = [];
});

describe("限流（真实 @/lib/rate-limit）", () => {
  it("3 次放行、第 4 次 429 RATE_LIMITED，且被拒那一次不调用模型", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await post();
      statuses.push(res.status);
    }

    const denied = await post();
    const body: any = await denied.json();

    console.log(
      "\n===RATELIMIT-RESULT===" +
        JSON.stringify({
          windowSec: 600,
          max: 3,
          statuses: [...statuses, denied.status],
          llmCalls: state.calls.length,
          code: body.code,
          retryAfterSec: body.retryAfterSec,
          retryAfterHeader: denied.headers.get("Retry-After"),
          error: body.error,
        }) +
        "\n===END===\n"
    );

    // 前 3 次全部通过
    expect(statuses).toEqual([200, 200, 200]);
    // 第 4 次被拒
    expect(denied.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.code).toBe("RATE_LIMITED");
    // 明确的重试指引（前端可读，也可直接看 header）
    expect(typeof body.retryAfterSec).toBe("number");
    expect(body.retryAfterSec).toBeGreaterThan(0);
    expect(denied.headers.get("Retry-After")).toBe(String(body.retryAfterSec));
    // 关键：被限流那一次**没有调用模型**（限流同样必须在花钱之前）
    expect(state.calls).toHaveLength(3);
  });
});
