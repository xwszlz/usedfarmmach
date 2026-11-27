/**
 * 注册 / 资料补全 —— 不可投递邮箱拦截回归（2026-11-27）
 *
 * 事故经过（真实，不是假设）：
 *   `.cn` 库里有一个 `email = support@usedfarmmach.cn` 的账号。注册流程
 *   （`src/app/api/auth/register/route.ts:104`）注册成功后会自动发验证邮件，
 *   而那封信被腾讯企业邮立刻退回：
 *     `Name service error for name=usedfarmmach.cn type=MX: Host not found`
 *   根因是 `usedfarmmach.cn` **没有任何 MX 记录**（腾讯企业邮免费版只许绑 1 个
 *   自有域名，名额已给 `shendiaotech.cn`），而原来的校验只有
 *   `z.string().email()` —— 只管语法，不管域名能不能收信。
 *
 * 这组测试钉的是：**格式合法但域名收不到信的地址，必须在写入前就被拒绝**。
 * 允许它注册 = 批量制造「永远无法自助找回密码」的僵尸账号。
 */
import { describe, it, expect } from "vitest";
import { registerSchema, completeProfileSchema } from "@/lib/validators";
import { UNDELIVERABLE_EMAIL_MESSAGE } from "@/lib/email/undeliverable";

/** 注册必填的最小合法载荷 */
function baseRegister(overrides: Record<string, unknown> = {}) {
  return {
    username: "testuser001",
    password: "secret123",
    confirmPassword: "secret123",
    // .com 构建下 dataCrossBorderConsent 必填；.cn 下是 optional，
    // 统一传 true 两边都能过，不影响本组测试要验的东西。
    dataCrossBorderConsent: true,
    ...overrides,
  };
}

describe("registerSchema —— 邮箱域名可达性", () => {
  it("拒绝 support@usedfarmmach.cn（本次事故地址）", () => {
    const r = registerSchema.safeParse(
      baseRegister({ email: "support@usedfarmmach.cn" })
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const messages = r.error.errors.map((e) => e.message);
      expect(messages).toContain(UNDELIVERABLE_EMAIL_MESSAGE);
    }
  });

  it("拒绝该域下的任意本地部分与子域", () => {
    for (const email of [
      "zhangsan@usedfarmmach.cn",
      "a@mail.usedfarmmach.cn",
      "Support@UsedFarmMach.CN",
    ]) {
      const r = registerSchema.safeParse(baseRegister({ email }));
      expect(r.success, email).toBe(false);
    }
  });

  it("正常邮箱照常通过（不能误伤）", () => {
    for (const email of [
      "787478895@qq.com",
      "support@shendiaotech.cn",
      "buyer@usedfarmmach.com",
      "user@gmail.com",
    ]) {
      const r = registerSchema.safeParse(baseRegister({ email }));
      expect(r.success, email).toBe(true);
    }
  });

  it("邮箱是可选字段：不传 / 传空串仍然合法（邮箱后补场景）", () => {
    expect(registerSchema.safeParse(baseRegister()).success).toBe(true);
    expect(registerSchema.safeParse(baseRegister({ email: "" })).success).toBe(
      true
    );
  });

  it("纯格式错误仍由原 .email() 报错，不被新校验掩盖", () => {
    const r = registerSchema.safeParse(baseRegister({ email: "not-an-email" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.errors.map((e) => e.message)).toContain(
        "Invalid email address"
      );
    }
  });
});

describe("completeProfileSchema —— 改邮箱同样受限", () => {
  // .com 构建下 dataCrossBorderConsent 必填，统一带上，避免测试被别的规则绊倒。
  const consent = { dataCrossBorderConsent: true };

  it("拒绝把账号邮箱改成 usedfarmmach.cn 死地址", () => {
    const r = completeProfileSchema.safeParse({
      email: "support@usedfarmmach.cn",
      ...consent,
    });
    expect(r.success).toBe(false);
  });

  it("正常邮箱可以保存", () => {
    const r = completeProfileSchema.safeParse({
      email: "787478895@qq.com",
      ...consent,
    });
    expect(r.success).toBe(true);
  });

  it("不传邮箱（只改资料）不受影响", () => {
    const r = completeProfileSchema.safeParse({
      companyName: "神雕农机",
      ...consent,
    });
    expect(r.success).toBe(true);
  });
});
