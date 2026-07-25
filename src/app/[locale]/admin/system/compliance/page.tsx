import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { getComplianceMetrics } from "@/lib/admin/system";

export const dynamic = "force-dynamic";

export default async function AdminCompliancePage() {
  // 仅 super_admin 可见（双层校验）
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

  const m = await getComplianceMetrics();
  const t = await getTranslations("adminSystem");
  const pct = Math.min(100, Math.round(m.ratio * 100));
  const over = m.ratio > 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("compliance")}</h1>
        <p className="text-sm text-gray-500">{t("complianceDesc")}</p>
      </div>

      <section className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span>{t("crossBorderRecipients")}</span>
          <span className="font-bold">
            {m.crossBorderRecipients} / {m.threshold}
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${over ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {over && (
          <div className="mt-2 text-sm text-red-700">{t("thresholdExceeded")}</div>
        )}
        <div className="mt-2 text-xs text-gray-400">
          {t("ratio")}：{(m.ratio * 100).toFixed(2)}%
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-3">{t("providers")}</h2>
        <table className="w-full text-sm">
          <tbody>
            {m.providers.map((p) => (
              <tr key={p.name} className="border-b">
                <td className="py-2">{p.name}</td>
                <td className="py-2">{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
