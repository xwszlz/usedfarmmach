/**
 * 超管专属：补贴机型实拍图复核列表（T05，只读）
 * GET /api/admin/system/subsidy-images?status=pending&page=1&pageSize=50
 *
 * 🔴 middleware 的 /api/ 分支会早退，SUPER_ADMIN_PATHS 对 API 不可达，
 *    故本 handler 必须在函数内首行自行 requireSuperAdmin 兜底（不依赖网关）。
 * 🔴 force-dynamic：.cn 构建期不得把无标记 GET 烤进镜像。
 * 响应统一信封 { success, data?, error?, code? } + Cache-Control: no-store。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin/system";
import { clampPageSize } from "@/lib/subsidy/raw-mode";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const REVIEW_STATUSES: readonly string[] = ["pending", "approved", "rejected"];

/** 11 项留痕 + 基础展示字段（不含任何 PII）。 */
const IMAGE_SELECT = {
  id: true,
  modelKey: true,
  brandName: true,
  category: true,
  modelName: true,
  sourceUrl: true,
  sourceDomain: true,
  finalUrl: true,
  httpStatus: true,
  contentType: true,
  fetchedAt: true,
  sha256: true,
  ossUrl: true,
  sortOrder: true,
  isPrimary: true,
  reviewStatus: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNote: true,
} as const;

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return noStore(
      NextResponse.json({ success: false, error: "无权限" }, { status: 403 })
    );
  }

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status");
  const status = statusRaw && REVIEW_STATUSES.includes(statusRaw) ? statusRaw : null;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = clampPageSize(url.searchParams.get("pageSize"));
  const where = status ? { reviewStatus: status } : {};

  try {
    const [rows, total] = await Promise.all([
      prisma.subsidyModelImage.findMany({
        where,
        orderBy: { fetchedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: IMAGE_SELECT,
      }),
      prisma.subsidyModelImage.count({ where }),
    ]);

    return noStore(
      NextResponse.json({
        success: true,
        data: {
          items: rows,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      })
    );
  } catch {
    return noStore(
      NextResponse.json(
        { success: false, error: "查询失败", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    );
  }
}
