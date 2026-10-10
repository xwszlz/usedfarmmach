/**
 * 线索池页（Seller Leads，T04）
 *
 * server 组件：鉴权二次收紧（admin/super_admin，editor 排除）→ 复用 `review.listLeads()`
 * → 渲染客户端线索表格。结构与采集审核页对称。
 *
 * ⚠️ `admin/layout.tsx` 放行了 `editor`，故本页**必须**再次校验角色，
 * 非 admin/super_admin → redirect 回 /${locale}/admin（与后端 requireRawListingAdmin 同口径）。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRawListingAdminRole } from "@/lib/raw-listing/admin-auth";
import { listLeads } from "@/lib/raw-listing/review";
import { LeadTable } from "@/components/admin/lead-table";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
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

  const query = sp.q || "";
  const page = parseInt(sp.page || "1", 10) || 1;
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.pageSize || "30", 10) || 30));

  const list = await listLeads({ page, pageSize, q: query || undefined });

  const buildPageHref = (p: number) => {
    const params2 = new URLSearchParams();
    if (query) params2.set("q", query);
    params2.set("page", String(p));
    return `?${params2.toString()}`;
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">线索池</h1>
      <p className="mb-4 text-sm text-gray-500">
        内部线索池：采集到的卖方线索统一在此查看与补全联系方式（电话 / 微信 / WhatsApp / 邮箱）。
        点击「查看联系方式」将留痕 PII 审计后展示明文；微信 / WhatsApp / 邮箱 可在此行内补全（采集端未自动落的可人工补）。
      </p>

      {/* 搜索表单 */}
      <form method="GET" className="mb-5 flex flex-wrap items-center gap-3">
        <input
          name="q"
          type="text"
          defaultValue={query}
          placeholder="搜索卖家名 / 品牌 / 型号..."
          className="w-64 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          搜索
        </button>
        {query && (
          <Link href="?" className="rounded-lg border px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">
            清除
          </Link>
        )}
      </form>

      <p className="mb-4 text-sm text-gray-500">
        共 {list.total} 条 {list.totalPages > 1 && `(第 ${list.page} / ${list.totalPages} 页)`}
      </p>

      <LeadTable items={list.items} locale={locale} />

      {/* 分页 */}
      {list.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: list.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildPageHref(p)}
              className={`rounded px-3 py-1 text-sm font-medium ${p === list.page ? "bg-primary-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
