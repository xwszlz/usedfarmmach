/**
 * ============================================================================
 *  积分单位 ×100 存量数据迁移脚本（1 元 = 1 积分  →  1 元 = 100 积分）
 * ============================================================================
 *
 * ⚠️⚠️ 执行前必读（四条红线）⚠️⚠️
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
 * 3. 【幂等，且崩溃可续跑】判据为 SystemConfig 键 `credits_x100_migration`。
 *    该键里存的是**进度**，不是简单的"已迁移"布尔：
 *      { status, startedAt, steps: { <stepKey>: { rows, cursor, done } } }
 *    · 每一步的每个批次都在**同一个事务内**连同进度一起落库，
 *      因此中途崩溃后重跑不会二次 ×100（旧版本只在全部跑完后写标记，
 *      中途崩溃重跑会把 User.credits 再乘一次 100 → ×10000，属资损）。
 *    · 重跑时若检测到 status=in_progress 的残留进度，默认**拒绝执行**，
 *      需显式加 CREDITS_X100_MIGRATION_RESUME=1 才会续跑（防止两个进程并跑）。
 *
 * 4. 【必须先过 pre-flight】脚本会自动做四项体检，任一不过即拒绝执行：
 *    a. 目标库确认（打印打码后的连接串，防止跑错库）；
 *    b. 混合单位检测：若库里已存在新单位流水（breakdown 带 pointsPerUnit=100），
 *       说明新代码已上线，直接 ×100 会把新单位数据再放大 100 倍 → 拒绝执行；
 *    c. int4 溢出检测：所有积分列都是 PG integer，×100 前任一绝对值
 *       > 21474836 会导致 UPDATE 报 integer out of range → 拒绝执行；
 *    d. SystemConfig 运营配置体检（credit_packs / plans / reward_values）。
 *
 * ── 迁移范围（只乘以 100，不做任何其他换算）─────────────────────────────
 *   · User.credits                     ×100
 *   · CreditLot.initialAmount          ×100
 *   · CreditLot.remainingAmount        ×100（⚠️ FIFO 扣减依赖它，漏改会导致批次对不上）
 *   · CreditTransaction.amount         ×100
 *   · CreditTransaction.balance        ×100（历史流水全表 ×100，保证前端流水列表数字连续）
 *   · ServiceOrder.credits             ×100（全部状态，见下方说明）
 *   · CheckIn.credits                  ×100
 *   · Promotion.creditsCost            ×100
 *   · CreditTransaction.breakdown      JSON：补 `pointsPerUnit: 100` 标记，
 *                                      且数组元素（扣减拆分）里的 `amount` 一并 ×100
 *   · SystemConfig 运营配置里的积数字段 ×100（credit_packs[].credits /
 *                                      plans[].credits / reward_values.*）
 *
 * ── 迁移之外的一件事（第 8 步，不乘任何数）─────────────────────────────
 *   · 为「无批次支撑的余额」补 CreditLot（补的是 ×100 后的 gap，详见文件头第 8 节）
 *
 * ── 为什么 ServiceOrder 改成全状态 ×100（与原实现不同）───────────────────
 *   原实现只改 pending/paid。但 `credits` 是一个**带单位的列**，单位必须全局一致：
 *   closed/rejected/refunded 订单若维持旧单位，后台订单列表里会出现
 *   "¥199 → 150 积分" 与 "¥199 → 15000 积分" 并列，运营人工确认时极易按错；
 *   且若存在"closed 订单被重新确认并发分"的补救路径，漏改就是实打实的资损。
 *   历史订单不影响任何余额，统一 ×100 只是让单位一致，风险低于不一致。
 *
 * ── 第 8 步：为什么还要补 CreditLot ────────────────────────────────────
 *   src/app/api/admin/credits/route.ts:27-31：后台手工加积分时**只 increment
 *   User.credits**，既不建批次也不写流水；而 src/lib/credits/spend.ts:177-193
 *   的 FIFO 扣减**只从 CreditLot 里扣**（且只取 expiresAt > now() 的批次），
 *   spend.ts:207-209 却按 need **全额 decrement User.credits**。
 *   → User.credits 里存在一部分「没有任何批次支撑」的余额，×100 后缺口同步放大 100 倍，
 *     账目不变式 User.credits = SUM(未过期 lot.remainingAmount) 不成立。
 *
 *   第 8 步放在全部 ×100 **之后**（此时 User.credits / lot 金额都已是新单位，
 *   gap 也是新单位，直接补，无需二次换算）：
 *     gap = User.credits − SUM(CreditLot.remainingAmount
 *                              WHERE remainingAmount > 0 AND expiresAt > now())
 *   只对 User.credits > 0 且 gap > 0 的用户建一个 lot：
 *     account = "recharge"      sourceType = "migration"
 *     sourceId = "credits-x100-backfill"（幂等判据 + 事后可识别）
 *     initialAmount = remainingAmount = gap        expiresAt = now + 365 天
 *   ⚠️ 绝不同时改动 User.credits —— 它已经是对的，改了就是重复加钱。
 *
 *   ⚠️ 已知副作用（需人工定夺，脚本只负责把数字打出来）：
 *   gap 里可能包含「早已过期、却从未被定时任务从 User.credits 扣掉」的积分，
 *   补 lot 等于把这部分**复活成 1 年有效**。脚本会统计疑似来自过期批次的用户数与积分量。
 *
 * ── 运行方式 ────────────────────────────────────────────────────────────
 *   # 0) 体检（只读，不写库）—— 强烈建议先跑这一遍
 *   CREDITS_X100_DRY_RUN=1 npx tsx prisma/migrate-credits-x100.ts
 *
 *   # 1) 正式执行（.com / Neon）
 *   DATABASE_URL="<neon 连接串>" \
 *   CREDITS_X100_TARGET=com \
 *   CREDITS_X100_MIGRATION_CONFIRM=1 \
 *   npx tsx prisma/migrate-credits-x100.ts
 *
 *   # 2) 正式执行（.cn / 境内库）—— 注意脚本只认 DATABASE_URL，
 *   #    必须把 DATABASE_URL_CN 的值赋给 DATABASE_URL 再跑
 *   DATABASE_URL="<DATABASE_URL_CN 的值>" \
 *   CREDITS_X100_TARGET=cn \
 *   CREDITS_X100_MIGRATION_CONFIRM=1 \
 *   npx tsx prisma/migrate-credits-x100.ts
 *
 *   # 3) 崩溃后续跑（仅在确认上一进程已死掉时使用）
 *   CREDITS_X100_MIGRATION_RESUME=1 CREDITS_X100_MIGRATION_CONFIRM=1 \
 *   npx tsx prisma/migrate-credits-x100.ts
 *
 * ⚠️ 本脚本**不要**在 .cn 机器上直接跑而不显式指定 DATABASE_URL：
 *    .env.cn.example 把 DATABASE_URL 置空、连接串放在 DATABASE_URL_CN，
 *    PrismaClient 默认只读 DATABASE_URL，会连错库或连不上。
 */
