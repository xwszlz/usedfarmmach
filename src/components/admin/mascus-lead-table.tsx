"use client";

/**
 * Mascus 线索池「挂牌列表」表格（客户端组件）
 *
 * 与 `lead-table.tsx` / `raw-listing-review-table.tsx` 同构：原生 `<table>` + Tailwind，
 * 全后台零 MUI / DataGrid。字段名严格取自 `@/lib/mascus-leads/query` 的导出类型。
 *
 * 🔴 PII 纪律：
 *   - **列表渲染路径只读 `sellerPhoneMasked`**，绝不出现明文 `sellerPhone`；
 *   - 明文只在 `MascusDetailButton` 的弹窗里出现，由 `GET /api/admin/mascus-listings/[id]` 返回，
 *     后端会先写 PII 审计；点击前有常驻横幅 + 按钮 title 明确提示；
 *   - 按卖家聚合视图同样只下发掩码（`phoneKeyMasked` / `phoneVariants[].masked`），
 *     该视图复用同一个 `MascusDetailButton` 看明文，避免两套实现。
 *
 * 🔴 价格纪律：`priceEuro` 为 null 时显示「—」，不做任何默认过滤或隐藏。
 *    后端 `buildMascusOrderBy` 已保证 null-last，前端只负责显示。
 *
 * 行内编辑：跟进状态 / 负责人下拉即改即提交，备注输入点「存备注」提交；
 * 统一走 `PATCH /api/admin/mascus-listings/[id]`，成功后 `router.refresh()`，
 * 失败在表格顶部红条显示 `error` / `code`，并回滚该字段的乐观值。
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MascusListing } from "@prisma/client";
import type { MascusAssigneeLookup, MascusListItem } from "@/lib/mascus-leads/query";

/** 单条详情 = 库表全字段 + 负责人展示名（后端 `GET [id]` 信封 `data`） */
type MascusDetail = MascusListing & { assignedToName: string | null };

interface Props {
  items: MascusListItem[];
  assignees: MascusAssigneeLookup[];
  /** 由 server 页从 `MASCUS_FOLLOW_STATUSES` 传入，避免客户端 bundle 引入 prisma */
  followStatuses: string[];
}

interface RowDraft {
  followStatus: string;
  assignedTo: string;
  note: string;
}

interface RowError {
  id: string;
  error: string;
  code?: string;
}

type DetailResp = { success: boolean; data?: MascusDetail; error?: string; code?: string };
type PatchData = { followStatus: string; assignedTo: string | null; note: string | null };
type PatchResp = { success: boolean; data?: PatchData; error?: string; code?: string };

