"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

type Row = Record<string, string | null>;

export function AuditLogTable() {
  const t = useTranslations("adminSystem");
  const [type, setType] = useState<"pii_audit" | "email_send">("pii_audit");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/system/audit?type=${type}&page=${page}&pageSize=20`,
        { method: "GET" },
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setList(((data.data?.list as Row[]) || []) as Row[]);
      setTotal(data.data?.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [type, page]);

  useEffect(() => {
    load();
  }, [load]);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : "-";

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => {
            setType("pii_audit");
            setPage(1);
          }}
          className={
            type === "pii_audit"
              ? "px-3 py-1.5 rounded-full text-xs font-medium bg-blue-600 text-white"
              : "px-3 py-1.5 rounded-full text-xs bg-white text-gray-600 border hover:border-blue-400"
          }
        >
          {t("piiAudit")}
        </button>
        <button
          onClick={() => {
            setType("email_send");
            setPage(1);
          }}
          className={
            type === "email_send"
              ? "px-3 py-1.5 rounded-full text-xs font-medium bg-blue-600 text-white"
              : "px-3 py-1.5 rounded-full text-xs bg-white text-gray-600 border hover:border-blue-400"
          }
        >
          {t("emailSend")}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b">
              {type === "pii_audit" ? (
                <>
                  <th className="text-left py-2 px-3">{t("actor")}</th>
                  <th className="text-left py-2 px-3">{t("target")}</th>
                  <th className="text-left py-2 px-3">{t("field")}</th>
                  <th className="text-left py-2 px-3">{t("action")}</th>
                  <th className="text-left py-2 px-3">{t("purpose")}</th>
                  <th className="text-left py-2 px-3">{t("createdAt")}</th>
                </>
              ) : (
                <>
                  <th className="text-left py-2 px-3">{t("actor")}</th>
                  <th className="text-left py-2 px-3">{t("provider")}</th>
                  <th className="text-left py-2 px-3">{t("recipient")}</th>
                  <th className="text-left py-2 px-3">{t("status")}</th>
                  <th className="text-left py-2 px-3">{t("createdAt")}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">
                  {t("loading")}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">
                  -
                </td>
              </tr>
            ) : (
              list.map((row) => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  {type === "pii_audit" ? (
                    <>
                      <td className="py-2 px-3 font-mono text-xs">{row.actorId}</td>
                      <td className="py-2 px-3 font-mono text-xs">{row.targetUserId}</td>
                      <td className="py-2 px-3">{row.field}</td>
                      <td className="py-2 px-3">{row.action}</td>
                      <td className="py-2 px-3">{row.purpose || "-"}</td>
                      <td className="py-2 px-3">{fmt(row.createdAt)}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 font-mono text-xs">{row.userId}</td>
                      <td className="py-2 px-3">{row.provider}</td>
                      <td className="py-2 px-3 font-mono text-xs break-all">{row.recipientHash}</td>
                      <td className="py-2 px-3">{row.status}</td>
                      <td className="py-2 px-3">{fmt(row.createdAt)}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {t("total")} {total}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            {t("prev")}
          </button>
          <button
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            {t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