import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 唯一的换算动作：×100。不做任何其他换算。 */
const MULTIPLIER = 100;
/** 每批处理的行数（CreditTransaction 逐行处理 breakdown，需分批） */
const BATCH_SIZE = 500;
/** 幂等 + 进度判据键（SystemConfig.key，全局唯一） */
const MARKER_KEY = "credits_x100_migration";
/** breakdown JSON 里标记"该账所属积分单位"的字段名（与 spend.ts 的 AiCostBreakdown 对齐） */
const POINTS_PER_UNIT_KEY = "pointsPerUnit";
/** 误触发保护：必须显式置 1 才会真正写库 */
const CONFIRM_ENV = "CREDITS_X100_MIGRATION_CONFIRM";
/** 续跑开关：上一轮崩溃后，确认没有并发进程时才允许续跑 */
const RESUME_ENV = "CREDITS_X100_MIGRATION_RESUME";
/** 体检模式：只读，不写库 */
const DRY_RUN_ENV = "CREDITS_X100_DRY_RUN";
/** 站点标签：com | cn，仅用于留痕，防止两个库跑串 */
const TARGET_ENV = "CREDITS_X100_TARGET";
/** 混合单位时强制执行的开关（除非人工核对过，否则不要开） */
const FORCE_MIXED_ENV = "CREDITS_X100_ALLOW_MIXED_UNIT";

/** PG integer 上限；×100 前的绝对安全阈值 */
const INT32_MAX = 2147483647;
const MAX_SAFE_BEFORE_MULTIPLY = Math.floor(INT32_MAX / MULTIPLIER); // 21474836

/** 第 8 步补出来的批次的账户（与 seed-credit-migration.ts 的存量余额口径一致） */
const BACKFILL_LOT_ACCOUNT = "recharge";
/** 第 8 步补出来的批次的来源类型（schema 注释里 sourceType 枚举含 migration） */
const BACKFILL_LOT_SOURCE_TYPE = "migration";
/** 第 8 步补出来的批次的来源 id：既是事后可识别标记，也是**幂等判据** */
const BACKFILL_LOT_SOURCE_ID = "credits-x100-backfill";
/** 第 8 步补出来的批次有效期（与 recharge 批次惯例一致） */
const BACKFILL_LOT_TTL_DAYS = 365;
/** 缺口报告里打印的 TOP N 用户 */
const TOP_GAP_USERS = 10;

/** SystemConfig 里需要同步 ×100 的运营配置键 */
const CREDIT_CONFIG_KEYS = {
  creditPacks: "credit_packs",
  plans: "plans",
  rewardValues: "reward_values",
} as const;

/** reward_values 里**不是**积分、不能 ×100 的字段 */
const NON_CREDIT_REWARD_FIELDS = new Set(["checkinStreakCycle"]);

const DRY_RUN = process.env[DRY_RUN_ENV] === "1";

// ─── 进度（幂等判据）───────────────────────────────────────────────────

interface StepState {
  rows: number;
  /** 游标：本步已处理到的最后一个 id；done=true 时置 null */
  cursor?: string | null;
  done: boolean;
  finishedAt?: string;
}

interface Progress {
  status: "in_progress" | "done";
  startedAt: string;
  finishedAt?: string;
  multiplier: number;
  /** com | cn（留痕，便于事后确认两个库都跑过） */
  target: string;
  steps: Record<string, StepState>;
}

const STEP_KEYS = {
  user: "User.credits",
  lots: "CreditLot.initialAmount+remainingAmount",
  transactions: "CreditTransaction.amount+balance",
  orders: "ServiceOrder.credits",
  checkins: "CheckIn.credits",
  promotions: "Promotion.creditsCost",
  configs: "SystemConfig.creditConfigs",
  backfillLots: "CreditLot.backfillMissing(gap)",
} as const;

/** 读取进度；内容损坏时返回 corrupt=true，由调用方决定是否中止 */
async function readProgress(): Promise<
  { progress: Progress | null; corrupt: boolean; raw?: string }
> {
  const row = await prisma.systemConfig.findUnique({ where: { key: MARKER_KEY } });
  if (!row) return { progress: null, corrupt: false };
  try {
    return { progress: JSON.parse(row.value) as Progress, corrupt: false };
  } catch {
    return { progress: null, corrupt: true, raw: row.value };
  }
}

/** 把进度写库。必须在与数据变更**同一个事务**里调用，否则崩溃后会重复 ×100 */
async function persistProgress(
  db: Prisma.TransactionClient | PrismaClient,
  progress: Progress
): Promise<void> {
  const value = JSON.stringify(progress);
  await db.systemConfig.upsert({
    where: { key: MARKER_KEY },
    create: { key: MARKER_KEY, value },
    update: { value },
  });
}

// ─── breakdown 处理 ────────────────────────────────────────────────────

/** breakdown 解析结果 */
type ParsedBreakdown = Record<string, unknown> | Array<Record<string, unknown>>;

/**
 * 判定该流水是否**已经是新单位**（1 元 = 100 积分）。
 * 依据：spend.ts 自 CREDITS_PER_UNIT 起会在 breakdown 写入 pointsPerUnit: 100。
 * 注意：只有 ai_deduct 类流水才有 breakdown，recharge/gift/checkin 等
 * breakdown 为 NULL —— 这些行**无法**靠标记自我保护，完全依赖进度游标防重。
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
 * 数组元素里的 `amount` 是积分数，必须同步 ×100，否则同一条流水里
 * CreditTransaction.amount（新单位）与 breakdown.amount（旧单位）会差 100 倍。
 */
function stampBreakdown(parsed: ParsedBreakdown): ParsedBreakdown {
  if (Array.isArray(parsed)) {
    return parsed.map((item) => {
      if (!item || typeof item !== "object") return item;
      const next: Record<string, unknown> = {
        ...item,
        [POINTS_PER_UNIT_KEY]: MULTIPLIER,
      };
      const amount = (item as Record<string, unknown>).amount;
      if (typeof amount === "number" && Number.isFinite(amount)) {
        next.amount = amount * MULTIPLIER;
      }
      return next;
    });
  }
  return { ...parsed, [POINTS_PER_UNIT_KEY]: MULTIPLIER };
}

