import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { getSystemConfig } from "@/lib/admin/system";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
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

  const cfg = getSystemConfig();
  const t = await getTranslations("adminSystem");
  const yes = (b: boolean) => (b ? t("configured") : t("notConfigured"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("config")}</h1>
        <p className="text-sm text-gray-500">{t("configDesc")}</p>
      </div>

      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-3">{t("configEnv")}</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-2">CREDITS_ISSUANCE_ENABLED</td>
              <td className="py-2">{yes(cfg.env.CREDITS_ISSUANCE_ENABLED)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">EMAIL_PROVIDER_DOMESTIC</td>
              <td className="py-2">{cfg.env.EMAIL_PROVIDER_DOMESTIC}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Resend</td>
              <td className="py-2">{yes(cfg.env.RESEND_CONFIGURED)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Aliyun DirectMail</td>
              <td className="py-2">{yes(cfg.env.ALIYUN_DM_CONFIGURED)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Tencent SES</td>
              <td className="py-2">{yes(cfg.env.TENCENT_SES_CONFIGURED)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-3">{t("configProviders")}</h2>
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(cfg.providers).map(([key, v]) => (
              <tr key={key} className="border-b">
                <td className="py-2">{v.label}</td>
                <td className="py-2">{yes(v.configured)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
