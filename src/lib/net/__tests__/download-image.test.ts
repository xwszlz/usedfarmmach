/**
 * `downloadGuardedImage` 单测 —— 把「守卫 + 体积上限 + content-type」这一层钉住
 *
 * 为什么单独测它：这一层是 5 个业务调用点（估值视觉、多模态、微信内容安全、建品入库、
 * 识别回读）的公共下载口，之前那段逻辑埋在 `internal/products/route.ts` 里（route 文件
 * 不能导出非 HTTP 符号），等于完全测不到。
 *
 * 覆盖：正常图成功 / content-type 兜底可定制 / 内网拒绝 / 30MB 提前 cancel /
 *       自有 OSS 跳过 DNS 解析（这条是"守卫误杀导致静默漏检"的根治点）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const dnsState = vi.hoisted(() => ({
  calls: [] as string[],
  resolved: [{ address: "93.184.216.34", family: 4 }] as Array<{ address: string; family: number }>,
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => {
    dnsState.calls.push(host);
    return dnsState.resolved;
  }),
}));

import { downloadGuardedImage } from "../download-image";
import { MAX_UPLOAD_IMAGE_BYTES } from "../ssrf-guard";
import { OSS_BUCKET_HOSTNAME } from "@/lib/oss-upload";

let fetchMock: ReturnType<typeof vi.fn>;

function imageResponse(bytes: number[], contentType = "image/png"): Response {
  return new Response(new Uint8Array(bytes).buffer as ArrayBuffer, {
    status: 200,
    headers: { "content-type": contentType },
  });
}

beforeEach(() => {
  dnsState.calls = [];
  dnsState.resolved = [{ address: "93.184.216.34", family: 4 }];
  fetchMock = vi.fn(async () => imageResponse([1, 2, 3], "image/png"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("正常路径（功能不能因为加守卫而坏掉）", () => {
  it("公网图片 → 返回原始字节 + content-type", async () => {
    const { buffer, contentType } = await downloadGuardedImage("https://cdn.example.com/a.png");

    expect(contentType).toBe("image/png");
    expect(Array.from(buffer)).toEqual([1, 2, 3]);
    expect(dnsState.calls).toContain("cdn.example.com");
  });

  it("响应没有 content-type → 用 defaultContentType（默认 image/jpeg）", async () => {
    fetchMock = vi.fn(async () => new Response(new Uint8Array([7]).buffer as ArrayBuffer, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const jpeg = await downloadGuardedImage("https://cdn.example.com/b");
    expect(jpeg.contentType).toBe("image/jpeg");

    const octet = await downloadGuardedImage("https://cdn.example.com/c", {
      defaultContentType: "application/octet-stream",
    });
    expect(octet.contentType).toBe("application/octet-stream");
  });

  it("非 2xx → 抛错", async () => {
    fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadGuardedImage("https://cdn.example.com/missing.jpg")).rejects.toThrow(/404/);
  });
});

describe("自有 OSS 直接放行且不做 DNS 解析", () => {
  it("OSS 直链（带 x-oss-process 参数）→ 成功，且 lookup 未被调用", async () => {
    const url = `https://${OSS_BUCKET_HOSTNAME}/uploads/products/a.jpg?x-oss-process=image/resize,w_400`;

    const { buffer } = await downloadGuardedImage(url, { maxBytes: MAX_UPLOAD_IMAGE_BYTES });

    expect(Array.from(buffer)).toEqual([1, 2, 3]);
    // 关键断言：走短路后不再解析域名 —— 容器 DNS 抖动不会把全站自有图片拖挂
    expect(dnsState.calls).toEqual([]);
  });

  it("自有 OSS 的 http 变体不走短路面（保留 https 约束，必须走完整校验）", async () => {
    // 注意：这里不是"拒绝"——http 的公网地址本身是允许的（与其他公网 http 一致），
    // 关键是它**不能**享受"自有域免解析"的短路，必须老老实实解析 + 判段。
    await downloadGuardedImage(`http://${OSS_BUCKET_HOSTNAME}/uploads/a.jpg`);
    expect(dnsState.calls).toEqual([OSS_BUCKET_HOSTNAME]);
  });
});

describe("拒绝语义", () => {
  it.each([
    ["云元数据（CGNAT）", "http://100.100.100.200/latest/meta-data/"],
    ["回环", "http://127.0.0.1/x"],
    ["私网", "http://192.168.1.1/x"],
  ])("%s ⇒ 抛错且零请求", async (_label, url) => {
    await expect(downloadGuardedImage(url)).rejects.toThrow(/内网/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("体积上限按调用点取值", () => {
  it("超过 30MB（落盘口径）⇒ 抛错并提前 cancel，不整包读进内存", async () => {
    const chunk = new Uint8Array(1024 * 1024);
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

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "image/jpeg" },
        body: stream,
      }))
    );

    await expect(
      downloadGuardedImage("https://cdn.example.com/huge.jpg", { maxBytes: MAX_UPLOAD_IMAGE_BYTES })
    ).rejects.toThrow(/体积超过上限/);

    expect(cancelled).toBe(true);
    expect(produced).toBeLessThanOrEqual(MAX_UPLOAD_IMAGE_BYTES + 4 * 1024 * 1024);
  });
});
