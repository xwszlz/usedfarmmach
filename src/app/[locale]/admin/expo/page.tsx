import { prisma } from "@/lib/db";
import { AdminRegActions } from "./AdminRegActions";

export const dynamic = "force-dynamic";

export default async function AdminExpoPage() {
  // Fetch all data in parallel
  const [
    registrations,
    inquiries,
    expoCount,
    boothCount,
    itemCount,
    registrationCount,
    inquiryCount,
  ] = await Promise.all([
    prisma.expoRegistration.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.expoInquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        showcaseItem: {
          select: { id: true, brand: true, model: true, deviceType: true },
        },
      },
    }),
    prisma.expo.count(),
    prisma.booth.count(),
    prisma.showcaseItem.count(),
    prisma.expoRegistration.count(),
    prisma.expoInquiry.count(),
  ]);

  // Stats
  const pendingCount = registrations.filter((r) => r.status === "pending").length;
  const newInquiryCount = inquiries.filter((i) => i.status === "new").length;

  // Group registrations by country
  const countryStats: Record<string, number> = {};
  registrations.forEach((r) => {
    if (r.country) {
      countryStats[r.country] = (countryStats[r.country] || 0) + 1;
    }
  });

  // Group registrations by boothType
  const boothTypeStats: Record<string, number> = {};
  registrations.forEach((r) => {
    if (r.boothType) {
      boothTypeStats[r.boothType] = (boothTypeStats[r.boothType] || 0) + 1;
    }
  });

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    contacted: "bg-blue-100 text-blue-700",
    confirmed: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    new: "bg-orange-100 text-orange-700",
    closed: "bg-gray-100 text-gray-600",
    converted: "bg-green-100 text-green-700",
  };

  const getStatusBadge = (status: string) => {
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[status] || "bg-gray-100 text-gray-600"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">博览会管理</h1>
        <p className="text-sm text-gray-500">招商意向、展品询盘、展会数据一览</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-500">展会数</div>
          <div className="text-2xl font-bold text-gray-900">{expoCount}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-500">展位数</div>
          <div className="text-2xl font-bold text-gray-900">{boothCount}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-500">展品数</div>
          <div className="text-2xl font-bold text-gray-900">{itemCount}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-500">招商意向</div>
          <div className="text-2xl font-bold text-amber-600">{registrationCount}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-500">展品询盘</div>
          <div className="text-2xl font-bold text-orange-600">{inquiryCount}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-500">待处理</div>
          <div className="text-2xl font-bold text-red-600">{pendingCount + newInquiryCount}</div>
        </div>
      </div>

      {/* Registration Distribution */}
      {(Object.keys(countryStats).length > 0 || Object.keys(boothTypeStats).length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Object.keys(countryStats).length > 0 && (
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">招商意向 - 国家/地区分布</h3>
              <div className="space-y-2">
                {Object.entries(countryStats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([country, count]) => (
                    <div key={country} className="flex items-center gap-2">
                      <span className="w-32 text-sm text-gray-600">{country}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${(count / registrationCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {Object.keys(boothTypeStats).length > 0 && (
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">招商意向 - 展位类型分布</h3>
              <div className="space-y-2">
                {Object.entries(boothTypeStats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <span className="w-32 text-sm text-gray-600">{type}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                        <div
                          className="h-full bg-orange-500"
                          style={{ width: `${(count / registrationCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Registrations Table */}
      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900">
            招商意向列表 <span className="text-sm font-normal text-gray-400">（{registrations.length} 条）</span>
          </h2>
          <p className="mt-1 text-xs text-gray-500">点击「通过」自动创建品牌账号并发送登录凭证邮件</p>
        </div>
        <div className="overflow-x-auto">
          {registrations.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">暂无招商意向</div>
          ) : (
            <AdminRegActions
              registrations={registrations.map((r) => ({
                id: r.id,
                name: r.name,
                company: r.company,
                phone: r.phone,
                email: r.email,
                country: r.country,
                category: r.category,
                boothType: r.boothType,
                status: r.status,
                createdAt: r.createdAt,
              }))}
            />
          )}
        </div>
      </div>

      {/* Inquiries Table */}
      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900">
            展品询盘列表 <span className="text-sm font-normal text-gray-400">（{inquiries.length} 条）</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          {inquiries.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">暂无展品询盘</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">时间</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">询盘展品</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">买家</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">电话</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">邮箱</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">国家</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">状态</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">留言</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inquiries.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {new Date(i.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {i.showcaseItem
                        ? `${i.showcaseItem.brand || ""} ${i.showcaseItem.model || ""}`.trim() || i.showcaseItem.deviceType
                        : "-"}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">{i.buyerName}</td>
                    <td className="px-4 py-2 text-gray-600">{i.buyerPhone}</td>
                    <td className="px-4 py-2 text-gray-600">{i.buyerEmail || "-"}</td>
                    <td className="px-4 py-2 text-gray-600">{i.buyerCountry || "-"}</td>
                    <td className="px-4 py-2">{getStatusBadge(i.status)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 max-w-[200px] truncate" title={i.message}>
                      {i.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
