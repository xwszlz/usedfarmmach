/**
 * ============================================================================
 *  积分单位 ×100 存量数据迁移脚本（1 元 = 1 积分  →  1 元 = 100 积分）
 * ============================================================================
 *
 * ⚠️⚠️ 执行前必读（三条红线）⚠️⚠️
 *
 * 1. 【必须先备份数据库】本脚本对存量积分做「原地 ×100」写操作，不可逆。
 *    执行前请对生产库做一次完整备份（快照 / pg_dump），并确认可回滚。
 *
 * 2. 【必须与代码改动同一版本上线】
 *    · 充值口径（DEFAULT_CREDIT_PACKS / DEFAULT_PLANS / 多语文案）与
 *    · 扣费口径（src/lib/credits/spend.ts 的 CREDITS_PER_UNIT = 100）
 *    必须与本脚本**同一次发布**生效。
 *    只改代码不改数据 → 老用户余额瞬间缩水 100 倍（资损）；
 *    只改数据不改代码 → 老用户余额凭空放大 100 倍（资损）。
 *    二者不同步 = 资损，没有第三种可能。
 *
 * 3. 【幂等，可重复执行】判据为 SystemConfig 键 `credits_x100_migration`：
 *    存在即整体跳过，绝不会二次 ×100。
 *    ⚠️ 刻意不使用旧的 `type:'migration'` 判据——那上一次余额迁移已用过，
 *       复用会导致本脚本被误判为"已迁移过"而直接跳过。
 *
 * ── 迁移范围（只乘以 100，不做任何其他换算）─────────────────────────────
 *   · User.credits                     ×100
 *   · CreditLot.initialAmount          ×100
 *   · CreditLot.remainingAmount        ×100（⚠️ FIFO 扣减依赖它，漏改会导致批次对不上）
 *   · CreditTransaction.amount         ×100
 *   · CreditTransaction.balance        ×100（历史流水全表 ×100，保证前端流水列表数字连续）
 *   · ServiceOrder.credits             ×100（仅存量 pending / paid 订单）
 *   · CheckIn.credits                  ×100
 *   · Promotion.creditsCost            ×100
 *   · CreditTransaction.breakdown      JSON 内补 `pointsPerUnit: 100` 标记（解析失败则跳过该条）
 *
 * ── 已知风险（上线前请人工核对）────────────────────────────────────────
 *   src/lib/credits/spend.ts 已按新单位（CREDITS_PER_UNIT = 100）出账，
 *   若该口径在本脚本执行前就已上线，则库里会存在"已经是新单位"的流水。
 *   本脚本对 CreditTransaction 已做保护：breakdown 里带 pointsPerUnit === 100 的行
 *   判定为新单位，**跳过不乘**（并打印跳过条数）。
 *   但 CreditLot / User.credits 等表没有单位标记字段，无法自动区分，
 *   若确实存在"部分数据已在新单位"的情况，请先人工核对再执行。
 *
 * ── 运行方式 ────────────────────────────────────────────────────────────
 *   # 需要显式确认环境变量，避免误触发（防资损）
 *   CREDITS_X100_MIGRATION_CONFIRM=1 npx tsx prisma/migrate-credits-x100.ts
 *
 *   ⚠️ 本脚本当前**只编写、不执行**。请勿在未经备份与双人确认的情况下运行。
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 唯一的换算动作：×100。不做任何其他换算。 */
const MULTIPLIER = 100;
/** 每批处理的行数（CreditTransaction 逐行处理 breakdown，需分批） */
const BATCH_SIZE = 500;
/** 幂等判据键（SystemConfig.key，全局唯一） */
const MARKER_KEY = "credits_x100_migration";
/** breakdown JSON 里标记"该账所属积分单位"的字段名（与 spend.ts 的 AiCostBreakdown 对齐） */
const POINTS_PER_UNIT_KEY = "pointsPerUnit";
/** 误触发保护：必须显式置 1 才会真正写库 */
const CONFIRM_ENV = "CREDITS_X100_MIGRATION_CONFIRM";

interface StepStat {
  table: string;
  rows: number;
}

/** breakdown 解析结果 */
type ParsedBreakdown = Record<string, unknown> | Array<Record<string, unknown>>;

