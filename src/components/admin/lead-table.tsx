"use client";

/**
 * 线索池表格（Seller Leads，客户端组件）
 *
 * - 列：来源 / 品牌·型号 / 地区 / 卖家名 / 电话 / 微信 / WhatsApp / 邮箱 / 操作
 * - 微信 / WhatsApp / 邮箱 支持行内「编辑」→ PATCH /api/admin/leads/[id]
 * - 「查看联系方式」→ GET /api/admin/leads/[id]（写 PII 审计）后明文展示
 *   默认对联系方式做掩码（🔒），查看后展示真实值，确保留痕合规。
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RawListingRow } from "@/lib/raw-listing/review";

/** 与 RawListingRow 对齐的线索行类型 */
export type LeadRow = RawListingRow;

interface ContactDraft {
  sellerWechat: string;
  sellerWhatsapp: string;
  sellerEmail: string;
}

interface Props {
  items: LeadRow[];
  locale: string;
}

type ApiResp = { success: boolean; data?: RawListingRow; error?: string; code?: string };

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  try {
    return (await res.json()) as T;
  } catch {
    return { success: false, error: `HTTP ${res.status}` } as T;
  }
}

export function LeadTable({ items, locale: _locale }: Props) {
  const router = useRouter();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContactDraft>({ sellerWechat: "", sellerWhatsapp: "", sellerEmail: "" });

  async function reveal(id: string) {
    setBusyId(id);
    try {
      const data = await apiJson<ApiResp>(`/api/admin/leads/${id}`, { method: "GET" });
      if (data.success) {
        setRevealed((prev) => new Set(prev).add(id));
        router.refresh();
      } else {
        alert(`查看失败：${data.error || "未知错误"}${data.code ? ` (${data.code})` : ""}`);
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(row: LeadRow) {
    setEditingId(row.id);
    setDraft({
      sellerWechat: row.sellerWechat ?? "",
      sellerWhatsapp: row.sellerWhatsapp ?? "",
      sellerEmail: row.sellerEmail ?? "",
    });
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      const data = await apiJson<ApiResp>(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (data.success) {
        setEditingId(null);
        router.refresh();
      } else {
        alert(`保存失败：${data.error || "未知错误"}${data.code ? ` (${data.code})` : ""}`);
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setBusyId(null);
    }
  }

  const renderMasked = (v: string | null) => (v ? "🔒" : "—");
  const renderValue = (v: string | null) => (v ? v : "—");

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
              <th className="px-3 py-3 font-medium">来源</th>
              <th className="px-3 py-3 font-medium">品牌/型号</th>
              <th className="px-3 py-3 font-medium">地区</th>
              <th className="px-3 py-3 font-medium">卖家名</th>
              <th className="px-3 py-3 font-medium">电话</th>
              <th className="px-3 py-3 font-medium">微信</th>
              <th className="px-3 py-3 font-medium">WhatsApp</th>
              <th className="px-3 py-3 font-medium">邮箱</th>
              <th className="px-3 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const isRevealed = revealed.has(it.id);
              const isEditing = editingId === it.id;
              const busy = busyId === it.id;
              return (
                <tr key={it.id} className="border-b align-top last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500">{it.source}</td>
                  <td className="px-3 py-2.5 text-gray-700">
                    <div>{it.brandName}</div>
                    <div className="text-xs text-gray-400">{it.modelName}</div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{it.location}</td>
                  <td className="px-3 py-2.5 text-gray-700">{it.sellerName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-700">{isRevealed ? renderValue(it.sellerPhone) : renderMasked(it.sellerPhone)}</td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {isEditing ? (
                      <input
                        value={draft.sellerWechat}
                        onChange={(e) => setDraft((p) => ({ ...p, sellerWechat: e.target.value }))}
                        className="w-28 rounded border px-1 py-0.5 text-xs"
                        placeholder="微信"
                      />
                    ) : (
                      isRevealed ? renderValue(it.sellerWechat) : renderMasked(it.sellerWechat)
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {isEditing ? (
                      <input
                        value={draft.sellerWhatsapp}
                        onChange={(e) => setDraft((p) => ({ ...p, sellerWhatsapp: e.target.value }))}
                        className="w-28 rounded border px-1 py-0.5 text-xs"
                        placeholder="WhatsApp"
                      />
                    ) : (
                      isRevealed ? renderValue(it.sellerWhatsapp) : renderMasked(it.sellerWhatsapp)
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {isEditing ? (
                      <input
                        value={draft.sellerEmail}
                        onChange={(e) => setDraft((p) => ({ ...p, sellerEmail: e.target.value }))}
                        className="w-44 rounded border px-1 py-0.5 text-xs"
                        placeholder="邮箱"
                      />
                    ) : (
                      isRevealed ? renderValue(it.sellerEmail) : renderMasked(it.sellerEmail)
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1.5">
                      {!isRevealed && (
                        <button
                          disabled={busy}
                          onClick={() => reveal(it.id)}
                          className="rounded bg-primary-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                          查看联系方式
                        </button>
                      )}
                      {!isEditing ? (
                        <button
                          disabled={busy}
                          onClick={() => startEdit(it)}
                          className="rounded border px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          编辑
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            disabled={busy}
                            onClick={() => saveEdit(it.id)}
                            className="rounded bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            保存
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => setEditingId(null)}
                            className="rounded border px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                  暂无线索
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
