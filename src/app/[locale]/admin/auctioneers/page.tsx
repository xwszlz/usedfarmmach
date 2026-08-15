"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

interface Auctioneer {
  id: string;
  userId: string | null;
  licenseNo: string;
  realName: string;
  phone: string | null;
  isAffiliated: boolean;
  hostedCount: number;
  remark: string | null;
  createdAt: string;
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const labelCls = "block text-xs font-medium text-gray-500 mb-1";

export default function AuctioneersAdminPage() {
  const locale = useLocale();
  const [list, setList] = useState<Auctioneer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    licenseNo: "",
    realName: "",
    phone: "",
    isAffiliated: true,
    remark: "",
    userId: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auctioneers");
      const json = await res.json();
      if (json.success) setList(json.data || []);
      else setError(json.error || "加载失败");
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.licenseNo.trim() || !form.realName.trim()) {
      setError("执业证书编号与姓名为必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/auctioneers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(`已录入拍卖师：${json.data.realName}（${json.data.licenseNo}）`);
        setForm({ licenseNo: "", realName: "", phone: "", isAffiliated: true, remark: "", userId: "" });
        load();
      } else {
        setError(json.error || "录入失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">拍卖师挂靠</h1>
        <p className="mt-1 text-sm text-gray-500">
          录入持《拍卖师执业资格证书》的挂靠拍卖师，用于路径C真实拍卖主持。仅 .cn 站点依法开展网络拍卖。
        </p>
      </div>

      {/* 录入表单 */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">新增挂靠拍卖师</h2>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>执业证书编号 *</label>
            <input
              className={inputCls}
              value={form.licenseNo}
              onChange={(e) => update("licenseNo", e.target.value)}
              placeholder="如 14012019XXXX"
            />
          </div>
          <div>
            <label className={labelCls}>姓名 *</label>
            <input
              className={inputCls}
              value={form.realName}
              onChange={(e) => update("realName", e.target.value)}
              placeholder="拍卖师真实姓名"
            />
          </div>
          <div>
            <label className={labelCls}>联系电话</label>
            <input
              className={inputCls}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="可选"
            />
          </div>
          <div>
            <label className={labelCls}>关联平台用户ID</label>
            <input
              className={inputCls}
              value={form.userId}
              onChange={(e) => update("userId", e.target.value)}
              placeholder="可选（外部挂靠拍卖师可留空）"
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="isAffiliated"
              type="checkbox"
              checked={form.isAffiliated}
              onChange={(e) => update("isAffiliated", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="isAffiliated" className="text-sm text-gray-700">
              是否挂靠（默认挂靠；自有执业拍卖师可取消）
            </label>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>备注</label>
            <input
              className={inputCls}
              value={form.remark}
              onChange={(e) => update("remark", e.target.value)}
              placeholder="可选，如挂靠协议编号、归属部门"
            />
          </div>

          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
          {success && <p className="md:col-span-2 text-sm text-green-600">{success}</p>}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#1E40AF] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? "提交中…" : "录入拍卖师"}
            </button>
          </div>
        </form>
      </div>

      {/* 列表 */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">挂靠拍卖师列表</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-6 py-10 text-center text-gray-400">加载中…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-6 py-3 font-medium">姓名</th>
                  <th className="px-6 py-3 font-medium">执业证书编号</th>
                  <th className="px-6 py-3 font-medium">电话</th>
                  <th className="px-6 py-3 font-medium">类型</th>
                  <th className="px-6 py-3 font-medium">主持场次</th>
                  <th className="px-6 py-3 font-medium">备注</th>
                  <th className="px-6 py-3 font-medium">录入时间</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{a.realName}</td>
                    <td className="px-6 py-3 font-mono text-gray-700">{a.licenseNo}</td>
                    <td className="px-6 py-3 text-gray-500">{a.phone || "-"}</td>
                    <td className="px-6 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.isAffiliated ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {a.isAffiliated ? "挂靠" : "自有"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-900">{a.hostedCount}</td>
                    <td className="px-6 py-3 text-gray-500">{a.remark || "-"}</td>
                    <td className="px-6 py-3 text-gray-400">
                      {new Date(a.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                      暂无挂靠拍卖师
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
