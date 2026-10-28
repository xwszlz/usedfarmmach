/**
 * 图片抓取出网守卫（SSRF）单元测试
 *
 * 背景：`imageUrls` 来自估值接口请求体，攻击者可传内网地址让服务器代其出网
 * （`.cn` 在阿里云 ECS 上，`100.100.100.200/latest/meta-data/` 即实例元数据）。
 *
 * 覆盖：scheme 白名单、特殊主机名、裸 IP 字面量判段、域名解析结果判段、
 *       公网地址放行、12MB 流式上限（提前 cancel，不整包读进内存）、
 *       以及「拒绝后由 analyzeProductImage 既有降级路径接手」的失败语义。
 *
 * 全程 mock `node:dns/promises` 与 `fetch`，**不产生任何真实网络请求**。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** DNS 解析桩：默认把所有域名解析到一个公网 IPv4 */
const dnsState = vi.hoisted(() => ({
  resolved: [{ address: "93.184.216.34", family: 4 }] as Array<{ address: string; family: number }>,
  calls: [] as string[],
  shouldFail: false,
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => {
    dnsState.calls.push(host);
    if (dnsState.shouldFail) throw new Error("ENOTFOUND");
    return dnsState.resolved;
  }),
}));

import {
  assertSafeImageUrl,
  fetchGuardedImage,
  readBodyWithLimit,
  MAX_IMAGE_BYTES,
} from "../ssrf-guard";
import { analyzeProductImage } from "../image-analyzer";

let fetchMock: ReturnType<typeof vi.fn>;

/** 造一个「正常图片响应」：真 Response，带 body 流 */
function imageResponse(bytes: Uint8Array = new Uint8Array([1, 2, 3, 4])): Response {
  // 取底层 ArrayBuffer 作为 BodyInit：Uint8Array<ArrayBufferLike> 在 TS 里不满足 BodyInit
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, { status: 200, headers: { "content-type": "image/jpeg" } });
}

