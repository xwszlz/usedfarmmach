/**
 * AI 销售策略 · 导出链路 PII 门禁公共层（excel / pdf 两个导出路由的**唯一口径**）
 * ─────────────────────────────────────────────────────────────────────────────
 * 为什么要有这个文件：
 *   历史上 `export/excel/route.ts` 与 `export/pdf/route.ts` **各抄了一份**
 *   `unlock:` 前缀常量与 `buildUnlockedSet()`。两端口径一旦分叉，
 *   就会出现「Excel 给明文、PDF 仍打码」这种最难排查的故障（同一用户、同一数据、两种结果）。
 *   故此处集中定义前缀常量、解锁集构建、以及「管理员全量明文导出」的审计留痕，
 *   两侧一律 import，禁止再各写一份。
 *
 * ── PII 放行判据（两条，缺一不可）────────────────────────────────────────────
 *   1. 角色放行：`canViewFullPii(role)`（`@/lib/pii`，FULL_PII_ROLES = super_admin / admin）。
 *      命中 ⇒ 导出全量明文（不再要求逐个点「解锁」）；路由把 `unlockAll: true` 传给渲染层。
 *   2. 逐条解锁：未命中角色的用户 ⇒ 仍按 `PiiAuditLog.field = "unlock:dealer_<id>"` /
 *      `"unlock:lead_<id>"` 构建 unlockedSet，**行为与改造前逐字不变**。
 *
 * ── ⚠️⚠️ 致命红线：审计留痕的 `field` 绝对不能用 `unlock:` 前缀 ─────────────────
 *   `buildUnlockedDealerSet()` 的唯一判据就是 `field.startsWith("unlock:dealer_")`。
 *   若为了「留个痕」而写 `field: "unlock:dealer_xxx"`，等于**给该用户永久解锁**：
 *   他下次以任何角色导出都是明文 —— 这是权限泄漏，不是日志。
 *   故本模块的留痕 field 一律用 `export:` 前缀（`buildExportAuditField`），
 *   并且 `recordAdminFullPiiExport()` 内置运行时防呆，前缀一旦写错立刻抛错而不是静默放行。
 *
 * ── 留痕粒度 ──────────────────────────────────────────────────────────────────
 *   一次导出只写**一条汇总记录**（不按每条线索/经销商写），避免几百行流水淹没有效信息。
 *   汇总内容：谁（actorId）、何时（createdAt）、以什么角色、导出哪个范围（scope）、多少行（rows）。
 *   `targetUserId` / `targetListingId` 对「批量导出」无单一对象 ⇒ 一律 null（不编造）。
 */

import { prisma } from "@/lib/db";

// ── 解锁前缀（历史口径，由 `unlock-contact` 路由写入：`field = "unlock:<candidateId>"`）──

/** 所有解锁记录的统一前缀；PDF 路由按它做 `startsWith` 查询 */
export const UNLOCK_FIELD_PREFIX = "unlock:";
/** 经销商解锁前缀（Excel / PDF 两路由共用，**禁止各写一份**） */
export const DEALER_UNLOCK_FIELD_PREFIX = "unlock:dealer_";
/** 线索解锁前缀（仅 PDF 解析 lead_ 候选时使用） */
export const LEAD_UNLOCK_FIELD_PREFIX = "unlock:lead_";

// ── 留痕前缀（**必须**与上面的 unlock: 区分开，见文件头红线）──

/** 导出留痕前缀：`export:dealer_batch` 等，永不被 buildUnlocked* 识别为解锁 */
export const EXPORT_AUDIT_FIELD_PREFIX = "export:";

/** 留痕覆盖的被导对象类型 */
export type ExportAuditScope = "dealer" | "lead" | "dealer+lead";

/** 导出渠道（写进 purpose，便于按渠道统计明文导出次数） */
export type ExportAuditChannel = "excel" | "pdf";

// ── 解锁集构建 ────────────────────────────────────────────────────────────────

/** `field` 只可能是字符串；DB / mock 里给 null / undefined 时按「非解锁记录」跳过 */
type AuditFieldRow = { field?: string | null };

/**
 * 由 PiiAuditLog 的 `field`（形如 `unlock:dealer_<id>`）提取**已解锁经销商 id** 集合。
 *
 * ⚠️ 只认 `unlock:dealer_`：`unlock:lead_xxx` 不得混入经销商集合（两种 id 空间不同），
 *    前缀必须 `slice` 掉（集合里放的是裸 id，与 `dealer.id` 对齐）。
 *
 * @param fields prisma 查出的 `{ field }` 行（可含 null，容错）
 * @returns 裸 dealer id 集合；无记录 ⇒ 空 Set（调用方得到「全脱敏」的安全默认值）
 */
export function buildUnlockedDealerSet(fields: readonly AuditFieldRow[] | null | undefined): Set<string> {
  const set = new Set<string>();
  if (!Array.isArray(fields)) return set;
  for (const row of fields) {
    const field = typeof row?.field === "string" ? row.field : "";
    if (!field.startsWith(DEALER_UNLOCK_FIELD_PREFIX)) continue;
    const id = field.slice(DEALER_UNLOCK_FIELD_PREFIX.length);
    if (id) set.add(id);
  }
  return set;
}

