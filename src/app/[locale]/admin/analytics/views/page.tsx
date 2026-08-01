import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import ViewsAnalyticsClient from "./ViewsAnalyticsClient";

export const dynamic = "force-dynamic";

/**
 * 管理后台浏览量看板（server wrapper）。
 * 鉴权由 admin/layout 统一把关（admin/super_admin/editor 可进入本区域）；
 * 此处额外限制为仅 admin/super_admin（editor 无网站级统计权限），否则退回首页。
 * 校验通过后将 role 传给客户端用于文案与视角标识。
 */
function getTokenFromHeaders(headersList: Headers): string | null {
  const auth = headersList.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = headersList.get("cookie");
  const m = cookie?.match(/token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default async function AdminViewsAnalyticsPage() {
  const token = getTokenFromHeaders(headers());
  const payload = token ? verifyToken(token) : null;
  if (!payload || !["admin", "super_admin"].includes(payload.role)) {
    redirect("/");
  }

  return <ViewsAnalyticsClient role={payload.role} variant="admin" />;
}
