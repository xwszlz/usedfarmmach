/**
 * 卖家联系邮箱可见性 / 询价收件人判定 —— 回归测试
 *
 * 这组判定同时决定了三件事，任何一条错都会造成线上事故：
 *   ① 商品详情页展不展示卖家邮箱（`GET /api/products/[id]/contact`）
 *   ② 询价通知发给哪个信箱（`POST /api/auctions/[id]/bid`）
 *   ③ 卖家改了邮箱后旧验证要不要作废（`PUT /api/seller/products/[id]`）
 *
 * 改动前的真实 bug：页面展示 `Product.contactEmail`，询价通知却固定发 `User.email`
 * ⇒ 卖家在发布页填了邮箱却收不到询价。
 *
 * 安全底线：自由发布场景下任何人可填别人邮箱，
 * **未验证的 contactEmail 永不展示、永不投递**。
 */
import { describe, it, expect } from "vitest";
import {
  normalizeContactEmail,
  isContactEmailVerified,
  shouldExposeContactEmail,
  resolveInquiryRecipient,
  contactEmailChanged,
} from "../contact-visibility";

const VERIFIED_AT = new Date("2026-11-22T10:00:00Z");

describe("normalizeContactEmail", () => {
  it("去掉首尾空白后返回原样写法（不改大小写）", () => {
    expect(normalizeContactEmail("  Zhang@Example.COM ")).toBe("Zhang@Example.COM");
  });

  it("空值 / 空白 / 非法格式一律返回 null", () => {
    expect(normalizeContactEmail(null)).toBeNull();
    expect(normalizeContactEmail(undefined)).toBeNull();
    expect(normalizeContactEmail("")).toBeNull();
    expect(normalizeContactEmail("   ")).toBeNull();
    expect(normalizeContactEmail("not-an-email")).toBeNull();
    expect(normalizeContactEmail("a@b")).toBeNull();
    expect(normalizeContactEmail("a b@c.com")).toBeNull();
  });
});

describe("isContactEmailVerified", () => {
  it("有验证时间戳且邮箱合法才算已验证", () => {
    expect(isContactEmailVerified({ contactEmail: "a@b.com", contactEmailVerifiedAt: VERIFIED_AT })).toBe(true);
  });

  it("没有验证时间戳 ⇒ 未验证", () => {
    expect(isContactEmailVerified({ contactEmail: "a@b.com", contactEmailVerifiedAt: null })).toBe(false);
  });

  it("有验证时间但邮箱被改成非法值 ⇒ 视为未验证", () => {
    expect(isContactEmailVerified({ contactEmail: "bad", contactEmailVerifiedAt: VERIFIED_AT })).toBe(false);
  });
});

describe("shouldExposeContactEmail —— 公开开关 + 已验证，缺一不可", () => {
  it("公开且已验证 ⇒ 展示", () => {
    expect(
      shouldExposeContactEmail({
        contactEmail: "seller@qq.com",
        contactEmailPublic: true,
        contactEmailVerifiedAt: VERIFIED_AT,
      })
    ).toBe(true);
  });

  it("只公开但未验证 ⇒ 不展示（存量一百多条产品的默认状态）", () => {
    expect(
      shouldExposeContactEmail({
        contactEmail: "seller@qq.com",
        contactEmailPublic: true,
        contactEmailVerifiedAt: null,
      })
    ).toBe(false);
  });

  it("只验证但没勾选公开 ⇒ 不展示", () => {
    expect(
      shouldExposeContactEmail({
        contactEmail: "seller@qq.com",
        contactEmailPublic: false,
        contactEmailVerifiedAt: VERIFIED_AT,
      })
    ).toBe(false);
  });

  it("既没公开也没验证（新发布产品的默认值）⇒ 不展示", () => {
    expect(
      shouldExposeContactEmail({
        contactEmail: "seller@qq.com",
        contactEmailPublic: false,
        contactEmailVerifiedAt: null,
      })
    ).toBe(false);
  });
});

