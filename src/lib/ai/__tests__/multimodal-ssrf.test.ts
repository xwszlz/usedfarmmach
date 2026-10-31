/**
 * `buildDoubaoContent` / `downloadImageAsBase64` 的出网守卫接线测试
 *
 * 这两个函数是「深度分析」「AI 销售策略」「卖家助手识图」三条链路的共同入口：
 * `imageUrls` 全部来自请求体，接守卫前是无校验的 axios.get（只有 20s 超时）。
 *
 * 锁三件事：
 *   ① 公网图片照常下载并转 base64（不能因为加校验把功能弄坏）
 *   ② 内网地址在 fetch 之前就被拒（不是"下载了才发现不对"）
 *   ③ 单图被拒只跳过该图，同批其他正常图仍然进入模型（既有容错语义不变）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const dnsState = vi.hoisted(() => ({
  resolved: [{ address: "93.184.216.34", family: 4 }] as Array<{ address: string; family: number }>,
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => dnsState.resolved),
}));

import { buildDoubaoContent, downloadImageAsBase64 } from "../multimodal";

let fetchMock: ReturnType<typeof vi.fn>;

function imageResponse(bytes: number[], contentType = "image/png"): Response {
  const body = new Uint8Array(bytes).buffer as ArrayBuffer;
  return new Response(body, { status: 200, headers: { "content-type": contentType } });
}

beforeEach(() => {
  dnsState.resolved = [{ address: "93.184.216.34", family: 4 }];
  fetchMock = vi.fn(async () => imageResponse([1, 2, 3]));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("downloadImageAsBase64：正常图片仍成功", () => {
  it("公网 https 图片 → 返回 mime + base64（原行为不变）", async () => {
    const result = await downloadImageAsBase64("https://cdn.example.com/a.png");

    expect(result.mimeType).toBe("image/png");
    expect(result.data).toBe(Buffer.from([1, 2, 3]).toString("base64"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 必须带超时 signal 且手动跟随重定向（否则 302 到内网即绕过）
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("content-type 缺失 → 回落 image/jpeg（原兜底行为不变）", async () => {
    fetchMock = vi.fn(async () => new Response(new Uint8Array([9]).buffer, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadImageAsBase64("https://cdn.example.com/b.jpg");
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("非 2xx → 抛错（原 axios 行为：4xx/5xx 视为失败）", async () => {
    fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadImageAsBase64("https://cdn.example.com/missing.jpg")).rejects.toThrow(/404/);
  });
});

describe("downloadImageAsBase64：内网地址拒绝", () => {
  it.each([
    ["云元数据（CGNAT）", "http://100.100.100.200/latest/meta-data/"],
    ["回环", "http://127.0.0.1:8080/x"],
    ["私网", "http://10.1.2.3/x"],
    ["IPv6 回环", "http://[::1]/x"],
  ])("%s ⇒ 抛错且不发请求", async (_label, url) => {
    await expect(downloadImageAsBase64(url)).rejects.toThrow(/内网/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("buildDoubaoContent：单图被拒不影响同批正常图", () => {
  it("内网图跳过 + 公网图照常进入 content（既有容错语义）", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const content = await buildDoubaoContent(
      ["http://100.100.100.200/latest/meta-data/", "https://cdn.example.com/ok.png"],
      [],
      "prompt"
    );

    const imageParts = content.filter((c) => c.type === "image_url");
    expect(imageParts).toHaveLength(1);
    expect(JSON.stringify(imageParts[0])).toContain("data:image/png;base64,");
    // 只发了公网那一枪；内网地址在 fetch 之前就被拒绝
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://cdn.example.com/ok.png");
    expect(warn).toHaveBeenCalled();
  });

  it("data URI 原样透传、不触发下载（国产渠道零收费回归点）", async () => {
    const content = await buildDoubaoContent(["data:image/jpeg;base64,AAAA"], [], "prompt");

    expect(fetchMock).not.toHaveBeenCalled();
    const imagePart = content.find((c) => c.type === "image_url") as {
      image_url: { url: string };
    };
    expect(imagePart.image_url.url).toBe("data:image/jpeg;base64,AAAA");
  });
});

describe("buildDoubaoContent：视频只送自有域名", () => {
  const OWN = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/videos/a.mp4";

  it("恶意 URL 不产生 video_url 内容块，自有 OSS 视频照常送出", async () => {
    const content = await buildDoubaoContent(
      [],
      ["https://evil.example.com/x.mp4", OWN],
      "prompt"
    );
    const videos = content.filter((part) => part.type === "video_url");
    expect(videos).toHaveLength(1);
    expect((videos[0].video_url as { url: string }).url).toBe(OWN);
  });

  it("只有恶意 URL ⇒ 一个 video_url 都没有，且不抛错（不阻断整条链路）", async () => {
    const content = await buildDoubaoContent([], ["https://evil.example.com/x.mp4"], "prompt");
    expect(content.filter((part) => part.type === "video_url")).toHaveLength(0);
    expect(content[0]).toEqual({ type: "text", text: "prompt" });
  });

  it("同域但 http / 后缀域名攻击 都被拒", async () => {
    const content = await buildDoubaoContent(
      [],
      [
        "http://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/videos/a.mp4",
        "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com.evil.tld/videos/a.mp4",
      ],
      "prompt"
    );
    expect(content.filter((part) => part.type === "video_url")).toHaveLength(0);
  });
});
