/**
 * `wechat-sec-check.checkImage` 的出网守卫接线测试
 *
 * 为什么守卫必须落在这一层：`checkImage` 有两个上游（`internal/products`、
 * `seller/products`），只在上游过滤必然漏一个；而它的形状最危险 ——
 * 「服务器代取 URL → 把内容 POST 给微信接口」，等于把内网响应外带出去。
 *
 * 锁三件事：① 正常 OSS/公网图照常下载并 POST（功能不变）；② 内网地址在 fetch 之前被拒；
 * ③ 空 URL 的既有短路行为不变（不请求、直接 pass）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const dnsState = vi.hoisted(() => ({
  resolved: [{ address: "93.184.216.34", family: 4 }] as Array<{ address: string; family: number }>,
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => dnsState.resolved),
}));

// 微信 access_token 走网络，测试里直接给常量
vi.mock("../wechat-miniprogram", () => ({
  getAccessToken: vi.fn(async () => "fake-access-token"),
}));

import { checkImage } from "../wechat-sec-check";

let fetchMock: ReturnType<typeof vi.fn>;

/** 第一次调用 = 下载图片；第二次 = POST 给微信 */
function installFetch(): { imageBytes: number[] } {
  const imageBytes = [11, 22, 33];
  fetchMock = vi.fn(async (input: string | URL) => {
    if (String(input).includes("imgseccheck")) {
      return new Response(
        JSON.stringify({ errcode: 0, errmsg: "ok", result: { suggest: "pass", label: 100 } }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(new Uint8Array(imageBytes).buffer, {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { imageBytes };
}

beforeEach(() => {
  dnsState.resolved = [{ address: "93.184.216.34", family: 4 }];
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkImage：正常图片仍可用", () => {
  it("公网 https 图片 → 下载后 POST 给微信，返回 pass", async () => {
    const result = await checkImage("https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/a.jpg");

    expect(result.suggest).toBe("pass");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // 第一次是图片下载，必须走守卫（manual 重定向 + 超时 signal）
    const downloadInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(downloadInit.redirect).toBe("manual");
    expect(downloadInit.signal).toBeInstanceOf(AbortSignal);

    // 第二次是微信 POST，body 里必须真的带上图片二进制
    const postInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(postInit.method).toBe("POST");
    const body = postInit.body as Buffer;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.includes(Buffer.from([11, 22, 33]))).toBe(true);
  });

  it("空 URL → 直接 pass，不发起任何请求（既有短路行为）", async () => {
    const result = await checkImage("");
    expect(result.suggest).toBe("pass");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("checkImage：内网地址必须被拦在下载之前", () => {
  it.each([
    ["云元数据（CGNAT 100.100.100.200）", "http://100.100.100.200/latest/meta-data/"],
    ["回环", "http://127.0.0.1/x"],
    ["私网 OSS 假地址", "http://192.168.1.10/a.jpg"],
    ["file 协议", "file:///etc/passwd"],
  ])("%s ⇒ 抛错、零请求（不会把内网内容 POST 给微信）", async (_label, url) => {
    await expect(checkImage(url)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
