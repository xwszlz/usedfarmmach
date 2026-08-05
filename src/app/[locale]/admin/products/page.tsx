import { prisma } from "@/lib/db";
import Link from "next/link";
import { DeleteProductButton } from "@/components/admin/delete-product-button";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; brandId?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q || "";
  const statusFilter = sp.status || "";
  const brandFilter = sp.brandId || "";
  const page = parseInt(sp.page || "1", 10);
  const pageSize = 30;

  // Build where clause
  const where: Record<string, unknown> = {};
  if (query) {
    where.OR = [
      { modelName: { contains: query } },
      { descriptionZh: { contains: query } },
      { brand: { nameZh: { contains: query } } },
      { brand: { nameEn: { contains: query } } },
      { location: { contains: query } },
    ];
  }
  if (statusFilter) {
    where.status = statusFilter;
  }
  if (brandFilter) {
    where.brandId = brandFilter;
  }

  const [products, total, brands, statuses] = await Promise.all([
    prisma.product.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        brand: { select: { id: true, nameZh: true, nameEn: true } },
        category: { select: { id: true, nameZh: true, nameEn: true } },
      },
    }),
    prisma.product.count({ where: where as any }),
    prisma.brand.findMany({ select: { id: true, nameZh: true }, orderBy: { nameZh: "asc" } }),
    prisma.product.findMany({ select: { status: true }, distinct: ["status"] }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">产品管理</h1>

      {/* Search & Filter */}
      <form method="GET" className="mb-6 flex flex-wrap items-center gap-3">
        <input
          name="q"
          type="text"
          defaultValue={query}
          placeholder="搜索型号/品牌/位置..."
          className="rounded-lg border px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select name="status" defaultValue={statusFilter} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {statuses.map((s) => (
            <option key={s.status} value={s.status}>{s.status}</option>
          ))}
        </select>
        <select name="brandId" defaultValue={brandFilter} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">全部品牌</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.nameZh}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          搜索
        </button>
        {(query || statusFilter || brandFilter) && (
          <Link href="?" className="rounded-lg border px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">
            清除过滤
          </Link>
        )}
      </form>

      {/* Stats */}
      <p className="mb-4 text-sm text-gray-500">
        共 {total} 个产品 {totalPages > 1 && `(第 ${page} / ${totalPages} 页)`}
      </p>

      {/* Product Table */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-4 py-3 font-medium">型号</th>
                <th className="px-4 py-3 font-medium">品牌</th>
                <th className="px-4 py-3 font-medium">年份</th>
                <th className="px-4 py-3 font-medium">小时</th>
                <th className="px-4 py-3 font-medium">价格 (CNY)</th>
                <th className="px-4 py-3 font-medium">位置</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[200px] truncate" title={product.modelName}>
                    {product.modelName}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{product.brand.nameZh}</td>
                  <td className="px-4 py-2.5 text-gray-900">{product.year}</td>
                  <td className="px-4 py-2.5 text-gray-500">{product.workingHours ?? "-"}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">¥{product.priceCny.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-500">{product.location}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.status === "active"
                          ? "bg-green-100 text-green-700"
                          : product.status === "sold"
                            ? "bg-gray-100 text-gray-600"
                            : product.status === "draft"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`products/${product.id}`}
                      className="inline-block rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
                    >
                      编辑
                    </Link>
                    <DeleteProductButton productId={product.id} productName={product.modelName} />
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    没有匹配的产品
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => {
            const p = i + 1;
            const params = new URLSearchParams();
            if (query) params.set("q", query);
            if (statusFilter) params.set("status", statusFilter);
            if (brandFilter) params.set("brandId", brandFilter);
            params.set("page", String(p));
            return (
              <Link
                key={p}
                href={`?${params.toString()}`}
                className={`rounded px-3 py-1 text-sm font-medium ${
                  p === page
                    ? "bg-primary-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
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
