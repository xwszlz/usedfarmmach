/**
 * `net/oss-host` —— 「自有媒体」白名单（`isOwnMediaUrl` / `filterOwnMediaUrls`）回归用例
 *
 * 被锁死的问题：视频以 `{ type: "video_url" }` 送进火山方舟后，是**方舟服务端**去抓这个地址
 * （我们这侧不出网，因此不是我们的 SSRF）。`videoUrls` 来自请求体、原本零校验，
 * 等于把"让第三方模型访问任意 URL"的入口开给了所有人。
 *
 * 同时锁住另一件事：**不许把 `isOwnOssUrl` 放宽来复用**。它守着出网守卫的自有 OSS 短路
 * （命中即跳过 DNS 解析与内网判段），一旦把"env 里声明过的域名"也算作自有，
 * 一个配错的 CDN 域名就能绕过整套内网判段。两个函数必须各管各的。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  OSS_BUCKET_HOSTNAME,
  filterOwnMediaUrls,
  getOwnMediaHostnames,
  isOwnMediaUrl,
  isOwnOssUrl,
} from "../oss-host";

const OWN_VIDEO = `https://${OSS_BUCKET_HOSTNAME}/videos/a.mp4`;

beforeEach(() => {
  // 默认把三个 env 清空，让"只有桶域名"成为确定的基线，
  // 避免跑测机器上恰好配了某条 env 导致用例时绿时红。
  vi.stubEnv("NEXT_PUBLIC_OSS_BASE_URL", "");
  vi.stubEnv("OSS_BASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_OSS_CDN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isOwnMediaUrl：自有域名判定", () => {
  it("自有 OSS 桶的 https 地址 → true（生产库 97 条 ProductVideo 全是这个形态）", () => {
    expect(isOwnMediaUrl(OWN_VIDEO)).toBe(true);
  });

  it("带 query（OSS 处理参数 / 签名）仍然通过", () => {
    expect(isOwnMediaUrl(`${OWN_VIDEO}?x-oss-process=video/snapshot,t_0`)).toBe(true);
  });

  it("同域但 http → false（自有资产全部 https，放宽会引入混合内容风险）", () => {
    expect(isOwnMediaUrl(`http://${OSS_BUCKET_HOSTNAME}/videos/a.mp4`)).toBe(false);
  });

  it("后缀域名攻击 → false（isOwnOssUrl 注释里点名的攻击形态，绝不能被前缀比较骗过）", () => {
    expect(isOwnMediaUrl(`https://${OSS_BUCKET_HOSTNAME}.evil.tld/videos/a.mp4`)).toBe(false);
  });

  it("任意外部域名 → false", () => {
    expect(isOwnMediaUrl("https://evil.example.com/videos/a.mp4")).toBe(false);
    expect(isOwnMediaUrl("https://cdn.example.com/a.mp4")).toBe(false);
  });

  it("空串 / 纯空白 / 非法 URL / 非字符串 → false（不抛错）", () => {
    expect(isOwnMediaUrl("")).toBe(false);
    expect(isOwnMediaUrl("   ")).toBe(false);
    expect(isOwnMediaUrl("not a url")).toBe(false);
    expect(isOwnMediaUrl("/uploads/videos/a.mp4")).toBe(false); // 相对路径：应由 getVideoUrl 先转绝对
    expect(isOwnMediaUrl(undefined as unknown as string)).toBe(false);
  });
});

describe("isOwnMediaUrl：env 域名容错（③ 将来接独立 CDN 不许静默失效）", () => {
  it("NEXT_PUBLIC_OSS_CDN 配了独立域名 → 该域名通过", () => {
    vi.stubEnv("NEXT_PUBLIC_OSS_CDN", "https://cdn.usedfarmmach.com");
    expect(isOwnMediaUrl("https://cdn.usedfarmmach.com/videos/a.mp4")).toBe(true);
  });

  it("NEXT_PUBLIC_OSS_CDN 写成裸域名（无 scheme）也生效", () => {
    vi.stubEnv("NEXT_PUBLIC_OSS_CDN", "cdn.usedfarmmach.com");
    expect(isOwnMediaUrl("https://cdn.usedfarmmach.com/videos/a.mp4")).toBe(true);
  });

  it("env 值带尾部斜杠 / 大写 / 尾部点 → 归一化后仍然匹配", () => {
    vi.stubEnv("NEXT_PUBLIC_OSS_CDN", "https://CDN.UsedFarmMach.com./");
    expect(isOwnMediaUrl("https://cdn.usedfarmmach.com/videos/a.mp4")).toBe(true);
  });

  it("NEXT_PUBLIC_OSS_BASE_URL 与 OSS_BASE_URL 都参与白名单", () => {
    vi.stubEnv("NEXT_PUBLIC_OSS_BASE_URL", "https://base.example.com");
    vi.stubEnv("OSS_BASE_URL", "https://server-side.example.com");
    expect(isOwnMediaUrl("https://base.example.com/videos/a.mp4")).toBe(true);
    expect(isOwnMediaUrl("https://server-side.example.com/videos/a.mp4")).toBe(true);
  });

  it("env 全为空 / 乱填 → 只剩桶域名，且不抛错", () => {
    vi.stubEnv("NEXT_PUBLIC_OSS_CDN", "::::not-a-url::::");
    expect(getOwnMediaHostnames()).toEqual([OSS_BUCKET_HOSTNAME]);
    expect(isOwnMediaUrl(OWN_VIDEO)).toBe(true);
    expect(isOwnMediaUrl("https://evil.example.com/a.mp4")).toBe(false);
  });

  it("白名单去重：env 配成与桶域名相同（生产现状）不会产生重复项", () => {
    vi.stubEnv("NEXT_PUBLIC_OSS_CDN", `https://${OSS_BUCKET_HOSTNAME}`);
    vi.stubEnv("NEXT_PUBLIC_OSS_BASE_URL", `https://${OSS_BUCKET_HOSTNAME}`);
    expect(getOwnMediaHostnames()).toEqual([OSS_BUCKET_HOSTNAME]);
  });

  it("★ 出网守卫的白名单**没有**被放宽：isOwnOssUrl 对 CDN 域名仍然 false", () => {
    vi.stubEnv("NEXT_PUBLIC_OSS_CDN", "https://cdn.usedfarmmach.com");
    // 交给第三方抓取：允许
    expect(isOwnMediaUrl("https://cdn.usedfarmmach.com/videos/a.mp4")).toBe(true);
    // 出网守卫的自有 OSS 短路：仍然只认那个桶，不认 CDN
    // （否则一个配错的 CDN 域名就能跳过守卫的 DNS 解析与内网判段）
    expect(isOwnOssUrl("https://cdn.usedfarmmach.com/videos/a.mp4")).toBe(false);
  });
});

describe("filterOwnMediaUrls：过滤 + warn，绝不抛错", () => {
  it("自有留下、外部丢弃，顺序不变", () => {
    const other = `https://${OSS_BUCKET_HOSTNAME}/videos/b.mp4`;
    const kept = filterOwnMediaUrls([OWN_VIDEO, "https://evil.example.com/x.mp4", other]);
    expect(kept).toEqual([OWN_VIDEO, other]);
  });

  it("空串 / undefined / 非字符串被静默跳过（不产生噪音日志）", () => {
    const kept = filterOwnMediaUrls([OWN_VIDEO, "", "   ", undefined as unknown as string]);
    expect(kept).toEqual([OWN_VIDEO]);
  });

  it("全部不合规 → 返回空数组，不抛错（调用方据此走中性降级）", () => {
    expect(() => filterOwnMediaUrls(["https://evil.example.com/a.mp4"])).not.toThrow();
    expect(filterOwnMediaUrls(["https://evil.example.com/a.mp4"])).toEqual([]);
  });

  it("入参不是数组（防御异常请求体）→ 返回空数组", () => {
    expect(filterOwnMediaUrls(undefined as unknown as string[])).toEqual([]);
    expect(filterOwnMediaUrls("https://evil.example.com/a.mp4" as unknown as string[])).toEqual([]);
  });

  it("丢弃时会打一条可 grep 的 warn，且只含 host 不含完整 URL（避免泄露签名参数）", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    filterOwnMediaUrls(["https://evil.example.com/a.mp4?Signature=SECRET"], "视频");
    const logs = warnSpy.mock.calls.map((call) => call.join(" "));
    expect(logs.some((line) => line.includes("[oss-host]") && line.includes("evil.example.com"))).toBe(true);
    expect(logs.some((line) => line.includes("SECRET"))).toBe(false);
    warnSpy.mockRestore();
  });
});
