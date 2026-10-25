/**
 * 单元测试：积分扣减核心 spend.ts（deduct.ts 的底层依赖）
 * 风险点 ④：绝不产生负余额 + FIFO 减 CreditLot。
 * —— 通过 mock prisma 的 $transaction，在内存里模拟 FIFO 扣减与余额校验，验证红线。
 *
 * 运行：npm test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// 仅 mock 掉会被 spend 引入的外部依赖；spend 的真实扣减逻辑被直接测试
vi.mock("@/lib/credits/fx", () => ({
  getCurrencyOfCountry: vi.fn(() => "CNY"),
  getUnit: vi.fn(() => 1),
  getRdSync: vi.fn(() => 1),
}));
vi.mock("@/config/site", () => ({
  isComSite: () => true,
  isCnSite: () => true,
  SITE: "cn",
  siteConfig: {},
}));

const h = vi.hoisted(() => {
  const store = {
    users: new Map<string, { credits: number }>(),
    lots: [] as Array<{
      id: string;
      userId: string;
      remainingAmount: number;
      expiresAt: Date;
      account: string;
    }>,
    txns: [] as any[],
  };

  const tx = {
    user: {
      findUnique: async ({ where }: any) => ({
        credits: store.users.get(where.id)?.credits ?? 0,
      }),
      update: async ({ where, data }: any) => {
        const u = store.users.get(where.id)!;
        u.credits -= data.credits.decrement;
        return u;
      },
    },
    creditLot: {
      findMany: async () =>
        store.lots
          .filter((l) => l.remainingAmount > 0)
          .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime()),
      update: async ({ where, data }: any) => {
        const lot = store.lots.find((l) => l.id === where.id)!;
        lot.remainingAmount -= data.remainingAmount.decrement;
        return lot;
      },
    },
    creditTransaction: {
      create: async ({ data }: any) => {
        store.txns.push(data);
        return data;
      },
    },
  };

  const prisma = {
    $transaction: async (fn: any) => fn(tx),
  };

  return { store, prisma, tx };
});

vi.mock("@/lib/db", () => ({ prisma: h.prisma }));

import { deductCredits } from "@/lib/credits/spend";

function seed() {
  h.store.users = new Map<string, { credits: number }>([["u1", { credits: 1000 }]]);
  const now = Date.now();
  h.store.lots = [
    // 先过期的小批次（gift）
    {
      id: "L1",
      userId: "u1",
      remainingAmount: 100,
      expiresAt: new Date(now + 86_400_000),
      account: "gift",
    },
    // 后过期的大批次（recharge）
    {
      id: "L2",
      userId: "u1",
      remainingAmount: 500,
      expiresAt: new Date(now + 86_400_000 * 30),
      account: "recharge",
    },
  ];
  h.store.txns = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  seed();
});

describe("deductCredits —— FIFO + 绝不产生负余额", () => {
  it("FIFO：按过期时间升序扣减 CreditLot，余额递减，不产生负数", async () => {
    const res = await deductCredits("u1", 300, "AI销售策略");

    expect(res.ok).toBe(true);
    expect(res.credits).toBe(700); // 1000 - 300

    // 先扣快过期的 L1（100），再扣 L2（剩 200）
    expect(h.store.lots.find((l) => l.id === "L1")!.remainingAmount).toBe(0);
    expect(h.store.lots.find((l) => l.id === "L2")!.remainingAmount).toBe(300);
    expect(h.store.users.get("u1")!.credits).toBe(700);

    // 账本写入：amount=-300，balance=700，跨账户标记 mixed
    expect(h.store.txns).toHaveLength(1);
    expect(h.store.txns[0].amount).toBe(-300);
    expect(h.store.txns[0].balance).toBe(700);
    expect(h.store.txns[0].account).toBe("mixed");
    expect(h.store.txns[0].type).toBe("ai_deduct");
    // 任何余额记录都 ≥ 0
    expect(h.store.txns[0].balance).toBeGreaterThanOrEqual(0);
  });

  it("余额不足：整体拒绝（insufficient），零写操作，用户余额不变", async () => {
    h.store.users = new Map([["u1", { credits: 50 }]]);

    const res = await deductCredits("u1", 100, "x");

    expect(res.ok).toBe(false);
    expect(res.insufficient).toBe(true);
    expect(res.credits).toBe(50);

    // 没有账本写入，批次与余额都未变
    expect(h.store.txns).toHaveLength(0);
    expect(h.store.lots.find((l) => l.id === "L1")!.remainingAmount).toBe(100);
    expect(h.store.lots.find((l) => l.id === "L2")!.remainingAmount).toBe(500);
    expect(h.store.users.get("u1")!.credits).toBe(50);
  });

  it("need=0：仍写一条 0 金额账本，不动余额与批次", async () => {
    const res = await deductCredits("u1", 0, "x");

    expect(res.ok).toBe(true);
    expect(res.credits).toBe(1000);
    expect(h.store.txns).toHaveLength(1);
    expect(h.store.txns[0].amount).toBe(0);
    expect(h.store.lots.find((l) => l.id === "L1")!.remainingAmount).toBe(100);
    expect(h.store.users.get("u1")!.credits).toBe(1000);
  });
});
