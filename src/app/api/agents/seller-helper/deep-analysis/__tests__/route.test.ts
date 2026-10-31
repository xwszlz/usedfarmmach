/**
 * deep-analysis 路由单测（2026-11 AI 输出质量修复）
 *
 * 覆盖本次修复的四个可回归点：
 *   ① 站点优先的 prompt 选择：`.com` 必须走国际版（不得出现「中国 / 补贴」市场视角），`.cn` 仍按品牌国籍切双引擎；
 *   ② 语种注入：body.locale / x-vercel-ip-country 决定的语种要写进初稿 prompt **和**续写指令；
 *   ③ 尾部 ```json 代码块连同残留标题 / 引导语 / 多余空行一起剥干净（不得残留「结构化数据」空小节）；
 *   ④ `modelUsed` 只回模型名，不再把内部引擎标签 `[国内(DOMESTIC)]` 漏给前端。
 *
 * 测试手法：mock 掉鉴权 / 计费 / 模型出口，走真实 POST 处理器（含真实 prompt 常量、真实清洗逻辑、
 * 真实的 `@/lib/ai/multimodal`）。不 mock 被测模块自身，避免「测了个假的」。
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/** 可控状态：站点变体、模型出口剧本、每次调用的 messages、余额与计费参数 */
const state = vi.hoisted(() => ({
  cnSite: false,
  /** 依次消费的模型返回剧本；用尽后复用最后一条 */
  script: [] as Array<{ text: string; finishReason?: string }>,
  /** 记录每次 chatCompletionDoubao 的调用参数 */
  calls: [] as Array<{ messages: Array<{ role: string; content: unknown }> }>,
  /** 每次模型调用"消耗"的毫秒数（配合假时钟，用于验证预算闸） */
  costMsPerCall: 0,
  /** 假时钟当前值（Date.now 被替换成读它） */
  clock: 1_800_000_000_000,
  /** 当前用户余额（预检读它；低于门槛必须早退 402） */
  credits: 100_000,
  /** 每次模型调用返回的 usage（可调，用于验证「多轮 token 累加」） */
  usage: { prompt_tokens: 100, completion_tokens: 200 },
  /** 记录每次 computeAiCost 的入参（**第一次是预检，最后一次才是真计费**） */
  costCalls: [] as Array<{ model: string; inputTokens: number; outputTokens: number }>,
  /** 记录每次 deductCredits 的入参 */
  deductCalls: [] as Array<{ userId: string; points: number; reason: string }>,
  /** 模型出口的 spy —— 预检反证要断言它 **toHaveBeenCalledTimes(0)** */
  llm: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: () => "fake-token",
  verifyToken: () => ({ userId: "user-1" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: async () => ({ credits: state.credits }) },
  },
}));

/**
 * 限流：本文件**mock 成永远放行**。
 * 理由：`@/lib/rate-limit` 的计数是进程级状态，若在本文件用真模块，前面十几个用例
 * 会把配额吃光，后面的用例全部 429（假红）。真实限流行为另见
 * `__tests__/route.ratelimit.test.ts`（那里用**真模块**连续打 N+1 次）。
 */
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ allowed: true, remaining: 2, retryAfterSec: 0 }),
}));

vi.mock("@/lib/credits/spend", () => ({
  computeAiCost: (params: {
    model: string;
    inputTokens: number;
    outputTokens: number;
  }) => {
    state.costCalls.push({
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    });
    return { points: 12, model: params.model };
  },
  deductCredits: async (userId: string, points: number, reason: string) => {
    state.deductCalls.push({ userId, points, reason });
    return { ok: true, credits: 988, required: points };
  },
}));

vi.mock("@/lib/credits/fx", () => ({
  getBillingCountry: async () => "CN",
  // 只保留测试用到的两条映射，其余返回 null（走下一优先级）
  getLocaleOfCountry: (country: string | null | undefined) => {
    if (country === "RU") return "ru";
    if (country === "DE") return "en";
    return null;
  },
}));

vi.mock("@/lib/ai/ark-client", () => ({
  getArkModelId: () => "doubao-seed-2-1-pro",
  chatCompletionDoubao: (params: { messages: Array<{ role: string; content: unknown }> }) =>
    state.llm(params),
}));

