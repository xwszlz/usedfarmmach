"use client";

import { useState } from "react";
import { CreditManager } from "./credit-manager";

/** 后台用户列表行（已脱敏） */
export interface AdminUserRow {
  id: string;
  emailMasked: string;
  emailPending: boolean;
  emailVerified: boolean;
  role: string;
  companyName: string | null;
  country: string | null;
  credits: number;
  completeness: {
    hasEmail: boolean;
    hasCompany: boolean;
    hasCountry: boolean;
    hasPhone: boolean;
    score: number;
    pending: boolean;
  };
  createdAt: string;
  productCount: number;
  inquiryCount: number;
}

interface Props {
  users: AdminUserRow[];
  canReveal: boolean;
  canRemind?: boolean;
}

/** 是否待补全：emailPending 或任一关键资料缺失 */
function isIncomplete(u: AdminUserRow): boolean {
  const c = u.completeness;
  return c.pending || !c.hasEmail || !c.hasCompany || !c.hasCountry || !c.hasPhone;
}

export function UsersTable({ users, canReveal, canRemind }: Props) {
  const [onlyPending, setOnlyPending] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealError, setRevealError] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [remindMsg, setRemindMsg] = useState<string | null>(null);

  const visible = onlyPending ? users.filter(isIncomplete) : users;

  const revealEmail = async (id: string) => {
    setRevealError(null);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/admin/users/${id}/reveal-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purpose: "后台查看用户邮箱" }),
      });
      const data = await res.json();
      if (data.success) {
        setRevealed((prev) => ({ ...prev, [id]: data.data.email }));
      } else {
        setRevealError(data.error || "无权限查看");
      }
    } catch {
      setRevealError("请求失败");
    }
  };

  const resetPassword = async (id: string) => {
    setResetMsg(null);
    const input = window.prompt("输入新密码（留空则由系统生成随机密码）：");
    if (input === null) return; // 取消
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/admin/reset-user-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: id, newPassword: input || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setResetMsg("已重置密码并通知用户（站内信）");
      } else {
        setResetMsg(data.error || "重置失败");
      }
    } catch {
      setResetMsg("请求失败");
    }
    setTimeout(() => setResetMsg(null), 3000);
  };

  const sendRemind = async (id: string) => {
    setRemindMsg(null);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/admin/send-complete-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setRemindMsg("已发送补全提醒（站内信 + 邮件）");
      } else {
        setRemindMsg(data.error || "发送失败");
      }
    } catch {
      setRemindMsg("请求失败");
    }
    setTimeout(() => setRemindMsg(null), 3000);
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
            className="h-4 w-4"
          />
          仅待补全（邮箱待填 / 资料缺失）
        </label>
        <span className="text-xs text-gray-400">共 {visible.length} 名用户</span>
      </div>

      {revealError && <div className="mb-2 text-xs text-red-600">{revealError}</div>}
      {resetMsg && <div className="mb-2 text-xs text-green-600">{resetMsg}</div>}
      {remindMsg && <div className="mb-2 text-xs text-green-600">{remindMsg}</div>}

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-6 py-3 font-medium">邮箱</th>
                <th className="px-6 py-3 font-medium">公司</th>
                <th className="px-6 py-3 font-medium">国家</th>
                <th className="px-6 py-3 font-medium">角色</th>
                <th className="px-6 py-3 font-medium">产品</th>
                <th className="px-6 py-3 font-medium">询盘</th>
                <th className="px-6 py-3 font-medium">积分</th>
                <th className="px-6 py-3 font-medium">资料完整度</th>
                <th className="px-6 py-3 font-medium">注册时间</th>
                <th className="px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const c = u.completeness;
                return (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{revealed[u.id] ?? (u.emailMasked || "-")}</span>
                        {canReveal && !revealed[u.id] && (
                          <button
                            onClick={() => revealEmail(u.id)}
                            className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
                          >
                            显示
                          </button>
                        )}
                      </div>
                      {u.emailPending && (
                        <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                          待补全
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{u.companyName || "-"}</td>
                    <td className="px-6 py-3 text-gray-500">{u.country || "-"}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : u.role === "editor"
                              ? "bg-teal-100 text-teal-700"
                              : u.role === "seller"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-900">{u.productCount}</td>
                    <td className="px-6 py-3 text-gray-900">{u.inquiryCount}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{u.credits}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded bg-gray-200">
                          <div
                            className={`h-full ${c.pending ? "bg-amber-400" : "bg-green-500"}`}
                            style={{ width: `${c.score}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{c.score}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-2">
                        <CreditManager
                          userId={u.id}
                          currentCredits={u.credits}
                          currentRole={u.role}
                        />
                        <button
                          onClick={() => resetPassword(u.id)}
                          className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600 hover:bg-red-100"
                        >
                          重置密码
                        </button>
                        {canRemind && (
                          <button
                            onClick={() => sendRemind(u.id)}
                            className="rounded bg-teal-50 px-2 py-0.5 text-xs text-teal-700 hover:bg-teal-100"
                          >
                            发送补全提醒
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
