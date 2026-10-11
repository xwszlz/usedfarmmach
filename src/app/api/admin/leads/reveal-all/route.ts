/**
 * 线索池 API：批量查看联系方式（审计留痕）
 *
 *  POST /api/admin/leads/reveal-all   对本页全部线索批量写 PII 审计
 *
 * 背景：一页 30 条逐条点「查看联系方式」太慢，故提供「显示全部」批量入口。
 * 合规口径与单条 `GET /api/admin/leads/[id]` **完全一致**：
 *  - 鉴权同样仅 admin / super_admin（复用 requireRawListingAdmin）；
 *  - 每条线索**各写一条** PiiAuditLog（actorId + targetListingId + field="contact" + action="view_full"），
 *    不合并成一条，保证「谁在何时看了哪条」可逐条追溯。
 *
 * 鉴权：仅 admin / super_admin。响应统一信封 { success, revealed?, error?, code? }。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRawListingAdmin } from "@/lib/raw-listing/admin-auth";
import { writePiiAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** 单次批量上限（与线索池分页上限 100 对齐，防止一次打满） */
const MAX_REVEAL_IDS = 100;

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

  const rawIds = body.ids;
  if (!Array.isArray(rawIds)) {
    return NextResponse.json(
      { success: false, error: "ids 必须是字符串数组", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  if (rawIds.length === 0 || rawIds.length > MAX_REVEAL_IDS) {
    return NextResponse.json(
      { success: false, error: `ids 数量必须在 1–${MAX_REVEAL_IDS} 之间`, code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const ids: string[] = [];
  for (const v of rawIds) {
    if (typeof v !== "string" || !v) {
      return NextResponse.json(
        { success: false, error: "ids 必须全部为非空字符串", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    ids.push(v);
  }

  // 逐条留痕：与单条查看同口径，每条各写一条 PiiAuditLog（不合并）
  for (const id of ids) {
    await writePiiAuditLog({
      actorId: guard.userId,
      targetListingId: id,
      field: "contact",
      action: "view_full",
    });
  }

  return NextResponse.json({ success: true, revealed: ids.length });
}
