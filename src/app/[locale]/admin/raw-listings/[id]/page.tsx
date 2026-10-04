/**
 * 采集单详情页（T05）
 *
 * server 组件：鉴权二次收紧（admin/super_admin）→ 取单条 `review.getRawListing(id)`
 * → 并行预解析品牌/品类 + 品牌/品类 lookups → 只读展示全字段 + 挂载客户端动作组件。
 *
 * ⚠️ `admin/layout.tsx` 放行了 `editor`，故本页**必须**再次校验角色，
 * 非 admin/super_admin → redirect 回 /${locale}/admin（与后端 requireRawListingAdmin 同口径）。
 */
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRawListingAdminRole } from "@/lib/raw-listing/admin-auth";
import { getRawListing } from "@/lib/raw-listing/review";
import { resolveBrandForListing, inferCategory } from "@/lib/raw-listing/convert";
import { RawListingFkSelect } from "@/components/admin/raw-listing-fk-select";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  needs_review: "bg-amber-100 text-amber-700",
  auto_rejected: "bg-red-100 text-red-700",
  approved: "bg-cyan-100 text-cyan-700",
  converted: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  converting: "bg-gray-200 text-gray-600",
  rejected: "bg-red-100 text-red-700",
  pending: "bg-gray-100 text-gray-600",
};

/** 只读字段行（label + 值） */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5">
      <dt className="w-40 shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-gray-900">{children}</dd>
    </div>
  );
}

