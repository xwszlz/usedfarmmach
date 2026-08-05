import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { maskEmail, profileCompleteness } from "@/lib/pii";
import { UsersTable, type AdminUserRow } from "./users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // 角色门禁：仅 admin / super_admin 可进入用户管理（T07 收紧）
  const headersList = headers();
  const token = (() => {
    const auth = headersList.get("authorization");
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    const cookie = headersList.get("cookie");
    const m = cookie?.match(/token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  })();

  let viewerRole: string | null = null;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { role: true },
      });
      viewerRole = user?.role ?? null;
    }
  }

  // editor 继续重定向到商品管理；其余非 admin / super_admin 角色一律拒绝进入
  if (viewerRole === "editor") {
    redirect("/admin/products");
  }
  if (!["admin", "super_admin"].includes(viewerRole ?? "")) {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      companyName: true,
      country: true,
      credits: true,
      emailPending: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { products: true, inquiries: true } },
    },
  });

  // 服务端脱敏 + 完整性计算，仅下发脱敏数据给客户端（共享知识 §1/§2）
  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    emailMasked: maskEmail(u.email),
    emailPending: u.emailPending,
    emailVerified: u.emailVerified,
    role: u.role,
    companyName: u.companyName,
    country: u.country,
    credits: u.credits,
    completeness: profileCompleteness({
      email: u.email,
      companyName: u.companyName,
      country: u.country,
      phone: u.phone,
      emailPending: u.emailPending,
    }),
    createdAt: u.createdAt.toISOString(),
    productCount: u._count.products,
    inquiryCount: u._count.inquiries,
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">用户管理</h1>
      <UsersTable users={rows} canReveal={true} canRemind={true} />
    </div>
  );
}
