/**
 * GET /api/(cn)/subsidy/raw/[id] —— 国内农机补贴原始公示明细 JSON 通道（纵深 fail-closed）
 * =============================================================================
 * 站点：仅在 .cn 生效；.com 直接返回 404（补贴库绝不进境外站）。
 * 模式：getRawMode() 返回 off / 非法值 → 404。
 * 身份：login 模式复用 @/lib/auth 既有三段链路
 *       （getTokenFromHeaders → verifyToken → getUserFromToken）；token 无效 → 401，
 *       **绝不 302 / 绝不 redirect() / 绝不 notFound()**（denied 用状态码，不用导航）。
 * 出站：自定义 `{ ok, page, pageSize, total, consistent, rows }`；
 *       rows 经 toRawDetailView 白名单裁剪，**绝不整行 spread**。
 * 每次 allowed 写一条 logRawAccess（零 PII；写失败只 console.warn，不抛）。
 * 全站 no-store 由 next.config headers() 覆盖；本路由再显式补 Cache-Control: no-store。
 *
 * 本模块属于 **C 档独立通道**：只依赖 raw-detail / raw-detail-view / raw-audit，
 * 与公开聚合层（aggregate）完全解耦；身份复用 @/lib/auth 既有函数（设计 §12.2/§12.3）。
 */

import { NextRequest, NextResponse } from "next/server";
import { isCnSite } from "@/config/site";
import { getRawMode, getRawFeatureConfig } from "@/lib/subsidy/raw-mode";
import {
  assertRawDetailAllowedOrThrow,
  queryRawDetail,
  resolveGroupKey,
  type RawDetailRow,
  type RawViewer,
  type SubsidyCatalog,
} from "@/lib/subsidy/raw-detail";
import { toRawDetailView } from "@/lib/subsidy/raw-detail-view";
import { logRawAccess } from "@/lib/subsidy/raw-audit";
import {
  getTokenFromHeaders,
  verifyToken,
  getUserFromToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 仅在 JSON 响应上补 Cache-Control: no-store（不依赖 next.config 的 headers()）。 */
function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** 登录模式缺有效凭证：401（状态码，不导航）。 */
function unauthorized(): NextResponse {
  return noStore(
    NextResponse.json({ ok: false, error: "login_required" }, { status: 401 })
  );
}

/** 空响应也显式 no-store，避免 404 被中间层缓存。 */
function notFoundNoStore(): Response {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * login 模式：复用 @/lib/auth 既有三段链路解析登录用户。
 * 任一步失败一律返回 null（fail-closed，由调用方转 401），不抛。
 */
async function resolveLoginViewer(req: NextRequest): Promise<RawViewer | null> {
  try {
    const token = getTokenFromHeaders(req.headers);
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload) return null;
    const user = await getUserFromToken(token);
    if (!user || user.isActive !== true) return null;
    return {
      userId: user.id,
      role: typeof user.role === "string" ? user.role : null,
      isActive: true,
      anonKeyHash: null,
      identitySource: "db_user",
      subject: user.id,
    };
  } catch {
    return null;
  }
}

/** 公开聚合条目（组键 + 审计所需字段）。多数字段沿用 raw-detail 的 SubsidyCatalog，
 *  额外带 id 供审计 catalogId 使用；结构上是 SubsidyCatalog 的超集，可直接传给 resolveGroupKey。 */
type CatalogEntry = SubsidyCatalog & { id: string };

/** 按 id 取公开聚合条目（仅取组键 + 审计所需字段；绝不取 raw 行）。 */
async function resolveCatalogEntry(id: string): Promise<CatalogEntry | null> {
  const { prisma } = await import("@/lib/db");
  const row = await prisma.subsidyCatalog.findUnique({
    where: { id },
    select: {
      id: true,
      batchCode: true,
      manufacturer: true,
      brandName: true,
      category: true,
      modelName: true,
      province: true,
      policyYear: true,
      sampleSize: true,
    },
  });
  return (row as CatalogEntry | null) ?? null;
}

function parsePage(value: string | null): number {
  if (typeof value !== "string" || value.trim() === "") return 1;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  // 第一道闸：.com 直接 404（不返回任何补贴数据到境外站）
  if (!isCnSite()) {
    return notFoundNoStore();
  }

  // 第二道闸：off / 非法值 → 404
  const mode = getRawMode();
  if (mode === "off") {
    return notFoundNoStore();
  }

  // 第三道闸：login 模式需要有效 token；public 模式无需登录
  let viewer: RawViewer | null = null;
  if (mode === "login") {
    viewer = await resolveLoginViewer(req);
    if (viewer === null) {
      return unauthorized();
    }
  }

  // 解析目标公开聚合条目（组键 + 审计 catalogId）
  const { id } = await ctx.params;
  const entry = await resolveCatalogEntry(id);
  if (!entry) {
    return notFoundNoStore();
  }

  // 门禁（locale 固定 zh：API 不携带 locale 维度，按设计默认 zh 放行）
  try {
    const decision = assertRawDetailAllowedOrThrow({
      site: "cn",
      mode,
      viewer,
      locale: "zh",
    });

    const page = parsePage(req.nextUrl.searchParams.get("page"));
    const pageSize = getRawFeatureConfig().pageSize;

    const result = await queryRawDetail({
      key: resolveGroupKey(entry),
      expectedSampleSize: entry.sampleSize,
      page,
      pageSize,
    });

    // 每次 allowed 写一条审计（零 PII；写失败只告警不抛，不阻塞响应）
    void logRawAccess({
      catalogId: entry.id,
      userId: viewer?.userId ?? null,
      anonKeyHash: viewer?.anonKeyHash ?? null,
      mode: decision.mode,
      rowCount: result.rows.length,
      decision: "allowed",
    });

    const rows = result.rows.map((r: RawDetailRow) =>
      toRawDetailView(r, {
        showSerialNo: true,
        showSourceFile: true,
        locale: "zh",
      })
    );

    return noStore(
      NextResponse.json({
        ok: true,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        consistent: result.consistent,
        rows,
      })
    );
  } catch {
    // 门禁 denied（含 locale / role 等内部决策失败）→ 401 状态码，不导航
    return unauthorized();
  }
}
