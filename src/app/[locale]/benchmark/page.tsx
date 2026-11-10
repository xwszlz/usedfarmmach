import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getUserFromRequest } from "@/lib/auth";
import { isRawListingAdminRole } from "@/lib/raw-listing/admin-auth";
import BenchmarkClient from "./BenchmarkClient";
import PublicBenchmarkSummary from "./PublicBenchmarkSummary";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("benchmarkPublic");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/**
 * 服务端按角色分流：
 *  - admin / super_admin → 原有全量看板 BenchmarkClient（/api/benchmark 鉴权不变）
 *  - 游客 / 普通注册用户 → 公开脱敏摘要 PublicBenchmarkSummary（/api/benchmark/public）
 *
 * 🔴 判定异常一律按游客处理（fail-closed），绝不因查库失败误放开全量数据。
 * 🔴 不再出现「游客撞 401 被兜底成无法获取数据」的路径。
 */
export default async function BenchmarkPage() {
  const t = await getTranslations("benchmarkPublic");

  let isAdmin = false;
  try {
    const h = new Headers();
    headers().forEach((value, key) => h.set(key, value));
    const cookieToken = cookies().get("token")?.value;
    if (cookieToken && !h.has("authorization")) {
      h.set("authorization", `Bearer ${cookieToken}`);
    }
    const user = await getUserFromRequest({ headers: h });
    isAdmin = isRawListingAdminRole(user?.role);
  } catch {
    isAdmin = false;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isAdmin ? t("adminTitle") : t("title")}
            </h1>
            <p className="text-gray-600">
              {isAdmin ? t("adminDescription") : t("description")}
            </p>
          </div>
          <Suspense
            fallback={
              <div className="border rounded-lg p-8 bg-white shadow-sm text-center text-gray-500">
                {t("loading")}
              </div>
            }
          >
            {isAdmin ? <BenchmarkClient /> : <PublicBenchmarkSummary />}
          </Suspense>
        </div>
      </div>
    </main>
  );
}
