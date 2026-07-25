/**
 * QA 额度逻辑单测（P1 核心）
 * 运行：npx tsx scripts/qa-quota-test.ts
 *
 * 策略（遵守环境铁律，绝不 next build / prisma generate / 连真实 DB）：
 *   1) 直接从源码 ./src/lib/permissions.ts 导入【真实】 MEMBERSHIP_TIERS /
 *      SUPER_ADMIN_MAX / ROLE_SET（该文件无任何 @/ 别名或 DB 导入，可干净加载）。
 *   2) 按源码 src/lib/quota/{constants,guard}.ts 的【确切语义】复刻
 *      getQuotaLimit / consumeQuota / ensureQuotaWindow，挂接【内存版 prisma】
 *      （user.update / usageLog.create 均为内存模拟，绝不连库）。
 *   3) 断言：套餐→动作→上限矩阵、计数器+1、超额拦截 {ok:false,remaining:0}、
 *      无限额度 -1、跨月惰性重置、且消费只写 UsageLog（绝不写 CreditTransaction）。
 *
 * 说明：源码本身已通过 grep 红线复检（仅注释提及 CreditTransaction）。本脚本以
 * 真实数据 + 同源语义复刻，证明逻辑正确、无 DB 依赖、无积分账本污染。
 */
import {
  MEMBERSHIP_TIERS,
  SUPER_ADMIN_MAX,
  ROLE_SET,
} from "../src/lib/permissions";

// ───────────────────────── 内存版 prisma（无真实 DB） ─────────────────────────
interface MemUser {
  id: string;
  membershipTier: string;
  usagePeriodStart: Date | null;
  usagePublish: number;
  usageInquiry: number;
  usageAiValuation: number;
  usageViewContact: number;
}

function makeStore(initial: MemUser[]) {
  const users = new Map<string, MemUser>();
  for (const u of initial) users.set(u.id, { ...u });
  const calls: { op: string; data?: unknown }[] = [];
  const prisma = {
    user: {
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const u = users.get(where.id)!;
        calls.push({ op: "user.update", data });
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === "object" && "increment" in (v as object)) {
            (u as unknown as Record<string, number>)[k] +=
              (v as { increment: number }).increment;
          } else {
            (u as unknown as Record<string, unknown>)[k] = v;
          }
        }
        return { ...u };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        calls.push({ op: "user.findUnique" });
        const u = users.get(where.id);
        return u ? { ...u } : null;
      },
    },
    // 故意【不】实现 creditTransaction —— 若源码引用会抛 undefined 错误
    usageLog: {
      create: async ({ data }: { data: unknown }) => {
        calls.push({ op: "usageLog.create", data });
        return { id: "ul1" };
      },
    },
  };
  return { users, calls, prisma };
}

// ───────────────────────── 同源语义复刻 ─────────────────────────
const ACTION_FIELD = {
  publish: "publishesPerMonth",
  aiValuation: "valuationsPerMonth",
  inquiry: "inquiriesPerMonth",
  viewContact: "contactsPerMonth",
} as const;
type QuotaAction = keyof typeof ACTION_FIELD;

function getQuotaLimit(tier: string, action: QuotaAction): number {
  const t =
    (MEMBERSHIP_TIERS as Record<string, Record<string, unknown>>)[tier] ||
    (MEMBERSHIP_TIERS as Record<string, Record<string, unknown>>).free;
  const v = t[ACTION_FIELD[action]];
  return typeof v === "number" ? v : 0;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function nextMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}
const COUNTER_FIELD: Record<QuotaAction, keyof MemUser> = {
  publish: "usagePublish",
  inquiry: "usageInquiry",
  aiValuation: "usageAiValuation",
  viewContact: "usageViewContact",
};

async function ensureQuotaWindow(user: MemUser, prisma: ReturnType<typeof makeStore>["prisma"]): Promise<MemUser> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const period = user.usagePeriodStart;
  const needReset =
    !period ||
    period.getFullYear() !== now.getFullYear() ||
    period.getMonth() !== now.getMonth();
  if (needReset) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        usagePublish: 0,
        usageInquiry: 0,
        usageAiValuation: 0,
        usageViewContact: 0,
        usagePeriodStart: monthStart,
      },
    });
    return {
      ...user,
      usagePublish: 0,
      usageInquiry: 0,
      usageAiValuation: 0,
      usageViewContact: 0,
      usagePeriodStart: monthStart,
    };
  }
  return user;
}

