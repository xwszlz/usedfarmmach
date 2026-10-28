/**
 * 游客限流键取值链测试（P0 安全问题：.cn 上 X-Forwarded-For 首段可被伪造）
 *
 * 漏洞形态：nginx 用 `$proxy_add_x_forwarded_for`，客户端自带的 XFF 原样保留在前、
 * 真实 IP 追加到末尾。旧实现取首段 ⇒ 攻击者每请求换一个随机首段就能把
 * `GUEST_DAILY_LIMIT = 3` 变成无限次（游客估值不扣积分，直接白嫖双模型算力）。
 *
 * 本文件锁死三件事：
 *   ① 两站都优先信 `x-real-ip`（代理覆盖写入，客户端改不了）
 *   ② `x-forwarded-for` 回退时**按站点取相反的一端**（.cn 取末段，.com 取首段）
 *   ③ 返回值仍是哈希（不落明文 IP，隐私设计不被"顺手改回去"）
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "crypto";

/** 站点变体开关：在 vi.mock 工厂执行前就存在 */
const siteState = vi.hoisted(() => ({ value: "com" as "com" | "cn" }));

vi.mock("@/config/site", () => ({
  SITE: "com",
  siteConfig: {},
  siteConfigMap: {},
  cnFeatures: {},
  getSiteVariant: () => siteState.value,
  isCnSite: () => siteState.value === "cn",
  isComSite: () => siteState.value === "com",
  isOverseasAiAllowed: () => siteState.value !== "cn",
}));

import { getClientIpHash, resolveClientIp, UNKNOWN_CLIENT_IP } from "@/lib/valuation/client-ip";

/** 与实现同源的期望值：`sha256("valuation-gate:" + ip)` */
function expectedHash(ip: string): string {
  return createHash("sha256").update(`valuation-gate:${ip}`).digest("hex");
}

function makeHeaders(init: Record<string, string> = {}): Headers {
  return new Headers(init);
}

beforeEach(() => {
  siteState.value = "com";
});

describe(".cn：x-real-ip 优先（nginx $remote_addr 覆盖写入，不可伪造）", () => {
  it("同时带 x-real-ip 与伪造首段的 XFF → 必须基于 x-real-ip，不能基于 6.6.6.6", () => {
    siteState.value = "cn";
    const headers = makeHeaders({
      "x-real-ip": "10.0.0.1",
      "x-forwarded-for": "6.6.6.6, 10.0.0.1",
    });

    expect(resolveClientIp(headers)).toBe("10.0.0.1");
    const hash = getClientIpHash(headers);
    expect(hash).toBe(expectedHash("10.0.0.1"));
    expect(hash).not.toBe(expectedHash("6.6.6.6"));
  });

  it("只有 XFF → 取最后一段（nginx 追加的真实 IP 在末尾）", () => {
    siteState.value = "cn";
    const headers = makeHeaders({ "x-forwarded-for": "6.6.6.6, 10.0.0.1" });

    expect(resolveClientIp(headers)).toBe("10.0.0.1");
    expect(getClientIpHash(headers)).toBe(expectedHash("10.0.0.1"));
  });

  it("换 5 个不同的伪造首段、真实 IP 不变 → 5 次的限流键完全相同（配额无法被刷新）", () => {
    siteState.value = "cn";
    const forgedFirstHops = ["1.2.3.4", "6.6.6.6", "8.8.8.8", "203.0.113.9", "198.51.100.7"];

    const hashes = forgedFirstHops.map((forged) =>
      getClientIpHash(makeHeaders({ "x-forwarded-for": `${forged}, 10.0.0.1` }))
    );

    expect(new Set(hashes).size).toBe(1);
    expect(hashes[0]).toBe(expectedHash("10.0.0.1"));
  });

  it("XFF 带多余空白时仍能取到末段", () => {
    siteState.value = "cn";
    expect(resolveClientIp(makeHeaders({ "x-forwarded-for": " 6.6.6.6 ,  10.0.0.1  " }))).toBe("10.0.0.1");
  });
});

describe(".com：x-real-ip 优先，回退取 XFF 首段（Vercel 边缘写入）", () => {
  it("只有 XFF → 取第一段 6.6.6.6（与 .cn 语义相反）", () => {
    siteState.value = "com";
    const headers = makeHeaders({ "x-forwarded-for": "6.6.6.6, 10.0.0.1" });

    expect(resolveClientIp(headers)).toBe("6.6.6.6");
    expect(getClientIpHash(headers)).toBe(expectedHash("6.6.6.6"));
    expect(getClientIpHash(headers)).not.toBe(expectedHash("10.0.0.1"));
  });

  it("带 x-real-ip 时仍以 x-real-ip 为准", () => {
    siteState.value = "com";
    const headers = makeHeaders({
      "x-real-ip": "203.0.113.5",
      "x-forwarded-for": "6.6.6.6, 10.0.0.1",
    });

    expect(getClientIpHash(headers)).toBe(expectedHash("203.0.113.5"));
  });
});

describe("兜底与隐私形态", () => {
  it("两个头都缺失 → 走到既有兜底常量 unknown，且不抛错", () => {
    siteState.value = "cn";
    expect(() => getClientIpHash(makeHeaders())).not.toThrow();
    expect(resolveClientIp(makeHeaders())).toBe(UNKNOWN_CLIENT_IP);
    expect(getClientIpHash(makeHeaders())).toBe(expectedHash("unknown"));

    siteState.value = "com";
    expect(getClientIpHash(makeHeaders())).toBe(expectedHash("unknown"));
  });

  it("空字符串头等同于缺失（不能把 空 IP 当成一个可轮换的桶）", () => {
    siteState.value = "cn";
    const headers = makeHeaders({ "x-real-ip": "   ", "x-forwarded-for": "  ,  " });
    expect(getClientIpHash(headers)).toBe(expectedHash("unknown"));
  });

  it("返回值仍是 64 位十六进制哈希，不含明文 IP（隐私设计不能被改坏）", () => {
    siteState.value = "cn";
    const hash = getClientIpHash(makeHeaders({ "x-real-ip": "203.0.113.77" }));

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.77");
  });
});

describe("反证：取值链一旦退回「XFF 首段优先」本条即红", () => {
  it("伪造首段与真实 IP 必须产生不同的键，且生效的是真实 IP", () => {
    siteState.value = "cn";
    const realHash = getClientIpHash(makeHeaders({ "x-forwarded-for": "10.0.0.1" }));
    const forgedHash = getClientIpHash(makeHeaders({ "x-forwarded-for": "6.6.6.6, 10.0.0.1" }));

    // 旧实现在这里会得到两个不同的键（即"换 header 就刷新配额"）
    expect(forgedHash).toBe(realHash);
  });
});
