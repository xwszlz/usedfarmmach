"use client";
import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
interface Registration {
    id: string;
    name: string;
    company: string | null;
    phone: string;
    email: string | null;
    country: string | null;
    category: string | null;
    boothType: string | null;
    status: string;
    createdAt: Date | string;
}
interface AdminRegActionsProps {
    registrations: Registration[];
}
export function AdminRegActions({ registrations: initialRegs }: AdminRegActionsProps) {
    const tr = useTr();
    const [regs, setRegs] = useState<Registration[]>(initialRegs);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    async function handleApprove(id: string) {
        if (!confirm("\u786E\u8BA4\u901A\u8FC7\u6B64\u8BA4\u9886\u7533\u8BF7\uFF1F\u7CFB\u7EDF\u5C06\u81EA\u52A8\u521B\u5EFA\u767B\u5F55\u8D26\u53F7\u5E76\u53D1\u9001\u51ED\u8BC1\u3002"))
            return;
        setLoadingId(id);
        try {
            const res = await fetch(`/api/expo/brand-claim/${id}/approve`, { method: "POST" });
            const json = await res.json();
            if (json.success) {
                const d = json.data ?? {};
                const summary: string = d.notifySummary ?? "";
                // 根据后端汇总状态区分展示（emoji 区分状态，保持简单 UI）
                let head = "";
                if (summary === "email+sms\u5747\u6210\u529F") {
                    head = "\u2705 \u901A\u8FC7\u6210\u529F\uFF01\u51ED\u8BC1\u5DF2\u901A\u8FC7\u90AE\u4EF6+\u77ED\u4FE1\u53D1\u9001\u7ED9\u54C1\u724C\u65B9\u3002";
                }
                else if (summary === "\u4EC5\u77ED\u4FE1\u6210\u529F") {
                    head = "\u26A0\uFE0F \u901A\u8FC7\u6210\u529F\uFF01\u51ED\u8BC1\u5DF2\u901A\u8FC7\u77ED\u4FE1\u53D1\u9001\u3002\u90AE\u4EF6\u6E20\u9053\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u8865\u53D1\u90AE\u4EF6\u901A\u77E5\u54C1\u724C\u65B9\u3002";
                }
                else if (summary === "\u4EC5\u90AE\u4EF6\u6210\u529F") {
                    head = "\u26A0\uFE0F \u901A\u8FC7\u6210\u529F\uFF01\u51ED\u8BC1\u5DF2\u901A\u8FC7\u90AE\u4EF6\u53D1\u9001\u3002\u77ED\u4FE1\u6E20\u9053\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u8865\u53D1\u77ED\u4FE1\u901A\u77E5\u54C1\u724C\u65B9\u3002";
                }
                else {
                    // 均失败 / 未知（缺 notifySummary 时按失败处理，提示手动通知）
                    head = "\u274C \u901A\u8FC7\u6210\u529F\uFF01\u4F46\u90AE\u4EF6\u548C\u77ED\u4FE1\u5747\u672A\u53D1\u9001\u6210\u529F\uFF0C\u8BF7\u624B\u52A8\u5C06\u4EE5\u4E0B\u51ED\u8BC1\u901A\u77E5\u54C1\u724C\u65B9\uFF1A";
                }
                const creds = `账号：${d.username}\n` +
                    `密码：${d.rawPassword}\n` +
                    `展台链接：${d.url}`;
                // 凭据仍可查看（折叠在提示中），便于管理员手动补发
                alert(`${head}\n\n${creds}`);
                setRegs(regs.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
            }
            else {
                alert(`❌ 通过失败：${json.error}`);
            }
        }
        catch (e) {
            alert(`❌ 网络错误：${e}`);
        }
        setLoadingId(null);
    }
    async function handleReject(id: string) {
        if (!confirm("\u786E\u8BA4\u62D2\u7EDD\u6B64\u8BA4\u9886\u7533\u8BF7\uFF1F"))
            return;
        setLoadingId(id);
        try {
            const res = await fetch(`/api/expo/brand-claim/${id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            const json = await res.json();
            if (json.success) {
                alert("已拒绝");
                setRegs(regs.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
            }
            else {
                alert(`❌ 拒绝失败：${json.error || "\u63A5\u53E3\u4E0D\u5B58\u5728"}`);
            }
        }
        catch (e) {
            alert(`❌ 网络错误：${e}`);
        }
        setLoadingId(null);
    }
    const statusColors: Record<string, string> = {
        pending: "bg-yellow-100 text-yellow-700",
        approved: "bg-green-100 text-green-700",
        rejected: "bg-red-100 text-red-700",
        contacted: "bg-blue-100 text-blue-700",
        confirmed: "bg-emerald-100 text-emerald-700",
    };
    return (<table className="w-full text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tr("时间")}</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tr("联系人")}</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tr("公司")}</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tr("电话")}</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tr("国家")}</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tr("品类")}</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tr("展位")}</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tr("状态")}</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tr("操作")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {regs.map((r) => (<tr key={r.id} className="hover:bg-gray-50">
            <td className="px-4 py-2 text-xs text-gray-500">
              {new Date(r.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </td>
            <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
            <td className="px-4 py-2 text-gray-600">{r.company || "-"}</td>
            <td className="px-4 py-2 text-gray-600">{r.phone}</td>
            <td className="px-4 py-2 text-gray-600">{r.country || "-"}</td>
            <td className="px-4 py-2 text-gray-600">{r.category || "-"}</td>
            <td className="px-4 py-2 text-gray-600">{r.boothType || "-"}</td>
            <td className="px-4 py-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[r.status] || "bg-gray-100 text-gray-600"}`}>
                {r.status}
              </span>
            </td>
            <td className="px-4 py-2">
              {r.status === "pending" ? (<div className="flex gap-2">
                  <button onClick={() => handleApprove(r.id)} disabled={loadingId === r.id} className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                    {loadingId === r.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3"/>}{tr("通过")}</button>
                  <button onClick={() => handleReject(r.id)} disabled={loadingId === r.id} className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                    <XCircle className="h-3 w-3"/>{tr("拒绝")}</button>
                </div>) : (<span className="text-xs text-gray-400">{tr("已处理")}</span>)}
            </td>
          </tr>))}
      </tbody>
    </table>);
}