// ─── 工具 ──────────────────────────────────────────────────────────────

/** 打码后的连接串：只保留 user@host:port/db，密码替换为 *** */
function maskDatasource(): string {
  const raw = process.env.DATABASE_URL || "";
  if (!raw) return "(DATABASE_URL 未设置！)";
  try {
    const u = new URL(raw);
    const user = u.username ? `${u.username}:***@` : "";
    return `${u.protocol}//${user}${u.host}${u.pathname}`;
  } catch {
    const scheme = raw.split("://")[0] || "";
    const rest = raw.slice(scheme.length + 3).split("@");
    return `${scheme}://***@${rest[rest.length - 1] ?? "?"}`;
  }
}

/** 执行一条返回单值（SUM / MAX 等）的原始 SQL，并转成 number */
async function scalar(sql: string): Promise<number> {
  const rows = (await prisma.$queryRawUnsafe(sql)) as Array<
    Record<string, number | string>
  >;
  const first = rows[0];
  if (!first) return 0;
  return Number(Object.values(first)[0] ?? 0);
}

function fatal(msg: string): never {
  console.error(`\n✗ pre-flight 未通过：${msg}`);
  console.error("  未做任何写操作，请处理后再跑。\n");
  process.exit(1);
}

// ─── pre-flight 体检 ───────────────────────────────────────────────────

async function preflight(): Promise<void> {
  console.log("── pre-flight 体检 ──────────────────────────────");

  // a. 目标库
  const target = process.env[TARGET_ENV] || "(未声明)";
  console.log(`  [a] 目标库：${maskDatasource()}`);
  console.log(`      站点标签 ${TARGET_ENV}=${target}`);
  if (!process.env.DATABASE_URL) {
    fatal(
      "DATABASE_URL 未设置。迁移 .cn 库时请把 DATABASE_URL_CN 的值赋给 DATABASE_URL 再跑。"
    );
  }
  if (target !== "com" && target !== "cn") {
    fatal(
      `请显式设置 ${TARGET_ENV}=com 或 ${TARGET_ENV}=cn，用于确认你跑的是哪个库（留痕用）。`
    );
  }

  // b. 混合单位检测（最危险的一条）
  const newUnitTxCount = await prisma.creditTransaction.count({
    where: { breakdown: { contains: "pointsPerUnit" } },
  });
  const newUnitStrict = await prisma.creditTransaction.count({
    where: { breakdown: { contains: '"pointsPerUnit":100' } },
  });
  console.log(
    `  [b] 新单位流水（breakdown 含 pointsPerUnit）：${newUnitTxCount} 行，` +
      `其中严格匹配 "pointsPerUnit":100 的 ${newUnitStrict} 行`
  );
  if (newUnitStrict > 0 && process.env[FORCE_MIXED_ENV] !== "1") {
    const sample = await prisma.creditTransaction.findMany({
      where: { breakdown: { contains: '"pointsPerUnit":100' } },
      orderBy: { createdAt: "asc" },
      take: 1,
      select: { id: true, createdAt: true },
    });
    fatal(
      `检测到 ${newUnitStrict} 行新单位流水（最早一条 id=${sample[0]?.id} ` +
        `createdAt=${sample[0]?.createdAt?.toISOString()}）。\n` +
        `      说明新单位代码已经在生产跑过了，此时整体 ×100 会把新单位数据再放大 100 倍。\n` +
        `      请先人工核对并决定处理方案（见 docs/credits-x100-migration-runbook.md）；\n` +
        `      确认无误后可加 ${FORCE_MIXED_ENV}=1 强制执行。`
    );
  }

  // c. int4 溢出检测（用原始 SQL 取绝对值最大值，避免 Prisma aggregate 的联合类型体操）
  const maxAbsChecks: Array<[string, string]> = [
    ["User.credits", 'SELECT COALESCE(MAX(ABS("credits")),0)::bigint AS t FROM "User"'],
    [
      "CreditLot.initialAmount",
      'SELECT COALESCE(MAX(ABS("initialAmount")),0)::bigint AS t FROM "CreditLot"',
    ],
    [
      "CreditLot.remainingAmount",
      'SELECT COALESCE(MAX(ABS("remainingAmount")),0)::bigint AS t FROM "CreditLot"',
    ],
    [
      "ServiceOrder.credits",
      'SELECT COALESCE(MAX(ABS("credits")),0)::bigint AS t FROM "ServiceOrder"',
    ],
    [
      "CheckIn.credits",
      'SELECT COALESCE(MAX(ABS("credits")),0)::bigint AS t FROM "CheckIn"',
    ],
    [
      "Promotion.creditsCost",
      'SELECT COALESCE(MAX(ABS("creditsCost")),0)::bigint AS t FROM "Promotion"',
    ],
    [
      "CreditTransaction.amount",
      'SELECT COALESCE(MAX(ABS("amount")),0)::bigint AS t FROM "CreditTransaction"',
    ],
    [
      "CreditTransaction.balance",
      'SELECT COALESCE(MAX(ABS("balance")),0)::bigint AS t FROM "CreditTransaction"',
    ],
  ];
  const offenders: string[] = [];
  for (const [label, sql] of maxAbsChecks) {
    const v = await scalar(sql);
    if (v > MAX_SAFE_BEFORE_MULTIPLY) {
      offenders.push(`${label} 绝对最大值 ${v} × 100 = ${v * MULTIPLIER} > ${INT32_MAX}`);
    }
  }
  console.log(
    `  [c] int4 溢出检测：安全阈值 ${MAX_SAFE_BEFORE_MULTIPLY}（×100 后须 < ${INT32_MAX}）`
  );
  if (offenders.length > 0) {
    fatal(
      "以下列 ×100 后会超出 PG integer 范围，UPDATE 会报 integer out of range：\n      " +
        offenders.join("\n      ")
    );
  }

  // d. SystemConfig 运营配置体检
  console.log("  [d] SystemConfig 运营配置（credit_packs / plans / reward_values）：");
  for (const key of Object.values(CREDIT_CONFIG_KEYS)) {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    if (!row) {
      console.log(`      ${key}：不存在 → 走代码默认值（constants.ts 已 ×100），无需迁移`);
      continue;
    }
    console.log(`      ${key}：存在，当前值 ${row.value.slice(0, 200)}`);
  }

  // e. 规模与前后对照
  const [
    userCount,
    lotCount,
    txCount,
    orderCount,
    checkinCount,
    promoCount,
    sumUser,
    sumLot,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.creditLot.count(),
    prisma.creditTransaction.count(),
    prisma.serviceOrder.count(),
    prisma.checkIn.count(),
    prisma.promotion.count(),
    scalar('SELECT COALESCE(SUM("credits"),0)::bigint AS t FROM "User"'),
    scalar(
      'SELECT COALESCE(SUM("remainingAmount"),0)::bigint AS t FROM "CreditLot"'
    ),
  ]);
  console.log("  [e] 规模：");
  console.log(
    `      User ${userCount} / CreditLot ${lotCount} / CreditTransaction ${txCount} / ` +
      `ServiceOrder ${orderCount} / CheckIn ${checkinCount} / Promotion ${promoCount}`
  );
  console.log(
    `      迁移前 SUM(User.credits)=${sumUser}  SUM(CreditLot.remainingAmount)=${sumLot}`
  );
  console.log("── pre-flight 通过 ──────────────────────────────\n");

  if (DRY_RUN) {
    console.log(
      `（${DRY_RUN_ENV}=1 体检模式，不写库。去掉该变量并加 ${CONFIRM_ENV}=1 即正式执行）`
    );
  }
}

