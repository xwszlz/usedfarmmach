import { describe, it, expect } from "vitest";
import { normalizeEmail } from "@/components/ui/email-link";
import { translate } from "@/lib/i18n-runtime";
import { RT_LOCALES } from "@/lib/i18n-types";

/**
 * EmailLink 的地址归一化。
 *
 * 起因（2026-11-21）：`.com` 站点的邮箱点击唤不起发信界面，根因在本机 mailto 关联，
 * 但顺带查出卖家联系卡用的是 `mailto:${contact.contactEmail}`，卖家自填的脏数据
 * （空串 / 带空格 / 根本不是邮箱）会拼出空的 `mailto:`，同样是点不开的死链。
 * 这里把归一化口径钉死，防止回退。
 */
describe("normalizeEmail", () => {
  it("正常地址原样返回", () => {
    expect(normalizeEmail("support@usedfarmmach.com")).toBe("support@usedfarmmach.com");
    expect(normalizeEmail("sales@usedfarmmach.com")).toBe("sales@usedfarmmach.com");
  });

  it("前后空格会被修掉（卖家手填最常见的脏数据）", () => {
    expect(normalizeEmail("  sales@usedfarmmach.com ")).toBe("sales@usedfarmmach.com");
    expect(normalizeEmail("\tmarketing@usedfarmmach.com\n")).toBe("marketing@usedfarmmach.com");
  });

  it("plus 地址与多级域名不能被误杀", () => {
    expect(normalizeEmail("a+b@usedfarmmach.com")).toBe("a+b@usedfarmmach.com");
    expect(normalizeEmail("x@mail.usedfarmmach.com")).toBe("x@mail.usedfarmmach.com");
  });

  it("空值一律返回 null，调用方据此整行不渲染", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("非法格式返回 null，避免拼出空的 mailto:", () => {
    expect(normalizeEmail("abc")).toBeNull();
    expect(normalizeEmail("a b@c.com")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("@usedfarmmach.com")).toBeNull();
    expect(normalizeEmail("sales@")).toBeNull();
  });
});

/**
 * 「已复制」是 EmailLink 唯一的用户可见文案（小信封已于 2026-11-21 按老板要求去掉，
 * 「在邮件应用中打开」/「已复制，可粘贴到邮件应用」两条字典项随之停用）。
 * 字典漏翻会直接让外语访客看到中文，所以这里逐个语言断言非空。
 */
describe("EmailLink 文案的 8 语覆盖", () => {
  for (const key of ["已复制"]) {
    it(`"${key}" 在 8 种语言下都有译文且不是源中文`, () => {
      for (const loc of RT_LOCALES) {
        const out = translate(key, loc);
        expect(out, `${key} @ ${loc}`).toBeTruthy();
        if (loc !== "zh") {
          expect(out, `${key} @ ${loc} 回落成了中文源串`).not.toBe(key);
        }
      }
    });
  }
});
