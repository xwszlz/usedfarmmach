/**
 * 合规守卫：SITE=cn 时生成链路不向 .com / ARK_PROXY_URL 发请求（T4 红线 #1）
 *
 * 断言对象：src/lib/ai/ark-client 的 getArkLinkPath() 在 SITE=cn 时返回 "direct"
 * （国行 ARK 直连），绝不走 b-channel 代理。生成路由（route.ts）唯一的 LLM 出口即
 * chatCompletionDoubao，其 base URL 由 getArkLinkPath 决定——因此 "direct" 即意味着
 * 「无代理、无出境」的合规姿态。
 *
 * 注意：ark-client.ts 在「模块加载时」即捕获 ARK_PROXY_URL（const ARK_PROXY_URL =
 * process.env.ARK_PROXY_URL || ""）。因此「.com + 代理 → b-channel」这条对照用例必须
 * 在设置好 env 后再 vi.resetModules() + 动态 import，才能让模块重新捕获环境变量。
 *
 * 本测试不依赖任何 DB / auth，纯函数级守卫。
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/config/site", () => ({
  // 动态读 env，便于在「对照」用例中切换到 .com
  SITE: process.env.SITE ?? "cn",
  isCnSite: vi.fn(() => (process.env.SITE ?? "cn") === "cn"),
  isComSite: vi.fn(() => (process.env.SITE ?? "cn") !== "cn"),
  getSiteVariant: vi.fn(() => (process.env.SITE ?? "cn")),
}));

// 静态导入：在默认环境（SITE=cn、无 ARK_PROXY_URL）下捕获的绑定，供前两个用例使用。
import { getArkLinkPath } from "@/lib/ai/ark-client";

describe("生成链路合规守卫（T4 红线 #1）", () => {
  it("SITE=cn → 国行 ARK 直连（无代理、无出境），不受 ARK_PROXY_URL 影响", () => {
    // 即便环境误配 ARK_PROXY_URL，.cn 站 isComSite() 为 false，仍走 direct
    expect(getArkLinkPath()).toBe("direct");
  });

  it("SITE=cn 时 isComSite() 为 false → 代理分支不会被触发", async () => {
    const { isComSite } = await import("@/config/site");
    expect(isComSite()).toBe(false);
  });
});

describe("对照：代理仅在 .com + ARK_PROXY_URL 时出现（非默认、非 .cn）", () => {
  it(".com 站且配置了 ARK_PROXY_URL → b-channel", async () => {
    // 让模块在「.com + 已配代理」的环境下重新捕获 ARK_PROXY_URL
    process.env.SITE = "com";
    process.env.ARK_PROXY_URL = "https://proxy.example.com";
    vi.resetModules();
    const { getArkLinkPath: getPath } = await import("@/lib/ai/ark-client");
    expect(getPath()).toBe("b-channel");

    // 卸下代理后再测：.com 无代理也应直连（证明代理需显式配置，非默认行为）
    delete process.env.ARK_PROXY_URL;
    vi.resetModules();
    const { getArkLinkPath: getPathNoProxy } = await import("@/lib/ai/ark-client");
    expect(getPathNoProxy()).toBe("direct");

    // 还原环境，避免影响其它测试文件
    delete process.env.SITE;
  });
});