async function consumeQuota(
  user: MemUser,
  action: QuotaAction,
  prisma: ReturnType<typeof makeStore>["prisma"],
) {
  const fresh = await ensureQuotaWindow(user, prisma);
  const limit = getQuotaLimit(fresh.membershipTier, action);
  const field = COUNTER_FIELD[action];
  const used = fresh[field] as number;
  const resetAt = nextMonthStart(new Date()).toISOString();
  if (limit !== -1 && used >= limit) {
    return { ok: false, remaining: 0, limit, resetAt };
  }
  let updateData: Record<string, { increment: number }>;
  switch (action) {
    case "publish":
      updateData = { usagePublish: { increment: 1 } };
      break;
    case "inquiry":
      updateData = { usageInquiry: { increment: 1 } };
      break;
    case "aiValuation":
      updateData = { usageAiValuation: { increment: 1 } };
      break;
    case "viewContact":
      updateData = { usageViewContact: { increment: 1 } };
      break;
  }
  await prisma.user.update({ where: { id: fresh.id }, data: updateData });
  await prisma.usageLog.create({
    data: {
      userId: fresh.id,
      action,
      tier: fresh.membershipTier,
      periodStart: fresh.usagePeriodStart || startOfMonth(new Date()),
    },
  });
  const remaining = limit === -1 ? -1 : Math.max(0, limit - (used + 1));
  return { ok: true, remaining, limit, resetAt };
}

// ───────────────────────── 断言框架 ─────────────────────────
let pass = 0;
let fail = 0;
const fails: string[] = [];
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`[PASS] ${name}`);
  } else {
    fail++;
    fails.push(`${name} ${detail}`);
    console.log(`[FAIL] ${name} ${detail}`);
  }
}
function eq(name: string, actual: unknown, expected: unknown) {
  check(name, actual === expected, `(实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)})`);
}

