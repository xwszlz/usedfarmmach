/**
 * 采集审核 API：单条详情 + 单条动作
 *
 *  GET  /api/admin/raw-listings/[id]   单条（含产物关联）
 *  POST /api/admin/raw-listings/[id]   单条动作（approve/reject/reevaluate/publish/unpublish）
 *
 * 鉴权：仅 admin / super_admin。响应统一信封 { success, data?, error?, code? }。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRawListingAdmin } from "@/lib/raw-listing/admin-auth";
import {
  applySingleAction,
  getRawListing,
  mapReviewError,
  SINGLE_ACTIONS,
  type SingleAction,
  type SingleActionInput,
} from "@/lib/raw-listing/review";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireRawListingAdmin(req);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  const { id } = await params;
  try {
    const data = await getRawListing(id);
    if (!data) {
      return NextResponse.json({ success: false, error: "采集记录不存在", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const mapped = mapReviewError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireRawListingAdmin(req);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  const { id } = await params;

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

  const input: SingleActionInput = {
    action,
    actorId: guard.userId,
    brandId: typeof body.brandId === "string" && body.brandId ? body.brandId : undefined,
    categoryId: typeof body.categoryId === "string" && body.categoryId ? body.categoryId : undefined,
    year: typeof body.year === "number" && Number.isFinite(body.year) ? body.year : undefined,
    priceCny: typeof body.priceCny === "number" && Number.isFinite(body.priceCny) ? body.priceCny : undefined,
    note: typeof body.note === "string" && body.note ? body.note : undefined,
  };

  try {
    const data = await applySingleAction(id, input);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const mapped = mapReviewError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