/**
 * 判定该流水是否**已经是新单位**（1 元 = 100 积分）。
 * 依据：spend.ts 自 CREDITS_PER_UNIT 起会在 breakdown 写入 pointsPerUnit: 100。
 */
function isAlreadyNewUnit(parsed: unknown): boolean {
  const checkOne = (obj: unknown): boolean =>
    typeof obj === "object" &&
    obj !== null &&
    (obj as Record<string, unknown>)[POINTS_PER_UNIT_KEY] === MULTIPLIER;

  if (Array.isArray(parsed)) return parsed.some(checkOne);
  return checkOne(parsed);
}

/**
 * 给已解析的 breakdown 补 pointsPerUnit: 100 标记。
 * breakdown 可能是对象，也可能是对象数组（扣减拆分 [{lotId, account, amount}]）。
 */
function stampBreakdown(parsed: ParsedBreakdown): ParsedBreakdown {
  if (Array.isArray(parsed)) {
    return parsed.map((item) =>
      item && typeof item === "object"
        ? { ...item, [POINTS_PER_UNIT_KEY]: MULTIPLIER }
        : item
    );
  }
  return { ...parsed, [POINTS_PER_UNIT_KEY]: MULTIPLIER };
}

/** 幂等判据：读迁移标记 */
async function readMarker(): Promise<Record<string, unknown> | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key: MARKER_KEY } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as Record<string, unknown>;
  } catch {
    // 标记存在但内容损坏：宁可当作"已迁移"而拒绝重跑，也不能冒险二次 ×100
    return { corrupted: true, raw: row.value };
  }
}

/** 写入迁移标记（幂等的落点） */
async function writeMarker(stats: StepStat[]): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: MARKER_KEY },
    create: {
      key: MARKER_KEY,
      value: JSON.stringify({
        migratedAt: new Date().toISOString(),
        multiplier: MULTIPLIER,
        steps: stats,
      }),
    },
    update: {
      value: JSON.stringify({
        migratedAt: new Date().toISOString(),
        multiplier: MULTIPLIER,
        steps: stats,
      }),
    },
  });
}

/** 1. User.credits ×100（全表，0 乘完仍是 0） */
async function migrateUsers(): Promise<StepStat> {
  const result = await prisma.user.updateMany({
    data: { credits: { multiply: MULTIPLIER } },
  });
  return { table: "User.credits", rows: result.count };
}

/** 2. CreditLot.initialAmount / remainingAmount ×100 */
async function migrateCreditLots(): Promise<StepStat> {
  const result = await prisma.creditLot.updateMany({
    data: {
      initialAmount: { multiply: MULTIPLIER },
      remainingAmount: { multiply: MULTIPLIER },
    },
  });
  return { table: "CreditLot.initialAmount + remainingAmount", rows: result.count };
}

/**
 * 3. CreditTransaction.amount / balance ×100，并给 breakdown 补 pointsPerUnit 标记。
 *    分批：按 id 升序游标推进，每批一个事务。
 *    · breakdown 带 pointsPerUnit === 100 → 已是新单位，跳过不乘；
 *    · breakdown 解析失败 → 只乘 amount/balance，跳过 JSON 改写，不中断整批。
 */
