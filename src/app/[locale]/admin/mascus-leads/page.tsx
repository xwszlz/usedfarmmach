/**
 * Mascus 线索池后台页（读取侧运营界面）
 *
 * server 组件。五段骨架与 `admin/raw-listings/page.tsx` 严格对称：
 *   文件头注释 + `force-dynamic` → 页内二次鉴权 → `<form method="GET">` 筛选
 *   → 计数 + 表格 → `<Link>` 分页。
 *
 * 与 raw-listings 复用 `review.ts` 同构，本页直接复用 `@/lib/mascus-leads/query`
 * 服务层（server 组件自请求自家 API 需要绝对地址且易在 SSR 期形成回环），
 * 客户端表格的「详情 / 行内编辑」则走已实现的 `/api/admin/mascus-listings` REST 契约。
 * 所有字段名逐字对齐 `query.ts` 的导出类型，未自行发明字段。
 *
 * 🔴 鉴权：`admin/layout.tsx` 放行了 `editor`，故本页必须按 DB 角色二次收紧；
 *    另加 SITE 闸门：`.cn` 侧整页 redirect（后端已 403），不在侧栏泄漏入口。
 * 🔴 价格：43% 挂牌无价，是线索池核心，**不做任何默认价格过滤**；
 *    排序 null-last 由后端 `buildMascusOrderBy` 保证，前端仅把 null 显示成「—」。
 * 🔴 PII：列表只渲染 `sellerPhoneMasked`；明文电话仅在客户端详情弹窗
 *    （GET [id]，后端先写 PII 审计）中出现。
 * ⚠️ 后台硬编码中文，不走 next-intl 8 语种。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMascusAdminRole, isMascusSiteAllowed } from "@/lib/mascus-leads/admin-auth";
import {
  aggregateByBrand,
  aggregateBySeller,
  listMascusListings,
  MASCUS_FOLLOW_STATUSES,
  MASCUS_ORDER_FIELDS,
  UNASSIGNED_TOKEN,
  type MascusBrandGroup,
  type MascusListQuery,
  type MascusOrderField,
  type MascusSellerGroup,
} from "@/lib/mascus-leads/query";
import { MascusDetailButton, MascusLeadTable, MascusThumb } from "@/components/admin/mascus-lead-table";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "listings", label: "挂牌列表" },
  { key: "sellers", label: "按卖家聚合" },
  { key: "brands", label: "按品牌聚合" },
] as const;
type MascusView = (typeof VIEWS)[number]["key"];

const ORDER_FIELDS: { key: MascusOrderField; label: string }[] = [
  { key: "listedAt", label: "挂牌时间" },
  { key: "lastSeenAt", label: "最后见到" },
  { key: "priceEuro", label: "价格（€）" },
  { key: "year", label: "年份" },
];

const PAGE_SIZES = [10, 30, 50, 100] as const;

/** Next 14：重复参数（如 `?q=a&q=b`）会给 `string[]`，单一参数给 `string` */
type SearchValue = string | string[] | undefined;

interface SearchParams {
  view?: SearchValue;
  page?: SearchValue;
  pageSize?: SearchValue;
  q?: SearchValue;
  segment?: SearchValue;
  country?: SearchValue;
  hasPhone?: SearchValue;
  onlyActive?: SearchValue;
  followStatus?: SearchValue;
  assignedTo?: SearchValue;
  orderBy?: SearchValue;
  order?: SearchValue;
}

/**
 * 重复参数统一取第一个值。
 * 不这么做的话 `sp.q` 会是 `string[]`，`buildHref` 里 `URLSearchParams.set(k, v)`
 * 会把它隐式字符串化成 `"a,b"`，筛选条件静默降级。
 */
function first(v: SearchValue): string {
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : "";
  return typeof v === "string" ? v : "";
}

