"use client";

/**
 * .cn 补贴机型实拍图复核后台（T05，客户端表格）
 * ===========================================================================
 * - 仅展示数据，抓取/投放归 scripts/fetch_subsidy_images.ts（境内 ECS，另行执行）。
 * - 列表/复核调用 /api/admin/system/subsidy-images*，凭证靠同源 cookie 自动携带
 *   （与 getTokenFromHeaders 读 cookie: token= 一致，不臆造 Bearer）。
 * - 🔴 本页唯一导出为 default（.cn 的 page.tsx 禁止额外 export）。
 * - 文案沿用内联双参 t("中文","English")，不改任何 messages/*.json。
 */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface ImageRow {
  id: string;
  modelKey: string;
  brandName: string;
  category: string;
  modelName: string;
  sourceUrl: string;
  sourceDomain: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  fetchedAt: string;
  sha256: string;
  ossUrl: string;
  sortOrder: number;
  isPrimary: boolean;
  reviewStatus: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

interface Checks {
  modelMatch: boolean;
  sourceReal: boolean;
  notAi: boolean;
  licensed: boolean;
}

type T = (zh: string, en: string) => string;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const EMPTY_CHECKS: Checks = {
  modelMatch: false,
  sourceReal: false,
  notAi: false,
  licensed: false,
};

const CHECK_LABELS: Array<{ key: keyof Checks; zh: string; en: string }> = [
  { key: "modelMatch", zh: "机型一致", en: "Model matches" },
  { key: "sourceReal", zh: "来源真实", en: "Source verified" },
  { key: "notAi", zh: "非 AI 生成", en: "Not AI-generated" },
  { key: "licensed", zh: "授权合规", en: "Licensed" },
];

function StatusBadge({ status, t }: { status: string; t: T }) {
  const label =
    status === "approved"
      ? t("已通过", "Approved")
      : status === "rejected"
        ? t("已驳回", "Rejected")
        : t("待复核", "Pending");
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  );
}

