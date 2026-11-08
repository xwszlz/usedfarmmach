/**
 * .cn 补贴机型实拍图 —— 复核纯函数层（T05）
 * ===========================================================================
 * 只放纯函数 / 领域错误，不直连生产库，便于单测钉死以下红线：
 *  - 来源白名单 fail-closed（空白名单 0 新增、精确等值、禁止 includes 旁路）；
 *  - 11 项留痕不齐一律不可复核（状态保持 pending）；
 *  - 状态机单向：仅 pending→approved / pending→rejected，禁止回退与重复复核；
 *  - rejected 保留 reviewNote、行不物理删除。
 *
 * 抓取器（scripts/fetch_subsidy_images.ts）、列表 API、复核 API 共用本层。
 */
import {
  getRawFeatureConfig,
  isImageFetchAllowed,
  type RawFeatureConfig,
} from "@/lib/subsidy/raw-mode";

// ── 类型 ────────────────────────────────────────────────────────────────

/** 通过复核前必须人工逐项勾选的 4 项必检。 */
export interface ReviewChecks {
  modelMatch: boolean;
  sourceReal: boolean;
  notAi: boolean;
  licensed: boolean;
}

export type ReviewStatus = "pending" | "approved" | "rejected";
export type ReviewAction = "approve" | "reject";

/** 领域错误：由 API 层映射为 4xx，不泄漏堆栈。 */
export class ImageReviewError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ImageReviewError";
    this.code = code;
  }
}

// ── 来源白名单（fail-closed） ──────────────────────────────────────────

/**
 * 校验抓取来源是否放行；放行返回小写 hostname，不放行抛 ImageReviewError。
 *
 * 规则（严格按口径，禁止 String.includes 旁路）：
 *  1. isImageFetchAllowed(config) 为 false（开关未开或白名单为空）→ 抛错（0 新增）；
 *  2. 协议只允许 https；
 *  3. hostname 与 allowlist 项「精确等值」，或 allowlist 项以 "." 开头且
 *     hostname.endsWith(item)。`evil-example.com` 绝不被 `example.com` 放行。
 */
export function assertSourceAllowed(
  sourceUrl: string,
  config: RawFeatureConfig = getRawFeatureConfig()
): string {
  if (!isImageFetchAllowed(config)) {
    throw new ImageReviewError(
      "IMAGE_FETCH_DISABLED",
      "图片抓取未启用或来源白名单为空（fail-closed）"
    );
  }

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new ImageReviewError("SOURCE_URL_INVALID", "来源 URL 非法");
  }
  if (url.protocol !== "https:") {
    throw new ImageReviewError("SOURCE_PROTOCOL_INVALID", "来源 URL 仅允许 https");
  }

  const hostname = url.hostname.toLowerCase();
  const allowed = config.imageSourceAllowlist.some((item) => {
    const d = item.toLowerCase();
    if (d.startsWith(".")) return hostname.endsWith(d);
    return hostname === d;
  });
  if (!allowed) {
    throw new ImageReviewError("SOURCE_NOT_ALLOWED", "来源域名不在白名单内");
  }
  return hostname;
}

// ── 11 项留痕校验 ──────────────────────────────────────────────────────

/** 登记/抓取阶段必须写满的 9 项留痕。 */
export const REGISTER_TRACE_FIELDS = [
  "modelKey",
  "sourceUrl",
  "sourceDomain",
  "finalUrl",
  "httpStatus",
  "contentType",
  "fetchedAt",
  "sha256",
  "ossUrl",
] as const;

/** 复核阶段由动作写入的 2 项留痕（与上面 9 项合计 11 项）。 */
export const REVIEW_TRACE_FIELDS = ["reviewedBy", "reviewedAt"] as const;

export interface ReviewableRow {
  modelKey?: string | null;
  sourceUrl?: string | null;
  sourceDomain?: string | null;
  finalUrl?: string | null;
  httpStatus?: number | null;
  contentType?: string | null;
  fetchedAt?: Date | string | number | null;
  sha256?: string | null;
  ossUrl?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | string | number | null;
  [key: string]: unknown;
}

