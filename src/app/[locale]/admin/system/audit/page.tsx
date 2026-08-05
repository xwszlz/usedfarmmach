import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { AuditLogTable } from "./AuditLogTable";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  // 仅 super_admin 可见
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

  const t = await getTranslations("adminSystem");
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">{t("audit")}</h1>
      <p className="mb-6 text-sm text-gray-500">{t("auditDesc")}</p>
      <AuditLogTable />
    </div>
  );
}