/**
 * 模型出口的假实现（放在 mock 工厂外，才能用 vi.fn 的调用次数做断言）。
 *
 * ⚠️ 必须是一个**具名函数**并且在 `beforeEach` 里重新 `mockImplementation`，
 *    不能只在模块顶层注册一次：`afterEach` 里的 `vi.restoreAllMocks()` 对
 *    `vi.fn()` 同样会移除已注册的实现（`mockRestore` 语义），第一次用例跑完
 *    模型出口就变回「返回 undefined」⇒ 从第二个用例起全文件假红。
 *    这是 b3（`afterEach` 无 `vi.fn()` spy）与 b4（`vi.fn()` spy 无 `afterEach`）
 *    合并后才会出现的**静默**破坏，git 不会报冲突。
 */
async function llmImpl(params: { messages: Array<{ role: string; content: unknown }> }) {
  state.calls.push({ messages: params.messages });
  // 模拟这次调用真实消耗的时间（预算闸用的是假时钟，见下方 describe）
  if (state.costMsPerCall > 0) state.clock += state.costMsPerCall;
  const next = state.script.length > 1 ? state.script.shift()! : state.script[0];
  if (!next) throw new Error("测试剧本未设置");
  return {
    text: next.text,
    finishReason: next.finishReason,
    usage: state.usage,
  };
}

vi.mock("@/config/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/site")>();
  return {
    ...actual,
    isCnSite: () => state.cnSite,
    isComSite: () => !state.cnSite,
  };
});

/** 真实数据 URI，避免真实模块去下载网络图片 */
const DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

/** 构造一个只暴露 headers + json 的最小 NextRequest（POST 只用到这两个能力） */
function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): NextRequest {
  const h = new Headers(headers);
  return { headers: h, json: async () => body } as unknown as NextRequest;
}

/** 走真实 POST；返回（已解析的）响应 JSON */
async function runRoute(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): Promise<any> {
  const res = await runRouteRaw(body, headers);
  return res.json();
}

/** 走真实 POST；返回 Response 本体（要断言 status / headers 时用） */
async function runRouteRaw(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): Promise<Response> {
  const { POST } = await import("../route");
  return POST(makeRequest({ imageDataUris: [DATA_URI], ...body }, headers));
}

/** 取某次调用里 user 侧的纯文本 prompt（content[0].text） */
function promptOf(callIndex: number): string {
  const call = state.calls[callIndex];
  expect(call, `第 ${callIndex} 次模型调用不存在`).toBeTruthy();
  const first = call.messages[0];
  const content = first.content as Array<Record<string, any>>;
  expect(Array.isArray(content)).toBe(true);
  expect(content[0].type).toBe("text");
  return String(content[0].text);
}

/** 取续写轮追加的指令文本（messages 里的最后一条 user） */
function continueInstructionOf(callIndex: number): string {
  const call = state.calls[callIndex];
  const last = call.messages[call.messages.length - 1];
  return String(last.content);
}

/** 一段足够长的“正常报告”（超过 callDoubao 的 50 字符下限） */
const REPORT_HEAD = [
  "## 设备识别",
  "- 品牌 John Deere",
  "- 具体型号 8R 410",
  "",
  "## 技术参数解读",
  "额定马力 410 HP，排量 9.0 L，六缸发动机。",
].join("\n");