// ─── 分批迁移（通用）─────────────────────────────────────────────────

/**
 * 按 id 游标分批 ×100。每个批次的「数据更新 + 进度落库」在同一个事务里完成，
 * 因此中途崩溃重跑只会从未提交的游标继续，绝不会把已乘过的行再乘一遍。
 */
async function runBatchedStep(params: {
  key: string;
  fetchIds: (take: number, cursor?: string) => Promise<string[]>;
  apply: (db: Prisma.TransactionClient, ids: string[]) => Promise<number>;
}): Promise<StepState> {
  const { progress } = await readProgress();
  const store = progress as Progress;
  const st: StepState = store.steps[params.key] ?? { rows: 0, cursor: null, done: false };
  store.steps[params.key] = st;

  if (st.done) {
    console.log(`  · ${params.key} 上一轮已完成（${st.rows} 行），跳过`);
    return st;
  }

  let cursor = st.cursor ?? undefined;
  console.log(`  · ${params.key} 开始${cursor ? `（从游标 ${cursor} 续跑）` : ""} ...`);

  for (;;) {
    const ids = await params.fetchIds(BATCH_SIZE, cursor);
    if (ids.length === 0) break;
    cursor = ids[ids.length - 1];

    if (DRY_RUN) {
      st.rows += ids.length;
      st.cursor = cursor;
    } else {
      await prisma.$transaction(async (tx) => {
        const n = await params.apply(tx, ids);
        st.rows += n;
        st.cursor = cursor;
        await persistProgress(tx, store);
      });
    }

    if (ids.length < BATCH_SIZE) break;
  }

  st.done = true;
  st.cursor = null;
  st.finishedAt = new Date().toISOString();
  // 完成标记必须落库，否则下一步读到的是旧进度，崩溃后会把本步整表再乘一遍
  if (!DRY_RUN) await persistProgress(prisma, store);
  console.log(`  · ${params.key} 完成，共 ${st.rows} 行`);
  return st;
}

async function fetchIds(
  model: {
    findMany: (args: {
      take: number;
      cursor?: { id: string };
      skip?: number;
      orderBy: { id: "asc" };
      select: { id: true };
    }) => Promise<Array<{ id: string }>>;
  },
  take: number,
  cursor?: string
): Promise<string[]> {
  const rows = await model.findMany({
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// ─── 各表迁移 ──────────────────────────────────────────────────────────

/** 1. User.credits ×100（全表，0 乘完仍是 0） */
async function migrateUsers(): Promise<void> {
  await runBatchedStep({
    key: STEP_KEYS.user,
    fetchIds: (take, cursor) => fetchIds(prisma.user, take, cursor),
    apply: (db, ids) =>
      db.user
        .updateMany({
          where: { id: { in: ids } },
          data: { credits: { multiply: MULTIPLIER } },
        })
        .then((r) => r.count),
  });
}

/** 2. CreditLot.initialAmount / remainingAmount ×100 */
async function migrateCreditLots(): Promise<void> {
  await runBatchedStep({
    key: STEP_KEYS.lots,
    fetchIds: (take, cursor) => fetchIds(prisma.creditLot, take, cursor),
    apply: (db, ids) =>
      db.creditLot
        .updateMany({
          where: { id: { in: ids } },
          data: {
            initialAmount: { multiply: MULTIPLIER },
            remainingAmount: { multiply: MULTIPLIER },
          },
        })
        .then((r) => r.count),
  });
}

/**
 * 3. CreditTransaction.amount / balance ×100，并给 breakdown 补 pointsPerUnit 标记。
 *    分批：按 id 升序游标推进，每批一个事务（连同进度一起提交）。
 *    · breakdown 带 pointsPerUnit === 100 → 已是新单位，跳过不乘；
 *    · breakdown 解析失败 → 只乘 amount/balance，跳过 JSON 改写，不中断整批。
 */
async function migrateCreditTransactions(): Promise<void> {
  const { progress } = await readProgress();
  const store = progress as Progress;
  const st: StepState = store.steps[STEP_KEYS.transactions] ?? {
    rows: 0,
    cursor: null,
    done: false,
  };
  store.steps[STEP_KEYS.transactions] = st;

  if (st.done) {
    console.log(`  · ${STEP_KEYS.transactions} 上一轮已完成（${st.rows} 行），跳过`);
    return;
  }

  let cursor = st.cursor ?? undefined;
  let migrated = 0;
  let skippedAlreadyNew = 0;
  let breakdownPatched = 0;
  let breakdownParseFailed = 0;
  console.log(
    `  · ${STEP_KEYS.transactions} 开始${cursor ? `（从游标 ${cursor} 续跑）` : ""} ...`
  );

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

    if (DRY_RUN) {
      migrated += oldUnitIds.length;
      breakdownPatched += breakdownUpdates.length;
      st.rows = migrated;
      st.cursor = cursor;
    } else {
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
        migrated += oldUnitIds.length;
        breakdownPatched += breakdownUpdates.length;
        st.rows = migrated;
        st.cursor = cursor;
        await persistProgress(tx, store);
      });
    }

    console.log(
      `    · CreditTransaction 本批 ${batch.length} 行：×100 ${oldUnitIds.length} 行，` +
        `breakdown 改写 ${breakdownUpdates.length} 行，累计 ${migrated} 行`
    );

    if (batch.length < BATCH_SIZE) break;
  }

  st.done = true;
  st.cursor = null;
  st.finishedAt = new Date().toISOString();
  if (!DRY_RUN) await persistProgress(prisma, store);
  console.log(
    `  · CreditTransaction 合计：×100 ${migrated} 行；已是新单位跳过 ${skippedAlreadyNew} 行；` +
      `breakdown 改写 ${breakdownPatched} 行；解析失败跳过 ${breakdownParseFailed} 行`
  );
}

