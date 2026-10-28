/**
 * 回归锁：/api/credits/recharge 的「积分数 === 实付分值」不变量
 *
 * 背景（.cn 丢钱 bug）：旧实现下单时积分用 `Math.floor(amount*100)`、实付给微信的金额用
 * `Math.round(amount*100)`。浮点误差下两者会差 1 分（如 `1.15*100 = 114.99999999999999`
 * ⇒ floor 114 / round 115），而回调侧是「实付分 !== credits 就判 amount mismatch」，
 * 结果是用户钱付了、积分不到账（微信重投 15 次后放弃）。
 *
 * 本文件把「下单积分数 === 下单实付分值」钉成不变量，覆盖四个已知会触发浮点误差的金额。
 *
 * 另外锁住 .com 的解耦不变量：**实付金额 ≠ 发放积分**（USD 积分要按汇率折回人民币口径），
 * 若有人再写回 `unitAmount = credits`，`$10` 会被收成 `$66.92`。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// fx.ts 顶层 import 了 @/lib/db（依赖 DATABASE_URL），单测桩掉
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/config/site", () => ({ isComSite: vi.fn(() => false) }));
vi.mock("@/lib/wechat-pay", () => ({
  isConfigured: vi.fn(() => true),
  createNativeOrder: vi.fn(),
}));
vi.mock("@/lib/alipay", () => ({
  isConfigured: vi.fn(() => true),
  createPrecreateOrder: vi.fn(),
}));
vi.mock("@/lib/payments/paddle", () => ({
  isConfigured: vi.fn(() => true),
  createCreditRechargeTransaction: vi.fn(),
}));

import { getUserFromRequest } from "@/lib/auth";
import { isComSite } from "@/config/site";
import { createNativeOrder } from "@/lib/wechat-pay";
import { createPrecreateOrder } from "@/lib/alipay";
import { createCreditRechargeTransaction } from "@/lib/payments/paddle";
import { POST } from "@/app/api/credits/recharge/route";

function makeReq(body: unknown) {
  return new NextRequest("https://usedfarmmach.cn/api/credits/recharge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 0 } as any);
  vi.mocked(isComSite).mockReturnValue(false);
  vi.mocked(createNativeOrder).mockResolvedValue({ code_url: "weixin://wxpay/x" } as any);
  vi.mocked(createPrecreateOrder).mockResolvedValue({ qr_code: "https://qr.alipay/x", out_trade_no: "o1" } as any);
  vi.mocked(createCreditRechargeTransaction).mockResolvedValue({
    checkoutUrl: "https://pay.paddle/x",
    transactionId: "txn_1",
  });
});

describe("① .cn 微信：积分 === 实付分值（浮点误差回归锁）", () => {
  const cases: Array<[number, number]> = [
    // amount, 期望分值（= 期望积分）
    [1.15, 115], // 1.15*100 = 114.99999999999999 → 旧实现 floor 得到 114（差 1 分）
    [0.07, 7],
    [0.29, 29], // 0.29*100 = 28.999999999999996 → 旧实现 floor 得到 28
    [19.99, 1999], // 19.99*100 = 1998.9999999999998 → 旧实现 floor 得到 1998
  ];

  for (const [amount, cents] of cases) {
    it(`amount=${amount} → credits=${cents}，且下单实付分 === credits`, async () => {
      const res = await POST(makeReq({ amount, channel: "wechat" }));
      expect(res.status).toBe(200);
      const j = await res.json();
      expect(j.success).toBe(true);
      expect(j.data.type).toBe("wechat");
      expect(j.data.credits).toBe(cents);

      // 不变量：传给微信的 total（分）与入账积分严格相等 —— 回调据此校验，不等就是丢钱
      expect(createNativeOrder).toHaveBeenCalledTimes(1);
      const amountInCents = vi.mocked(createNativeOrder).mock.calls[0][1];
      expect(amountInCents).toBe(cents);
      expect(amountInCents).toBe(j.data.credits);
    });
  }

  it("两位小数全量扫描：0.01~20.00 每一分钱都满足 credits === 实付分", async () => {
    // 逐分钱扫，覆盖全部浮点误差点（不只四个样本）
    for (let cents = 1; cents <= 2000; cents++) {
      const amount = cents / 100;
      vi.mocked(createNativeOrder).mockClear();
      const res = await POST(makeReq({ amount, channel: "wechat" }));
      const j = await res.json();
      expect(j.data.credits).toBe(cents);
      expect(vi.mocked(createNativeOrder).mock.calls[0][1]).toBe(cents);
    }
  });
});

describe("② .cn 支付宝：实付「元」与 credits 同源", () => {
  it("amount=1.15 → credits=115，支付宝实付元额折算回分后仍等于 115", async () => {
    const res = await POST(makeReq({ amount: 1.15, channel: "alipay" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.type).toBe("alipay");
    expect(j.data.credits).toBe(115);

    const amountYuan = vi.mocked(createPrecreateOrder).mock.calls[0][1];
    // 回调侧校验口径：Number(total_amount) === pc.credits / 100
    expect(Number(amountYuan.toFixed(2))).toBe(115 / 100);
    expect(Math.round(amountYuan * 100)).toBe(115);
  });
});

describe("③ .com Paddle：实付金额与发放积分解耦", () => {
  it("$10 → credits=6692（按汇率折回人民币），实付仍是 1000 美分", async () => {
    vi.mocked(isComSite).mockReturnValue(true);

    const res = await POST(makeReq({ amount: 10 }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.type).toBe("paddle");
    expect(j.data.credits).toBe(6692);

    const arg = vi.mocked(createCreditRechargeTransaction).mock.calls[0][0];
    expect(arg.credits).toBe(6692);
    expect(arg.amountCents).toBe(1000);
    expect(arg.currency).toBe("USD");
    // 红线：金额绝不能被 credits 反推（否则 $10 被收成 $66.92）
    expect(arg.amountCents).not.toBe(arg.credits);
  });

  it("$100 → credits=66920，实付 10000 美分", async () => {
    vi.mocked(isComSite).mockReturnValue(true);

    const res = await POST(makeReq({ amount: 100 }));
    const j = await res.json();
    expect(j.data.credits).toBe(66920);

    const arg = vi.mocked(createCreditRechargeTransaction).mock.calls[0][0];
    expect(arg.amountCents).toBe(10000);
  });

  it("金额为 0 → 400（credits < 1 时不下单）", async () => {
    vi.mocked(isComSite).mockReturnValue(true);
    const res = await POST(makeReq({ amount: 0 }));
    expect(res.status).toBe(400);
    expect(createCreditRechargeTransaction).not.toHaveBeenCalled();
  });
});
