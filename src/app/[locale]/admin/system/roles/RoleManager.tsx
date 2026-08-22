"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ROLE_SET } from "@/lib/permissions";
import { useTr } from "@/lib/i18n-tr";
export interface RoleRow {
    id: string;
    emailMasked: string;
    role: string;
    membershipTier: string;
    companyName: string | null;
    country: string | null;
}
const ROLE_LABELS: Record<string, string> = {
    buyer: "\u4E70\u5BB6",
    seller: "\u5356\u5BB6",
    editor: "\u7F16\u8F91",
    admin: "\u7BA1\u7406\u5458",
    super_admin: "\u8D85\u7EA7\u7BA1\u7406\u5458",
    partner_limited: "\u5408\u4F5C\u65B9\uFF08\u53D7\u9650\uFF09",
};
export function RoleManager({ users }: {
    users: RoleRow[];
}) {
  const tr = useTr();
    const t = useTranslations("adminSystem");
    const [rows, setRows] = useState<RoleRow[]>(users);
    const [pending, setPending] = useState<Record<string, {
        role: string;
        reason: string;
    }>>({});
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);
    const submit = async (id: string) => {
        const p = pending[id];
        if (!p)
            return;
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
                setMsg(data.error || "\u64CD\u4F5C\u5931\u8D25");
            }
            else {
                setRows((prev) => prev.map((r) => (r.id === id ? { ...r, role: p.role } : r)));
                setMsg(t("rolesUpdated"));
            }
        }
        catch (e) {
            setMsg(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(null);
        }
    };
    return (<div className="space-y-4">
      {msg && (<div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {msg}
        </div>)}
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b">
              <th className="text-left py-2 px-3">{tr("邮箱")}</th>
              <th className="text-left py-2 px-3">{tr("公司")}</th>
              <th className="text-left py-2 px-3">{tr("国家")}</th>
              <th className="text-left py-2 px-3">{tr("当前角色")}</th>
              <th className="text-left py-2 px-3">{tr("目标角色")}</th>
              <th className="text-left py-2 px-3">{tr("理由")}</th>
              <th className="text-left py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
            const local = pending[r.id] || { role: r.role, reason: "" };
            return (<tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{r.emailMasked}</td>
                  <td className="py-2 px-3">{r.companyName || "-"}</td>
                  <td className="py-2 px-3">{r.country || "-"}</td>
                  <td className="py-2 px-3">{ROLE_LABELS[r.role] || r.role}</td>
                  <td className="py-2 px-3">
                    <select value={local.role} onChange={(e) => setPending((p) => ({ ...p, [r.id]: { ...local, role: e.target.value } }))} className="border border-gray-300 rounded px-2 py-1 bg-white">
                      {ROLE_SET.map((rl) => (<option key={rl} value={rl}>
                          {ROLE_LABELS[rl] || rl}
                        </option>))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input value={local.reason} onChange={(e) => setPending((p) => ({ ...p, [r.id]: { ...local, reason: e.target.value } }))} placeholder={t("reason")} className="border border-gray-300 rounded px-2 py-1 w-48"/>
                  </td>
                  <td className="py-2 px-3">
                    <button disabled={busy === r.id || local.role === r.role} onClick={() => submit(r.id)} className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700">
                      {t("apply")}
                    </button>
                  </td>
                </tr>);
        })}
          </tbody>
        </table>
      </div>
    </div>);
}
