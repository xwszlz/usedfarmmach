/**
 * 线索录入 API（P0 + T3a 逐行归属校验）
 *
 *  POST /api/admin/leads/import   接收前端列映射后的 JSON 行数组，批量写入 RawListing
 *
 * 归属口径（T3a，替代原先「站点级一刀切 403」）：
 *  - **逐行判定**：每行先经 `resolveStoreScope(row)` 定权威归属（cn / intl / unknown）；
 *  - `.cn` 站：只收 `cn` 行 → 拒 `intl` 行、拒 `unknown` 行；
 *  - `.com` 站：只收 `intl` 行 → 拒 `cn` 行、拒 `unknown` 行；
 *  - 保留 `requireRawListingAdmin` 鉴权（admin / super_admin）。
 *
 * 请求体：{ rows: ImportLeadRow[] } 或 ImportLeadRow[]（两种均可）。
 * 响应：三类结果分开返回 —— **成功 / 被拒（含原因）/ 待核（unknown）**，便于前端逐行展示：
 *   { success, site, siteScope, imported, skipped, errors, sampleErrors,
 *     pending, pendingDetail, importedByScope, rejected, total, message }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRawListingAdmin } from "@/lib/raw-listing/admin-auth";
import {
  importLeadsRows,
  rowIdentity,
  type ImportLeadRow,
} from "@/lib/raw-listing/import-leads";
import { SITE, type SiteVariant } from "@/config/site";
import {
  isScopeAllowedOnSite,
  resolveStoreScope,
  STORE_SCOPE_LABEL,
  type StoreScope,
} from "@/lib/raw-listing/store-scope";

export const dynamic = "force-dynamic";

/** 被所在站点拒收的单行明细 */
interface RejectedRow {
  /** 行号（从 1 开始） */
  lineNo: number;
  /** 行的可视标识（品牌·机型·地区） */
  identity: string;
  /** 该行的权威归属 */
  scope: StoreScope;
  /** 拒收原因原文 */
  reason: string;
}

/** 当前站点只接受哪种归属（.cn→cn，.com→intl） */
function siteScopeOf(site: SiteVariant): Exclude<StoreScope, "unknown"> {
  return site === "cn" ? "cn" : "intl";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 鉴权（admin / super_admin）──
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

  // ── 逐行归属校验（核心：货物所在地决定能否入本站点）──
  const siteScope = siteScopeOf(SITE as SiteVariant);
  const accepted: ImportLeadRow[] = [];
  const rejected: RejectedRow[] = [];
  let pending = 0;
  const pendingDetail: Array<{ lineNo: number; identity: string; scope: StoreScope; reason: string }> = [];

  (rows as ImportLeadRow[]).forEach((row, index) => {
    const lineNo = index + 1;
    const candidate = { ...row };
    const scope = resolveStoreScope(candidate);
    if (scope === "unknown") {
      pending += 1;
      if (pendingDetail.length < 50) {
        pendingDetail.push({
          lineNo,
          identity: rowIdentity(candidate),
          scope,
          reason:
            "判不出货物（机器）实际所在地 → 不入库；请人工核实后回填 goodsRegion 再导",
        });
      }
      return;
    }
    if (!isScopeAllowedOnSite(scope, SITE as SiteVariant)) {
      rejected.push({
        lineNo,
        identity: rowIdentity(candidate),
        scope,
        reason:
          `该行归属「${STORE_SCOPE_LABEL[scope]}」，与当前站点不符` +
          `（本站点只收 ${STORE_SCOPE_LABEL[siteScope]}），已拒收`,
      });
      return;
    }
    accepted.push(candidate);
  });

  // ── 写库（未知的行已从 accepted 中剔除，故不会落库）──
  let result = {
    imported: 0,
    skipped: 0,
    errors: 0,
    sampleErrors: [] as string[],
    pending: 0,
    pendingDetail: [] as Array<{ lineNo: number; identity: string; scope: StoreScope; reason: string }>,
    importedByScope: { cn: 0, intl: 0, unknown: 0 } as Record<StoreScope, number>,
  };
  if (accepted.length > 0) {
    try {
      result = await importLeadsRows(accepted, guard.userId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          success: false,
          error: msg,
          code: "SCHEMA_NOT_READY",
          rejected,
          rejectedCount: rejected.length,
        },
        { status: 500 },
      );
    }
  }

  // importLeadsRows 内部还会再挡一次 unknown（双保险），此处合并计数
  const totalPending = pending + result.pending;
  const pendingRows = pendingDetail.concat(result.pendingDetail).slice(0, 50);
  const message =
    `本站点（${SITE}）只收 ${STORE_SCOPE_LABEL[siteScope]}：` +
    `成功 ${result.imported} 条 / 重复跳过 ${result.skipped} 条 / ` +
    `校验失败 ${result.errors} 条 / 拒收 ${rejected.length} 条 / 待人工核实 ${totalPending} 条`;

  return NextResponse.json({
    success: true,
    site: SITE,
    siteScope,
    // 兼容旧字段（前端老逻辑仍可读）
    imported: result.imported,
    skipped: result.skipped,
    errors: result.errors,
    sampleErrors: result.sampleErrors,
    // T3a 新增字段
    importedByScope: result.importedByScope,
    rejected,
    rejectedCount: rejected.length,
    pending: totalPending,
    pendingDetail: pendingRows,
    total: (rows as ImportLeadRow[]).length,
    message,
  });
}