beforeEach(() => {
  state.cnSite = false;
  state.calls = [];
  state.script = [{ text: REPORT_HEAD, finishReason: "stop" }];
  state.costMsPerCall = 0;
  // 假时钟：路由用 Date.now() 算预算，必须可控才能验证「预算不足 ⇒ 不续写」
  state.clock = 1_800_000_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => state.clock);
  // 预检默认余额充足（门槛 300 + 预估值），单测不关心余额时不用每条都设
  state.credits = 100_000;
  state.usage = { prompt_tokens: 100, completion_tokens: 200 };
  state.costCalls = [];
  state.deductCalls = [];
  state.llm.mockClear();
  // 每个用例都重新装一次实现：上一条用例的 afterEach 已把它清掉了（见 llmImpl 注释）
  state.llm.mockImplementation(llmImpl);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("站点优先的引擎选择（.com 去中国化）", () => {
  it("`.com` + 中国品牌也必须走国际版 prompt（不得出现中国市场视角）", async () => {
    state.cnSite = false;
    const json = await runRoute({ isChineseBrand: true, locale: "en" });

    expect(json.success).toBe(true);
    const prompt = promptOf(0);
    // 国际版特征：全球品牌视角 + 面向国际买家
    expect(prompt).toContain("全球主流品牌");
    expect(prompt).toContain("面向**国际买家**");
    expect(prompt).toContain("目标销售市场");
    // 国内版特征一律不得出现
    expect(prompt).not.toContain("农机购置补贴");
    expect(prompt).not.toContain("该品牌在中国的授权服务商信息");
    expect(prompt).not.toContain("国内主流品牌");
    // 国际版 prompt 内已无「中国」字样（唯一一处已改为市场中立措辞）
    expect(prompt).not.toContain("中国");
  });

  it("`.cn` + 中国品牌仍走国内版 prompt（补贴/国内措辞保留）", async () => {
    state.cnSite = true;
    await runRoute({ isChineseBrand: true, locale: "zh" });

    const prompt = promptOf(0);
    expect(prompt).toContain("农机购置补贴政策");
    expect(prompt).toContain("该品牌在中国的授权服务商信息");
  });

  it("`.cn` + 非中国品牌走国际版 prompt", async () => {
    state.cnSite = true;
    await runRoute({ isChineseBrand: false, locale: "zh" });

    const prompt = promptOf(0);
    expect(prompt).toContain("全球主流品牌");
    expect(prompt).not.toContain("农机购置补贴");
  });

  it("`.com` 传入 isChineseBrand=false 同样走国际版", async () => {
    state.cnSite = false;
    await runRoute({ isChineseBrand: false, locale: "en" });
    expect(promptOf(0)).toContain("全球主流品牌");
  });
});

describe("8 语种输出接入", () => {
  it("body.locale 命中语言指令（ru → Русский）", async () => {
    await runRoute({ locale: "ru" });
    const prompt = promptOf(0);
    expect(prompt).toContain("=== OUTPUT LANGUAGE (MANDATORY) ===");
    expect(prompt).toContain("Русский");
    // 语言指令必须追加在 prompt 最末（离模型最近）
    expect(prompt.trimEnd().endsWith("=== END OUTPUT LANGUAGE ===")).toBe(true);
  });

  it("body 无 locale 时按 x-vercel-ip-country 兜底（RU → Русский）", async () => {
    await runRoute({}, { "x-vercel-ip-country": "RU" });
    expect(promptOf(0)).toContain("Русский");
  });

  it("`.cn` 站点把非 zh/en 语种收敛掉（不留西班牙语）", async () => {
    state.cnSite = true;
    await runRoute({ locale: "es" });
    expect(promptOf(0)).not.toContain("Español");
  });

  it("已知信息用英文标签注入（避免中文标签把输出语言拉回中文）", async () => {
    await runRoute({
      locale: "en",
      brandName: "John Deere",
      productName: "8R 410",
      year: 2021,
      enginePower: "410",
    });
    const prompt = promptOf(0);
    expect(prompt).toContain("⚠️ Known facts (treat as authoritative; photos are for verification):");
    expect(prompt).toContain("- Brand: John Deere");
    expect(prompt).toContain("- Model: 8R 410");
    expect(prompt).toContain("- Year: 2021");
    expect(prompt).toContain("- Power: 410 HP");
    expect(prompt).not.toContain("已知信息");
    expect(prompt).not.toContain("- 品牌：");
  });

  it("续写指令同样带语言指令（否则补写的段落会退回中文）", async () => {
    state.script = [
      { text: REPORT_HEAD, finishReason: "length" },
      { text: "\n\n## 购买建议\n该机适合大规模农场作业，建议重点检查液压系统、传动系统与轮胎磨损情况，并索取完整维保记录。", finishReason: "stop" },
    ];
    const json = await runRoute({ locale: "fr" });

    expect(state.calls.length).toBe(2);
    // 第 2 次调用的 messages = [user(prompt+图片), assistant(初稿), user(续写指令)]
    const instruction = continueInstructionOf(1);
    expect(instruction).toContain("Français");
    expect(instruction).toContain("请紧接着截断处继续输出剩余部分");
    expect(json.data.analysis).toContain("## 购买建议");
  });
});

describe("尾部 JSON 小节清洗", () => {
  it("剥掉 ```json 块 + 残留标题 + 引导语，不留空小节", async () => {
    const raw = [
      "## 设备识别",
      "- 品牌 John Deere",
      "",
      "## 结构化数据（JSON）",
      "最后附上一个JSON代码块，包含可被程序解析的结构化数据：",
      "```json",
      '{"brand":"John Deere"}',
      "```",
    ].join("\n");
    state.script = [{ text: raw, finishReason: "stop" }];

    const json = await runRoute({ locale: "zh" });

    expect(json.success).toBe(true);
    expect(json.data.analysis).toBe("## 设备识别\n- 品牌 John Deere");
    expect(json.data.analysis).not.toContain("结构化数据");
    expect(json.data.analysis).not.toContain("最后附上");
    expect(json.data.analysis).not.toContain("```");
    // JSON 代码块虽从正文剥离，但结构化字段必须照样解析出来
    expect(json.data.structured).toEqual({ brand: "John Deere" });
  });

  it("删行后产生的连续空行压成最多 2 个，并删末尾孤立 `---`", async () => {
    const raw = [
      "## 设备识别",
      "- 品牌 CLAAS",
      "",
      "",
      "",
      "## 结构化数据（JSON）",
      "",
      "最后附上一个JSON代码块：",
      "```json",
      '{"brand":"CLAAS"}',
      "```",
      "",
      "",
      "---",
      "",
    ].join("\n");
    state.script = [{ text: raw, finishReason: "stop" }];

    const json = await runRoute({ locale: "zh" });
    expect(json.data.analysis).toBe("## 设备识别\n- 品牌 CLAAS");
  });

  it("外语标题（Structured Data (JSON)）与英文引导语同样剥掉", async () => {
    const raw = [
      "## Machine identification",
      "- Brand: New Holland",
      "",
      "## Structured Data (JSON)",
      "Finally, append a JSON code block that can be parsed by the system:",
      "```json",
      '{"brand":"New Holland"}',
      "```",
    ].join("\n");
    state.script = [{ text: raw, finishReason: "stop" }];

    const json = await runRoute({ locale: "en" });
    expect(json.data.analysis).toBe("## Machine identification\n- Brand: New Holland");
    expect(json.data.structured).toEqual({ brand: "New Holland" });
  });

  it("代码块被 max_tokens 截断（缺闭合围栏）也不残留半截 JSON", async () => {
    const raw = [
      "## 设备识别",
      "- 品牌 Kubota",
      "",
      "## 结构化数据（JSON）",
      "最后附上一个JSON代码块，包含可被程序解析的结构化数据：",
      "```json",
      '{"brand":"Kubota","modelName":"M70',
    ].join("\n");
    state.script = [{ text: raw, finishReason: "stop" }];

    const json = await runRoute({ locale: "zh" });
    expect(json.data.analysis).toBe("## 设备识别\n- 品牌 Kubota");
    expect(json.data.analysis).not.toContain("Kubota\",");
  });
});

describe("用户可见的 modelUsed", () => {
  it("只回模型名，不再拼内部引擎标签", async () => {
    await runRoute({ isChineseBrand: true, locale: "en" });
    expect(state.calls.length).toBeGreaterThan(0);
    state.cnSite = true;
    await runRoute({ isChineseBrand: true, locale: "zh" });
    const json = await runRoute({ isChineseBrand: true, locale: "zh" });
    expect(json.data.model).toBe("豆包 doubao-seed-2-1-pro");
    expect(json.data.model).not.toContain("国内(DOMESTIC)");
    expect(json.data.model).not.toContain("国际(INTERNATIONAL)");
  });
});

/**
 * 截断契约（2026-10-31 线上二次事故的回归锁）
 *
 * 事故形态：单轮 LLM 跑满超时 → 老板只看到「模型均调用失败」。修复后要求：
 *   - 正常收尾 ⇒ `truncated=false` / `budgetExhausted=false`
 *   - `finishReason=length` 但剩余预算不足 ⇒ **不再发起续写**，且必须显式回 `truncated=true`
 *     + `budgetExhausted=true`（前端据此显示黄色提示条，绝不能静默当成功）
 *   - 正文为空 ⇒ 仍走 503 `ALL_MODELS_FAILED`（不改成 200）
 */
describe("截断契约（truncated / budgetExhausted）", () => {
  it("正常收尾：两个标记都为 false，并回传墙钟与 token 数", async () => {
    const json = await runRoute({ locale: "zh" });

    expect(json.success).toBe(true);
    expect(json.data.truncated).toBe(false);
    expect(json.data.budgetExhausted).toBe(false);
    expect(json.data.continueRounds).toBe(0);
    expect(typeof json.data.elapsedMs).toBe("number");
  });

  it("被 max_tokens 截断且剩余预算不足：跳过续写，标记 truncated+budgetExhausted（只调 1 次）", async () => {
    state.script = [{ text: REPORT_HEAD, finishReason: "length" }];
    // 单轮消耗 250s：总预算 285s ⇒ 剩余 35s < 续写门槛 50s ⇒ 必须放弃续写
    state.costMsPerCall = 250_000;

    const json = await runRoute({ locale: "zh" });

    expect(state.calls.length).toBe(1);
    expect(json.data.truncated).toBe(true);
    expect(json.data.budgetExhausted).toBe(true);
    expect(json.data.continueRounds).toBe(0);
    // 已生成正文必须保留（不能因为截断就整份丢弃）
    expect(json.data.analysis).toContain("## 设备识别");
  });

  it("被 max_tokens 截断但预算充足：照常续写，最终 truncated=false", async () => {
    state.script = [
      { text: REPORT_HEAD, finishReason: "length" },
      { text: "\n\n## 购买建议\n该机整体状况良好，适合中等规模农场作业；建议重点检查液压系统、传动系统与轮胎磨损情况，并索取完整维保记录后再议价。", finishReason: "stop" },
    ];
    // 每轮 30s，两轮共 60s，远少于 285s 预算
    state.costMsPerCall = 30_000;

    const json = await runRoute({ locale: "zh" });

    expect(state.calls.length).toBe(2);
    expect(json.data.continueRounds).toBe(1);
    expect(json.data.truncated).toBe(false);
    expect(json.data.budgetExhausted).toBe(false);
    expect(json.data.analysis).toContain("## 购买建议");
  });
});

/**
 * 余额预检（2026-10-31 计费安全）
 *
 * 洞：旧实现只在**末尾** `deductCredits` 处拦「积分不足」。余额 0 的账号点一次，
 * 系统照样跑完 190~290 秒、生成完整报告，最后才 402 ⇒ 报告丢弃、一分钱收不到，
 * 而单次真实成本 ¥0.28~0.43 已经烧掉，且可无限重复。
 *
 * 所以这里最重要的一条不是「返回 402」，而是 **`chatCompletionDoubao` 一次都没被调用**。
 */
describe("余额预检（早退，不是预扣）", () => {
  it("余额 < 门槛 ⇒ 402 且 LLM 零调用（核心反证）", async () => {
    state.credits = 100; // 门槛最低 300，必然不足

    const res = await runRouteRaw({ locale: "zh" });
    const body = await res.json();

    // ① 一个 token 都不该花：模型出口 spy 必须零调用
    expect(state.llm).toHaveBeenCalledTimes(0);
    expect(state.calls).toHaveLength(0);
    // ② 也不该走到扣费
    expect(state.deductCalls).toHaveLength(0);
    // ③ 状态码与响应体形状必须与旧「余额不足」分支完全一致（前端只有一条 402 分支）
    expect(res.status).toBe(402);
    expect(body).toMatchObject({
      success: false,
      error: "积分不足，请先充值后再使用 AI 深度分析",
      code: "INSUFFICIENT_CREDITS",
      rechargeUrl: "/zh/credits",
    });
    expect(typeof body.required).toBe("number");
    expect(body.balance).toBe(100);
    // ④ 字段集合必须与旧分支同形（多一个少一个都会逼前端加分支）
    expect(Object.keys(body).sort()).toEqual(
      ["balance", "code", "error", "rechargeUrl", "required", "success"].sort()
    );
  });

  it("门槛是「>= 放行 / < 拦截」的边界，不是「多 1 分才让过」", async () => {
    // 本文件的 computeAiCost mock 恒返回 12 分，低于 MIN_POINTS ⇒ 门槛恒为 300。
    // 用 299 / 300 卡边界：拦在 299、放行 300，证明比较用的是 `<` 而不是 `<=`。
    state.credits = 299;
    const denied = await runRouteRaw({ locale: "zh" });
    expect(denied.status).toBe(402);
    expect(state.calls).toHaveLength(0);

    state.credits = 300;
    state.calls = [];
    const allowed = await runRouteRaw({ locale: "zh" });
    expect(allowed.status).toBe(200);
    expect(state.calls.length).toBeGreaterThan(0);
  });

  it("门槛随图片数上升（图越多预估越贵）", async () => {
    const one = async () => {
      state.costCalls = [];
      await runRoute({ imageDataUris: [DATA_URI], locale: "zh" });
      return state.costCalls[0].inputTokens;
    };
    const eight = async () => {
      const uris = Array.from({ length: 8 }, (_, i) => `data:image/png;base64,AAAA${i}`);
      state.costCalls = [];
      await runRoute({ imageDataUris: uris, imageUrls: [], locale: "zh" });
      return state.costCalls[0].inputTokens;
    };
    const oneImg = await one();
    const eightImg = await eight();
    expect(eightImg).toBeGreaterThan(oneImg);
    // 预估输入量级校验（8 图 ≈ 40.7k，对应实测累计输入 42,145）
    expect(eightImg).toBeGreaterThan(38_000);
    expect(eightImg).toBeLessThan(44_000);
  });
});

/**
 * 图片张数上限（老板 2026-10-29 拍板 3→8）
 *
 * 前端已切片，但接口是登录即可调的 ⇒ 服务端必须再夹一次，
 * 否则有人直接 POST 30 张会把 input token 翻几倍、把报告拖成截断。
 */
describe("图片张数上限", () => {
  it("8 张全部进入模型（不被误裁）", async () => {
    const uris = Array.from({ length: 8 }, (_, i) => `data:image/png;base64,AAAA${i}`);
    await runRoute({ imageDataUris: uris, imageUrls: [], locale: "zh" });

    const content = state.calls[0].messages[0].content as Array<Record<string, unknown>>;
    expect(content.filter((c) => c.type === "image_url")).toHaveLength(8);
  });

  it("超过 8 张时服务端截到 8 张（防绕过前端）", async () => {
    const uris = Array.from({ length: 12 }, (_, i) => `data:image/png;base64,AAAA${i}`);
    const json = await runRoute({ imageDataUris: uris, imageUrls: [], locale: "zh" });

    const content = state.calls[0].messages[0].content as Array<Record<string, unknown>>;
    expect(content.filter((c) => c.type === "image_url")).toHaveLength(8);
    expect(json.data.mediaCount.images).toBe(8);
  });
});

/**
 * 结构化 JSON 必须排在正文**之前**（V2.5 截断韧性，2026-11）
 *
 * 根因：截断（`finish_reason=length`）砍掉的永远是**尾部**。JSON 放末尾 ⇒ 截断时
 * `structured` 为空 ⇒ 前端技术参数表 / 六维度评分整块空白（即使正文已经写了 5000 字）。
 * 放到开头后，只要模型还在写字，JSON 就一定已经写完。
 *
 * 这两条断言锁的是「prompt 顺序」这个**契约**，防止将来有人「把 JSON 挪回结尾图省事」：
 *   ① 初稿 prompt 里第一个 ```json 代码块必须出现在第一个 `## ` 小节**之前**；
 *   ② 续写指令不得再要求补 JSON 块（重复输出会让 `extractStructured` 的 `match` 命中错的那份）。
 *
 * 为什么用真实解析（而不是断言整段 prompt 文本）：prompt 文案会持续微调，
 * 断死文案会让每次改一个字就红；顺序是语义，文案是措辞。
 */
describe("结构化 JSON 前置（截断韧性）", () => {
  it("初稿 prompt：```json 块在小节正文之前", async () => {
    await runRoute({ locale: "zh" });
    const prompt = promptOf(0);

    const jsonAt = prompt.indexOf("```json");
    const firstSectionAt = prompt.search(/^##\s+\S/m);

    expect(jsonAt).toBeGreaterThan(-1);
    expect(firstSectionAt).toBeGreaterThan(-1);
    // 核心：JSON 模板在第一个二级小节之前
    expect(jsonAt).toBeLessThan(firstSectionAt);
  });

  it("续写指令：明确禁止再输出 json 代码块", async () => {
    state.script = [
      { text: REPORT_HEAD, finishReason: "length" },
      {
        text:
          "\n\n## 购买建议\n该机整体状况良好，液压系统无渗漏、轮胎花纹剩余约六成，" +
          "适合中等规模农场作业；建议重点检查传动系统与制动鼓，并索取完整维保记录后再议价。",
        finishReason: "stop",
      },
    ];
    state.costMsPerCall = 20_000;

    await runRoute({ locale: "zh" });
    const instruction = continueInstructionOf(1);

    expect(instruction).toContain("json");
    expect(instruction).toContain("严禁");
    // 不能再说「补上结尾要求的那一个 json 代码块」
    expect(instruction).not.toContain("只需补上");
  });
});

/**
 * 国内版 prompt 的顺序同样必须「JSON 在前」。
 *
 * 两个 prompt 是两份独立的大字符串，改了一个很容易漏另一个 ——
 * `.cn` 站的中国品牌产品走的正是国内版，漏改就等于国内用户的截断韧性没修。
 */
describe("结构化 JSON 前置（国内版 prompt 同样适用）", () => {
  it("`.cn` + 中国品牌：```json 块在小节正文之前", async () => {
    state.cnSite = true;
    await runRoute({ isChineseBrand: true, locale: "zh" });

    const prompt = promptOf(0);
    // 先确认确实走的是国内版
    expect(prompt).toContain("农机购置补贴政策");

    const jsonAt = prompt.indexOf("```json");
    const firstSectionAt = prompt.search(/^##\s+\S/m);
    expect(jsonAt).toBeGreaterThan(-1);
    expect(jsonAt).toBeLessThan(firstSectionAt);
    // 且不允许再出现「正文全部写完后…输出 json」的旧尾句
    expect(prompt).not.toContain("正文全部写完后");
  });
});

/**
 * 正向回归：余额充足时行为与改前完全一致（预检不得改变计费结果）
 */
describe("余额充足时行为不变", () => {
  it("deductCredits 仍然只调一次，且 points 来自 computeAiCost", async () => {
    await runRoute({ locale: "zh" });

    expect(state.deductCalls).toHaveLength(1);
    expect(state.deductCalls[0].userId).toBe("user-1");
    expect(state.deductCalls[0].reason).toBe("AI深度分析");
    expect(state.deductCalls[0].points).toBe(12);
  });

  it("续写多轮的 token 必须**累加**后计费（不是只取最后一轮）", async () => {
    // 每轮 prompt 14,000 / completion 2,000（量级对齐实测 8 图三轮 input 42,145）
    state.usage = { prompt_tokens: 14_000, completion_tokens: 2_000 };
    state.script = [
      { text: REPORT_HEAD, finishReason: "length" },
      {
        text:
          "\n\n## 技术参数解读（续）\n额定马力 410 HP，排量 9.0 L，六缸发动机，四驱，" +
          "变速箱 16 前进 4 倒退，液压输出流量 120 L/min，整机重量 12,800 kg。",
        finishReason: "length",
      },
      {
        text:
          "\n\n## 购买建议\n该机整体状况良好，液压系统无渗漏，轮胎花纹剩余约六成，" +
          "适合中等规模农场作业；建议重点检查传动系统与制动鼓，并索取完整维保记录后再议价。",
        finishReason: "stop",
      },
    ];

    await runRoute({ locale: "zh" });

    // 3 轮模型调用
    expect(state.calls).toHaveLength(3);
    // 计费那一次（最后一次 computeAiCost；第一次是预检）
    const billing = state.costCalls[state.costCalls.length - 1];
    expect(billing.inputTokens).toBe(14_000 * 3);
    expect(billing.outputTokens).toBe(2_000 * 3);
    // 若只取最后一轮，这里会是 14,000 —— 这条断言就是防这个回归
    expect(billing.inputTokens).not.toBe(14_000);
  });
});
