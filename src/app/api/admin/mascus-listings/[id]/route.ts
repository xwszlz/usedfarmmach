/**
 * mascus 线索池后台 API：单条详情（PII 明文 + 审计留痕）+ 单条更新
 *
 *  GET   /api/admin/mascus-listings/[id]  查看线索全部字段（含**明文卖家电话**，先写审计再返回）
 *  PATCH /api/admin/mascus-listings/[id]  更新 followStatus / assignedTo / note
 *
 * 顺序要求：**先 SITE 闸门，后鉴权**（见 `requireMascusSite` 注释）。
 * 响应统一信封 `{ success, data?, error?, code? }`。
 *
 * 🔴 PII 纪律：列表接口只给掩码；明文电话只在 GET 本路由返回，且**必须先落审计**。
 * 🔴 fail-closed：审计落库失败必须让 GET 直接 500，绝不能「明文已下发但无留痕」。
 *    因此这里**直接调 `prisma.piiAuditLog.create`**，不走 `@/lib/audit` 的封装函数
 *    （后者内部 try/catch 吞掉异常、只 console.error，永不抛）。
 *    ⚠️ 只改本接口自身的审计责任面，不动全仓共享的 `src/lib/audit.ts`。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMascusAdmin, requireMascusSite } from "@/lib/mascus-leads/admin-auth";
import {
  getMascusListingDetail,
  mapMascusError,
  updateMascusListing,
  type MascusUpdateInput,
} from "@/lib/mascus-leads/query";

export const dynamic = "force-dynamic";

/**
 * 🔴 审计用途标记。
 *
 * `PiiAuditLog.targetListingId` 是**裸 String?**（无外键），mascus 与 RawListing 的 id
 * 会落在同一列里，无法从 id 反推源表。因此把源表标记写进 `purpose`，
 * 格式固定为 `"<source>:<场景>"`，便于审计侧按前缀过滤。
 */
const PII_PURPOSE = "mascus_listing:seller_phone";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // ── 1) SITE 闸门 ──
  const site = requireMascusSite();
  if (!site.ok) return NextResponse.json(site.body, { status: site.status });

  // ── 2) 鉴权 ──
  const guard = await requireMascusAdmin(req);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  const { id } = await params;

  try {
    const row = await getMascusListingDetail(id);
    if (!row) {
      return NextResponse.json(
        { success: false, error: "线索不存在", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // ── 3) 🔴 先落审计，再返回明文（fail-closed）──
    // 直接写库：任何异常都会冒泡到下面的 catch → 500，明文绝不会在无留痕的情况下下发。
    await prisma.piiAuditLog.create({
      data: {
        actorId: guard.userId,
        targetUserId: null,
        targetListingId: row.id,
        field: "sellerPhone",
        action: "view_full",
        purpose: PII_PURPOSE,
      },
    });

    return NextResponse.json({ success: true, data: row });
  } catch (e) {
    const mapped = mapMascusError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // ── 1) SITE 闸门 ──
  const site = requireMascusSite();
  if (!site.ok) return NextResponse.json(site.body, { status: site.status });

  // ── 2) 鉴权 ──
  const guard = await requireMascusAdmin(req);
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

  // 仅收集调用方**显式提供**的字段（未传 → 不改动）
  const input: MascusUpdateInput = {};
  if ("followStatus" in body) {
    input.followStatus = typeof body.followStatus === "string" ? body.followStatus : String(body.followStatus ?? "");
  }
  if ("assignedTo" in body) {
    input.assignedTo = body.assignedTo === null ? null : typeof body.assignedTo === "string" ? body.assignedTo : null;
  }
  if ("note" in body) {
    input.note = body.note === null ? null : typeof body.note === "string" ? body.note : null;
  }

  if (Object.keys(input).length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "未提供任何可更新字段（followStatus/assignedTo/note）",
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }

  try {
    const updated = await updateMascusListing(id, input, guard.userId);
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    const mapped = mapMascusError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
