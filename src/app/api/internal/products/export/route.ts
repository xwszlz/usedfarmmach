/**
 * 内部只读导出接口：.cn → .com 产品同步数据源
 *
 * 职责：
 * - 仅在 SITE=cn 生效（否则直接 404），防止 .com 侧误暴露 Neon 数据；
 * - 独立密钥 CN_SYNC_API_KEY 鉴权（请求头 x-sync-key），常量时间比较，fail-closed；
 * - 源头过滤：小程序（seller.email=miniprogram@shendiao.com）+ active + 国际品牌（brand.isImported）；
 * - 两种模式：
 *   · 增量（默认）：keyset 复合游标 (updatedAt, id) 单调推进，无 since = 全量拉取，
 *     返回白名单裁剪后的产品数组 + nextSince/nextId；仅传 since 的老调用方行为不变；
 *   · 全量对账（mode=full）：仅返回 id 集合（分页），供 .com 侧 reconcile 判存活；
 * - 白名单裁剪（去 PII / 精确坐标 / 卖家身份）：见 lib/cn-sync/field-whitelist。
 *
 * 合规：本接口只读、零外呼（.cn 进程绝不主动出境）；不同步 Valuation；不出境 latitude/longitude。
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pickProductWhitelist } from "@/lib/cn-sync/field-whitelist";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MINIAPP_SELLER_EMAIL = "miniprogram@shendiao.com";
const LIMIT_DEFAULT = 100;
const LIMIT_MAX = 500;

/** 常量时间字符串比较（防时序侧信道） */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** 校验 x-sync-key 是否匹配 CN_SYNC_API_KEY（未配置密钥 → 一律拒绝） */
function requireSyncKey(req: NextRequest): boolean {
  const expected = process.env.CN_SYNC_API_KEY;
  if (!expected) return false;
  const provided = req.headers.get("x-sync-key") ?? "";
  return provided.length > 0 && safeEqual(provided, expected);
}

/** 解析 limit 参数（1..LIMIT_MAX，非法回退默认值） */
function parseLimit(raw: string | null): number {
  const n = Number(raw ?? LIMIT_DEFAULT);
  if (!Number.isFinite(n) || n <= 0) return LIMIT_DEFAULT;
  return Math.min(Math.floor(n), LIMIT_MAX);
}

/**
 * 解析 since 为合法 Date。
 * - 参数缺失（null）→ 返回 null（由调用方按"全量拉取"处理）；
 * - 参数存在但非法（含空串）→ 返回 null（由调用方在鉴权后转 400）。
 */
function parseSince(raw: string | null): Date | null {
  if (raw === null) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ① 仅 .cn 生效（防止 .com 误暴露 Neon 数据）
  if ((process.env.SITE ?? "com") !== "cn") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  // ② 鉴权（失败返回 401，而非 403/404）
  if (!requireSyncKey(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const mode = sp.get("mode"); // null | "full"

  // ②-a 非法 since 守卫（必须在鉴权 ② 之后，避免向未授权调用方泄露任何信息）：
  //   参数缺失 → 全量（since=null）；参数存在但无法解析 → 400（不再静默退化为全量）。
  const sinceRaw = sp.get("since");
  const since = parseSince(sinceRaw);
  if (sinceRaw !== null && since === null) {
    return NextResponse.json(
      { success: false, error: "invalid since: expect ISO 8601 datetime" },
      { status: 400 }
    );
  }

  const limit = parseLimit(sp.get("limit"));
  const cursor = sp.get("cursor"); // full 模式分页游标（Product.id）
  const sinceId = sp.get("sinceId"); // 增量模式 keyset 复合游标（与 since 配对，解决同毫秒漏项）

  // ③ 源头过滤：小程序 + active + 国际品牌
  const baseWhere: Prisma.ProductWhereInput = {
    status: "active",
    seller: { email: MINIAPP_SELLER_EMAIL },
    brand: { isImported: true },
  };

  // ④ 全量对账模式：仅返回 id 集合（轻量、分页）
  if (mode === "full") {
    // 游标守卫（新-1）：cursor 必须「存在且属于当前过滤集合（baseWhere）」。
    // - 已删除 / 不存在，或存在但不属本过滤集合（如已转 inactive、非小程序国际品牌）→ 视为无效游标，
    //   回退为从头开始（useCursor=null, cursorReset=true），避免 Prisma 抛错（500）或错误续页。
    let useCursor = cursor;
    if (useCursor) {
      const anchor = await prisma.product.findFirst({
        where: { AND: [baseWhere, { id: useCursor }] },
        select: { id: true },
      });
      if (!anchor) useCursor = null;
    }

    const rows = await prisma.product.findMany({
      where: baseWhere,
      select: { id: true },
      orderBy: { id: "asc" },
      take: limit,
      ...(useCursor ? { skip: 1, cursor: { id: useCursor } } : {}),
    });
    return NextResponse.json({
      success: true,
      mode: "full",
      cursorReset: Boolean(cursor) && !useCursor,
      ids: rows.map((r) => r.id),
      nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
    });
  }

  // ⑤ 增量模式：keyset 复合游标 (updatedAt, id) 单调推进
  // - 仅传 since：updatedAt > since（与旧版行为完全一致，向后兼容）；
  // - 传 since + sinceId：updatedAt > since OR (updatedAt == since AND id > sinceId)，
  //   解决「同一毫秒多行 + 分页边界落在这批中间」导致的永久漏项。
  const incrementalWhere: Prisma.ProductWhereInput = since
    ? sinceId
      ? {
          ...baseWhere,
          OR: [
            { updatedAt: { gt: since } },
            { updatedAt: since, id: { gt: sinceId } },
          ],
        }
      : { ...baseWhere, updatedAt: { gt: since } }
    : baseWhere;

  const products = await prisma.product.findMany({
    where: incrementalWhere,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: limit,
    include: {
      brand: { select: { nameZh: true, nameEn: true, originCountry: true, isImported: true } },
      category: { select: { nameZh: true, nameEn: true } },
      images: {
        select: { url: true, sortOrder: true, isPrimary: true },
        orderBy: { sortOrder: "asc" },
      },
      videos: {
        where: { moderationStatus: { not: "rejected" } }, // 违规视频不外传
        select: { url: true, sortOrder: true, title: true, duration: true, moderationStatus: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // ⑥ 白名单裁剪（去 PII / 坐标 / 卖家身份）
  const items = products.map((p) =>
    pickProductWhitelist(p as unknown as Record<string, unknown>)
  );

  const last = products[products.length - 1];
  const nextSince = last ? last.updatedAt.toISOString() : since ? since.toISOString() : null;
  const nextId = last ? last.id : sinceId ?? null;

  return NextResponse.json({
    success: true,
    mode: "incremental",
    count: items.length,
    nextSince,
    nextId,
    items,
  });
}