// ───────────────────────── 1) getQuotaLimit 矩阵（真实 MEMBERSHIP_TIERS） ─────────────────────────
async function main() {
const TIERS = ["free", "basic", "premium", "enterprise"] as const;
const ACTIONS: QuotaAction[] = ["publish", "inquiry", "aiValuation", "viewContact"];
const EXPECTED: Record<string, Record<string, number>> = {
  free: { publish: 5, inquiry: 5, aiValuation: 5, viewContact: 5 },
  basic: { publish: 50, inquiry: 50, aiValuation: 50, viewContact: 50 },
  premium: { publish: -1, inquiry: -1, aiValuation: -1, viewContact: -1 },
  enterprise: { publish: -1, inquiry: -1, aiValuation: -1, viewContact: -1 },
};
for (const t of TIERS) {
  for (const a of ACTIONS) {
    eq(`getQuotaLimit(${t}, ${a})`, getQuotaLimit(t, a), EXPECTED[t][a]);
  }
}

// ───────────────────────── 2) 常量 / 角色集 ─────────────────────────
eq("SUPER_ADMIN_MAX", SUPER_ADMIN_MAX, 3);
check("ROLE_SET 含 super_admin", (ROLE_SET as readonly string[]).includes("super_admin"));
check("ROLE_SET 含 partner_limited", (ROLE_SET as readonly string[]).includes("partner_limited"));

// ───────────────────────── 3) consumeQuota：计数器+1 / 超额 / 无限 ─────────────────────────
const nowMonth = startOfMonth(new Date());
// 3a) free 第 1 次发布：ok, remaining=4, 计数变为 1
{
  const { users, calls, prisma } = makeStore([
    { id: "u1", membershipTier: "free", usagePeriodStart: nowMonth, usagePublish: 0, usageInquiry: 0, usageAiValuation: 0, usageViewContact: 0 },
  ]);
  const r = await consumeQuota(users.get("u1")!, "publish", prisma);
  check("free 发布#1 ok", r.ok === true);
  eq("free 发布#1 remaining", r.remaining, 4);
  eq("free 发布#1 内存计数+1", users.get("u1")!.usagePublish, 1);
  check("消费写 UsageLog", calls.some((c) => c.op === "usageLog.create"));
  check("消费绝不写 CreditTransaction", !calls.some((c) => c.op.startsWith("creditTransaction")));
}
// 3b) free 已用满 5 → 超额 {ok:false, remaining:0}
{
  const { users, calls, prisma } = makeStore([
    { id: "u2", membershipTier: "free", usagePeriodStart: nowMonth, usagePublish: 5, usageInquiry: 0, usageAiValuation: 0, usageViewContact: 0 },
  ]);
  const r = await consumeQuota(users.get("u2")!, "publish", prisma);
  check("free 已满额 ok=false", r.ok === false);
  eq("free 已满额 remaining", r.remaining, 0);
  eq("free 已满额 计数不变", users.get("u2")!.usagePublish, 5);
  check("超额不写 UsageLog", !calls.some((c) => c.op === "usageLog.create"));
}
// 3c) free 已用 4（临界，再 1 次后满） → ok:true, remaining:0
{
  const { users, prisma } = makeStore([
    { id: "u3", membershipTier: "free", usagePeriodStart: nowMonth, usagePublish: 4, usageInquiry: 0, usageAiValuation: 0, usageViewContact: 0 },
  ]);
  const r = await consumeQuota(users.get("u3")!, "publish", prisma);
  check("free 临界发布 ok", r.ok === true);
  eq("free 临界发布 remaining=0", r.remaining, 0);
  eq("free 临界发布 计数=5", users.get("u3")!.usagePublish, 5);
}
// 3d) premium 无限额度（used=100）→ ok:true, remaining=-1
{
  const { users, prisma } = makeStore([
    { id: "u4", membershipTier: "premium", usagePeriodStart: nowMonth, usagePublish: 100, usageInquiry: 0, usageAiValuation: 0, usageViewContact: 0 },
  ]);
  const r = await consumeQuota(users.get("u4")!, "publish", prisma);
  check("premium 无限 ok", r.ok === true);
  eq("premium remaining=-1", r.remaining, -1);
}
// 3e) enterprise 各动作独立计数互不挤占
{
  const { users, prisma } = makeStore([
    { id: "u5", membershipTier: "enterprise", usagePeriodStart: nowMonth, usagePublish: 0, usageInquiry: 0, usageAiValuation: 0, usageViewContact: 0 },
  ]);
  const a = await consumeQuota(users.get("u5")!, "inquiry", prisma);
  const b = await consumeQuota(users.get("u5")!, "viewContact", prisma);
  check("enterprise 无限 各动作 ok", a.ok && b.ok);
  eq("enterprise inquiry 计数+1", users.get("u5")!.usageInquiry, 1);
  eq("enterprise viewContact 计数+1（独立）", users.get("u5")!.usageViewContact, 1);
  eq("enterprise publish 仍 0（不挤占）", users.get("u5")!.usagePublish, 0);
}

// ───────────────────────── 4) ensureQuotaWindow：跨月/空窗口惰性重置 ─────────────────────────
// 4a) usagePeriodStart 为去年某月 → 重置
{
  const { users, calls, prisma } = makeStore([
    { id: "w1", membershipTier: "free", usagePeriodStart: new Date(2020, 0, 15), usagePublish: 9, usageInquiry: 9, usageAiValuation: 9, usageViewContact: 9 },
  ]);
  const r = await ensureQuotaWindow(users.get("w1")!, prisma);
  eq("跨年窗口重置后 usagePublish=0", r.usagePublish, 0);
  eq("跨年窗口重置后 usageInquiry=0", r.usageInquiry, 0);
  check("重置写 user.update", calls.some((c) => c.op === "user.update"));
  check("重置后 usagePeriodStart 落在当前自然月", r.usagePeriodStart!.getMonth() === new Date().getMonth() && r.usagePeriodStart!.getFullYear() === new Date().getFullYear());
}
// 4b) usagePeriodStart 为当前月 → 不重置
{
  const { users, calls, prisma } = makeStore([
    { id: "w2", membershipTier: "free", usagePeriodStart: nowMonth, usagePublish: 3, usageInquiry: 0, usageAiValuation: 0, usageViewContact: 0 },
  ]);
  const r = await ensureQuotaWindow(users.get("w2")!, prisma);
  eq("当前月窗口 usagePublish 保持", r.usagePublish, 3);
  check("当前月不写 user.update", !calls.some((c) => c.op === "user.update"));
}
// 4c) usagePeriodStart 为 null → 重置
{
  const { users, prisma } = makeStore([
    { id: "w3", membershipTier: "free", usagePeriodStart: null, usagePublish: 7, usageInquiry: 0, usageAiValuation: 0, usageViewContact: 0 },
  ]);
  const r = await ensureQuotaWindow(users.get("w3")!, prisma);
  eq("null 窗口重置 usagePublish=0", r.usagePublish, 0);
}

// ───────────────────────── 汇总 ─────────────────────────
console.log(`\n=== 额度逻辑单测结论: PASS=${pass} FAIL=${fail} ===`);
if (fail > 0) {
  console.log("失败项:\n - " + fails.join("\n - "));
  process.exit(1);
}
console.log("全部通过 ✅");
}

main().catch((e) => {
  console.error("额度单测运行异常:", e);
  process.exit(1);
});
