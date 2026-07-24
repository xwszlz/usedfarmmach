"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";

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
  const [regs, setRegs] = useState<Registration[]>(initialRegs);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleApprove(id: string) {
    if (!confirm("确认通过此认领申请？系统将自动创建登录账号并发送凭证。")) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/expo/brand-claim/${id}/approve`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        alert(`✅ 通过成功！\n\n账号：${json.data.username}\n密码：${json.data.rawPassword}\n展台链接：${json.data.url}\n\n请将账号密码通过邮件/短信发给品牌方。`);
        setRegs(regs.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
      } else {
        alert(`❌ 通过失败：${json.error}`);
      }
    } catch (e) {
      alert(`❌ 网络错误：${e}`);
    }
    setLoadingId(null);
  }

  async function handleReject(id: string) {
    if (!confirm("确认拒绝此认领申请？")) return;
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
      } else {
        alert(`❌ 拒绝失败：${json.error || "接口不存在"}`);
      }
    } catch (e) {
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

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">时间</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">联系人</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">公司</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">电话</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">国家</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">品类</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">展位</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">状态</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">操作</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {regs.map((r) => (
          <tr key={r.id} className="hover:bg-gray-50">
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
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(r.id)}
                    disabled={loadingId === r.id}
                    className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {loadingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    通过
                  </button>
                  <button
                    onClick={() => handleReject(r.id)}
                    disabled={loadingId === r.id}
                    className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="h-3 w-3" />
                    拒绝
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-400">已处理</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}