/** 4. ServiceOrder.credits ×100（全部状态，理由见文件头） */
async function migrateServiceOrders(): Promise<void> {
  await runBatchedStep({
    key: STEP_KEYS.orders,
    fetchIds: (take, cursor) => fetchIds(prisma.serviceOrder, take, cursor),
    apply: (db, ids) =>
      db.serviceOrder
        .updateMany({
          where: { id: { in: ids } },
          data: { credits: { multiply: MULTIPLIER } },
        })
        .then((r) => r.count),
  });
}

/** 5. CheckIn.credits ×100 */
async function migrateCheckIns(): Promise<void> {
  await runBatchedStep({
    key: STEP_KEYS.checkins,
    fetchIds: (take, cursor) => fetchIds(prisma.checkIn, take, cursor),
    apply: (db, ids) =>
      db.checkIn
        .updateMany({
          where: { id: { in: ids } },
          data: { credits: { multiply: MULTIPLIER } },
        })
        .then((r) => r.count),
  });
}

/** 6. Promotion.creditsCost ×100 */
async function migratePromotions(): Promise<void> {
  await runBatchedStep({
    key: STEP_KEYS.promotions,
    fetchIds: (take, cursor) => fetchIds(prisma.promotion, take, cursor),
    apply: (db, ids) =>
      db.promotion
        .updateMany({
          where: { id: { in: ids } },
          data: { creditsCost: { multiply: MULTIPLIER } },
        })
        .then((r) => r.count),
  });
}

/**
 * 7. SystemConfig 运营配置里的积数字段 ×100。
 *
 * src/lib/credits/config.ts 的 getCreditPacks / getPlans / getRewardValues
 * 优先读 SystemConfig，读不到才回退 constants.ts（已 ×100）。
 * 若库里存着旧单位的运营配置，迁移后用户付 ¥199 只会拿到 150 积分（应为 15000）。
 */
async function migrateSystemConfigCreditValues(): Promise<void> {
  const { progress } = await readProgress();
  const store = progress as Progress;
  const st: StepState = store.steps[STEP_KEYS.configs] ?? {
    rows: 0,
    cursor: null,
    done: false,
  };
  store.steps[STEP_KEYS.configs] = st;

  if (st.done) {
    console.log(`  · ${STEP_KEYS.configs} 上一轮已完成，跳过`);
    return;
  }

  let changed = 0;

  // credit_packs / plans：数组，每项 { sku, credits, priceCny, ... }
  for (const key of [CREDIT_CONFIG_KEYS.creditPacks, CREDIT_CONFIG_KEYS.plans]) {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    if (!row) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      console.error(`  ! ${key} JSON 解析失败，跳过（请人工处理）`);
      continue;
    }
    if (!Array.isArray(parsed)) continue;

    // 已是新单位的保护：credits / priceCny 比值应 ≈ 50~80（新）而非 0.5~0.8（旧）
    const looksNew = parsed.some(
      (item: Record<string, unknown>) =>
        typeof item?.credits === "number" &&
        typeof item?.priceCny === "number" &&
        item.priceCny > 0 &&
        item.credits / item.priceCny > 10
    );
    if (looksNew) {
      console.log(`  · ${key} 看起来已是新单位（credits/priceCny > 10），跳过`);
      continue;
    }

    const next = parsed.map((item: Record<string, unknown>) =>
      typeof item?.credits === "number"
        ? { ...item, credits: item.credits * MULTIPLIER }
        : item
    );
    if (!DRY_RUN) {
      await prisma.$transaction(async (tx) => {
        await tx.systemConfig.update({
          where: { key },
          data: { value: JSON.stringify(next) },
        });
        changed += 1;
        st.rows = changed;
        await persistProgress(tx, store);
      });
    } else {
      changed += 1;
      st.rows = changed;
    }
    console.log(`  · ${key} 已 ×100：${JSON.stringify(next).slice(0, 200)}`);
  }

  // reward_values：对象，除 checkinStreakCycle（天数）外全是积分
  const rvRow = await prisma.systemConfig.findUnique({
    where: { key: CREDIT_CONFIG_KEYS.rewardValues },
  });
  if (rvRow) {
    try {
      const rv = JSON.parse(rvRow.value) as Record<string, unknown>;
      const registerGift = rv.registerGift;
      if (typeof registerGift === "number" && registerGift >= 1000) {
        console.log(
          `  · ${CREDIT_CONFIG_KEYS.rewardValues} 的 registerGift=${registerGift} 已是新单位量级，跳过`
        );
      } else {
        const next: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rv)) {
          next[k] =
            typeof v === "number" && !NON_CREDIT_REWARD_FIELDS.has(k)
              ? v * MULTIPLIER
              : v;
        }
        if (!DRY_RUN) {
          await prisma.$transaction(async (tx) => {
            await tx.systemConfig.update({
              where: { key: CREDIT_CONFIG_KEYS.rewardValues },
              data: { value: JSON.stringify(next) },
            });
            changed += 1;
            st.rows = changed;
            await persistProgress(tx, store);
          });
        } else {
          changed += 1;
          st.rows = changed;
        }
        console.log(
          `  · ${CREDIT_CONFIG_KEYS.rewardValues} 已 ×100：${JSON.stringify(next).slice(0, 200)}`
        );
      }
    } catch {
      console.error(
        `  ! ${CREDIT_CONFIG_KEYS.rewardValues} JSON 解析失败，跳过（请人工处理）`
      );
    }
  }

  st.done = true;
  st.finishedAt = new Date().toISOString();
  if (!DRY_RUN) await persistProgress(prisma, store);
  console.log(`  · ${STEP_KEYS.configs} 完成，改动 ${changed} 个配置项`);
}

// ─── 第 8 步：为「无批次支撑的余额」补 CreditLot ────────────────────────

