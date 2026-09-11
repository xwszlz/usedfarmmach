"use client";

/**
 * 合作持牌拍卖机构台账（合规红线 #4/#5）
 *
 * 用途：登记并核验合作机构的《拍卖经营批准证书》，满足
 *   - 《网络拍卖规程》「拍卖主体资格审核制度」要求（核验 + 登记 + 留存）；
 *   - 2024 三部门《指导意见》第八条「平台须核验、登记平台内拍卖经营者身份及许可信息」。
 *
 * 语义铁律：本页登记的是**合作机构**资质，不是平台自有资质。
 *   status 改为非 ACTIVE 后，hammer 路由会立即拒绝该机构名下所有落槌（自动下线）。
 */

import { useEffect, useState } from "react";

interface Agency {
  id: string;
  name: string;
  licenseNo: string;
  unifiedCreditCode: string | null;
  licenseAuthority: string | null;
  licenseValidTo: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  licenseFileUrl: string | null;
  licenseVerifiedAt: string | null;
  remark: string | null;
  createdAt: string;
  _count?: { auctioneers: number; auctions: number };
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  SUSPENDED: "bg-amber-100 text-amber-700",
  EXPIRED: "bg-gray-200 text-gray-600",
  REVOKED: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "合作中",
  SUSPENDED: "暂停",
  EXPIRED: "已失效",
  REVOKED: "已吊销",
};

export default function AuctionAgenciesAdminPage() {
  const [list, setList] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    licenseNo: "",
    unifiedCreditCode: "",
    licenseAuthority: "",
    licenseValidTo: "",
    contactName: "",
    contactPhone: "",
    licenseFileUrl: "",
    status: "ACTIVE",
    remark: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auction-agencies");
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

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.name.trim() || !form.licenseNo.trim()) {
      setError("机构法定全称与证书编号为必填");
      return;
    }
    if (!form.licenseFileUrl.trim()) {
      setError("请先上传证书扫描件并填入 URL（无核验留痕不得登记，合规红线 #4）");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/auction-agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(`已登记合作持牌机构：${json.data.name}（${json.data.licenseNo}）`);
        setForm({
          name: "",
          licenseNo: "",
          unifiedCreditCode: "",
          licenseAuthority: "",
          licenseValidTo: "",
          contactName: "",
          contactPhone: "",
          licenseFileUrl: "",
          status: "ACTIVE",
          remark: "",
        });
        load();
      } else {
        setError(json.error || "登记失败");
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
        <h1 className="text-2xl font-bold text-gray-900">合作持牌拍卖机构</h1>
        <p className="mt-1 text-sm text-gray-500">
          登记合作机构的《拍卖经营批准证书》并留存核验记录。平台自身不持证，
          真实拍卖业务全部由本表机构作为拍卖人依法开展；机构状态非「合作中」时，落槌接口将自动拒绝。
        </p>
      </div>

      <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold text-amber-800">口径提醒（对外文案铁律）</p>
        <p className="mt-1">
          本页登记的是<b>合作机构</b>证书，不是平台自有资质。对外一律写「本平台拍卖业务由合作持牌机构
          XX（证书编号：…）依法开展」，<b>不得写成「本公司已取得《拍卖经营批准证书》」</b>。
        </p>
      </div>

      {/* 录入表单 */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">登记合作机构</h2>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>机构法定全称 *</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="如 XX拍卖有限公司"
            />
          </div>
          <div>
            <label className={labelCls}>《拍卖经营批准证书》编号 *</label>
            <input
              className={inputCls}
              value={form.licenseNo}
              onChange={(e) => update("licenseNo", e.target.value)}
              placeholder="合作机构证书编号（非本平台资质）"
            />
          </div>
          <div>
            <label className={labelCls}>统一社会信用代码</label>
            <input
              className={inputCls}
              value={form.unifiedCreditCode}
              onChange={(e) => update("unifiedCreditCode", e.target.value)}
              placeholder="可选"
            />
          </div>
          <div>
            <label className={labelCls}>发证机关</label>
            <input
              className={inputCls}
              value={form.licenseAuthority}
              onChange={(e) => update("licenseAuthority", e.target.value)}
              placeholder="如 河北省商务厅"
            />
          </div>
          <div>
            <label className={labelCls}>证书有效期至</label>
            <input
              type="date"
              className={inputCls}
              value={form.licenseValidTo}
              onChange={(e) => update("licenseValidTo", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>状态</label>
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="ACTIVE">合作中</option>
              <option value="SUSPENDED">暂停</option>
              <option value="EXPIRED">已失效</option>
              <option value="REVOKED">已吊销</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>对接联系人</label>
            <input
              className={inputCls}
              value={form.contactName}
              onChange={(e) => update("contactName", e.target.value)}
              placeholder="可选"
            />
          </div>
          <div>
            <label className={labelCls}>联系电话</label>
            <input
              className={inputCls}
              value={form.contactPhone}
              onChange={(e) => update("contactPhone", e.target.value)}
              placeholder="可选"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>证书扫描件 URL *（核验留痕，存 OSS）</label>
            <input
              className={inputCls}
              value={form.licenseFileUrl}
              onChange={(e) => update("licenseFileUrl", e.target.value)}
              placeholder="https://…（留空无法登记：无核验留痕即无资质审核制度）"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>备注</label>
            <input
              className={inputCls}
              value={form.remark}
              onChange={(e) => update("remark", e.target.value)}
              placeholder="可选，如合作协议编号、佣金结算约定"
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
              {submitting ? "提交中…" : "登记合作机构"}
            </button>
          </div>
        </form>
      </div>

      {/* 列表 */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">资质台账</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-6 py-10 text-center text-gray-400">加载中…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-6 py-3 font-medium">机构名称</th>
                  <th className="px-6 py-3 font-medium">证书编号</th>
                  <th className="px-6 py-3 font-medium">发证机关</th>
                  <th className="px-6 py-3 font-medium">有效期至</th>
                  <th className="px-6 py-3 font-medium">状态</th>
                  <th className="px-6 py-3 font-medium">名下拍卖师</th>
                  <th className="px-6 py-3 font-medium">核验时间</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-6 py-3 font-mono text-gray-700">{a.licenseNo}</td>
                    <td className="px-6 py-3 text-gray-500">{a.licenseAuthority || "-"}</td>
                    <td className="px-6 py-3 text-gray-500">
                      {a.licenseValidTo
                        ? new Date(a.licenseValidTo).toLocaleDateString("zh-CN")
                        : "-"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLE[a.status] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-900">{a._count?.auctioneers ?? 0}</td>
                    <td className="px-6 py-3 text-gray-400">
                      {a.licenseVerifiedAt
                        ? new Date(a.licenseVerifiedAt).toLocaleDateString("zh-CN")
                        : "未核验"}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                      暂无登记的合作持牌机构
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
