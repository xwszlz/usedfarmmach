/**
 * 经销商对照页（整合视图，P1）
 *
 * server 组件：与线索池页同口径的二次角色收紧（admin/super_admin，editor 排除）→
 * 复用 T2 统一查询层 `listUnifiedLeads` + `groupByTierBrand`，把「经销商（户，含联系方式）」
 * 与「挂牌（台，含价格/年份）」按「马力档(tier) + 品牌(brandKey)」分组对照。
 *
 * 设计来源：docs/采集数据统一方案（P1）。零新增列、零表变更、无新 UI 框架。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRawListingAdminRole } from "@/lib/raw-listing/admin-auth";
import { listUnifiedLeads, groupByTierBrand } from "@/lib/raw-listing/dealer-view";
import type { UnifiedLeadRow, TierBrandGroup } from "@/lib/raw-listing/dealer-view";
import { DealerContact } from "@/components/admin/dealer-contact";

export const dynamic = "force-dynamic";

/** 初始渲染上限（数据量大时先渲染前 N 组，避免一次性渲染过多 DOM） */
const MAX_GROUPS = 200;

/** 人民币价格格式化（null 显示为 —） */
function formatPrice(priceCny: number | null): string {
  if (priceCny == null) return "—";
  return `¥${priceCny.toLocaleString("zh-CN")}`;
}

export default async function DealersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

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

  // 整合视图：国内站点，全部行（经销商 + 挂牌），按「马力档 + 品牌」软分组
  const rows = await listUnifiedLeads({ site: "cn", kind: "all" });
  const groups: TierBrandGroup[] = groupByTierBrand(rows);
  const shown = groups.slice(0, MAX_GROUPS);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">经销商对照</h1>
      <p className="mb-4 text-sm text-gray-500">
        整合视图：按「马力档 + 品牌」把<strong className="text-blue-700">经销商（户，含联系方式）</strong>与
        <strong className="text-amber-700">挂牌（台，含价格/年份）</strong>对照展示，兑现「采集数据统一」价值。
        {groups.length > MAX_GROUPS
          ? ` 当前仅渲染前 ${MAX_GROUPS} 组（共 ${groups.length} 组），可缩小筛选范围以查看更多。`
          : ` 共 ${groups.length} 组。`}
      </p>

      {groups.length === 0 ? (
        <div className="rounded-xl border bg-white px-4 py-10 text-center text-gray-400 shadow-sm">
          暂无数据
        </div>
      ) : (
        <div className="space-y-6">
          {shown.map((g) => (
            <section key={`${g.tier}::${g.brandKey}`} className="rounded-xl border bg-white shadow-sm">
              {/* 分组标题：马力档 + 品牌 + 计数 */}
              <div className="flex items-center gap-2 border-b bg-gray-50 px-4 py-3">
                <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">{g.tier}</span>
                <span className="text-sm font-semibold text-gray-800">{g.brandKey}</span>
                <span className="ml-auto text-xs text-gray-400">
                  经销商 {g.dealers.length} · 挂牌 {g.listings.length}
                </span>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2">
                {/* 经销商（户）*/}
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-blue-700">经销商（{g.dealers.length}）</h3>
                  {g.dealers.length === 0 ? (
                    <p className="text-xs text-gray-400">本组暂无经销商</p>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {g.dealers.map((d) => (
                          <tr key={d.id} className="border-b last:border-0">
                            <td className="py-2 pr-2 align-top text-gray-700">{d.sellerName ?? "—"}</td>
                            <td className="py-2 align-top text-xs text-gray-500">
                              {/* P0-5：明文电话/微信/WhatsApp/邮箱改为掩码 + reveal，首次查看写 PII 审计 */}
                              <DealerContact
                                id={d.id}
                                phone={d.sellerPhone}
                                wechat={d.sellerWechat}
                                whatsapp={d.sellerWhatsapp}
                                email={d.sellerEmail}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 挂牌（台）*/}
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-amber-700">挂牌（{g.listings.length}）</h3>
                  {g.listings.length === 0 ? (
                    <p className="text-xs text-gray-400">本组暂无挂牌</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-gray-400">
                          <th className="py-1.5 pr-2 font-medium">品牌/型号</th>
                          <th className="py-1.5 pr-2 font-medium">年份</th>
                          <th className="py-1.5 pr-2 font-medium">价格</th>
                          <th className="py-1.5 pr-2 font-medium">地区</th>
                          <th className="py-1.5 font-medium">平台</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.listings.map((l) => (
                          <tr key={l.id} className="border-b last:border-0">
                            <td className="py-2 pr-2 align-top text-gray-700">
                              <div>{l.brandName}</div>
                              <div className="text-xs text-gray-400">{l.modelName}</div>
                            </td>
                            <td className="py-2 pr-2 align-top text-gray-500">{l.year ?? "—"}</td>
                            <td className="py-2 pr-2 align-top text-gray-700">{formatPrice(l.priceCny)}</td>
                            <td className="py-2 pr-2 align-top text-gray-500">{l.location || "—"}</td>
                            <td className="py-2 align-top text-xs text-gray-400">{l.platform || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>
          ))}

          {groups.length > MAX_GROUPS && (
            <p className="text-center text-xs text-gray-400">
              仅显示前 {MAX_GROUPS} 组，共 {groups.length} 组；可缩小筛选范围以查看更多。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
