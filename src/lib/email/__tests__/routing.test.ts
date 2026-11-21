/**
 * P1 邮件路由矩阵单测（D2 / D6）
 *
 * 覆盖 {cn,com} × {境内,境外,空属地} × {凭证齐,凭证缺}。
 * 硬断言：.cn 任何组合都不返回 resend（数据不出境红线）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";

type Site = "cn" | "com";
type Cred = "present" | "missing";

const RECIPIENTS = [
  { label: "境内 CN/zh", user: { country: "CN", preferredLanguage: "zh" } },
  { label: "境外 US/en", user: { country: "US", preferredLanguage: "en" } },
  { label: "空属地 null/en", user: { country: null, preferredLanguage: "en" } },
] as const;

/** 在 import 前注入站点/凭证，并返回该环境下的模块实例 */
async function loadModules(site: Site, cred: Cred) {
  vi.resetModules();
  vi.stubEnv("SITE", site);
  vi.stubEnv("NEXT_PUBLIC_SITE", site);
  vi.stubEnv("SEND_FROM_NAME", "神雕农机");
  vi.stubEnv("EMAIL_REPLY_TO", "");
  // .cn 即使误配 Resend key，也绝不能走 Resend
  vi.stubEnv("RESEND_API_KEY", cred === "present" ? "re_test_key" : "");
  vi.stubEnv(
    "TENCENT_SES_SMTP_USER",
    site === "cn" && cred === "present" ? "support@shendiaotech.cn" : ""
  );
  vi.stubEnv("TENCENT_SES_SMTP_PASS", site === "cn" && cred === "present" ? "test-pass" : "");
  vi.stubEnv("TENCENT_SES_SMTP_HOST", "smtp.exmail.qq.com");
  vi.stubEnv("TENCENT_SES_SMTP_PORT", "465");

  const config = await import("../config");
  const routing = await import("../routing");
  const support = await import("@/config/support-email");
  return { config, routing, support };
}

/**
 * 不注入品牌相关变量（SEND_FROM_NAME / EMAIL_REPLY_TO 置空），
 * 用于验证「默认值」是否符合发件人规范，而不是被 stub 掩盖。
 */
async function loadModulesDefaults(site: Site, cred: Cred) {
  vi.resetModules();
  vi.stubEnv("SITE", site);
  vi.stubEnv("NEXT_PUBLIC_SITE", site);
  vi.stubEnv("SEND_FROM_NAME", "");
  vi.stubEnv("EMAIL_REPLY_TO", "");
  vi.stubEnv("RESEND_API_KEY", cred === "present" ? "re_test_key" : "");
  vi.stubEnv(
    "TENCENT_SES_SMTP_USER",
    site === "cn" && cred === "present" ? "support@shendiaotech.cn" : ""
  );
  vi.stubEnv("TENCENT_SES_SMTP_PASS", site === "cn" && cred === "present" ? "test-pass" : "");
  vi.stubEnv("TENCENT_SES_SMTP_HOST", "smtp.exmail.qq.com");
  vi.stubEnv("TENCENT_SES_SMTP_PORT", "465");

  const config = await import("../config");
  return { config };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("resolveMailConfig · SITE-first", () => {
  for (const site of ["cn", "com"] as const) {
    for (const cred of ["present", "missing"] as const) {
      it(`${site} × 凭证${cred} → from/support/降级正确`, async () => {
        const { config } = await loadModules(site, cred);
        const cfg = config.resolveMailConfig();
        expect(cfg.site).toBe(site);
        expect(cfg.fromEmail).toBe(
          site === "cn" ? "support@shendiaotech.cn" : "support@usedfarmmach.com"
        );
        expect(cfg.supportEmail).toBe(
          site === "cn" ? "support@shendiaotech.cn" : "support@usedfarmmach.com"
        );
        expect(cfg.fromName).toBe("神雕农机");
        expect(cfg.degraded).toBe(cred === "missing");
        if (site === "cn") {
          expect(cfg.providerKind).toBe(cred === "present" ? "tencent_ses" : "console");
        } else {
          expect(cfg.providerKind).toBe(cred === "present" ? "resend" : "console");
        }
      });
    }
  }
});

describe("selectProviderForUser · 站点 × 属地 × 凭证矩阵", () => {
  for (const site of ["cn", "com"] as const) {
    for (const cred of ["present", "missing"] as const) {
      for (const recipient of RECIPIENTS) {
        it(`${site} × ${recipient.label} × 凭证${cred}`, async () => {
          const { config, routing } = await loadModules(site, cred);
          const cfg = config.resolveMailConfig();
          const selection = await routing.selectProviderForUser(recipient.user, cfg);

          if (site === "cn") {
            // 数据不出境红线：.cn 任意组合都不得返回 resend
            expect(selection.name).not.toBe("resend");
            expect(selection.name).toBe(cred === "present" ? "tencent_ses" : "console");
          } else if (recipient.user.country === "CN") {
            // .com 境内且有 userId 调用场景：保留既有 console 安全下限
            expect(selection.name).toBe("console");
          } else {
            expect(selection.name).toBe(cred === "present" ? "resend" : "console");
          }
        });
      }
    }
  }
});

describe("support-email · 分站地址与字面量替换", () => {
  for (const site of ["cn", "com"] as const) {
    it(`${site} → getSupportEmail / localizeSupportEmail`, async () => {
      const { support } = await loadModules(site, "present");
      const expected = site === "cn" ? "support@shendiaotech.cn" : "support@usedfarmmach.com";
      expect(support.getSupportEmail()).toBe(expected);
      expect(support.getSystemFromEmail()).toBe(
        site === "cn" ? "support@shendiaotech.cn" : "support@usedfarmmach.com"
      );
      expect(support.localizeSupportEmail("联系 jiusei0319@gmail.com 或 932133255@qq.com")).toBe(
        `联系 ${expected} 或 ${expected}`
      );
      expect(support.localizeSupportEmail("无字面量")).toBe("无字面量");
    });
  }
});

describe("发件人规范守卫（2026-11-20 拍板：废 no-reply / 不用 notify 子域）", () => {
  for (const site of ["cn", "com"] as const) {
    for (const cred of ["present", "missing"] as const) {
      it(`${site} × 凭证${cred} → from 必须是 support@ 本站域名`, async () => {
        const { config } = await loadModulesDefaults(site, cred);
        const cfg = config.resolveMailConfig();

        // 发件人 = 客服地址，两站各自域名
        expect(cfg.fromEmail).toBe(
          site === "cn" ? "support@shendiaotech.cn" : "support@usedfarmmach.com"
        );
        // 反向守卫：三个历史坑一个都不许回来
        expect(cfg.fromEmail).not.toMatch(/no-?reply/i);
        expect(cfg.fromEmail).not.toContain("notify.");
        expect(cfg.fromEmail).not.toContain("resend.dev");
        // Reply-To 默认回落客服地址：客户点「回复」直达 Inbox
        expect(cfg.replyTo).toBe(cfg.supportEmail);
      });
    }
  }

  it("显示名默认按站分流：.cn=神雕农机 / .com=UsedFarmMach", async () => {
    const cnMod = await loadModulesDefaults("cn", "present");
    expect(cnMod.config.resolveMailConfig().fromName).toBe("神雕农机");

    const comMod = await loadModulesDefaults("com", "present");
    expect(comMod.config.resolveMailConfig().fromName).toBe("UsedFarmMach");
  });
});
