/**
 * 线索池 API：单条查看（审计留痕）+ 联系方式补全
 *
 *  GET  /api/admin/leads/[id]   查看该采集单完整联系方式（写 PII 审计后返回）
 *  PATCH /api/admin/leads/[id]   补全 sellerWechat / sellerWhatsapp / sellerEmail（仅写入提供的字段）
 *
 * 鉴权：仅 admin / super_admin（与采集审核同口径）。响应统一信封 { success, data?, error?, code? }。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRawListingAdmin } from "@/lib/raw-listing/admin-auth";
import { RAW_SELECT } from "@/lib/raw-listing/review";
import { writePiiAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireRawListingAdmin(req);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  const { id } = await params;

  try {
    const row = await prisma.rawListing.findUnique({ where: { id }, select: RAW_SELECT });
    if (!row) {
      return NextResponse.json({ success: false, error: "采集记录不存在", code: "NOT_FOUND" }, { status: 404 });
    }
    // PII 审计：谁、何时、读了哪个线索（listing）的哪些联系方式
    await writePiiAuditLog({
      actorId: guard.userId,
      targetListingId: id,
      field: "contact",
      action: "view_full",
    });
    return NextResponse.json({ success: true, data: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "服务器内部错误";
    return NextResponse.json({ success: false, error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(
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

  // 仅写入调用方显式提供的字段（未传则不改动）
  const data: { sellerWechat?: string | null; sellerWhatsapp?: string | null; sellerEmail?: string | null } = {};
  if ("sellerWechat" in body) {
    data.sellerWechat = typeof body.sellerWechat === "string" ? body.sellerWechat.trim() : null;
  }
  if ("sellerWhatsapp" in body) {
    data.sellerWhatsapp = typeof body.sellerWhatsapp === "string" ? body.sellerWhatsapp.trim() : null;
  }
  if ("sellerEmail" in body) {
    data.sellerEmail = typeof body.sellerEmail === "string" ? body.sellerEmail.trim() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { success: false, error: "未提供任何可更新的联系方式字段（sellerWechat/sellerWhatsapp/sellerEmail）", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.rawListing.update({
      where: { id },
      data,
      select: RAW_SELECT,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "服务器内部错误";
    return NextResponse.json({ success: false, error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