export default async function RawListingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  // ── 页内二次角色收紧（layout 放行了 editor）──
  const headersList = headers();
  const token = getTokenFromHeaders(headersList);
  const payload = token ? verifyToken(token) : null;
  const me = payload
    ? await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true, isActive: true } })
    : null;
  if (!me || !me.isActive || !isRawListingAdminRole(me.role)) {
    redirect(`/${locale}/admin`);
  }

  const data = await getRawListing(id);
  if (!data) notFound();

  // 预解析（供下拉预选）+ lookups
  const [brandRes, catRes, brands, categories] = await Promise.all([
    resolveBrandForListing(data.brandName),
    inferCategory(data.modelName),
    prisma.brand.findMany({ select: { id: true, nameZh: true, nameEn: true }, orderBy: { nameZh: "asc" } }),
    prisma.category.findMany({
      select: { id: true, nameZh: true, nameEn: true, parentId: true },
      orderBy: { nameZh: "asc" },
    }),
  ]);

  // 红标口径同表格：effectivePriceCny 越界 [3000, 20000000]
  const priceOut = data.effectivePriceCny != null && (data.effectivePriceCny < 3000 || data.effectivePriceCny > 20000000);
  const statusBadge = STATUS_STYLE[data.status] ?? "bg-gray-100 text-gray-600";

  // images 原始 JSON 字符串 → 美观化（解析失败原样展示）
  let imagesPretty: string | null = data.images;
  if (data.images) {
    try {
      imagesPretty = JSON.stringify(JSON.parse(data.images), null, 2);
    } catch {
      imagesPretty = data.images;
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Link href={`/${locale}/admin/raw-listings`} className="text-sm text-primary-600 hover:underline">
          ← 返回列表
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{data.modelName || "(无型号)"}</h1>
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge}`}>{data.status}</span>
        <span className="text-xs text-gray-400">id: {data.id}</span>
      </div>

      {/* 基本信息 */}
      <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">基本信息</h2>
        <dl className="divide-y divide-gray-100">
          <Field label="来源">{data.source || "-"}</Field>
          <Field label="原始链接">
            {data.sourceUrl ? (
              /^https?:\/\//i.test(data.sourceUrl) ? (
                <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-primary-600 hover:underline">
                  {data.sourceUrl}
                </a>
              ) : (
                <span className="break-all text-gray-700">{data.sourceUrl}</span>
              )
            ) : (
              <span className="text-gray-400">(无链接)</span>
            )}
          </Field>
          <Field label="品牌">
            {data.brandName || "-"}
            {data.brandNormalized && data.brandNormalized !== data.brandName && (
              <span className="text-gray-400"> → {data.brandNormalized}</span>
            )}
          </Field>
          <Field label="型号">{data.modelName || "-"}</Field>
          <Field label="年份 / 工作小时">
            {data.year ?? "-"} / {data.workingHours ?? "-"}
          </Field>
          <Field label="成色">{data.condition || "-"}</Field>
          <Field label="原币价格">
            {data.priceRaw != null ? `${data.priceRaw} ${data.currency ?? ""}`.trim() : "-"}
          </Field>
          <Field label="人民币价">
            {data.priceCny != null ? (
              <span className={priceOut ? "font-medium text-red-600" : ""}>
                ¥{Math.round(data.priceCny).toLocaleString()}
              </span>
            ) : data.effectivePriceCny != null ? (
              <span className={priceOut ? "font-medium text-red-600" : "text-gray-400"}>
                ≈¥{Math.round(data.effectivePriceCny).toLocaleString()}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Field>
          <Field label="位置">{data.location || "-"}</Field>
          <Field label="卖家">{data.sellerName || "-"}</Field>
          <Field label="电话">{data.sellerPhone || "-"}</Field>
          <Field label="微信">{data.sellerWechat || "-"}</Field>
          <Field label="WhatsApp">{data.sellerWhatsapp || "-"}</Field>
          <Field label="采集时间">{data.scrapedAt}</Field>
          <Field label="审核时间">{data.reviewedAt || "-"}</Field>
          <Field label="审核人">{data.reviewedBy || "-"}</Field>
          <Field label="转换时间">{data.convertedAt || "-"}</Field>
        </dl>
      </section>

      {/* 命中规则 */}
      <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">命中规则</h2>
        <div className="flex flex-wrap gap-1">
          {data.reasons.length === 0 ? (
            <span className="text-sm text-gray-400">—</span>
          ) : (
            data.reasons.map((r) => (
              <span key={r} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                {r}
              </span>
            ))
          )}
        </div>
      </section>

      {/* 外键预解析 */}
      <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">外键预解析（供下拉预选）</h2>
        <dl className="divide-y divide-gray-100">
          <Field label="品牌归一">
            {brandRes.original || "-"}
            {brandRes.normalized !== brandRes.original && <span className="text-gray-400"> → {brandRes.normalized}</span>}
            {brandRes.mapped && <span className="ml-1 text-[11px] text-gray-400">(命中映射表)</span>}
          </Field>
          <Field label="解析品牌">
            {brandRes.brandId ? (
              <span>
                {brandRes.displayName ?? "-"}{" "}
                <span className="text-[11px] text-gray-400">({brandRes.brandId.slice(-6)})</span>
              </span>
            ) : (
              <span className="text-red-600">未匹配到品牌</span>
            )}
          </Field>
          <Field label="解析品类">
            {catRes.categoryId ? (
              <span>
                {catRes.displayName ?? "-"}{" "}
                <span className="text-[11px] text-gray-400">({catRes.categoryId.slice(-6)})</span>
              </span>
            ) : (
              <span className="text-red-600">未解析到品类</span>
            )}
          </Field>
        </dl>
        {catRes.usedFallback && (
          <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
            ⚠️ 品类走兜底，需人工确认（usedFallback = true）
          </p>
        )}
      </section>

      {/* 图片 */}
      <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">图片（images 原始 JSON）</h2>
        {imagesPretty ? (
          <pre className="overflow-x-auto rounded bg-gray-50 p-3 text-xs text-gray-700">{imagesPretty}</pre>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </section>

      {/* 审计 notes */}
      <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">审计 notes</h2>
        {data.notes ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">{data.notes}</pre>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </section>

      {/* 产物 */}
      {data.product && (
        <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">产物 Product</h2>
          <dl className="divide-y divide-gray-100">
            <Field label="Product id">{data.product.id}</Field>
            <Field label="状态">{data.product.status}</Field>
            <Field label="型号">{data.product.modelName}</Field>
            <Field label="人民币价">¥{Math.round(data.product.priceCny).toLocaleString()}</Field>
            <Field label="图片数">{data.product.images.length}</Field>
          </dl>
          <div className="mt-3">
            <Link
              href={`/${locale}/admin/products/${data.product.id}`}
              className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              查看产物
            </Link>
          </div>
        </section>
      )}

      {/* 审核动作 */}
      <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">审核动作</h2>
        <RawListingFkSelect
          id={data.id}
          item={data}
          product={data.product}
          brands={brands}
          categories={categories}
          locale={locale}
          preselectedBrandId={brandRes.brandId ?? ""}
          preselectedCategoryId={catRes.categoryId ?? ""}
        />
      </section>
    </div>
  );
}
