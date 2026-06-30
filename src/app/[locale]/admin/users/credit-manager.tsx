"use client";

import { useState } from "react";

interface Props {
  userId: string;
  currentCredits: number;
  currentRole: string;
}

export function CreditManager({ userId, currentCredits, currentRole }: Props) {
  const [credits, setCredits] = useState(currentCredits);
  const [role, setRole] = useState(currentRole);
  const [amount, setAmount] = useState(0);
  const [msg, setMsg] = useState("");

  const addCredits = async () => {
    if (amount <= 0) return;
    const token = localStorage.getItem("token");
    const res = await fetch("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, amount }),
    });
    const data = await res.json();
    if (data.success) {
      setCredits(data.credits);
      setAmount(0);
      setMsg(`充值成功！当前 ${data.credits} 积分`);
    } else {
      setMsg(data.error || "操作失败");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const updateRole = async (newRole: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/admin/role", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, role: newRole }),
    });
    const data = await res.json();
    if (data.success) {
      setRole(newRole);
      setMsg(`角色已更新为 ${newRole}`);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))}
        min={0} placeholder="数量" className="w-16 rounded border px-1 py-0.5 text-xs"
      />
      <button onClick={addCredits} className="rounded bg-primary-600 px-2 py-0.5 text-xs text-white hover:bg-primary-700">
        充值
      </button>
      <select value={role} onChange={(e) => updateRole(e.target.value)}
        className="rounded border px-1 py-0.5 text-xs">
        <option value="buyer">buyer</option>
        <option value="seller">seller</option>
        <option value="editor">editor</option>
        <option value="admin">admin</option>
      </select>
      {msg && <span className="text-xs text-green-600">{msg}</span>}
    </div>
  );
}