/** 11 项留痕（9 登记/抓取 + 复核人/时间/说明）+ 机型三元组的逐项展示。 */
function TraceFields({ row, t }: { row: ImageRow; t: T }) {
  const short = (v: string | null) => (v ? (v.length > 64 ? `${v.slice(0, 61)}…` : v) : "—");
  const fields: Array<[string, string]> = [
    [t("机型键 modelKey", "Model key"), short(row.modelKey)],
    [t("品牌 brandName", "Brand"), short(row.brandName)],
    [t("品类 category", "Category"), short(row.category)],
    [t("型号 modelName", "Model"), short(row.modelName)],
    [t("来源 sourceUrl", "Source URL"), short(row.sourceUrl)],
    [t("来源域 sourceDomain", "Source domain"), short(row.sourceDomain)],
    [t("终点 finalUrl", "Final URL"), short(row.finalUrl)],
    [t("状态 httpStatus", "HTTP status"), String(row.httpStatus)],
    [t("类型 contentType", "Content-Type"), short(row.contentType)],
    [t("抓取时间 fetchedAt", "Fetched at"), short(row.fetchedAt)],
    [t("摘要 sha256", "SHA-256"), short(row.sha256)],
    [t("OSS ossUrl", "OSS URL"), short(row.ossUrl)],
    [t("复核人 reviewedBy", "Reviewed by"), short(row.reviewedBy)],
    [t("复核时间 reviewedAt", "Reviewed at"), short(row.reviewedAt)],
    [t("复核说明 reviewNote", "Review note"), short(row.reviewNote)],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-600 md:grid-cols-2 lg:grid-cols-3">
      {fields.map(([k, v]) => (
        <div key={k} className="flex gap-2 border-b border-gray-100 py-1">
          <dt className="shrink-0 text-gray-400">{k}</dt>
          <dd className="break-all text-gray-700">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 单行：4 项必检勾选 + reviewNote 文本框 + 通过/驳回按钮。 */
function ReviewRow({ row, t, onDone }: { row: ImageRow; t: T; onDone: () => void }) {
  const [checks, setChecks] = useState<Checks>(EMPTY_CHECKS);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const editable = row.reviewStatus === "pending";

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/system/subsidy-images/${row.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, checks, reviewNote: note }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(t("已提交", "Submitted"));
        onDone();
      } else {
        setMsg(`${t("失败", "Failed")}: ${data.error || data.code || res.status}`);
      }
    } catch {
      setMsg(t("网络错误，请重试", "Network error, retry"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="px-3 py-3">
        <div className="font-medium text-gray-900">{row.brandName} {row.modelName}</div>
        <div className="text-xs text-gray-400">{row.category}</div>
        <div className="mt-1"><StatusBadge status={row.reviewStatus} t={t} /></div>
      </td>
      <td className="px-3 py-3 text-xs text-gray-500">{row.sourceDomain || "—"}</td>
      <td className="px-3 py-3">
        <TraceFields row={row} t={t} />
      </td>
      <td className="px-3 py-3">
        {editable ? (
          <div className="w-56 space-y-2">
            {CHECK_LABELS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={checks[c.key]}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                />
                {t(c.zh, c.en)}
              </label>
            ))}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("复核说明（驳回必填）", "Review note (required to reject)")}
              className="w-full rounded border border-gray-300 p-1 text-xs"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => void act("approve")}
                className="rounded bg-green-600 px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                {t("通过", "Approve")}
              </button>
              <button
                disabled={busy}
                onClick={() => void act("reject")}
                className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                {t("驳回", "Reject")}
              </button>
            </div>
            {msg && <div className="text-xs text-gray-500">{msg}</div>}
          </div>
        ) : (
          <div className="text-xs text-gray-400">{t("仅待复核记录可操作", "Pending only")}</div>
        )}
      </td>
    </tr>
  );
}

export default function SubsidyImagesAdminPage() {
  const { locale } = useParams<{ locale: string }>();
  const t: T = (zh, en) => (locale === "zh" ? zh : en);

  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [items, setItems] = useState<ImageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const tt: T = (zh, en) => (locale === "zh" ? zh : en);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (status !== "all") qs.set("status", status);
      const res = await fetch(`/api/admin/system/subsidy-images?${qs.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items as ImageRow[]);
        setTotal(data.data.total as number);
      } else {
        setError(`${tt("加载失败", "Load failed")}: ${data.error || res.status}`);
      }
    } catch {
      setError(tt("网络错误，请重试", "Network error, retry"));
    } finally {
      setLoading(false);
    }
  }, [page, status, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t("补贴机型实拍图复核", "Subsidy model image review")}</h1>
        <p className="text-xs text-gray-500">
          {t("仅展示已登记素材；复核前请逐项核对 4 项必检，登记/抓取阶段一律 pending，自动上架率 0。", "Registered assets only; all start as pending. Verify 4 checks before approving.")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          {t("状态", "Status")}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded border border-gray-300 px-2 py-1"
          >
            <option value="pending">{t("待复核", "Pending")}</option>
            <option value="approved">{t("已通过", "Approved")}</option>
            <option value="rejected">{t("已驳回", "Rejected")}</option>
            <option value="all">{t("全部", "All")}</option>
          </select>
        </label>
        <span className="text-gray-500">{t("共", "Total")} {total} {t("条", "rows")}</span>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
        >
          {loading ? t("加载中…", "Loading…") : t("刷新", "Refresh")}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
          >
            {t("上一页", "Prev")}
          </button>
          <span className="text-xs text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
          >
            {t("下一页", "Next")}
          </button>
        </div>
      </div>

      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">{t("机型 / 状态", "Model / Status")}</th>
              <th className="px-3 py-2 text-left">{t("来源域", "Source domain")}</th>
              <th className="px-3 py-2 text-left">{t("11 项留痕", "Trace fields")}</th>
              <th className="px-3 py-2 text-left">{t("复核操作", "Review")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-400">
                  {t("暂无记录", "No records")}
                </td>
              </tr>
            )}
            {items.map((row) => (
              <ReviewRow key={row.id} row={row} t={t} onDone={() => void load()} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
