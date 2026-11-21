/**
 * 分站邮箱角色单测（2026-11-21 老板拍板：sales 接单 / support 救火 / marketing 谈合作）
 *
 * 硬断言：`.cn` 站**没有** sales@ / marketing@ 邮箱（腾讯企业邮只开了 support 一个公共邮箱），
 * 所以这两个 getter 在 .cn 必须回退到客服邮箱 —— 绝不下发收不到信的死地址。
 *
 * 🔴 2026-11-21 起 .cn 的客服域是 **shendiaotech.cn**（A 方案）：
 *    usedfarmmach.cn 无 MX（死信箱）＋ 腾讯企业邮免费版只允许绑定 1 个自有域名，
 *    名额已给 shendiaotech.cn ⇒ 原 support@usedfarmmach.cn 收发皆不可用。
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
    expect(m.getSupportEmail()).toBe("support@shendiaotech.cn");
    expect(m.getSalesEmail()).toBe("support@shendiaotech.cn");
    expect(m.getMarketingEmail()).toBe("support@shendiaotech.cn");
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
