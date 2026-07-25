"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ROLE_SET } from "@/lib/permissions";

export interface RoleRow {
  id: string;
  emailMasked: string;
  role: string;
  membershipTier: string;
  companyName: string | null;
  country: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  buyer: "买家",
  seller: "卖家",
  editor: "编辑",
  admin: "管理员",
  super_admin: "超级管理员",
  partner_limited: "合作方（受限）",
};

export function RoleManager({ users }: { users: RoleRow[] }) {
  const t = useTranslations("adminSystem");
  const [rows, setRows] = useState<RoleRow[]>(users);
  const [pending, setPending] = useState<Record<string, { role: string; reason: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (id: string) => {
    const p = pending[id];
    if (!p) return;
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id, role: p.role, reason: p.reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "操作失败");
      } else {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, role: p.role } : r)));
        setMsg(t("rolesUpdated"));
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {msg}
        </div>
      )}
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b">
              <th className="text-left py-2 px-3">邮箱</th>
              <th className="text-left py-2 px-3">公司</th>
              <th className="text-left py-2 px-3">国家</th>
              <th className="text-left py-2 px-3">当前角色</th>
              <th className="text-left py-2 px-3">目标角色</th>
              <th className="text-left py-2 px-3">理由</th>
              <th className="text-left py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const local = pending[r.id] || { role: r.role, reason: "" };
              return (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{r.emailMasked}</td>
                  <td className="py-2 px-3">{r.companyName || "-"}</td>
                  <td className="py-2 px-3">{r.country || "-"}</td>
                  <td className="py-2 px-3">{ROLE_LABELS[r.role] || r.role}</td>
                  <td className="py-2 px-3">
                    <select
                      value={local.role}
                      onChange={(e) =>
                        setPending((p) => ({ ...p, [r.id]: { ...local, role: e.target.value } }))
                      }
                      className="border border-gray-300 rounded px-2 py-1 bg-white"
                    >
                      {ROLE_SET.map((rl) => (
                        <option key={rl} value={rl}>
                          {ROLE_LABELS[rl] || rl}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      value={local.reason}
                      onChange={(e) =>
                        setPending((p) => ({ ...p, [r.id]: { ...local, reason: e.target.value } }))
                      }
                      placeholder={t("reason")}
                      className="border border-gray-300 rounded px-2 py-1 w-48"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <button
                      disabled={busy === r.id || local.role === r.role}
                      onClick={() => submit(r.id)}
                      className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
                    >
                      {t("apply")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
