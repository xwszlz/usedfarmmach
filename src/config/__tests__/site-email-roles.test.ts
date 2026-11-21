/**
 * 分站邮箱角色单测（2026-11-21 老板拍板：sales 接单 / support 救火 / marketing 谈合作）
 *
 * 硬断言：`.cn` 站**没有** sales@ / marketing@ 邮箱（腾讯企业邮只开了 support 一个公共邮箱），
 * 所以这两个 getter 在 .cn 必须回退到 support@usedfarmmach.cn —— 绝不下发收不到信的死地址。
 */
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadSupportEmail(site: "cn" | "com") {
  vi.resetModules();
  vi.stubEnv("SITE", site);
  vi.stubEnv("NEXT_PUBLIC_SITE", site);
  return await import("../support-email");
}

describe("分站邮箱角色解析", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it(".com 三个地址各自独立，互不顶替", async () => {
    const m = await loadSupportEmail("com");
    expect(m.getSupportEmail()).toBe("support@usedfarmmach.com");
    expect(m.getSalesEmail()).toBe("sales@usedfarmmach.com");
    expect(m.getMarketingEmail()).toBe("marketing@usedfarmmach.com");
  });

  it(".cn 无 sales/marketing，一律回退客服邮箱（防死信箱）", async () => {
    const m = await loadSupportEmail("cn");
    expect(m.getSupportEmail()).toBe("support@usedfarmmach.cn");
    expect(m.getSalesEmail()).toBe("support@usedfarmmach.cn");
    expect(m.getMarketingEmail()).toBe("support@usedfarmmach.cn");
  });

  it("localizeSupportEmail 只替换历史 Gmail/QQ 字面量，不动真实销售地址", async () => {
    const m = await loadSupportEmail("com");
    expect(m.localizeSupportEmail("联系 jiusei0319@gmail.com")).toBe(
      "联系 support@usedfarmmach.com"
    );
    expect(m.localizeSupportEmail("联系 sales@usedfarmmach.com")).toBe(
      "联系 sales@usedfarmmach.com"
    );
  });
});
