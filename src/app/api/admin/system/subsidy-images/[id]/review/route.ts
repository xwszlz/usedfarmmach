/**
 * 超管专属：补贴机型实拍图单条复核（T05）
 * POST /api/admin/system/subsidy-images/[id]/review
 * body: { action: "approve"|"reject", checks?: ReviewChecks, reviewNote?: string }
 *
 * 🔴 middleware 的 /api/ 分支早退 ⇒ 函数内首行 requireSuperAdmin 兜底。
 * 状态机单向：仅 pending→approved / pending→rejected，重复复核 / 非法迁移 → 409。
 * approve 要求 4 项 checks 全为 true；reject 要求 reviewNote 非空。
 * 落库前用 assertReviewable 校验 11 项留痕（含动作写入的 reviewedBy/reviewedAt），
 * 缺一即抛错且不落库 ⇒ 状态保持 pending。
 * rejected 只改状态 + 说明 + 复核人/时间，保留 reviewNote、绝不物理删行。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin/system";
import { prisma } from "@/lib/db";
import {
  assertChecksComplete,
  assertRejectNote,
  assertReviewable,
  assertReviewTransition,
  buildReviewPatch,
  ImageReviewError,
  reviewStatusForAction,
  type ReviewableRow,
  type ReviewAction,
} from "@/lib/subsidy/image-review";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function err(status: number, error: string, code: string): NextResponse {
  return noStore(NextResponse.json({ success: false, error, code }, { status }));
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const admin = await requireSuperAdmin(request);
  if (!admin) return err(403, "无权限", "FORBIDDEN");

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return err(400, "请求体不是合法 JSON", "VALIDATION_ERROR");
  }

  const action = body.action as ReviewAction | undefined;
  if (action !== "approve" && action !== "reject") {
    return err(400, "action 必须为 approve/reject 之一", "VALIDATION_ERROR");
  }

  try {
    // 动作前置校验
    if (action === "approve") assertChecksComplete(body.checks);
    const note =
      action === "reject"
        ? assertRejectNote(body.reviewNote)
        : typeof body.reviewNote === "string"
          ? body.reviewNote
          : null;

    // 读原行（用于留痕校验 + 状态机）
    const row = await prisma.subsidyModelImage.findUnique({ where: { id } });
    if (!row) return err(404, "记录不存在", "NOT_FOUND");

    // 状态机：非法迁移 / 重复复核 → 409（不落库）
    const target = reviewStatusForAction(action);
    try {
      assertReviewTransition(row.reviewStatus, target);
    } catch {
      return err(409, "仅待复核记录可操作（状态已变更或重复复核）", "STATE_CONFLICT");
    }

    // 构造写入数据；复核阶段 reviewedBy/reviewedAt 由动作写入
    const patch = buildReviewPatch({
      action,
      actorId: admin.userId,
      now: new Date(),
      note,
    });

    // 在「写入后的候选行」上断言 11 项留痕；缺一抛错且尚未落库 ⇒ 状态保持 pending
    const candidate: ReviewableRow = {
      modelKey: row.modelKey,
      sourceUrl: row.sourceUrl,
      sourceDomain: row.sourceDomain,
      finalUrl: row.finalUrl,
      httpStatus: row.httpStatus,
      contentType: row.contentType,
      fetchedAt: row.fetchedAt,
      sha256: row.sha256,
      ossUrl: row.ossUrl,
      reviewedBy: patch.reviewedBy,
      reviewedAt: patch.reviewedAt,
    };
    assertReviewable(candidate);

    // 落库：where 带 reviewStatus:"pending"，防并发重复复核；count!==1 → 409
    const updated = await prisma.subsidyModelImage.updateMany({
      where: { id, reviewStatus: "pending" },
      data: patch,
    });
    if (updated.count !== 1) {
      return err(409, "并发抢占失败或状态已变更，请刷新后重试", "STATE_CONFLICT");
    }

    return noStore(
      NextResponse.json({ success: true, data: { id, ...patch } })
    );
  } catch (e) {
    if (e instanceof ImageReviewError) {
      const status = e.code === "TRACE_INCOMPLETE" ? 422 : 400;
      return err(status, e.message, e.code);
    }
    return err(500, "服务器内部错误", "INTERNAL_ERROR");
  }
}