/** 单个用户的「无批次支撑余额」盘点结果 */
interface GapRow {
  id: string;
  credits: number;
  /** 未过期批次的剩余之和（口径与 spend.ts:177-184 的 FIFO 取数完全一致） */
  lotRemaining: number;
  /** 已过期但 remainingAmount 仍 > 0 的批次剩余之和 */
  expiredRemaining: number;
  /** 已过期且 remainingAmount > 0 的批次数 */
  expiredLotCount: number;
  /** 该用户的全部批次数（含已过期 / 已用完） */
  lotCount: number;
}

interface GapStats {
  /** 已盘点用户数（credits > 0） */
  scanned: number;
  /** gap > 0 的用户数 */
  withGap: number;
  /** gap > 0 的缺口积分总和 */
  totalGap: number;
  /** gap < 0 的用户数（余额小于未过期批次，异常脏数据，不动） */
  negativeGap: number;
  /** gap > 0 且存在「已过期但未清零」批次的用户数（疑似来自过期积分） */
  expiredSuspectedUsers: number;
  /** 上述用户的缺口总和（上界，实际来自过期的部分可能更少） */
  expiredSuspectedGap: number;
  /** 全库已过期但 remainingAmount > 0 的批次剩余总量 */
  expiredTotalRemaining: number;
  /** gap > 0 且从未有过任何 lot 的用户数（更保守口径的作用面） */
  noLotAtAllUsers: number;
  noLotAtAllGap: number;
  /** 缺口最大的若干用户 */
  top: Array<{
    id: string;
    credits: number;
    lotRemaining: number;
    gap: number;
    expiredLotCount: number;
  }>;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** 脱敏：只保留 userId 前缀 */
function maskId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : `${id.slice(0, 4)}…`;
}

/**
 * 取一批用户的「余额 vs 未过期批次支撑」对照。
 * 口径刻意与 spend.ts 的 FIFO 取数一致：`remainingAmount > 0 AND expiresAt > now()`，
 * 过期批次不算支撑（因为 spend.ts 扣不到它们）。
 */
async function fetchGapBatch(take: number, cursor?: string): Promise<GapRow[]> {
  const where = cursor
    ? Prisma.sql`WHERE u."credits" > 0 AND u."id" > ${cursor}`
    : Prisma.sql`WHERE u."credits" > 0`;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      credits: bigint;
      lot_remaining: bigint;
      expired_remaining: bigint;
      expired_lot_count: bigint;
      lot_count: bigint;
    }>
  >`
    SELECT u."id"                          AS id,
           u."credits"::bigint             AS credits,
           COALESCE((SELECT SUM(l."remainingAmount") FROM "CreditLot" l
                      WHERE l."userId" = u."id"
                        AND l."remainingAmount" > 0
                        AND l."expiresAt" > now()), 0)::bigint  AS lot_remaining,
           COALESCE((SELECT SUM(l."remainingAmount") FROM "CreditLot" l
                      WHERE l."userId" = u."id"
                        AND l."remainingAmount" > 0
                        AND l."expiresAt" <= now()), 0)::bigint AS expired_remaining,
           (SELECT COUNT(*) FROM "CreditLot" l
              WHERE l."userId" = u."id"
                AND l."remainingAmount" > 0
                AND l."expiresAt" <= now())::bigint             AS expired_lot_count,
           (SELECT COUNT(*) FROM "CreditLot" l
              WHERE l."userId" = u."id")::bigint                AS lot_count
    FROM "User" u
    ${where}
    ORDER BY u."id" ASC
    LIMIT ${take}
  `;

  return rows.map((r) => ({
    id: r.id,
    credits: Number(r.credits),
    lotRemaining: Number(r.lot_remaining),
    expiredRemaining: Number(r.expired_remaining),
    expiredLotCount: Number(r.expired_lot_count),
    lotCount: Number(r.lot_count),
  }));
}

/**
 * 按 id 游标全表扫描「无批次支撑的余额」，累积统计并返回。
 * `onBatch` 用于在第 8 步里就地建 lot（批次级事务 + 进度落库）。
 */
async function scanCreditLotGaps(params: {
  startCursor?: string;
  onBatch?: (rows: GapRow[], cursor: string) => Promise<void>;
} = {}): Promise<GapStats> {
  const stats: GapStats = {
    scanned: 0,
    withGap: 0,
    totalGap: 0,
    negativeGap: 0,
    expiredSuspectedUsers: 0,
    expiredSuspectedGap: 0,
    expiredTotalRemaining: 0,
    noLotAtAllUsers: 0,
    noLotAtAllGap: 0,
    top: [],
  };

  let cursor = params.startCursor;
  for (;;) {
    const rows = await fetchGapBatch(BATCH_SIZE, cursor);
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const r of rows) {
      stats.scanned += 1;
      stats.expiredTotalRemaining += r.expiredRemaining;
      const gap = r.credits - r.lotRemaining;
      if (gap > 0) {
        stats.withGap += 1;
        stats.totalGap += gap;
        stats.top.push({
          id: r.id,
          credits: r.credits,
          lotRemaining: r.lotRemaining,
          gap,
          expiredLotCount: r.expiredLotCount,
        });
        if (r.expiredLotCount > 0) {
          stats.expiredSuspectedUsers += 1;
          stats.expiredSuspectedGap += gap;
        }
        if (r.lotCount === 0) {
          stats.noLotAtAllUsers += 1;
          stats.noLotAtAllGap += gap;
        }
      } else if (gap < 0) {
        // 余额小于未过期批次支撑：属于既有脏数据，不补也不改，只计数
        stats.negativeGap += 1;
      }
    }

    if (params.onBatch) await params.onBatch(rows, cursor);
    console.log(`    · 已盘点 ${stats.scanned} 个用户（credits>0）...`);

    if (rows.length < BATCH_SIZE) break;
  }

  stats.top.sort((a, b) => b.gap - a.gap);
  stats.top = stats.top.slice(0, TOP_GAP_USERS);
  return stats;
}

/**
 * 打印缺口报告。
 * `projectMultiplier` 传 true 时额外打印「×100 之后」的预估值 —— DRY_RUN 跑在
 * ×100 之前，库里还是旧单位，必须同时给出两列，否则老板会看错量级。
 */
