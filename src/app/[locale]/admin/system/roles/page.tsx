import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { maskEmail } from "@/lib/pii";
import { getTranslations } from "next-intl/server";
import { RoleManager } from "./RoleManager";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  // 仅 super_admin 可见（双层：middleware 网关 + 此处再校验）
  const headersList = headers();
  const token = (() => {
    const auth = headersList.get("authorization");
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    const cookie = headersList.get("cookie");
    const m = cookie?.match(/token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  })();

  let role: string | null = null;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const u = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { role: true },
      });
      role = u?.role ?? null;
    }
  }
  if (role !== "super_admin") redirect("/admin");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      membershipTier: true,
      companyName: true,
      country: true,
    },
  });

  const rows = users.map((u) => ({
    id: u.id,
    emailMasked: maskEmail(u.email),
    role: u.role,
    membershipTier: u.membershipTier,
    companyName: u.companyName,
    country: u.country,
  }));

  const t = await getTranslations("adminSystem");
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">{t("roles")}</h1>
      <p className="mb-6 text-sm text-gray-500">{t("rolesDesc")}</p>
      <RoleManager users={rows} />
    </div>
  );
}
