/**
 * ResendProvider 回归守卫（2026-11-20 线上事故后新增）
 *
 * 事故：发件功能自上线起从未成功过——旧实现用「包名走变量 + webpackIgnore」的
 * 动态 import 加载 resend SDK，webpack 绕开了，但 Vercel 的 @vercel/nft 也跟丢了，
 * 函数产物里没有 node_modules/resend，运行时报 ERR_MODULE_NOT_FOUND，
 * 而错误被 email.ts 门面 catch 吞掉，接口照样返回 success:true。
 *
 * 本文件锁三件事：
 *   1. 行为：直连 REST 的请求形状正确（端点 / Bearer / snake_case reply_to）；
 *   2. 失败：非 2xx 与网络异常必须抛出带上下文的错误，绝不静默返回成功；
 *   3. 结构：源码不得再出现「忽略打包」式 import，也不得重新依赖 npm 包 resend。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResendProvider } from "../provider-resend";

const ENDPOINT = "https://api.resend.com/emails";

/** 装一个假 fetch，返回指定状态码与报文 */
function stubFetch(status: number, payload: unknown) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const fn = vi.fn(async (..._args: unknown[]) => new Response(body, { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** 取出假 fetch 收到的 (url, init) */
function callOf(fn: ReturnType<typeof stubFetch>) {
  const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
  return {
    url,
    init,
    headers: init.headers as Record<string, string>,
    payload: JSON.parse(String(init.body)) as Record<string, unknown>,
  };
}

const BASE_INPUT = {
  to: "buyer@example.com",
  subject: "订阅成功",
  html: "<p>hi</p>",
  text: "hi",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ResendProvider · 直连 REST 的请求形状", () => {
  it("POST 到官方端点，带 Bearer 鉴权与 JSON body", async () => {
    const fetchMock = stubFetch(200, { id: "msg_123" });
    const provider = new ResendProvider("re_test_key", "UsedFarmMach <support@usedfarmmach.com>");

    const result = await provider.send(BASE_INPUT);

    const { url, init, headers, payload } = callOf(fetchMock);
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(headers.Authorization).toBe("Bearer re_test_key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(payload.from).toBe("UsedFarmMach <support@usedfarmmach.com>");
    expect(payload.to).toEqual(["buyer@example.com"]);
    expect(payload.subject).toBe("订阅成功");
    expect(payload.html).toBe("<p>hi</p>");
    expect(payload.text).toBe("hi");
    expect(result).toEqual({ id: "msg_123", provider: "resend" });
  });

  it("reply_to 必须是 snake_case（SDK 的 camelCase 会静默失效）", async () => {
    const fetchMock = stubFetch(200, { id: "msg_1" });
    const provider = new ResendProvider("k", "support@usedfarmmach.com", "support@usedfarmmach.com");

    await provider.send(BASE_INPUT);

    const { payload } = callOf(fetchMock);
    expect(payload.reply_to).toBe("support@usedfarmmach.com");
    expect(payload).not.toHaveProperty("replyTo");
  });

  it("单次调用的 input.replyTo 覆盖构造器默认值", async () => {
    const fetchMock = stubFetch(200, { id: "msg_1" });
    const provider = new ResendProvider("k", "support@usedfarmmach.com", "default@usedfarmmach.com");

    await provider.send({ ...BASE_INPUT, replyTo: "override@usedfarmmach.com" });

    expect(callOf(fetchMock).payload.reply_to).toBe("override@usedfarmmach.com");
  });

  it("没有任何 replyTo 时不发送该字段，避免空值被拒", async () => {
    const fetchMock = stubFetch(200, { id: "msg_1" });
    const provider = new ResendProvider("k", "support@usedfarmmach.com");

    await provider.send(BASE_INPUT);

    expect(callOf(fetchMock).payload).not.toHaveProperty("reply_to");
  });

  it("没有 text 版本时不发送空 text 字段", async () => {
    const fetchMock = stubFetch(200, { id: "msg_1" });
    const provider = new ResendProvider("k", "support@usedfarmmach.com");

    await provider.send({ to: "a@b.com", subject: "s", html: "<p>x</p>" });

    expect(callOf(fetchMock).payload).not.toHaveProperty("text");
  });

  it("响应无 id 时返回 null 而不是 undefined", async () => {
    stubFetch(200, {});
    const provider = new ResendProvider("k", "support@usedfarmmach.com");

    await expect(provider.send(BASE_INPUT)).resolves.toEqual({ id: null, provider: "resend" });
  });
});

describe("ResendProvider · 失败必须抛出且带上下文", () => {
  it("4xx：错误信息含 HTTP 状态码与 Resend 原始 message", async () => {
    stubFetch(403, { statusCode: 403, name: "validation_error", message: "Domain is not verified" });
    const provider = new ResendProvider("k", "support@usedfarmmach.com");

    await expect(provider.send(BASE_INPUT)).rejects.toThrow(/HTTP 403.*Domain is not verified/);
  });

  it("5xx 且响应不是 JSON 时，保留报文前段便于排障", async () => {
    stubFetch(502, "<html>Bad Gateway</html>");
    const provider = new ResendProvider("k", "support@usedfarmmach.com");

    await expect(provider.send(BASE_INPUT)).rejects.toThrow(/HTTP 502.*Bad Gateway/);
  });

  it("网络层异常（含超时 abort）不吞错", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("The operation was aborted");
      })
    );
    const provider = new ResendProvider("k", "support@usedfarmmach.com");

    await expect(provider.send(BASE_INPUT)).rejects.toThrow(/网络\/超时.*aborted/);
  });
});

describe("ResendProvider · 结构守卫（防事故回流）", () => {
  const source = readFileSync(fileURLToPath(new URL("../provider-resend.ts", import.meta.url)), "utf8");
  /** 去掉注释，避免把说明文字当成代码判据 */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("不得使用忽略打包的 import 指令", () => {
    expect(code).not.toMatch(/webpackIgnore\s*:/);
  });

  it("不得再 import npm 包 resend（直连 REST，零依赖）", () => {
    expect(code).not.toMatch(/from\s+["']resend["']/);
    expect(code).not.toMatch(/import\(\s*["']resend["']\s*\)/);
  });

  it("端点使用常量而非散落字符串，且指向官方域名", () => {
    expect(code).toMatch(/const\s+RESEND_ENDPOINT\s*=\s*["']https:\/\/api\.resend\.com\/emails["']/);
  });

  it("发信带超时中断，避免 serverless 函数整体挂死", () => {
    expect(code).toMatch(/AbortController/);
    expect(code).toMatch(/SEND_TIMEOUT_MS/);
  });
});