function printGapReport(stats: GapStats, projectMultiplier: boolean): void {
  console.log(`  已盘点用户（credits > 0）      ：${stats.scanned}`);
  console.log(`  存在缺口的用户数              ：${stats.withGap}`);
  console.log(`  缺口总积分                    ：${stats.totalGap}`);
  if (projectMultiplier) {
    console.log("  ── ×100 之后（正式执行时实际会补的量级）──");
    console.log(`  存在缺口的用户数              ：${stats.withGap}（用户数不变）`);
    console.log(`  缺口总积分                    ：${stats.totalGap * MULTIPLIER}`);
  }
  console.log(
    `  ⚠️ 缺口为负（余额 < 未过期批次，既有脏数据，不补不改）：${stats.negativeGap} 个用户`
  );
  console.log(
    `  ⚠️ 疑似含已过期积分：${stats.expiredSuspectedUsers} 个用户，涉及缺口 ${stats.expiredSuspectedGap}`
  );
  console.log(
    `     全库已过期但 remainingAmount > 0 的批次剩余总量：${stats.expiredTotalRemaining}`
  );
  console.log(
    `  从未有过任何 lot 的用户（更保守口径的作用面）：${stats.noLotAtAllUsers} 个，` +
      `涉及缺口 ${stats.noLotAtAllGap}`
  );
  console.log(`  TOP ${TOP_GAP_USERS} 缺口最大（userId 已脱敏）：`);
  if (stats.top.length === 0) {
    console.log("    （无缺口用户）");
    return;
  }
  stats.top.forEach((t, i) => {
    const expired = t.expiredLotCount > 0 ? `  ⚠️含 ${t.expiredLotCount} 个已过期批次` : "";
    console.log(
      `    ${String(i + 1).padStart(2)}. ${maskId(t.id)}  credits=${t.credits}  ` +
        `未过期批次=${t.lotRemaining}  缺口=${t.gap}${expired}`
    );
  });
}

/**
 * 8. 为「无批次支撑的余额」补 CreditLot（放在全部 ×100 之后）。
 *
 * · 幂等 ①：纳入进度游标（STEP_KEYS.backfillLots），崩溃续跑不会重跑已处理的批；
 * · 幂等 ②：建 lot 前先查该用户是否已有 sourceType=migration + sourceId=credits-x100-backfill
 *           的批次，有则跳过 —— 防重跑时重复补；
 * · 绝不改动 User.credits（它已经是对的）。
 */
async function backfillMissingCreditLots(): Promise<void> {
  const { progress } = await readProgress();
  const store = progress as Progress;
  const key = STEP_KEYS.backfillLots;
  const st: StepState = store.steps[key] ?? { rows: 0, cursor: null, done: false };
  store.steps[key] = st;

  if (st.done) {
    console.log(`  · ${key} 上一轮已完成（补了 ${st.rows} 个 lot），跳过`);
    return;
  }

  console.log(
    `  · ${key} 开始${st.cursor ? `（从游标 ${st.cursor} 续跑）` : ""} ...`
  );

  let created = 0;
  let filledGap = 0;
  let skippedExisting = 0;
  let skippedNoGap = 0;

  const stats = await scanCreditLotGaps({
    startCursor: st.cursor ?? undefined,
    onBatch: async (rows, cursor) => {
      const candidates = rows
        .map((r) => ({ id: r.id, gap: r.credits - r.lotRemaining }))
        .filter((r) => r.gap > 0);
      skippedNoGap += rows.length - candidates.length;

      let toCreate = candidates;
      if (candidates.length > 0) {
        // 幂等第二道闸：已补过的用户不再补
        const existing = await prisma.$queryRaw<Array<{ userId: string }>>`
          SELECT DISTINCT "userId"
          FROM "CreditLot"
          WHERE "sourceType" = ${BACKFILL_LOT_SOURCE_TYPE}
            AND "sourceId" = ${BACKFILL_LOT_SOURCE_ID}
            AND "userId" IN (${Prisma.join(candidates.map((c) => c.id))})
        `;
        const already = new Set(existing.map((e) => e.userId));
        skippedExisting += already.size;
        toCreate = candidates.filter((c) => !already.has(c.id));
      }

      const batchFilled = toCreate.reduce((s, c) => s + c.gap, 0);
      const expiresAt = addDays(new Date(), BACKFILL_LOT_TTL_DAYS);

      await prisma.$transaction(async (tx) => {
        for (const c of toCreate) {
          await tx.creditLot.create({
            data: {
              userId: c.id,
              account: BACKFILL_LOT_ACCOUNT,
              sourceType: BACKFILL_LOT_SOURCE_TYPE,
              sourceId: BACKFILL_LOT_SOURCE_ID,
              initialAmount: c.gap,
              remainingAmount: c.gap,
              expiresAt,
            },
          });
        }
        created += toCreate.length;
        filledGap += batchFilled;
        st.rows = created;
        st.cursor = cursor;
        await persistProgress(tx, store);
      });

      if (toCreate.length > 0) {
        console.log(
          `    · 本批补 ${toCreate.length} 个 lot，共 ${batchFilled} 积分（累计 ${created} 个 / ${filledGap} 积分）`
        );
      }
    },
  });

  st.done = true;
  st.cursor = null;
  st.finishedAt = new Date().toISOString();
  await persistProgress(prisma, store);

  console.log(`  · ${key} 完成：`);
  printGapReport(stats, false);
  console.log(
    `  实际新建 lot ${created} 个，补进批次支撑 ${filledGap} 积分；` +
      `跳过（已有补 lot 标记）${skippedExisting} 个，跳过（无缺口）${skippedNoGap} 个`
  );
}

/** DRY_RUN 专属：只读盘点「无批次支撑的余额」，打印报告，不写库 */
async function surveyMissingLots(): Promise<void> {
  console.log("\n── [体检] 无批次支撑余额盘点（第 8 步预演，只读，不写库）──────");
  const stats = await scanCreditLotGaps();
  printGapReport(stats, true);
  console.log(
    "  说明：DRY_RUN 跑在 ×100 之前，库里仍是旧单位，上面第一组是旧单位值，\n" +
      "        「×100 之后」那一组才是正式执行时第 8 步会补的量级。"
  );
  console.log("── 盘点结束（未写库）──────\n");
}

/**
 * 收尾核对：User.credits 是否等于未过期批次剩余之和（只读）。
 * 第 8 步跑完后，正向缺口（credits > 批次支撑）应当被清零；
 * 仍不符的行只可能是 gap < 0 的既有脏数据（余额小于批次支撑）。
 */
