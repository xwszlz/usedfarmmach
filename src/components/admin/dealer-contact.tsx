"use client";

/**
 * 经销商联系方式组件（P0-5：PII 掩码 + reveal + 审计留痕）
 *
 * 复用 /admin/leads 的口径：
 *  - 默认对电话 / 微信 / WhatsApp / 邮箱做掩码（🔒）；
 *  - 点击「查看联系方式」→ GET /api/admin/leads/[id]（服务端写 PiiAuditLog）后明文展示。
 * 与 lead-table.tsx 共用同一审计端点，确保留痕合规一致。
 *
 * 注：掩码为展示层遮罩（与 leads 页一致，明文值随组件 props 下发），
 * 真正的合规留痕由服务端 /api/admin/leads/[id] 的 PiiAuditLog 承担。
 */
import { useState } from "react";

interface Props {
  id: string;
  phone: string | null;
  wechat: string | null;
  whatsapp: string | null;
  email: string | null;
}

interface RevealResp {
  success: boolean;
  error?: string;
  code?: string;
}

export function DealerContact({ id, phone, wechat, whatsapp, email }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasAny = Boolean(phone || wechat || whatsapp || email);
  if (!hasAny) return <span className="text-gray-400">—</span>;

  async function reveal() {
    if (revealed || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, { method: "GET" });
      const data = (await res.json()) as RevealResp;
      if (data.success) {
        setRevealed(true);
      } else {
        alert(`查看失败：${data.error || "未知错误"}${data.code ? ` (${data.code})` : ""}`);
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setBusy(false);
    }
  }

  if (!revealed) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={reveal}
        title="查看联系方式（将写入 PII 审计日志）"
        className="rounded border px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        {busy ? "处理中…" : "查看联系方式 🔒"}
      </button>
    );
  }

  const parts: string[] = [];
  if (phone) parts.push(`电话：${phone}`);
  if (wechat) parts.push(`微信：${wechat}`);
  if (whatsapp) parts.push(`WhatsApp：${whatsapp}`);
  if (email) parts.push(`邮箱：${email}`);
  return <span className="text-xs text-gray-600">{parts.join(" · ")}</span>;
}