beforeEach(() => {
  dnsState.resolved = [{ address: "93.184.216.34", family: 4 }];
  dnsState.calls = [];
  dnsState.shouldFail = false;
  fetchMock = vi.fn(async () => imageResponse());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SSRF：内网地址一律拒绝", () => {
  it("阿里云 ECS 元数据地址 100.100.100.200 ⇒ 拒绝，且根本不发起 fetch", async () => {
    await expect(assertSafeImageUrl("http://100.100.100.200/latest/meta-data/")).rejects.toThrow(/内网/);
    await expect(fetchGuardedImage("http://100.100.100.200/latest/meta-data/")).rejects.toThrow(/内网/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["回环 + 端口", "http://127.0.0.1:8080/x"],
    ["localhost 主机名", "http://localhost/x"],
    ["IPv6 回环", "http://[::1]/x"],
    ["链路本地（云元数据常见）", "http://169.254.169.254/x"],
    ["私网 192.168", "http://192.168.1.1/x"],
    ["私网 10/8", "http://10.1.2.3/x"],
    ["私网 172.16/12", "http://172.20.0.1/x"],
    ["CGNAT 100.64/10", "http://100.64.0.1/x"],
    ["CGNAT 上界 100.127.255.255", "http://100.127.255.255/x"],
    ["0.0.0.0", "http://0.0.0.0/x"],
    ["组播/保留 >=224", "http://239.1.1.1/x"],
  ])("裸 IP 字面量：%s 拒绝", async (_label, url) => {
    // localhost 走"内部主机名"分支，其余走"内网 IP"分支 —— 两者都是拒绝
    await expect(assertSafeImageUrl(url)).rejects.toThrow(/内网|内部主机名/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["内部主机名后缀 .internal", "http://metadata.google.internal/x"],
    ["mDNS .local", "http://printer.local/x"],
    ["子域 localhost", "http://api.localhost/x"],
  ])("特殊主机名：%s 拒绝", async (_label, url) => {
    await expect(assertSafeImageUrl(url)).rejects.toThrow(/内部主机名/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("域名解析到私网地址 ⇒ 拒绝（解析前无法判段，必须看解析结果）", async () => {
    dnsState.resolved = [{ address: "10.0.0.9", family: 4 }];
    await expect(assertSafeImageUrl("https://evil.example.com/a.jpg")).rejects.toThrow(/内网地址/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("IPv4 映射的 IPv6（::ffff:127.0.0.1）⇒ 按内嵌 IPv4 判段后拒绝", async () => {
    await expect(assertSafeImageUrl("http://[::ffff:127.0.0.1]/x")).rejects.toThrow(/内网/);
    await expect(assertSafeImageUrl("http://[::ffff:100.64.0.1]/x")).rejects.toThrow(/内网/);
  });

  it("解析失败时失败即关闭（不猜、不放行）", async () => {
    dnsState.shouldFail = true;
    await expect(assertSafeImageUrl("https://nxdomain.example.com/a.jpg")).rejects.toThrow(/解析失败/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("SSRF：scheme 白名单", () => {
  it.each([
    ["file", "file:///etc/passwd"],
    ["ftp", "ftp://example.com/y"],
    ["gopher", "gopher://example.com/y"],
    ["非图片 data URI", "data:text/html;base64,PHNjcmlwdD4="],
  ])("%s 协议 ⇒ 拒绝", async (_label, url) => {
    await expect(assertSafeImageUrl(url)).rejects.toThrow(/协议|不合法/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("SSRF：重定向不能成为绕过通道", () => {
  it("公网地址 302 到内网 ⇒ 第二跳被拦下", async () => {
    fetchMock = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "http://100.100.100.200/latest/meta-data/" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGuardedImage("https://cdn.example.com/a.jpg")).rejects.toThrow(/内网/);
    // 只发了公网那一枪，第二枪（内网）在 fetch 之前就被守卫拒了
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("公网图片放行（normal path 回归）", () => {
  /**
   * 反向用例：**防止将来有人"顺手"把整个 100.0.0.0/8 封掉**。
   *
   * 缘由（别删这段注释，它是这条用例存在的唯一理由）：
   *   - 100.64.0.0/10 是 RFC 6598 的 CGNAT 段，阿里云元数据 100.100.100.200 落在这里 ⇒ 必须封；
   *   - 但 100.0.0.0/8 的**其余部分**是 ARIN 2012 年拿到的真实公网分配段，与内网无关。
   * 曾有一版实现为了让"100.0.0.200"这个地址被拒而整段封 100/8（那是笔误，真实元数据是
   * 100.100.100.200）。那种过度封禁不会让任何"必须拒绝"的用例变红，因此**只有这条放行用例**
   * 能发现它，一旦有人把范围放大，这条会立刻红。
   */
  it("100.1.2.3（100/8 内、CGNAT 之外，ARIN 公网段）⇒ 必须放行", async () => {
    const url = await assertSafeImageUrl("http://100.1.2.3/a.jpg");
    expect(url.hostname).toBe("100.1.2.3");

    const resp = await fetchGuardedImage("http://100.1.2.3/a.jpg");
    expect(resp.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 边界：100.63.255.255 在 CGNAT 之下（放行），100.128.0.1 在其之上（放行）
    await expect(assertSafeImageUrl("http://100.63.255.255/a.jpg")).resolves.toBeInstanceOf(URL);
    await expect(assertSafeImageUrl("http://100.128.0.1/a.jpg")).resolves.toBeInstanceOf(URL);
  });

  it("https 公网图片：解析域名 → 抓取 → 读出字节", async () => {
    const bytes = new Uint8Array([9, 8, 7, 6, 5]);
    fetchMock = vi.fn(async () => imageResponse(bytes));
    vi.stubGlobal("fetch", fetchMock);

    const url = await assertSafeImageUrl("https://cdn.example.com/a.jpg");
    expect(url.hostname).toBe("cdn.example.com");
    expect(dnsState.calls).toContain("cdn.example.com");

    const resp = await fetchGuardedImage("https://cdn.example.com/a.jpg");
    expect(resp.ok).toBe(true);
    const buf = await readBodyWithLimit(resp);
    expect(Array.from(buf)).toEqual([9, 8, 7, 6, 5]);

    // 抓取必须带超时 signal 且手动跟随重定向（否则 302 到内网即绕过）
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("体积上限：12MB 流式截断（不能先 arrayBuffer 再判）", () => {
  it("超过 12MB ⇒ 抛错、提前 cancel，且未把整个 body 读进内存", async () => {
    const chunk = new Uint8Array(1024 * 1024); // 每块 1MB
    let produced = 0;
    let cancelled = false;

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        produced += chunk.byteLength;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });

    const fakeResp = {
      ok: true,
      status: 200,
      headers: { get: () => "image/jpeg" },
      body: stream,
    } as unknown as Response;

    await expect(readBodyWithLimit(fakeResp)).rejects.toThrow(/体积超过上限/);
    expect(cancelled).toBe(true);
    // 只多读了很少的块就中止；整包读完会是「无限流」⇒ 挂死
    expect(produced).toBeLessThanOrEqual(MAX_IMAGE_BYTES + 4 * 1024 * 1024);
  });

  it("恰好 12MB 以内 ⇒ 正常返回", async () => {
    const bytes = new Uint8Array(1024 * 1024);
    const resp = new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } });
    const buf = await readBodyWithLimit(resp);
    expect(buf.byteLength).toBe(bytes.byteLength);
  });
});

describe("失败语义：抛错并由 analyzeProductImage 既有降级路径接手", () => {
  it("内网 URL ⇒ 视觉分析降级为默认结果（有日志、不静默、也不发请求）", async () => {
    const result = await analyzeProductImage("http://100.100.100.200/latest/meta-data/");
    expect(result.isDefault).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("超大响应 ⇒ 同样走降级路径（不是静默返回空字符串）", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "image/jpeg" },
        body: stream,
      }))
    );

    const result = await analyzeProductImage("http://93.184.216.34/oversize.jpg");
    expect(result.isDefault).toBe(true);
  });
});