async function checkBalanceInvariant(): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{ n: bigint; n_positive: bigint }>
  >`
    SELECT COUNT(*)::bigint AS n,
           COUNT(*) FILTER (WHERE u."credits" >
             COALESCE((SELECT SUM(l."remainingAmount") FROM "CreditLot" l
                        WHERE l."userId" = u."id"
                          AND l."remainingAmount" > 0
                          AND l."expiresAt" > now()), 0))::bigint AS n_positive
    FROM "User" u
    WHERE u."credits" <> COALESCE((SELECT SUM(l."remainingAmount") FROM "CreditLot" l
                                     WHERE l."userId" = u."id"
                                       AND l."remainingAmount" > 0
                                       AND l."expiresAt" > now()), 0)
  `;
  const mismatch = Number(rows[0]?.n ?? 0);
  const positive = Number(rows[0]?.n_positive ?? 0);
  console.log(
    `  · 不变式核对 User.credits = SUM(未过期 lot.remainingAmount)：` +
      `不符 ${mismatch} 个用户，其中「余额 > 批次支撑」（本应被第 8 步补掉）${positive} 个`
  );
  if (positive > 0) {
    console.log("    ⚠️ 仍有正向缺口，请人工核对（可能是并发写入、或补 lot 被跳过的用户）");
  }
}

// ─── 主流程 ────────────────────────────────────────────────────────────

async function main() {
  console.log("=== 积分单位 ×100 存量迁移（1 元 = 1 积分 → 1 元 = 100 积分）===");
  if (DRY_RUN) console.log(`（体检模式 ${DRY_RUN_ENV}=1：只读，不写库）`);

  // 误触发保护：必须在任何写操作之前
  if (!DRY_RUN && process.env[CONFIRM_ENV] !== "1") {
    console.error(
      `✗ 拒绝执行：请设置环境变量 ${CONFIRM_ENV}=1 以确认你已备份数据库、且确认代码改动会与本次迁移同版本上线。\n` +
        `  用法：DATABASE_URL=... CREDITS_X100_TARGET=com|cn ${CONFIRM_ENV}=1 npx tsx prisma/migrate-credits-x100.ts`
    );
    process.exit(1);
  }

  await preflight();
  if (DRY_RUN) {
    // 体检模式只做只读盘点（×100 各步需要进度行才能跑，DRY_RUN 不建进度行）
    await surveyMissingLots();
    return;
  }

  // ── 幂等 / 续跑判定 ──
  const { progress: existing, corrupt } = await readProgress();
  if (corrupt) {
    fatal(
      `SystemConfig 键 ${MARKER_KEY} 存在但内容不是合法 JSON，无法判断进度。\n` +
        `      既不能当作"已迁移"跳过（迁移没跑 = 资损），也不能当作"未迁移"重跑（可能二次 ×100）。\n` +
        `      请人工确认该键内容后决定：删除该行（确认从未成功跑过）或保留（确认已跑完）。`
    );
  }

  let progress: Progress;
  if (existing) {
    if (existing.status === "done") {
      console.log(
        `✓ 检测到已完成的迁移标记 ${MARKER_KEY}，本次跳过（幂等，不会二次 ×100）：`
      );
      console.log(JSON.stringify(existing, null, 2));
      return;
    }
    if (process.env[RESUME_ENV] !== "1") {
      fatal(
        `检测到未完成的迁移进度（startedAt=${existing.startedAt}，已完成步骤：${
          Object.entries(existing.steps)
            .filter(([, s]) => s.done)
            .map(([k]) => k)
            .join(", ") || "无"
        }）。\n` +
          `      这可能是：① 上一轮崩溃了；② 另一个进程**正在跑**。（后者继续跑 = 二次 ×100）\n` +
          `      请先确认没有并发进程，再显式加 ${RESUME_ENV}=1 续跑。`
      );
    }
    progress = existing;
    console.log(
      `↻ 续跑模式：已完成步骤 ${Object.entries(progress.steps)
        .filter(([, s]) => s.done)
        .map(([k]) => k)
        .join(", ") || "无"}`
    );
  } else {
    progress = {
      status: "in_progress",
      startedAt: new Date().toISOString(),
      multiplier: MULTIPLIER,
      target: process.env[TARGET_ENV] || "",
      steps: {},
    };
    // 先把 in_progress 落库：这样第二个并发进程会被上面的判定拦住
    await persistProgress(prisma, progress);
  }

  console.log("[1/8] User.credits ×100 ...");
  await migrateUsers();

  console.log("[2/8] CreditLot.initialAmount / remainingAmount ×100 ...");
  await migrateCreditLots();

  console.log("[3/8] CreditTransaction.amount / balance ×100 + breakdown 补标记 ...");
  await migrateCreditTransactions();

  console.log("[4/8] ServiceOrder.credits ×100（全部状态）...");
  await migrateServiceOrders();

  console.log("[5/8] CheckIn.credits ×100 ...");
  await migrateCheckIns();

  console.log("[6/8] Promotion.creditsCost ×100 ...");
  await migratePromotions();

  console.log("[7/8] SystemConfig 运营配置积数字段 ×100 ...");
  await migrateSystemConfigCreditValues();

  console.log("[8/8] 为「无批次支撑的余额」补 CreditLot（不改动 User.credits）...");
  await backfillMissingCreditLots();

  console.log("── 收尾不变式核对 ──");
  await checkBalanceInvariant();

  // 收尾：标记完成
  const { progress: latest } = await readProgress();
  const final = (latest ?? progress) as Progress;
  final.status = "done";
  final.finishedAt = new Date().toISOString();
  await persistProgress(prisma, final);

  // 迁移后对照（与 pre-flight 的 SUM 对照：应恰好是 100 倍）
  const sumUser = await scalar('SELECT COALESCE(SUM("credits"),0)::bigint AS t FROM "User"');
  const sumLot = await scalar(
    'SELECT COALESCE(SUM("remainingAmount"),0)::bigint AS t FROM "CreditLot"'
  );
  const sumTx = await scalar(
    'SELECT COALESCE(SUM("amount"),0)::bigint AS t FROM "CreditTransaction"'
  );

  console.log("=== 迁移完成，已写入幂等标记 ===");
  console.log(JSON.stringify(final, null, 2));
  console.log("迁移后对照：");
  console.log(`  SUM(User.credits)              = ${sumUser}`);
  console.log(`  SUM(CreditLot.remainingAmount) = ${sumLot}`);
  console.log(`  SUM(CreditTransaction.amount)  = ${sumTx}`);
  console.log("⚠️ 请按 docs/credits-x100-migration-runbook.md 执行验证 SQL，");
  console.log("⚠️ 并确认代码改动（常量 / 多语文案 / spend.ts）与本次迁移同版本上线。");
}

main()
  .catch((error) => {
    console.error("×100 迁移失败：", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
