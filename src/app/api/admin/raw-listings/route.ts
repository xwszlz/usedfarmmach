/**
 * 采集审核 API：列表 + 批量动作
 *
 *  GET  /api/admin/raw-listings   列表（分页/筛选/搜索/statusCounts/sources）
 *  POST /api/admin/raw-listings   批量动作（approve/reject/reevaluate/publish/unpublish）
 *
 * 鉴权：仅 admin / super_admin（editor 不接受）。响应统一信封 { success, data?, error?, code? }。
 * 全部业务逻辑在 `@/lib/raw-listing/review`，本文件只做 HTTP 适配。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRawListingAdmin } from "@/lib/raw-listing/admin-auth";
import {
  applyBatchAction,
  listRawListings,
  mapReviewError,
  SINGLE_ACTIONS,
  type BatchActionInput,
  type ListQuery,
  type SingleAction,
} from "@/lib/raw-listing/review";

export const dynamic = "force-dynamic";

function toInt(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = await requireRawListingAdmin(req);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  const url = new URL(req.url);
  const q: ListQuery = {
    page: toInt(url.searchParams.get("page")),
    pageSize: toInt(url.searchParams.get("pageSize")),
    status: url.searchParams.get("status") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    rule: url.searchParams.get("rule") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    orderBy: url.searchParams.get("orderBy") ?? undefined,
    order: url.searchParams.get("order") === "asc" ? "asc" : "desc",
  };

  try {
    const data = await listRawListings(q);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const mapped = mapReviewError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await requireRawListingAdmin(req);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "请求体不是合法 JSON", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const action = body.action as SingleAction | undefined;
  if (!action || !SINGLE_ACTIONS.includes(action)) {
    return NextResponse.json(
      { success: false, error: `action 必须为 ${SINGLE_ACTIONS.join("/")} 之一`, code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const input: BatchActionInput = {
    action,
    actorId: guard.userId,
    mode: body.mode === "by_model" ? "by_model" : "ids",
    ids: Array.isArray(body.ids) ? (body.ids as string[]) : undefined,
    modelName: typeof body.modelName === "string" ? body.modelName : undefined,
    overrides:
      body.overrides && typeof body.overrides === "object"
        ? (body.overrides as { brandId?: string; categoryId?: string })
        : undefined,
    limit: typeof body.limit === "number" ? body.limit : undefined,
  };

  try {
    const data = await applyBatchAction(input);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const mapped = mapReviewError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