function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return !Number.isFinite(value);
  if (value instanceof Date) return Number.isNaN(value.getTime());
  return false;
}

/**
 * approve/reject 前校验 11 项留痕全部非空；缺一抛 ImageReviewError。
 * 复核阶段 reviewedBy / reviewedAt 由动作写入，调用方须在「写入后的候选行」上断言；
 * 抛错时调用方尚未落库 ⇒ 状态保持 pending。
 */
export function assertReviewable(row: ReviewableRow): void {
  const fields: readonly string[] = [
    ...REGISTER_TRACE_FIELDS,
    ...REVIEW_TRACE_FIELDS,
  ];
  const missing = fields.filter((f) => isBlank(row[f]));
  if (missing.length > 0) {
    throw new ImageReviewError(
      "TRACE_INCOMPLETE",
      `留痕字段缺失：${missing.join(", ")}`
    );
  }
}

// ── 状态机（单向） ──────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: ReadonlyArray<readonly [ReviewStatus, ReviewStatus]> = [
  ["pending", "approved"],
  ["pending", "rejected"],
];

/**
 * 校验状态迁移是否合法；非法（approved→pending / rejected→approved /
 * approved→approved / rejected→rejected / pending→pending 等）一律抛错。
 */
export function assertReviewTransition(from: string, to: string): void {
  const ok = ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to);
  if (!ok) {
    throw new ImageReviewError(
      "INVALID_TRANSITION",
      `非法状态迁移：${from} → ${to}（仅允许 pending→approved / pending→rejected）`
    );
  }
}

/** action → 目标状态。 */
export function reviewStatusForAction(action: ReviewAction): ReviewStatus {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  throw new ImageReviewError("INVALID_ACTION", `未知复核动作：${String(action)}`);
}

/** 校验迁移并返回目标状态（便捷组合）。 */
export function nextReviewStatus(current: string, action: ReviewAction): ReviewStatus {
  const to = reviewStatusForAction(action);
  assertReviewTransition(current, to);
  return to;
}

// ── 动作前置校验与写入数据 ─────────────────────────────────────────────

/** approve 要求 4 项 checks 全为 true。 */
export function assertChecksComplete(checks: unknown): asserts checks is ReviewChecks {
  const c = checks as ReviewChecks | null | undefined;
  if (
    !c ||
    typeof c !== "object" ||
    c.modelMatch !== true ||
    c.sourceReal !== true ||
    c.notAi !== true ||
    c.licensed !== true
  ) {
    throw new ImageReviewError("CHECKS_INCOMPLETE", "通过复核需 4 项必检全部勾选");
  }
}

/** reject 要求 reviewNote 非空，返回去空白后的文本。 */
export function assertRejectNote(reviewNote: unknown): string {
  if (typeof reviewNote !== "string" || reviewNote.trim() === "") {
    throw new ImageReviewError("NOTE_REQUIRED", "驳回需填写复核说明");
  }
  return reviewNote.trim();
}

export interface ReviewPatch {
  reviewStatus: ReviewStatus;
  reviewedBy: string;
  reviewedAt: Date;
  reviewNote: string | null;
}

/**
 * 构造复核写入数据（纯函数）。
 * - 只改状态 + 复核人/时间 + 说明，绝不产生任何删除语义（rejected 行保留）；
 * - reject 时写入 note（非空由 assertRejectNote 保证）；approve 时 note 可空。
 */
export function buildReviewPatch(input: {
  action: ReviewAction;
  actorId: string;
  now: Date;
  note?: string | null;
}): ReviewPatch {
  return {
    reviewStatus: reviewStatusForAction(input.action),
    reviewedBy: input.actorId,
    reviewedAt: input.now,
    reviewNote:
      input.action === "reject"
        ? (input.note ?? "").trim()
        : (input.note ?? null),
  };
}
