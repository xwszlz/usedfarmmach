/**
 * 销售策略 · 渠道联系方式显示口径回归锁（线上事故 hotfix）
 * ─────────────────────────────────────────────────────────────
 * 事故现象（生产环境，`.cn` + `.com` 同时中招）：
 *   `ai-sales-strategy-card.tsx` 把「解锁态取值 + 空值占位」写成无括号的多层三目
 *
 *     {full ? full.phone || zh ? "无" : "—" : c.phoneMasked || zh ? "无电话" : "—"}
 *
 *   `||` 优先级高于 `?:` ⇒ 实际语义变成
 *     `full ? ((full.phone || zh) ? "无" : "—") : ((c.phoneMasked || zh) ? "无电话" : "—")`
 *   ⇒ **用户花积分解锁后看到的是「无」**，未解锁有掩码时看到的是「无电话」。
 *   电话、邮箱两列全坏。
 *
 * 本文件锁死（任何一条变红都说明这段口径被改坏了）：
 *   ① 已解锁 + 有号码 ⇒ 渲染号码本身（**不是**「无」）——事故的直接回归锁；
 *   ② 已解锁 + 无号码 ⇒ 「无」；
 *   ③ 未解锁 + 有掩码 ⇒ 渲染掩码（**不是**「无电话」）——事故的第二个方向；
 *   ④ 未解锁 + 无掩码 ⇒ 「无电话」；
 *   ⑤ 邮箱四种场景同 ①–④（占位为「无邮箱」）；
 *   ⑥ `zh=false` 时以上全部走英文/破折号占位，**且输出不含任何中文字符**；
 *   ⑦ 微信口径与改造前逐字等价（无微信线索 ⇒ `null` 不渲染）。
 *
 * 运行：`npx vitest run src/lib/sales-strategy/__tests__/contact-display.test.ts`
 */
import { describe, expect, it } from "vitest";
import {
  CONTACT_DASH,
  formatEmailDisplay,
  formatPhoneDisplay,
  formatWechatDisplay,
  resolveChannelContactDisplay,
  type MaskedContact,
  type UnlockedContact,
} from "@/lib/sales-strategy/contact-display";

/** 中文正则：任何一处漏翻都会被抓到 */
const CJK = /[\u4e00-\u9fa5]/;

/**
 * 造一份「源数据齐备」的脱敏联系方式（对应生成接口 `channels[]` 单项）。
 *
 * 口径依据 `api/agents/seller-helper/sales-strategy/route.ts:700-702`：
 * 源数据缺失时对应字段是**空串**，而不是 null。
 */
function masked(overrides: Partial<MaskedContact> = {}): MaskedContact {
  return {
    phoneMasked: "+49 171 ****567",
    wechatMasked: "微信:********",
    emailMasked: "in**@example.com",
    ...overrides,
  };
}

/** 造一份「三项齐备」的解锁明文（对应 `unlocked[candidateId]`） */
function unlocked(overrides: Partial<UnlockedContact> = {}): UnlockedContact {
  return {
    phone: "+49 171 1234567",
    wechat: "dealer-wx-0049",
    email: "info@example.com",
    ...overrides,
  };
}

describe("formatPhoneDisplay · 已解锁（付费用户视角）", () => {
  it("① 已解锁 + 有号码 ⇒ 渲染号码本身（回归锁：绝不能是「无」）", () => {
    const out = formatPhoneDisplay(unlocked(), masked(), true);
    expect(out).toBe("+49 171 1234567");
    expect(out, "用户已付费解锁却看到「无」——线上事故原样复现").not.toBe("无");
    expect(out).not.toBe(masked().phoneMasked);
  });

  it("② 已解锁 + 无号码（空串）⇒ 中文站「无」", () => {
    expect(formatPhoneDisplay(unlocked({ phone: "" }), masked(), true)).toBe("无");
  });

  it("② 已解锁 + 无号码 ⇒ 英文站破折号（不出现中文）", () => {
    const out = formatPhoneDisplay(unlocked({ phone: "" }), masked(), false);
    expect(out).toBe(CONTACT_DASH);
    expect(out).not.toMatch(CJK);
  });

  it("已解锁时不受脱敏数据影响：掩码为空也照样出明文", () => {
    expect(formatPhoneDisplay(unlocked(), masked({ phoneMasked: "" }), true)).toBe("+49 171 1234567");
  });

  it("已解锁 + 空号码 + 空掩码 ⇒ 中文站仍是「无」（不是「无电话」）", () => {
    expect(formatPhoneDisplay(unlocked({ phone: "" }), masked({ phoneMasked: "" }), true)).toBe("无");
  });
});

