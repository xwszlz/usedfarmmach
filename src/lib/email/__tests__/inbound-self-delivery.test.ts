import { describe, it, expect } from "vitest";
import { isOwnAddress, isSelfDelivery, pickReplyTo } from "@/lib/email/inbound";

/**
 * 2026-11-21 线上事故回归：网站联系表单通知被自域保险静默丢弃。
 *
 * 现象：老板在 `/contact` 提交表单，页面提示成功；Resend Inbox
 * `support@usedfarmmach.com` 里确实能看到那封信，但腾讯企业邮群组和企业微信群
 * 永远收不到 —— 因为通知信的 From 取 `EMAIL_FROM`（`support@usedfarmmach.com`），
 * 命中 `isOwnAddress` 后整封信被判 `skipped: "own-domain"`，返回 200 静默跳过。
 */
describe("isSelfDelivery —— 自投递放行（表单通知不被当内部往来信丢掉）", () => {
  it("From == To（表单通知的真实形态）判为自投递", () => {
    expect(
      isSelfDelivery("support@usedfarmmach.com", ["support@usedfarmmach.com"])
    ).toBe(true);
  });

  it("收件地址带显示名、大小写不同也认", () => {
    expect(
      isSelfDelivery("support@usedfarmmach.com", [
        "UsedFarmMach <Support@UsedFarmMach.com>",
      ])
    ).toBe(true);
  });

  it("多个收件人里只要有一个等于发件人就算自投递", () => {
    expect(
      isSelfDelivery("sales@usedfarmmach.com", [
        "someone@example.com",
        "sales@usedfarmmach.com",
      ])
    ).toBe(true);
  });

  it("From != To（群组成员回信 A→B）不算自投递，回路保险继续生效", () => {
    expect(
      isSelfDelivery("support@shendiaotech.cn", ["support@usedfarmmach.com"])
    ).toBe(false);
  });

  it("发件人为空 / 收件人缺失时一律不算自投递（保守拦截）", () => {
    expect(isSelfDelivery(null, ["support@usedfarmmach.com"])).toBe(false);
    expect(isSelfDelivery("support@usedfarmmach.com", undefined)).toBe(false);
    expect(isSelfDelivery("support@usedfarmmach.com", [])).toBe(false);
  });
});

describe("自域保险的组合判定（与 forwarder 里的真实条件一致）", () => {
  const shouldSkip = (from: string, to: string[]) =>
    isOwnAddress(from) && !isSelfDelivery(from, to);

  it("表单通知：自家域名且自己发给自己 ⇒ 必须放行", () => {
    expect(
      shouldSkip("support@usedfarmmach.com", ["support@usedfarmmach.com"])
    ).toBe(false);
  });

  it("外部客户来信 ⇒ 放行（本来就不该拦）", () => {
    expect(shouldSkip("buyer@example.com", ["sales@usedfarmmach.com"])).toBe(
      false
    );
  });

  it("企业邮群组回灌到 .com 收件箱 ⇒ 仍然拦（这才是真正的回路风险）", () => {
    expect(
      shouldSkip("support@shendiaotech.cn", ["support@usedfarmmach.com"])
    ).toBe(true);
  });
});

describe("pickReplyTo —— 表单通知的回复要能回到访客", () => {
  it("取到 Reply-To，键名任意大小写", () => {
    expect(pickReplyTo({ "Reply-To": "932133255@qq.com" })).toBe(
      "932133255@qq.com"
    );
    expect(pickReplyTo({ "reply-to": "932133255@qq.com" })).toBe(
      "932133255@qq.com"
    );
  });

  it("带显示名也能抠出地址", () => {
    expect(pickReplyTo({ "reply-to": "openclaw <a@b.com>" })).toBe("a@b.com");
  });

  it("没有 Reply-To / 值非法时返回 null（调用方回退发件人）", () => {
    expect(pickReplyTo(null)).toBe(null);
    expect(pickReplyTo({ "x-mailer": "Resend" })).toBe(null);
    expect(pickReplyTo({ "reply-to": "not-an-email" })).toBe(null);
  });
});