/** 与客户端 `formatDate` 同口径：后台时间一律 UTC，避免 SSR/hydrate 文本漂移 */
function formatUtc(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function formatEuro(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `€${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** 分页页码窗口：页多时只渲染首尾 + 当前页附近，避免生成成千上万个 Link */
function paginationPages(current: number, total: number): number[] {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current]);
  for (let d = -2; d <= 2; d += 1) {
    const p = current + d;
    if (p >= 1 && p <= total) set.add(p);
  }
  return Array.from(set).sort((a, b) => a - b);
}

export default async function MascusLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  // ── 1) SITE 闸门（先于鉴权，与后端 requireMascusSite 同顺序：.cn 不查库）──
  if (!isMascusSiteAllowed()) {
    redirect(`/${locale}/admin`);
  }

  // ── 2) 页内二次鉴权（layout 放行了 editor；以 DB role/isActive 为准）──
  const headersList = headers();
  const token = getTokenFromHeaders(headersList);
  const payload = token ? verifyToken(token) : null;
  const me = payload
    ? await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { role: true, isActive: true },
      })
    : null;
  if (!me || !me.isActive || !isMascusAdminRole(me.role)) {
    redirect(`/${locale}/admin`);
  }

  // ── 3) 解析全部 query 参数（与 GET /api/admin/mascus-listings 逐字对齐）──
  // 全部经 first() 归一：Next 14 对重复参数给 string[]，需取第一个，避免静默降级
  const viewRaw = first(sp.view);
  const view: MascusView = viewRaw === "sellers" || viewRaw === "brands" ? viewRaw : "listings";
  const page = Math.max(1, parseInt(first(sp.page) || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(first(sp.pageSize) || "30", 10) || 30));
  const q = first(sp.q);
  const segment = first(sp.segment);
  const country = first(sp.country);
  const hasPhone = first(sp.hasPhone) === "1";
  const onlyActive = first(sp.onlyActive) === "1";
  const followStatusRaw = first(sp.followStatus);
  const followStatus = (MASCUS_FOLLOW_STATUSES as readonly string[]).includes(followStatusRaw)
    ? followStatusRaw
    : "";
  const assignedTo = first(sp.assignedTo);
  const orderByRaw = first(sp.orderBy);
  const orderBy: MascusOrderField = (MASCUS_ORDER_FIELDS as readonly string[]).includes(orderByRaw)
    ? (orderByRaw as MascusOrderField)
    : "listedAt";
  const order: "asc" | "desc" = first(sp.order) === "asc" ? "asc" : "desc";

  const query: MascusListQuery = {
    page,
    pageSize,
    q,
    segment,
    country,
    hasPhone,
    onlyActive,
    followStatus,
    assignedTo,
    orderBy,
    order,
  };

  // 三个视图都复用同一次 listMascusListings 取 lookups / statusCounts；
  // 聚合视图把分页压到 1 行，避免白白拉一页明细。
  const [listResult, sellerItems, brandItems] = await Promise.all([
    listMascusListings(view === "listings" ? query : { ...query, page: 1, pageSize: 1 }),
    view === "sellers" ? aggregateBySeller(query) : Promise.resolve<MascusSellerGroup[]>([]),
    view === "brands" ? aggregateByBrand(query) : Promise.resolve<MascusBrandGroup[]>([]),
  ]);
  const { lookups, statusCounts } = listResult;

  /**
   * 构造保留全部筛选参数的 href。
   * `overrides` 里传 `null` 表示删除该参数；默认值（view=listings / page=1 /
   * pageSize=30 / orderBy=listedAt / order=desc）不写入 URL，保持地址干净。
   */
  function buildHref(overrides: Record<string, string | null> = {}): string {
    const values: Record<string, string | null> = {
      view: view === "listings" ? null : view,
      page: page === 1 ? null : String(page),
      pageSize: pageSize === 30 ? null : String(pageSize),
      q: q || null,
      segment: segment || null,
      country: country || null,
      hasPhone: hasPhone ? "1" : null,
      onlyActive: onlyActive ? "1" : null,
      followStatus: followStatus || null,
      assignedTo: assignedTo || null,
      orderBy: orderBy === "listedAt" ? null : orderBy,
      order: order === "desc" ? null : order,
      ...overrides,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) {
      if (v === null || v === "") continue;
      p.set(k, v);
    }
    const qs = p.toString();
    return qs.length > 0 ? `?${qs}` : "?";
  }

  const allStatusCount = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
  const statusTabs = [
    { key: "", label: "全部", count: allStatusCount },
    ...MASCUS_FOLLOW_STATUSES.map((s) => ({ key: s, label: s, count: statusCounts[s] ?? 0 })),
  ];

  const clearHref = buildHref({
    q: null,
    segment: null,
    country: null,
    hasPhone: null,
    onlyActive: null,
    followStatus: null,
    assignedTo: null,
    orderBy: null,
    order: null,
    page: null,
  });

  const currentPage = Math.min(listResult.page, listResult.totalPages);
  const pages = paginationPages(currentPage, listResult.totalPages);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Mascus 线索池</h1>
      <p className="mb-4 text-sm text-gray-500">
        Mascus 采集挂牌的运营工作台：查看掩码电话、按跟进状态分派负责人、按卖家电话 / 品牌做聚合。
        <span className="ml-1 font-medium text-amber-700">
          约 43% 挂牌无价格，属于线索池核心，本页不按价格过滤（无价显示「—」，排序 null-last）。
        </span>
      </p>

      {/* 三个视图：<Link> 带 view= 参数，服务端渲染，不用客户端状态 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">视图：</span>
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <Link
              key={v.key}
              href={buildHref({ view: v.key === "listings" ? null : v.key, page: null })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                active ? "bg-primary-600 text-white" : "border text-gray-600 hover:bg-gray-100"
              }`}
            >
              {v.label}
            </Link>
          );
        })}
      </div>

      {/* 状态 Tab（仅挂牌列表视图；计数来自 statusCounts，不受 followStatus 自身筛选影响） */}
      {view === "listings" && (
        <div className="mb-4 flex flex-wrap gap-2">
          {statusTabs.map((tb) => {
            const active = followStatus === tb.key;
            return (
              <Link
                key={tb.key || "all"}
                href={buildHref({ followStatus: tb.key || null, page: null })}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "border-primary-600 bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tb.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                    active ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {tb.count}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* 筛选表单：method="GET"，参数名逐字对齐后端 GET /api/admin/mascus-listings */}
      <form method="GET" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border bg-gray-50 p-4">
        <input type="hidden" name="view" value={view} />

        <label className="flex flex-col gap-1 text-xs text-gray-500">
          关键词
          <input
            name="q"
            type="text"
            defaultValue={q}
            placeholder="品牌 / 型号 / 公司"
            className="w-52 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-500">
          扫描段
          <select name="segment" defaultValue={segment} className="w-44 rounded-lg border px-3 py-2 text-sm">
            <option value="">全部段</option>
            {lookups.segments.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-500">
          国家
          <select name="country" defaultValue={country} className="w-40 rounded-lg border px-3 py-2 text-sm">
            <option value="">全部国家</option>
            {lookups.countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-500">
          跟进状态
          <select name="followStatus" defaultValue={followStatus} className="w-32 rounded-lg border px-3 py-2 text-sm">
            <option value="">全部状态</option>
            {MASCUS_FOLLOW_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-500">
          负责人
          <select name="assignedTo" defaultValue={assignedTo} className="w-36 rounded-lg border px-3 py-2 text-sm">
            <option value="">全部负责人</option>
            <option value={UNASSIGNED_TOKEN}>未分配</option>
            {lookups.assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-500">
          排序字段
          <select name="orderBy" defaultValue={orderBy} className="w-32 rounded-lg border px-3 py-2 text-sm">
            {ORDER_FIELDS.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-500">
          方向
          <select name="order" defaultValue={order} className="w-24 rounded-lg border px-3 py-2 text-sm">
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-500">
          每页
          <select name="pageSize" defaultValue={String(pageSize)} className="w-24 rounded-lg border px-3 py-2 text-sm">
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n} 条</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 pb-2 text-xs text-gray-600">
          <input type="checkbox" name="hasPhone" value="1" defaultChecked={hasPhone} className="h-4 w-4" />
          仅看有电话
        </label>

        <label className="flex items-center gap-1.5 pb-2 text-xs text-gray-600">
          <input type="checkbox" name="onlyActive" value="1" defaultChecked={onlyActive} className="h-4 w-4" />
          仅看还在挂
        </label>

        <button
          type="submit"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          筛选
        </button>
        <Link href={clearHref} className="rounded-lg border px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">
          清除过滤
        </Link>
      </form>

      {/* 计数 */}
      <p className="mb-4 text-sm text-gray-500">
        {view === "listings" && (
          <>
            共 {listResult.total} 条线索
            {listResult.totalPages > 1 && `（第 ${listResult.page} / ${listResult.totalPages} 页）`}
            ，含无价行
          </>
        )}
        {view === "sellers" && <>共 {sellerItems.length} 个电话分组（后端单次返回上限 200）</>}
        {view === "brands" && <>共 {brandItems.length} 个品牌</>}
      </p>

      {/* 挂牌列表视图 */}
      {view === "listings" && (
        <MascusLeadTable
          items={listResult.items}
          assignees={lookups.assignees}
          followStatuses={[...MASCUS_FOLLOW_STATUSES]}
        />
      )}

      {/* 按卖家聚合视图：companyName 原样展示，不做连锁归并 */}
      {view === "sellers" && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-2.5 text-xs text-gray-500">
            公司名按 Mascus 原文展示（自带分公司后缀，如
            <span className="mx-1 font-mono text-gray-700">&quot;Ag-Pro - Mansfield, OH&quot;</span>
            ），<span className="font-medium text-gray-700">不做连锁归并</span>；
            「电话写法（掩码）」用数组长度体现同一号码的原始写法种数，供人工核对归一结果。无电话的行不参与聚合。
            <br />
            <span className="font-medium text-amber-700">🔴 本视图与挂牌列表同样只展示掩码电话</span>
            （后端 `aggregateBySeller` 只下发 `phoneKeyMasked` / `phoneVariants[].masked`）；
            查看明文须点每行「查看明文」，将调用详情接口并<span className="font-medium">记录 PII 审计日志</span>。
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-3 py-3 font-medium">图</th>
                  <th className="px-3 py-3 font-medium">电话归一键（掩码）</th>
                  <th className="px-3 py-3 font-medium">公司（原文）</th>
                  <th className="px-3 py-3 font-medium">电话写法（掩码）</th>
                  <th className="px-3 py-3 font-medium">地区</th>
                  <th className="px-3 py-3 font-medium">挂牌数</th>
                  <th className="px-3 py-3 font-medium">品牌</th>
                  <th className="px-3 py-3 font-medium">扫描段</th>
                  <th className="px-3 py-3 font-medium">价格区间（€）</th>
                  <th className="px-3 py-3 font-medium">最近挂牌（UTC）</th>
                  <th className="px-3 py-3 font-medium">跟进状态</th>
                  <th className="px-3 py-3 font-medium">负责人</th>
                  <th className="px-3 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {sellerItems.map((s) => {
                  const region = [s.locationCountry, s.locationCity]
                    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
                    .join(" / ");
                  const assigneeLabel = lookups.assignees.find((a) => a.id === s.assignedTo)?.label
                    ?? s.assignedTo
                    ?? "未分配";
                  return (
                    <tr key={s.sampleListingId} className="border-b align-top last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <MascusThumb src={s.sampleAssetUrl} alt={s.companyName ?? "卖家"} />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-800">{s.phoneKeyMasked || "—"}</td>
                      <td className="px-3 py-2.5">
                        {/* 🔴 原样展示，不拆分 / 不去后缀 / 不并连锁 */}
                        <div className="max-w-[16rem] break-words text-gray-800">{s.companyName ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex max-w-[16rem] flex-wrap gap-1">
                          {s.phoneVariants.map((v, i) => (
                            <span
                              key={`${v.masked}-${i}`}
                              className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600"
                            >
                              {v.masked} <span className="text-gray-400">×{v.count}</span>
                            </span>
                          ))}
                          {s.phoneVariants.length === 0 && <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">{region || "—"}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{s.listingCount}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">
                        <div className="max-w-[12rem] break-words">{s.brands.join("、") || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">
                        <div className="max-w-[12rem] break-words">{s.segments.join("、") || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700">
                        {formatEuro(s.priceMinEuro)} ~ {formatEuro(s.priceMaxEuro)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">
                        <div>{formatUtc(s.latestListedAt)}</div>
                        <div className="text-[10px] text-gray-400">末见 {formatUtc(s.maxLastSeenAt)}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700">{s.followStatus}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700">{assigneeLabel}</td>
                      <td className="px-3 py-2.5">
                        <MascusDetailButton id={s.sampleListingId} label="查看明文" />
                      </td>
                    </tr>
                  );
                })}
                {sellerItems.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-4 py-10 text-center text-gray-400">
                      暂无可聚合的带电话卖家
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 按品牌聚合视图 */}
      {view === "brands" && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-3 py-3 font-medium">品牌</th>
                  <th className="px-3 py-3 font-medium">挂牌数</th>
                  <th className="px-3 py-3 font-medium">带电话数</th>
                  <th className="px-3 py-3 font-medium">带电话占比</th>
                </tr>
              </thead>
              <tbody>
                {brandItems.map((b) => {
                  const pct = b.listingCount > 0
                    ? `${((b.withPhoneCount / b.listingCount) * 100).toFixed(1)}%`
                    : "—";
                  return (
                    <tr key={b.brandName} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{b.brandName}</td>
                      <td className="px-3 py-2.5 text-gray-700">{b.listingCount}</td>
                      <td className="px-3 py-2.5 text-gray-700">{b.withPhoneCount}</td>
                      <td className="px-3 py-2.5 text-gray-500">{pct}</td>
                    </tr>
                  );
                })}
                {brandItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                      暂无品牌聚合数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 分页：保留全部筛选参数 */}
      {view === "listings" && listResult.totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={buildHref({ page: String(currentPage - 1) })}
              className="rounded px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              上一页
            </Link>
          )}
          {pages.map((p, idx) => (
            <span key={p} className="flex items-center gap-2">
              {idx > 0 && p - pages[idx - 1] > 1 && (
                <span className="px-1 text-xs text-gray-400">…</span>
              )}
              <Link
                href={buildHref({ page: String(p) })}
                className={`rounded px-3 py-1 text-sm font-medium ${
                  p === currentPage ? "bg-primary-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {p}
              </Link>
            </span>
          ))}
          {currentPage < listResult.totalPages && (
            <Link
              href={buildHref({ page: String(currentPage + 1) })}
              className="rounded px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              下一页
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