async function migrateCreditTransactions(): Promise<StepStat> {
  let cursor: string | undefined;
  let migrated = 0;
  let skippedAlreadyNew = 0;
  let breakdownPatched = 0;
  let breakdownParseFailed = 0;

  for (;;) {
    const batch = await prisma.creditTransaction.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: { id: true, amount: true, balance: true, breakdown: true },
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    // 本批中需要 ×100 的行（排除已是新单位的行）
    const oldUnitIds: string[] = [];
    const breakdownUpdates: Array<{ id: string; breakdown: string }> = [];

    for (const row of batch) {
      let parsed: unknown = undefined;
      let parseOk = false;
      if (row.breakdown && row.breakdown.trim() !== "") {
        try {
          parsed = JSON.parse(row.breakdown);
          parseOk = true;
        } catch {
          breakdownParseFailed += 1;
        }
      }

      if (parseOk && isAlreadyNewUnit(parsed)) {
        skippedAlreadyNew += 1;
        continue;
      }

      oldUnitIds.push(row.id);

      if (parseOk && typeof parsed === "object" && parsed !== null) {
        try {
          breakdownUpdates.push({
            id: row.id,
            breakdown: JSON.stringify(stampBreakdown(parsed as ParsedBreakdown)),
          });
        } catch {
          breakdownParseFailed += 1;
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (oldUnitIds.length > 0) {
        await tx.creditTransaction.updateMany({
          where: { id: { in: oldUnitIds } },
          data: {
            amount: { multiply: MULTIPLIER },
            balance: { multiply: MULTIPLIER },
          },
        });
      }
      for (const u of breakdownUpdates) {
        await tx.creditTransaction.update({
          where: { id: u.id },
          data: { breakdown: u.breakdown },
        });
      }
    });

    migrated += oldUnitIds.length;
    breakdownPatched += breakdownUpdates.length;
    console.log(
      `  · CreditTransaction 本批 ${batch.length} 行：×100 ${oldUnitIds.length} 行，` +
        `breakdown 补标记 ${breakdownUpdates.length} 行，累计 ${migrated} 行`
    );
  }

  console.log(
    `  · CreditTransaction 合计：×100 ${migrated} 行；` +
      `已是新单位跳过 ${skippedAlreadyNew} 行；` +
      `breakdown 补标记 ${breakdownPatched} 行；解析失败跳过 ${breakdownParseFailed} 行`
  );
  return { table: "CreditTransaction.amount + balance", rows: migrated };
}

/** 4. ServiceOrder.credits ×100（仅存量 pending / paid 订单） */
async function migrateServiceOrders(): Promise<StepStat> {
  const result = await prisma.serviceOrder.updateMany({
    where: { status: { in: ["pending", "paid"] } },
    data: { credits: { multiply: MULTIPLIER } },
  });
  return { table: "ServiceOrder.credits (pending/paid)", rows: result.count };
}

/** 5. CheckIn.credits ×100 */
async function migrateCheckIns(): Promise<StepStat> {
  const result = await prisma.checkIn.updateMany({
    data: { credits: { multiply: MULTIPLIER } },
  });
  return { table: "CheckIn.credits", rows: result.count };
}

/** 6. Promotion.creditsCost ×100 */
async function migratePromotions(): Promise<StepStat> {
  const result = await prisma.promotion.updateMany({
    data: { creditsCost: { multiply: MULTIPLIER } },
  });
  return { table: "Promotion.creditsCost", rows: result.count };
}

async function main() {
  console.log("=== 积分单位 ×100 存量迁移（1 元 = 1 积分 → 1 元 = 100 积分）===");

  // 误触发保护
  if (process.env[CONFIRM_ENV] !== "1") {
    console.error(
      `✗ 拒绝执行：请设置环境变量 ${CONFIRM_ENV}=1 以确认你已备份数据库、且确认代码改动会与本次迁移同版本上线。\n` +
        `  用法：${CONFIRM_ENV}=1 npx tsx prisma/migrate-credits-x100.ts`
    );
    process.exit(1);
  }

  // 幂等：已迁移过则整体跳过
  const existing = await readMarker();
  if (existing) {
    console.log(
      `✓ 检测到迁移标记 ${MARKER_KEY}，本次执行跳过（幂等，不会二次 ×100）：`
    );
    console.log(JSON.stringify(existing, null, 2));
    return;
  }

  const stats: StepStat[] = [];

  console.log("[1/6] User.credits ×100 ...");
  stats.push(await migrateUsers());

  console.log("[2/6] CreditLot.initialAmount / remainingAmount ×100 ...");
  stats.push(await migrateCreditLots());

  console.log("[3/6] CreditTransaction.amount / balance ×100 + breakdown 补标记 ...");
  stats.push(await migrateCreditTransactions());

  console.log("[4/6] ServiceOrder.credits ×100（pending / paid）...");
  stats.push(await migrateServiceOrders());

  console.log("[5/6] CheckIn.credits ×100 ...");
  stats.push(await migrateCheckIns());

  console.log("[6/6] Promotion.creditsCost ×100 ...");
  stats.push(await migratePromotions());

  await writeMarker(stats);

  console.log("=== 迁移完成，已写入幂等标记 ===");
  console.log(
    JSON.stringify({ marker: MARKER_KEY, multiplier: MULTIPLIER, steps: stats }, null, 2)
  );
  console.log("⚠️ 请确认代码改动（常量 / 多语文案 / spend.ts）与本次迁移同版本上线。");
}

main()
  .catch((error) => {
    console.error("×100 迁移失败：", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
