/**
 * .cn 补贴库 C 档明文 —— 访问审计（独立通道 / 零 PII / fail-closed）
 * ===========================================================================
 * 只写「谁 / 何时 / 看了哪条 catalog / 返回几行 / 什么模式 / 放行与否」这类元数据，
 * 绝不落任何 raw 行内容或 PII 值（buyerName / county / township / serialNo /
 * salePriceCny 等）。设计 §3.3 L299–309、§7 L872、§12.7。
 *
 * 三条硬约束：
 *   1) 写入字段**显式逐项挑白名单**，绝不 spread 调用方入参 —— 即使调用方对象里
 *      夹带 PII 键，也只会被丢弃并告警键名（不告警值），不会进 create.data。
 *   2) `@/lib/db` **只在函数内动态 import**，模块顶层零 IO、零 PrismaClient 加载，
 *      保证单测可在无库环境直接跑。
 *   3) 校验失败 / 动态 import 失败 / 写库抛异常 → 只 `console.warn` 后 return，
 *      **绝不抛、绝不阻塞渲染**（沿用 v1 fail-closed 语义）。
 *
 * 控制台告警统一前缀 `[subsidy-raw]`，便于境内日志检索（§7 L872）。
 */

/** 审计表允许写入的字段白名单，与 `SubsidyRawAccessLog` DDL 字段一一对应。 */
export const RAW_ACCESS_LOG_ALLOWED_FIELDS: readonly string[] = [
  "catalogId",
  "userId",
  "anonKeyHash",
  "mode",
  "rowCount",
  "decision",
  "reason",
  "createdAt",
];

/**
 * raw 明细 / PII 字段黑名单（负向自检与单测用）。
 * 写入路径不消费此表，仅用于文档化「绝不入库」的字段集合。
 */
export const RAW_ACCESS_LOG_FORBIDDEN_FIELDS: readonly string[] = [
  "buyerName",
  "county",
  "township",
  "serialNo",
  "sourceFile",
  "salePriceCny",
  "centralSubsidyCny",
  "totalSubsidyCny",
  "purchaseDate",
  "quantity",
  "dealer",
  "productName",
  "status",
  "contentHash",
  "id",
  "goodsRegion",
  "batchCode",
  "manufacturer",
  "modelName",
  "category",
  "province",
];

export interface RawAccessLogInput {
  /** 被查看的公开聚合条目 id（不是 raw 行 id、不是任何 PII）。 */
  catalogId: string;
  /** login 模式应为登录用户 id；public 模式为 null。 */
  userId: string | null;
  /** public 模式匿名限流键的 sha256 片段；绝不存原始 IP / UA 原值。 */
  anonKeyHash: string | null;
  mode: "login" | "public";
  /** 本次返回的明文明细行数；必须为非负整数。 */
  rowCount: number;
  decision: "allowed" | "denied";
  /** 可选：denied 原因（如 login_required / role_denied），只记枚举式短串。 */
  reason?: string;
}

/** `prisma.subsidyRawAccessLog.create({ data })` 的精确形状（8 个白名单字段）。 */
export interface RawAccessLogData {
  catalogId: string;
  userId: string | null;
  anonKeyHash: string | null;
  mode: "login" | "public";
  rowCount: number;
  decision: "allowed" | "denied";
  reason: string | null;
  createdAt: Date;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 运行时最小入参校验（TS 类型之外再兜一层，防 JS 调用方传脏数据）：
 * rowCount 非非负整数、未知 mode / decision、catalogId 空、userId/anonKeyHash
 * 非 string|null、reason 非 string|undefined、入参非对象 → 一律 false。
 */
export function isValidRawAccessLogInput(value: unknown): value is RawAccessLogInput {
  if (!isRecord(value)) return false;
  if (typeof value.catalogId !== "string" || value.catalogId.trim() === "") return false;
  if (!isNullableString(value.userId)) return false;
  if (!isNullableString(value.anonKeyHash)) return false;
  if (value.mode !== "login" && value.mode !== "public") return false;
  if (
    typeof value.rowCount !== "number" ||
    !Number.isInteger(value.rowCount) ||
    value.rowCount < 0
  ) {
    return false;
  }
  if (value.decision !== "allowed" && value.decision !== "denied") return false;
  if (value.reason !== undefined && typeof value.reason !== "string") return false;
  return true;
}

/**
 * 纯函数：显式逐项挑 8 个白名单字段构造 create.data，绝不 spread 入参。
 * 出现非白名单键时只告警**键名**（绝不带值），随后静默丢弃，杜绝 PII 夹带。
 * @param now 注入时间便于单测复现；生产默认 `new Date()`。
 */
export function buildRawAccessLogData(
  input: RawAccessLogInput,
  now: Date = new Date()
): RawAccessLogData {
  const raw = input as unknown as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!RAW_ACCESS_LOG_ALLOWED_FIELDS.includes(key)) {
      console.warn(`[subsidy-raw] 审计入参出现非白名单字段，已忽略（仅记键名）: ${key}`);
    }
  }
  return {
    catalogId: typeof raw.catalogId === "string" ? raw.catalogId : "",
    userId: typeof raw.userId === "string" ? raw.userId : null,
    anonKeyHash: typeof raw.anonKeyHash === "string" ? raw.anonKeyHash : null,
    mode: raw.mode === "public" ? "public" : "login",
    rowCount: typeof raw.rowCount === "number" ? raw.rowCount : 0,
    decision: raw.decision === "denied" ? "denied" : "allowed",
    reason: typeof raw.reason === "string" ? raw.reason : null,
    createdAt: now,
  };
}

/**
 * 写一条 C 档明文访问审计。返回 Promise<void>，**任何情况都不抛**。
 * 调用方可 fire-and-forget（不阻塞 SSR 渲染）；失败只 console.warn。
 */
export async function logRawAccess(input: RawAccessLogInput): Promise<void> {
  if (!isValidRawAccessLogInput(input)) {
    console.warn("[subsidy-raw] 审计入参校验失败，跳过写入（不阻塞渲染）");
    return;
  }

  const data = buildRawAccessLogData(input);
  try {
    // 🔴 函数内动态 import：模块顶层零 IO，单测不连库。
    const { prisma } = await import("@/lib/db");
    await prisma.subsidyRawAccessLog.create({ data });
  } catch (error) {
    console.warn("[subsidy-raw] 审计写入失败，只告警不抛（不阻塞渲染）", error);
  }
}