/**
 * 由 PiiAuditLog 的 `field` 提取**已解锁经销商 / 线索**两个集合（PDF 路由用）。
 *
 * 与 `buildUnlockedDealerSet` 同口径（同一前缀常量、同样 `slice` 剥前缀），
 * 额外识别 `unlock:lead_`：`unlock-contact` 路由对所有 candidateId 统一写
 * `field = "unlock:<candidateId>"`，线索解锁同样留过审计，PDF 也必须给明文。
 *
 * @param fields prisma 查出的 `{ field }` 行（可含 null，容错）
 */
export function buildUnlockedContactSets(fields: readonly AuditFieldRow[] | null | undefined): {
  dealers: Set<string>;
  leads: Set<string>;
} {
  const dealers = new Set<string>();
  const leads = new Set<string>();
  if (!Array.isArray(fields)) return { dealers, leads };
  for (const row of fields) {
    const field = typeof row?.field === "string" ? row.field : "";
    if (!field.startsWith(UNLOCK_FIELD_PREFIX)) continue;
    if (field.startsWith(DEALER_UNLOCK_FIELD_PREFIX)) {
      const id = field.slice(DEALER_UNLOCK_FIELD_PREFIX.length);
      if (id) dealers.add(id);
    } else if (field.startsWith(LEAD_UNLOCK_FIELD_PREFIX)) {
      const id = field.slice(LEAD_UNLOCK_FIELD_PREFIX.length);
      if (id) leads.add(id);
    }
  }
  return { dealers, leads };
}

// ── 管理员全量明文导出的留痕 ───────────────────────────────────────────────────

/**
 * 构造留痕 `field`：`export:<scope>_batch`（如 `export:dealer_batch`）。
 *
 * 恒不返回 `unlock:` 开头的值 —— 用 `_batch` 后缀明确表示「批量导出事件」，
 * 不带具体 id，避免与「逐条解锁」的语义混淆。
 */
export function buildExportAuditField(scope: ExportAuditScope): string {
  return `${EXPORT_AUDIT_FIELD_PREFIX}${scope}_batch`;
}

/** `recordAdminFullPiiExport` 的入参 */
export interface AdminFullPiiExportAuditInput {
  /** 操作人 userId（= 当前登录用户） */
  actorId: string;
  /** 操作人角色（仅用于留痕文本，不参与判定） */
  role: string;
  /** 导出渠道 */
  channel: ExportAuditChannel;
  /** 导出范围的可读描述（Excel：partition；PDF：`dealer=3;lead=2`） */
  scope: string;
  /** 被导出的行数（0 行不调用本函数，见调用方） */
  rows: number;
  /** 留痕覆盖的对象类型；缺省 `dealer`（Excel 路由只导经销商） */
  auditScope?: ExportAuditScope;
}

/**
 * 构造留痕 `purpose` 的可读文本（不含任何 PII 正文，只有 id/数量/枚举）。
 */
export function buildExportAuditPurpose(input: {
  channel: ExportAuditChannel;
  role: string;
  scope: string;
  rows: number;
}): string {
  return `admin_export_full_pii channel=${input.channel} role=${input.role} scope=${input.scope} rows=${input.rows}`;
}

/**
 * 写一条「管理员导出全量明文 PII」的审计记录（一次导出调用一次）。
 *
 * ⚠️ 语义（本函数**刻意不吞异常**）：留痕失败 ⇒ 抛给调用方 ⇒ 路由 500，文件不发出。
 *   理由：导出是免费的（零 LLM 成本），失败重试即可，没有「钱扣了拿不到文件」的风险；
 *   而「明文 PII 流出去了却查不到谁导的」是不可补救的合规缺口 ⇒ 宁可失败在明处。
 *   （对比 `@/lib/audit` 的 `writePiiAuditLog` 是「失败不影响主流程」的口径，
 *     那是因为它记的是可重复读的查看事件，与「一次性批量外发」性质不同。）
 *
 * @throws 当 `field` 前缀误写成 `unlock:`（权限泄漏防呆）或 DB 写入失败时
 */
export async function recordAdminFullPiiExport(
  input: AdminFullPiiExportAuditInput
): Promise<void> {
  const field = buildExportAuditField(input.auditScope ?? "dealer");
  // 防呆（防回归）：留痕 field 若被改成 unlock: 前缀，等于永久解锁 ⇒ 立刻炸，不静默放过。
  if (field.startsWith(UNLOCK_FIELD_PREFIX)) {
    throw new Error(
      `[PiiExportAudit] field 不得以 "${UNLOCK_FIELD_PREFIX}" 开头（会导致永久解锁）：${field}`
    );
  }
  await prisma.piiAuditLog.create({
    data: {
      actorId: input.actorId,
      // 批量导出无单一被查看对象 ⇒ null（不编造）
      targetUserId: null,
      targetListingId: null,
      field,
      action: "export",
      purpose: buildExportAuditPurpose({
        channel: input.channel,
        role: input.role,
        scope: input.scope,
        rows: input.rows,
      }),
    },
  });
}
