/**
 * 境内线索录入 API（P0）
 *
 *  POST /api/admin/leads/import   接收前端列映射后的 JSON 行数组，批量写入 RawListing
 *
 * 安全口径与《工程方案》§4 一致：
 *  - CN-only 护栏（双保险，防有人直调）：SITE!=="cn" → 403；
 *  - 鉴权仅 admin / super_admin（复用 requireRawListingAdmin）。
 *
 * 请求体：{ rows: ImportLeadRow[] } 或 ImportLeadRow[]（两种均可）。
 * 响应：{ success, imported, skipped, errors, sampleErrors }。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRawListingAdmin } from "@/lib/raw-listing/admin-auth";
import { importLeadsRows, type ImportLeadRow } from "@/lib/raw-listing/import-leads";
import { SITE } from "@/config/site";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── CN-only 护栏（双保险，防有人直调）──
  if (SITE !== "cn") {
    return NextResponse.json(
      { success: false, error: "境内线索录入仅限 .cn 站点", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const guard = await requireRawListingAdmin(req);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  // 解析请求体（兼容 数组 / { rows } 两种形态）
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "请求体不是合法 JSON", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }
  const rows = Array.isArray(body)
    ? body
    : (body as { rows?: unknown })?.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json(
      { success: false, error: "rows 必须是对象数组", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const result = await importLeadsRows(rows as ImportLeadRow[], guard.userId);
  return NextResponse.json({ success: true, ...result });
}