describe("resolveInquiryRecipient —— 收件人优先级", () => {
  const SELLER_ACCOUNT = "seller-account@163.com";

  it("已验证 contactEmail 优先（纯协议上修掉「填了邮箱收不到询价」的老 bug）", () => {
    expect(
      resolveInquiryRecipient({
        product: {
          contactEmail: "seller@qq.com",
          contactEmailPublic: true,
          contactEmailVerifiedAt: VERIFIED_AT,
        },
        sellerEmail: SELLER_ACCOUNT,
      })
    ).toEqual({ email: "seller@qq.com", source: "contact" });
  });

  it("未验证 contactEmail ⇒ 回落账号邮箱（绝不投递未验证地址）", () => {
    expect(
      resolveInquiryRecipient({
        product: {
          contactEmail: "victim@example.com",
          contactEmailPublic: true,
          contactEmailVerifiedAt: null,
        },
        sellerEmail: SELLER_ACCOUNT,
      })
    ).toEqual({ email: SELLER_ACCOUNT, source: "account" });
  });

  it("未勾选公开但已验证 ⇒ 询价仍发到 contactEmail（不公开 ≠ 不想收通知）", () => {
    expect(
      resolveInquiryRecipient({
        product: {
          contactEmail: "seller@qq.com",
          contactEmailPublic: false,
          contactEmailVerifiedAt: VERIFIED_AT,
        },
        sellerEmail: SELLER_ACCOUNT,
      })
    ).toEqual({ email: "seller@qq.com", source: "contact" });
  });

  it("两个都没有 ⇒ none（站内信照发，只是不发邮件）", () => {
    expect(
      resolveInquiryRecipient({
        product: { contactEmail: null, contactEmailPublic: false, contactEmailVerifiedAt: null },
        sellerEmail: null,
      })
    ).toEqual({ email: null, source: "none" });
  });

  it("contactEmail 是非法字符串时不当作有效收件人", () => {
    expect(
      resolveInquiryRecipient({
        product: {
          contactEmail: "not-an-email",
          contactEmailPublic: true,
          contactEmailVerifiedAt: VERIFIED_AT,
        },
        sellerEmail: SELLER_ACCOUNT,
      })
    ).toEqual({ email: SELLER_ACCOUNT, source: "account" });
  });
});

describe("contactEmailChanged —— 改邮箱必须作废旧验证", () => {
  it("大小写不同视为同一个邮箱（不误清验证状态）", () => {
    expect(contactEmailChanged("Seller@QQ.com", "seller@qq.com")).toBe(false);
  });

  it("首尾空格不算变更", () => {
    expect(contactEmailChanged(" seller@qq.com ", "seller@qq.com")).toBe(false);
  });

  it("换成另一个邮箱 ⇒ true（否则「验证 A → 改成 B」可绕过验证）", () => {
    expect(contactEmailChanged("a@qq.com", "b@qq.com")).toBe(true);
  });

  it("从空到有 / 从有到空 ⇒ true", () => {
    expect(contactEmailChanged(null, "a@qq.com")).toBe(true);
    expect(contactEmailChanged("a@qq.com", null)).toBe(true);
    expect(contactEmailChanged("a@qq.com", "")).toBe(true);
  });
});

/**
 * 不可投递域拦截（2026-11-27 追加）
 *
 * 卖家邮箱是「验证通过后展示给买家、并接收询盘」的通道。若卖家填了
 * `xxx@usedfarmmach.cn`（该域无 MX，实测必退信），验证邮件根本发不出去，
 * 卖家会永远卡在「未验证」且不知道为什么 —— 所以在归一化阶段就判为不合格。
 */
describe("normalizeContactEmail —— 拦截不可投递域", () => {
  it("usedfarmmach.cn 地址判为不合格（返回 null）", () => {
    expect(normalizeContactEmail("support@usedfarmmach.cn")).toBeNull();
    expect(normalizeContactEmail("someone@mail.usedfarmmach.cn")).toBeNull();
  });

  it("正常邮箱仍然通过（不能误伤）", () => {
    expect(normalizeContactEmail("787478895@qq.com")).toBe("787478895@qq.com");
    expect(normalizeContactEmail("support@shendiaotech.cn")).toBe(
      "support@shendiaotech.cn"
    );
  });

  it("不合格的地址即使带验证时间戳，也不算已验证", () => {
    expect(
      isContactEmailVerified({
        contactEmail: "support@usedfarmmach.cn",
        contactEmailVerifiedAt: new Date(),
      })
    ).toBe(false);
  });
});
