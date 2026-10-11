/**
 * 境内线索录入入口页（P0，server 组件）
 *
 * 安全护栏（与《工程方案》§4 一致）：
 *  - CN-only：SITE!=="cn" → redirect 回线索池（.com 部署看不到入口，数据不出境红线）；
 *  - 角色二次收紧：非 admin/super_admin → redirect 回 /admin（同 leads/page.tsx 范式）。
 *
 * 仅渲染 `<LeadImportUpload />`（client，负责解析/列映射/提交）。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRawListingAdminRole } from "@/lib/raw-listing/admin-auth";
import { SITE } from "@/config/site";
import { LeadImportUpload } from "@/components/admin/lead-import-upload";

export const dynamic = "force-dynamic";

export default async function LeadImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // ── CN-only 护栏（数据不出境红线）──
  if (SITE !== "cn") {
    redirect(`/${locale}/admin/leads`);
  }

  // ── 页内二次角色收紧（layout 放行了 editor）──
  const headersList = headers();
  const token = getTokenFromHeaders(headersList);
  const payload = token ? verifyToken(token) : null;
  const me = payload
    ? await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true, isActive: true } })
    : null;
  if (!me || !me.isActive || !isRawListingAdminRole(me.role)) {
    redirect(`/${locale}/admin`);
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">境内线索录入</h1>
      <p className="mb-4 text-sm text-gray-500">
        仅限境内（.cn）站点使用。支持上传 Excel/CSV 或粘贴表格（Excel 复制选区 / CSV 文本），
        浏览器内完成列映射与预览校验后提交。每行按「品牌 · 机型 · 年份 · 地区 · 价格 · 卖家」生成独立线索，
        并逐行留痕 PII 审计（field=&quot;contact&quot;）。
      </p>
      <LeadImportUpload />
    </div>
  );
}