describe("formatPhoneDisplay · 未解锁（掩码态）", () => {
  it("③ 未解锁 + 有掩码 ⇒ 渲染掩码本身（回归锁：绝不能是「无电话」）", () => {
    const out = formatPhoneDisplay(undefined, masked(), true);
    expect(out).toBe("+49 171 ****567");
    expect(out, "有线索却显示「无电话」，等于把可联系的线索藏起来").not.toBe("无电话");
  });

  it("③ 未解锁传 null 效果同 undefined", () => {
    expect(formatPhoneDisplay(null, masked(), true)).toBe("+49 171 ****567");
  });

  it("④ 未解锁 + 无掩码（空串）⇒ 中文站「无电话」", () => {
    expect(formatPhoneDisplay(undefined, masked({ phoneMasked: "" }), true)).toBe("无电话");
  });

  it("④ 未解锁 + 无掩码 ⇒ 英文站破折号（不出现中文）", () => {
    const out = formatPhoneDisplay(undefined, masked({ phoneMasked: "" }), false);
    expect(out).toBe(CONTACT_DASH);
    expect(out).not.toMatch(CJK);
  });
});

describe("formatEmailDisplay · 已解锁", () => {
  it("① 已解锁 + 有邮箱 ⇒ 渲染邮箱本身（回归锁：绝不能是「无」）", () => {
    const out = formatEmailDisplay(unlocked(), masked(), true);
    expect(out).toBe("info@example.com");
    expect(out, "邮箱列同样被优先级 bug 打坏").not.toBe("无");
    expect(out).not.toBe(masked().emailMasked);
  });

  it("② 已解锁 + 无邮箱（空串）⇒ 中文站「无」", () => {
    expect(formatEmailDisplay(unlocked({ email: "" }), masked(), true)).toBe("无");
  });

  it("② 已解锁 + 无邮箱 ⇒ 英文站破折号（不出现中文）", () => {
    const out = formatEmailDisplay(unlocked({ email: "" }), masked(), false);
    expect(out).toBe(CONTACT_DASH);
    expect(out).not.toMatch(CJK);
  });
});

describe("formatEmailDisplay · 未解锁（掩码态）", () => {
  it("③ 未解锁 + 有掩码邮箱 ⇒ 渲染掩码本身（绝不能是「无邮箱」）", () => {
    const out = formatEmailDisplay(undefined, masked(), true);
    expect(out).toBe("in**@example.com");
    expect(out).not.toBe("无邮箱");
  });

  it("③ 未解锁传 null 效果同 undefined", () => {
    expect(formatEmailDisplay(null, masked(), true)).toBe("in**@example.com");
  });

  it("④ 未解锁 + 无掩码（空串）⇒ 中文站「无邮箱」", () => {
    expect(formatEmailDisplay(undefined, masked({ emailMasked: "" }), true)).toBe("无邮箱");
  });

  it("④ 未解锁 + 无掩码 ⇒ 英文站破折号（不出现中文）", () => {
    const out = formatEmailDisplay(undefined, masked({ emailMasked: "" }), false);
    expect(out).toBe(CONTACT_DASH);
    expect(out).not.toMatch(CJK);
  });
});

