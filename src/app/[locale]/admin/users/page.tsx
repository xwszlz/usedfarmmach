import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { CreditManager } from "./credit-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // Editor 角色不能访问用户管理
  const headersList = headers();
  const token = (() => {
    const auth = headersList.get("authorization");
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    const cookie = headersList.get("cookie");
    const m = cookie?.match(/token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  })();
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
      if (user?.role === "editor") {
        redirect("/admin/products");
      }
    }
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, companyName: true, country: true, credits: true, createdAt: true, _count: { select: { products: true, inquiries: true } } },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">用户管理</h1>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-6 py-3 font-medium">邮箱</th>
                <th className="px-6 py-3 font-medium">公司</th>
                <th className="px-6 py-3 font-medium">国家</th>
                <th className="px-6 py-3 font-medium">角色</th>
                <th className="px-6 py-3 font-medium">产品</th>
                <th className="px-6 py-3 font-medium">询盘</th>
                <th className="px-6 py-3 font-medium">积分</th>
                <th className="px-6 py-3 font-medium">注册时间</th>
                <th className="px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{u.email}</td>
                  <td className="px-6 py-3 text-gray-500">{u.companyName || "-"}</td>
                  <td className="px-6 py-3 text-gray-500">{u.country || "-"}</td>
                  <td className="px-6 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.role === "admin" ? "bg-purple-100 text-purple-700" :
                      u.role === "editor" ? "bg-teal-100 text-teal-700" :
                      u.role === "seller" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-900">{u._count.products}</td>
                  <td className="px-6 py-3 text-gray-900">{u._count.inquiries}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{u.credits}</td>
                  <td className="px-6 py-3 text-gray-400">{new Date(u.createdAt).toLocaleDateString("zh-CN")}</td>
                  <td className="px-6 py-3">
                    <CreditManager userId={u.id} currentCredits={u.credits} currentRole={u.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
