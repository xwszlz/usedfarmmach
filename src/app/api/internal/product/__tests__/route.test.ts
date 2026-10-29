/**
 * `/api/internal/product` 转发路由的 Host 头注入回归用例
 *
 * 这个路由本身不校验任何凭据，只把调用方的 `x-api-key` / `x-miniapp-key` 往下转发，
 * 再把目标响应 `json()` 后原样回吐。修复前它的转发目标 base 取自 `request.url`
 * （origin 由 Host 头推导）⇒ 「匿名可达 + 目标主机完全可控 + 完整读回响应」= POST 型 SSRF。
 *
 * 修复后 base 固定为 `SITE_ORIGIN`（canonical 域名）。本文件锁两件事：
 *   ① `Host: evil.tld` 时请求仍然打到 SITE_ORIGIN，**不是** evil.tld；
 *   ② 合法调用（canonical Host）行为不变：方法/头/body 原样透传，响应状态码与 body 原样返回。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { SITE_ORIGIN } from "@/lib/site-url";

import { POST } from "../route";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ success: true, productId: "p1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    })
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ brandName: "Kuhn", images: ["data:image/jpeg;base64,AAAA"] }),
  });
}

describe("Host 头不能改变转发目标", () => {
  it("Host: evil.tld ⇒ 仍然转发到 SITE_ORIGIN（不是 evil.tld）", async () => {
    await POST(makeRequest("https://evil.tld/api/internal/product", { host: "evil.tld" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const target = String(fetchMock.mock.calls[0][0]);
    expect(target).toBe(`${SITE_ORIGIN}/api/internal/products`);
    expect(target).not.toContain("evil.tld");
  });

  it("内网 Host（100.100.100.200）同样不改变目标", async () => {
    await POST(makeRequest("http://100.100.100.200:3000/api/internal/product", { host: "100.100.100.200:3000" }));

    const target = String(fetchMock.mock.calls[0][0]);
    expect(target).toBe(`${SITE_ORIGIN}/api/internal/products`);
    expect(target).not.toContain("100.100.100.200");
  });
});

describe("合法调用行为不变", () => {
  it("透传 POST 方法与鉴权头，并把目标响应状态码/body 原样返回", async () => {
    const res = await POST(
      makeRequest(`${SITE_ORIGIN}/api/internal/product`, {
        host: new URL(SITE_ORIGIN).host,
        "x-api-key": "k1",
        "x-miniapp-key": "m1",
      })
    );

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k1");
    expect((init.headers as Record<string, string>)["x-miniapp-key"]).toBe("m1");
    expect(init.signal).toBeInstanceOf(AbortSignal);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ success: true, productId: "p1" });
  });

  /**
   * 反向用例（删掉转发里的 `...(auth ? { authorization: auth } : {})` 必红）。
   *
   * 下游 `/api/internal/products` 的鉴权是「x-api-key 匹配 **或** Bearer JWT 有效」。
   * 旧实现只转 content-type / x-api-key / x-miniapp-key ⇒ 只带 JWT 的早期小程序
   * 走这条兼容路径时 JWT 被丢、必然判 401 —— 也就是说这条兼容路由对"它要兼容的那批
   * 客户端"从来没生效过。这条用例把那个行为钉死。
   */
  it("Authorization: Bearer <jwt> 必须原样转发到下游", async () => {
    await POST(
      makeRequest(`${SITE_ORIGIN}/api/internal/product`, {
        host: new URL(SITE_ORIGIN).host,
        authorization: "Bearer test-jwt",
      })
    );

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-jwt");
  });

  it("没有 Authorization 时不塞空字符串（空 Authorization 是非法值，部分代理会 400）", async () => {
    await POST(
      makeRequest(`${SITE_ORIGIN}/api/internal/product`, {
        host: new URL(SITE_ORIGIN).host,
        "x-api-key": "k1",
      })
    );

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect("authorization" in headers).toBe(false);
  });
});