describe("中英双语全覆盖 · zh=false 绝不出现中文", () => {
  const cases: Array<[string, UnlockedContact | undefined, MaskedContact]> = [
    ["已解锁·齐备", unlocked(), masked()],
    ["已解锁·全空", unlocked({ phone: "", email: "", wechat: "" }), masked()],
    ["未解锁·齐备", undefined, masked()],
    ["未解锁·全空", undefined, masked({ phoneMasked: "", emailMasked: "", wechatMasked: "" })],
  ];

  it("六种输出组合在 zh=true 时全部有值且为字符串", () => {
    for (const [label, full, mk] of cases) {
      const out = resolveChannelContactDisplay(full, mk, true);
      expect(typeof out.phone, `${label} · phone`).toBe("string");
      expect(out.phone.length, `${label} · phone 不能为空串（否则界面出现空白）`).toBeGreaterThan(0);
      expect(out.email.length, `${label} · email 不能为空串`).toBeGreaterThan(0);
    }
  });

  it("zh=false：telephone / email 两列永不含中文字符", () => {
    for (const [label, full, mk] of cases) {
      const out = resolveChannelContactDisplay(full, mk, false);
      expect(out.phone, `${label} · phone 出现中文`).not.toMatch(CJK);
      expect(out.email, `${label} · email 出现中文`).not.toMatch(CJK);
    }
  });

  it("zh=false：中文专有占位「无 / 无电话 / 无邮箱」一个都不能出现", () => {
    const zhOnly = ["无", "无电话", "无邮箱"];
    for (const [label, full, mk] of cases) {
      const out = resolveChannelContactDisplay(full, mk, false);
      for (const word of zhOnly) {
        expect(out.phone, `${label} · phone 泄露中文占位「${word}」`).not.toBe(word);
        expect(out.email, `${label} · email 泄露中文占位「${word}」`).not.toBe(word);
      }
    }
  });
});

describe("formatWechatDisplay · 与改造前逐字等价（本次热修不改语义）", () => {
  it("未解锁 + 有微信线索 ⇒ 渲染服务端脱敏占位", () => {
    expect(formatWechatDisplay(undefined, masked())).toBe("微信:********");
  });

  it("已解锁 + 有明文微信 ⇒ 渲染明文", () => {
    expect(formatWechatDisplay(unlocked(), masked())).toBe("dealer-wx-0049");
  });

  it("已解锁但明文微信为空 ⇒ 回落脱敏占位（不渲染空白）", () => {
    expect(formatWechatDisplay(unlocked({ wechat: "" }), masked())).toBe("微信:********");
  });

  it("无微信线索（空串）⇒ null，卡片整个 span 不渲染", () => {
    expect(formatWechatDisplay(undefined, masked({ wechatMasked: "" }))).toBeNull();
    expect(formatWechatDisplay(unlocked(), masked({ wechatMasked: "" }))).toBeNull();
  });
});

describe("resolveChannelContactDisplay · 三段聚合", () => {
  it("未解锁齐备：电话/邮箱是掩码、微信是占位（三列同时有内容，一个字都不能丢）", () => {
    const out = resolveChannelContactDisplay(undefined, masked(), true);
    expect(out).toEqual({
      phone: "+49 171 ****567",
      email: "in**@example.com",
      wechat: "微信:********",
    });
  });

  it("已解锁齐备：三段全部明文", () => {
    const out = resolveChannelContactDisplay(unlocked(), masked(), true);
    expect(out).toEqual({
      phone: "+49 171 1234567",
      email: "info@example.com",
      wechat: "dealer-wx-0049",
    });
  });

  it("已解锁全空 + 中文站：电话/邮箱「无」，微信回落占位", () => {
    const out = resolveChannelContactDisplay(unlocked({ phone: "", email: "", wechat: "" }), masked(), true);
    expect(out).toEqual({ phone: "无", email: "无", wechat: "微信:********" });
  });
});

describe("运行时防御 · 上游脏数据不得把整块打到白屏", () => {
  it("字段缺失 / 非字符串时按空值处理（LLM 或老响应可能不带这些键）", () => {
    const dirty = { phoneMasked: undefined, emailMasked: null, wechatMasked: "" } as unknown as MaskedContact;
    const out = resolveChannelContactDisplay(undefined, dirty, true);
    expect(out).toEqual({ phone: "无电话", email: "无邮箱", wechat: null });
  });

  it("解锁对象字段为非字符串时同样回落占位，不抛异常", () => {
    const dirty = { phone: 12345, wechat: null, email: {} } as unknown as UnlockedContact;
    const out = resolveChannelContactDisplay(dirty, masked(), true);
    expect(out.phone).toBe("无");
    expect(out.email).toBe("无");
    // 微信：明文非字符串 ⇒ 回落服务端脱敏占位，仍不渲染空白
    expect(out.wechat).toBe("微信:********");
  });
});