/** 统一把响应体解析为信封；非 JSON / 网络异常也归一成 `{success:false}` */
async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  try {
    return (await res.json()) as T;
  } catch {
    return { success: false, error: `HTTP ${res.status}`, code: "HTTP_ERROR" } as unknown as T;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 时间一律按 **UTC** 渲染。
 * 客户端组件会同时经历 SSR 与浏览器 hydrate，用本地时区会产生 hydration 文本不一致。
 */
function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "—";
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** 价格：null / 非有限数一律显示「—」，绝不把无价行藏起来 */
function formatEuro(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `€${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** 详情弹窗里需要按时间格式化 / 需要特殊排版（raw JSON）的字段 */
const DATE_KEYS = new Set(["listedAt", "lastSeenAt", "firstSeenAt", "assignedAt", "createdAt"]);

/**
 * 🔴 仅「详情弹窗」使用的字段中文名表。
 * 这里的 `sellerPhone` 是**唯一**允许出现明文电话的地方；
 * 列表表格的所有单元格都不引用该字段。
 */
const DETAIL_LABELS: Record<string, string> = {
  id: "线索 ID",
  productId: "mascus 商品 ID",
  brandName: "品牌",
  modelName: "型号",
  categoryName: "品类",
  catalogName: "目录名",
  year: "年份",
  priceEuro: "价格（€）",
  priceOriginal: "原始价格",
  priceCurrency: "原始币种",
  sellerPhone: "卖家电话（明文 · 已审计）",
  companyName: "公司名（原文）",
  companyCountry: "公司国别",
  locationCity: "城市",
  locationCountry: "挂牌国别",
  assetUrl: "挂牌链接",
  imageUrl: "图片链接",
  listedAt: "挂牌时间（UTC）",
  scanSegment: "扫描段",
  raw: "原始 JSON",
  firstSeenAt: "首次见到（UTC）",
  lastSeenAt: "最后见到（UTC）",
  followStatus: "跟进状态",
  assignedTo: "负责人 ID",
  assignedAt: "分配时间（UTC）",
  assignedToName: "负责人",
  note: "备注",
  createdAt: "创建时间（UTC）",
};

function formatDetailValue(key: string, value: unknown): string {
  if (DATE_KEYS.has(key)) return formatDate(value);
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    const text = JSON.stringify(value);
    return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
  }
  return String(value);
}

/**
 * 外链图片缩略图。
 *
 * mascus 的 `assetUrl` / `imageUrl` 是外域地址，不能用 `next/image`（需配 `images.domains`），
 * 因此用原生 `<img>` + `referrerPolicy="no-referrer"`（防盗链），并按
 * `[src, fallbackSrc]` 顺序在加载失败时降级，全部失败渲染占位块。
 * 本组件同时被 server 页的「按卖家聚合」视图复用。
 */
export function MascusThumb({
  src,
  fallbackSrc,
  alt,
}: {
  src: string | null;
  fallbackSrc?: string | null;
  alt: string;
}) {
  const [candidate, setCandidate] = useState<number>(0);
  const urls = [src, fallbackSrc]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
  const url = urls[candidate];

  if (!url) {
    return (
      <div className="flex h-10 w-14 items-center justify-center rounded border bg-gray-100 text-[10px] text-gray-400">
        无图
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setCandidate((c) => c + 1)}
      className="h-10 w-14 rounded border border-gray-200 object-cover"
    />
  );
}

/**
 * 「查看明文」按钮 + 详情弹窗（**列表视图与按卖家聚合视图共用**）。
 *
 * 🔴 唯一允许下发 / 渲染明文 `sellerPhone` 的入口：
 *   `GET /api/admin/mascus-listings/[id]` 由后端先写 PII 审计再返回。
 *   点击前的明确提示 = 按钮 `title` + 各调用页的常驻横幅。
 * 明文绝不会出现在 props（只传 id），只会存在于本组件的临时 state 里。
 */
export function MascusDetailButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState<boolean>(false);
  const [detail, setDetail] = useState<MascusDetail | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<{ error: string; code?: string } | null>(null);

  async function load(): Promise<void> {
    setOpen(true);
    setDetail(null);
    setError(null);
    setBusy(true);
    try {
      const data = await apiJson<DetailResp>(`/api/admin/mascus-listings/${encodeURIComponent(id)}`, {
        method: "GET",
      });
      if (data.success && data.data) {
        setDetail(data.data);
      } else {
        setError({ error: data.error ?? "未知错误", code: data.code });
      }
    } catch (e) {
      setError({
        error: e instanceof Error ? e.message : "网络错误",
        code: "NETWORK_ERROR",
      });
    } finally {
      setBusy(false);
    }
  }

  function close(): void {
    setOpen(false);
    setDetail(null);
    setError(null);
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        title="查看明文将记录审计日志"
        onClick={() => void load()}
        className="rounded bg-primary-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-primary-700"
      >
        {label}
      </button>

      {/* ── 详情弹窗：唯一展示明文电话的位置 ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">线索详情（含明文电话）</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  线索 ID：{id} · 本次查看已写入 PII 审计日志
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              >
                关闭
              </button>
            </div>

            {busy && <p className="py-8 text-center text-sm text-gray-500">加载中…</p>}

            {!busy && error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                查看详情失败：{error.error}{error.code ? ` (${error.code})` : ""}
              </p>
            )}

            {!busy && detail && (
              <div className="space-y-4">
                {/* 明文电话高亮 */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="text-xs font-medium text-amber-700">卖家电话（明文 · 已审计）</div>
                  <div className="mt-1 break-all font-mono text-xl font-semibold text-amber-900">
                    {detail.sellerPhone ?? "—"}
                  </div>
                </div>

                {/* 备注高亮 */}
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                  <div className="text-xs font-medium text-blue-700">运营备注</div>
                  <div className="mt-1 whitespace-pre-wrap break-all text-sm text-gray-800">
                    {detail.note ?? "—"}
                  </div>
                </div>

                {/* 全部字段（含 raw JSON） */}
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(detail as unknown as Record<string, unknown>).map(([key, value]) => (
                    <div
                      key={key}
                      className={`rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 ${key === "raw" ? "sm:col-span-2" : ""}`}
                    >
                      <dt className="text-[11px] text-gray-500">{DETAIL_LABELS[key] ?? key}</dt>
                      <dd
                        className={`mt-0.5 break-all text-sm text-gray-800 ${
                          key === "raw" ? "max-h-32 overflow-auto whitespace-pre-wrap text-[11px]" : ""
                        }`}
                      >
                        {formatDetailValue(key, value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function MascusLeadTable({ items, assignees, followStatuses }: Props) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<RowError | null>(null);

  function draftFromRow(row: MascusListItem): RowDraft {
    return {
      followStatus: row.followStatus,
      assignedTo: row.assignedTo ?? "",
      note: row.note ?? "",
    };
  }

  function draftOf(row: MascusListItem): RowDraft {
    return drafts[row.id] ?? draftFromRow(row);
  }

  function updateDraft(row: MascusListItem, patch: Partial<RowDraft>): void {
    setDrafts((prev) => {
      const base = prev[row.id] ?? draftFromRow(row);
      return { ...prev, [row.id]: { ...base, ...patch } };
    });
  }

  /** 失败时只回滚本次提交的字段，保留运营尚未保存的其它输入（如备注草稿） */
  function revertFields(row: MascusListItem, body: Record<string, unknown>): void {
    const base = draftFromRow(row);
    const patch: Partial<RowDraft> = {};
    if ("followStatus" in body) patch.followStatus = base.followStatus;
    if ("assignedTo" in body) patch.assignedTo = base.assignedTo;
    if ("note" in body) patch.note = base.note;
    if (Object.keys(patch).length > 0) updateDraft(row, patch);
  }

  /** 成功时只同步本次提交的字段，避免把未提交的备注草稿冲掉 */
  function syncFields(row: MascusListItem, body: Record<string, unknown>, data: PatchData): void {
    const patch: Partial<RowDraft> = {};
    if ("followStatus" in body) patch.followStatus = data.followStatus;
    if ("assignedTo" in body) patch.assignedTo = data.assignedTo ?? "";
    if ("note" in body) patch.note = data.note ?? "";
    if (Object.keys(patch).length > 0) updateDraft(row, patch);
  }

  async function patchRow(row: MascusListItem, body: Record<string, unknown>): Promise<void> {
    setBusyId(row.id);
    setRowError(null);
    try {
      const data = await apiJson<PatchResp>(`/api/admin/mascus-listings/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!data.success) {
        setRowError({ id: row.id, error: data.error ?? "未知错误", code: data.code });
        revertFields(row, body);
        return;
      }
      if (data.data) syncFields(row, body, data.data);
      router.refresh();
    } catch (e) {
      setRowError({
        id: row.id,
        error: e instanceof Error ? e.message : "网络错误",
        code: "NETWORK_ERROR",
      });
      revertFields(row, body);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      {/* 🔴 点击前的明确提示：查看明文会写 PII 审计日志 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
        <span className="text-xs font-semibold text-amber-800">⚠️ 查看明文将记录审计日志</span>
        <span className="text-[11px] text-amber-700">
          列表只显示掩码电话；点击「查看详情」/「查看明文」会向服务端请求明文卖家电话并写入 PII 审计日志，请按需查看。
        </span>
      </div>

      {/* PATCH 失败：显示后端信封的 error / code */}
      {rowError && (
        <div className="flex items-start justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          <span className="break-all">
            ⚠ 线索 {rowError.id} 保存失败：{rowError.error}
            {rowError.code ? ` (${rowError.code})` : ""}
          </span>
          <button
            type="button"
            onClick={() => setRowError(null)}
            className="shrink-0 rounded border border-red-200 px-2 py-0.5 text-[11px] hover:bg-red-100"
          >
            关闭
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
              <th className="px-3 py-3 font-medium">品牌·型号</th>
              <th className="px-3 py-3 font-medium">年份</th>
              <th className="px-3 py-3 font-medium">价格（€）</th>
              <th className="px-3 py-3 font-medium">公司</th>
              <th className="px-3 py-3 font-medium">地区</th>
              <th className="px-3 py-3 font-medium">电话</th>
              <th className="px-3 py-3 font-medium">跟进状态</th>
              <th className="px-3 py-3 font-medium">负责人 / 备注</th>
              <th className="px-3 py-3 font-medium">挂牌时间（UTC）</th>
              <th className="px-3 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const draft = draftOf(it);
              const busy = busyId === it.id;
              const region = [it.locationCountry, it.locationCity]
                .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
                .join(" / ");
              const assigneeKnown = assignees.some((a) => a.id === draft.assignedTo);
              return (
                <tr key={it.id} className="border-b align-top last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <MascusThumb src={it.assetUrl} fallbackSrc={it.imageUrl} alt={it.brandName ?? "mascus 挂牌"} />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800">{it.brandName ?? "—"}</div>
                        <div className="break-all text-xs text-gray-500">{it.modelName ?? "—"}</div>
                        {it.scanSegment && (
                          <div className="mt-0.5 text-[10px] text-gray-400">{it.scanSegment}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{it.year ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {/* 🔴 null 显示「—」，不过滤、不隐藏；原币种仅作辅助小字 */}
                    <div className="font-medium">{formatEuro(it.priceEuro)}</div>
                    {it.priceOriginal !== null && it.priceOriginal !== undefined && (
                      <div className="text-[11px] text-gray-400">
                        原币 {it.priceOriginal} {it.priceCurrency ?? ""}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    <div className="max-w-[14rem] break-words">{it.companyName ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{region || "—"}</td>
                  <td className="px-3 py-2.5">
                    {/* 🔴 列表路径：只渲染 sellerPhoneMasked */}
                    <div className="font-mono text-xs text-gray-800">{it.sellerPhoneMasked ?? "—"}</div>
                    <div className={`mt-0.5 text-[10px] ${it.hasPhone ? "text-green-600" : "text-gray-400"}`}>
                      {it.hasPhone ? "有电话" : "无电话"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={draft.followStatus}
                      disabled={busy}
                      onChange={(e) => {
                        const next = e.target.value;
                        updateDraft(it, { followStatus: next });
                        void patchRow(it, { followStatus: next });
                      }}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {followStatuses.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={draft.assignedTo}
                      disabled={busy}
                      onChange={(e) => {
                        const next = e.target.value;
                        updateDraft(it, { assignedTo: next });
                        void patchRow(it, { assignedTo: next });
                      }}
                      className="w-32 rounded border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      <option value="">未分配</option>
                      {assignees.map((a) => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                      {/* 负责人已停用 / 不在可分配名单时，仍要能显示当前值 */}
                      {!assigneeKnown && draft.assignedTo !== "" && (
                        <option value={draft.assignedTo}>{it.assignedToName ?? draft.assignedTo}</option>
                      )}
                    </select>
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        value={draft.note}
                        disabled={busy}
                        onChange={(e) => updateDraft(it, { note: e.target.value })}
                        placeholder="备注"
                        className="w-28 rounded border px-2 py-1 text-xs disabled:opacity-50"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void patchRow(it, { note: draft.note })}
                        className="rounded border px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        存备注
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    <div>{formatDate(it.listedAt)}</div>
                    <div className="text-[10px] text-gray-400">末见 {formatDate(it.lastSeenAt)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <MascusDetailButton id={it.id} label="查看详情（明文留痕）" />
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                  暂无符合条件的线索
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
