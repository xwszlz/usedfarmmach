/**
 * 不可投递收件域拦截（src/lib/email/undeliverable.ts）单测。
 *
 * 这个模块的存在理由是一起真实事故（2026-11-27）：
 * `.cn` 库有一个 `email = support@usedfarmmach.cn` 的账号，注册/触发验证时
 * 系统照常发信，腾讯企业邮立刻退回 ——
 *   `Name service error for name=usedfarmmach.cn type=MX: Host not found`
 * 用户以为注册好了，我们只在 PostMaster 里看到退信，代码全程无感知。
 *
 * 测试要钉住的红线：
 * 1. 死域必须拦住，且**子域一起拦**（`a@x.usedfarmmach.cn` 同样没有 MX）
 * 2. 正常域**绝不能误伤** —— 误伤的表现是「注册页报错说邮箱不可用」，
 *    这种故障极难联想到是黑名单写多了
 * 3. 格式问题不归它管：非法邮箱返回 false，交给 zod/.email() 去报
 */
import { describe, it, expect } from "vitest";
import {
  UNDELIVERABLE_DOMAINS,
  emailDomainOf,
  isUndeliverableEmail,
  shouldBlockDelivery,
} from "@/lib/email/undeliverable";

describe("emailDomainOf", () => {
  it("取 @ 之后的部分并小写", () => {
    expect(emailDomainOf("A@Example.COM")).toBe("example.com");
  });

  it("能从带显示名的写法里取出来", () => {
    expect(emailDomainOf("Ada Lovelace <ada@example.com>")).toBe("example.com");
  });

  it("去掉首尾空白", () => {
    expect(emailDomainOf("  ada@example.com  ")).toBe("example.com");
  });

  it("没有 @ / @ 结尾 / 域名无点 → null", () => {
    expect(emailDomainOf("no-at-sign")).toBeNull();
    expect(emailDomainOf("trailing@")).toBeNull();
    expect(emailDomainOf("local@localhost")).toBeNull();
  });

  it("空值与 undefined → null", () => {
    expect(emailDomainOf("")).toBeNull();
    expect(emailDomainOf(null)).toBeNull();
    expect(emailDomainOf(undefined)).toBeNull();
  });
});

describe("isUndeliverableEmail —— 死域必须拦住", () => {
  it("support@usedfarmmach.cn 命中（本次事故地址）", () => {
    expect(isUndeliverableEmail("support@usedfarmmach.cn")).toBe(true);
  });

  it("任意本地部分命中（不是只拦 support）", () => {
    expect(isUndeliverableEmail("zhangsan@usedfarmmach.cn")).toBe(true);
    expect(isUndeliverableEmail("a.b+c@usedfarmmach.cn")).toBe(true);
  });

  it("大小写不敏感", () => {
    expect(isUndeliverableEmail("Support@UsedFarmMach.CN")).toBe(true);
  });

  it("子域一起拦（子域同样没有 MX）", () => {
    expect(isUndeliverableEmail("x@mail.usedfarmmach.cn")).toBe(true);
    expect(isUndeliverableEmail("x@a.b.usedfarmmach.cn")).toBe(true);
  });

  it("带显示名也能拦", () => {
    expect(isUndeliverableEmail("客服 <support@usedfarmmach.cn>")).toBe(true);
  });
});

describe("isUndeliverableEmail —— 绝不能误伤", () => {
  it("usedfarmmach.com 可收（MX 指向 Resend 收信）", () => {
    expect(isUndeliverableEmail("support@usedfarmmach.com")).toBe(false);
  });

  it("shendiaotech.cn 可收（MX 指向腾讯企业邮）—— 这是 .cn 真实在用的客服地址", () => {
    expect(isUndeliverableEmail("support@shendiaotech.cn")).toBe(false);
  });

  it("普通第三方邮箱不误伤", () => {
    for (const addr of [
      "787478895@qq.com",
      "someone@163.com",
      "user@gmail.com",
      "buyer@outlook.com",
    ]) {
      expect(isUndeliverableEmail(addr), addr).toBe(false);
    }
  });

  it("形似但不同的域不能误判", () => {
    // 后缀相同但不是该域
    expect(isUndeliverableEmail("x@notusedfarmmach.cn")).toBe(false);
    // 前缀匹配不能当后缀匹配
    expect(isUndeliverableEmail("x@usedfarmmach.cn.evil.com")).toBe(false);
  });

  it("非法输入不报错、返回 false（格式问题不归这里管）", () => {
    expect(isUndeliverableEmail("")).toBe(false);
    expect(isUndeliverableEmail(null)).toBe(false);
    expect(isUndeliverableEmail(undefined)).toBe(false);
    expect(isUndeliverableEmail("not-an-email")).toBe(false);
  });
});

describe("shouldBlockDelivery（发信层兜底的判据）", () => {
  it("死地址 → 拦", () => {
    expect(shouldBlockDelivery("support@usedfarmmach.cn")).toBe(true);
  });

  it("正常地址 → 放行", () => {
    expect(shouldBlockDelivery("support@shendiaotech.cn")).toBe(false);
  });
});

describe("黑名单常量本身", () => {
  it("目前只应有 usedfarmmach.cn 一条；新增条目必须同步更新注释里的 MX 实测依据", () => {
    expect([...UNDELIVERABLE_DOMAINS]).toEqual(["usedfarmmach.cn"]);
  });

  it("条目必须是纯域名，不带 @ 或协议前缀", () => {
    for (const d of UNDELIVERABLE_DOMAINS) {
      expect(d).not.toContain("@");
      expect(d).not.toContain("://");
      expect(d).toBe(d.toLowerCase());
    }
  });
});
