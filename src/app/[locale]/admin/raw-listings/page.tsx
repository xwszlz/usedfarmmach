/**
 * 采集审核列表页（T04）
 *
 * server 组件：鉴权二次收紧（admin/super_admin）→ 复用 `review.listRawListings()`
 * → 并行取品牌/品类 lookups → 渲染客户端审核表格。
 *
 * ⚠️ `admin/layout.tsx` 放行了 `editor`，故本页**必须**再次校验角色，
 * 非 admin/super_admin → redirect 回 /${locale}/admin（与后端 requireRawListingAdmin 同口径）。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRawListingAdminRole } from "@/lib/raw-listing/admin-auth";
import { listRawListings } from "@/lib/raw-listing/review";
import { RawListingReviewTable } from "@/components/admin/raw-listing-review-table";

export const dynamic = "force-dynamic";

const TABS: { key: string; label: string }[] = [
  { key: "needs_review", label: "待审" },
  { key: "auto_rejected", label: "自动拒绝" },
  { key: "approved", label: "已通过(sanity)" },
  { key: "converting", label: "转换中" },
  { key: "converted", label: "已转换" },
  { key: "published", label: "已发布" },
  { key: "rejected", label: "已拒绝" },
  { key: "all", label: "全部" },
];

function getTokenFromHeaders(headersList: Headers): string | null {
  const auth = headersList.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = headersList.get("cookie");
  const m = cookie?.match(/token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default async function RawListingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; source?: string; rule?: string; q?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

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

  const status = sp.status || "needs_review";
  const source = sp.source || "";
  const rule = sp.rule || "";
  const query = sp.q || "";
  const page = parseInt(sp.page || "1", 10) || 1;

  const [list, brands, categories] = await Promise.all([
    listRawListings({ status, source: source || undefined, rule: rule || undefined, q: query || undefined, page, pageSize: 30 }),
    prisma.brand.findMany({ select: { id: true, nameZh: true, nameEn: true }, orderBy: { nameZh: "asc" } }),
    prisma.category.findMany({ select: { id: true, nameZh: true, nameEn: true, parentId: true }, orderBy: { nameZh: "asc" } }),
  ]);

  const buildTabHref = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "needs_review") p.set("status", key);
    if (source) p.set("source", source);
    if (rule) p.set("rule", rule);
    if (query) p.set("q", query);
    const qs = p.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">采集审核</h1>
      <p className="mb-4 text-sm text-gray-500">
        审核自动过滤后的采集单；为卡在「品类/品牌」的行补齐外键 → 通过并转换（生成 draft）→ 发布（draft→active）。
      </p>

      {/* 状态 Tab */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tb) => {
          const active = status === tb.key;
          const count = tb.key === "all" ? list.total : list.statusCounts[tb.key] ?? 0;
          return (
            <Link
              key={tb.key}
              href={buildTabHref(tb.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "border-primary-600 bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tb.label}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${active ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* 筛选表单 */}
      <form method="GET" className="mb-5 flex flex-wrap items-center gap-3">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          type="text"
          defaultValue={query}
          placeholder="搜索型号/品牌/位置/链接..."
          className="w-64 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select name="source" defaultValue={source} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">全部来源</option>
          {list.lookups.sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="rule" defaultValue={rule} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">全部规则</option>
          {["category_undetermined", "brand_unmatched", "no_price", "invalid_year", "price_outlier", "domain_blacklist", "source_url_missing", "price_hard_bound", "duplicate_product"].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          筛选
        </button>
        {(query || source || rule) && (
          <Link href={`?status=${status}`} className="rounded-lg border px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">
            清除过滤
          </Link>
        )}
      </form>

      <p className="mb-4 text-sm text-gray-500">
        共 {list.total} 条 {list.totalPages > 1 && `(第 ${list.page} / ${list.totalPages} 页)`}
      </p>

      <RawListingReviewTable items={list.items} brands={brands} categories={categories} locale={locale} />

      {/* 分页 */}
      {list.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: list.totalPages }, (_, i) => i + 1).map((p) => {
            const params2 = new URLSearchParams();
            if (status && status !== "needs_review") params2.set("status", status);
            if (source) params2.set("source", source);
            if (rule) params2.set("rule", rule);
            if (query) params2.set("q", query);
            params2.set("page", String(p));
            return (
              <Link
                key={p}
                href={`?${params2.toString()}`}
                className={`rounded px-3 py-1 text-sm font-medium ${p === list.page ? "bg-primary-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              >
                {p}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
