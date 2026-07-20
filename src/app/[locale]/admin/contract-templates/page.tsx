"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { FileText, Plus, Edit2, Trash2, X, Save, Loader2 } from "lucide-react";

interface ContractTemplate {
  id: string;
  templateNo: string;
  title: string;
  contractType: string;
  sellerName: string;
  sellerCreditCode?: string | null;
  sellerAddress?: string | null;
  sellerPhone?: string | null;
  sellerLegalPerson?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNo?: string | null;
  content: string;
  paymentDays: number;
  deliveryDays: number;
  transferResponsibility: string;
  courtJurisdiction?: string | null;
  status: string;
  createdAt: string;
}

export default function ContractTemplatesPage() {
  const locale = useLocale();
  const isZh = (locale || "zh") === "zh";
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    templateNo: "",
    title: "",
    contractType: "sale",
    sellerName: "",
    sellerCreditCode: "",
    sellerAddress: "",
    sellerPhone: "",
    sellerLegalPerson: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNo: "",
    content: "",
    paymentDays: 2,
    deliveryDays: 3,
    transferResponsibility: "buyer",
    courtJurisdiction: "",
  });

  const getAuthHeaders = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.token) headers["Authorization"] = `Bearer ${u.token}`;
        } catch {}
      }
    }
    return headers;
  };

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/contract-templates", { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setTemplates(json.data);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSave = async () => {
    if (!form.templateNo || !form.title || !form.sellerName || !form.content) {
      setError(isZh ? "请填写必填项（编号/标题/卖方名称/合同内容）" : "Required fields missing");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = editing
        ? `/api/contract-templates/${editing.id}`
        : "/api/contract-templates";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setEditing(null);
        fetchTemplates();
      } else {
        setError(json.error || "Failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (t: ContractTemplate) => {
    setEditing(t);
    setForm({
      templateNo: t.templateNo,
      title: t.title,
      contractType: t.contractType,
      sellerName: t.sellerName,
      sellerCreditCode: t.sellerCreditCode || "",
      sellerAddress: t.sellerAddress || "",
      sellerPhone: t.sellerPhone || "",
      sellerLegalPerson: t.sellerLegalPerson || "",
      bankName: t.bankName || "",
      bankAccountName: t.bankAccountName || "",
      bankAccountNo: t.bankAccountNo || "",
      content: t.content,
      paymentDays: t.paymentDays,
      deliveryDays: t.deliveryDays,
      transferResponsibility: t.transferResponsibility,
      courtJurisdiction: t.courtJurisdiction || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(isZh ? "确认归档此合同模板？" : "Archive this template?")) return;
    try {
      await fetch(`/api/contract-templates/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      fetchTemplates();
    } catch {}
  };

  const resetForm = () => {
    setForm({
      templateNo: "", title: "", contractType: "sale", sellerName: "",
      sellerCreditCode: "", sellerAddress: "", sellerPhone: "",
      sellerLegalPerson: "", bankName: "", bankAccountName: "",
      bankAccountNo: "", content: "", paymentDays: 2, deliveryDays: 3,
      transferResponsibility: "buyer", courtJurisdiction: "",
    });
    setEditing(null);
    setError("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-7 w-7 text-blue-600" />
          {isZh ? "合同模板管理" : "Contract Templates"}
        </h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {isZh ? "创建模板" : "New Template"}
        </button>
      </div>

      {/* 模板列表 */}
      <div className="space-y-3">
        {templates.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {isZh ? "暂无合同模板，点击右上角创建" : "No templates yet. Click \"New Template\" to create one."}
          </div>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-bold text-gray-900">{t.title}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono">{t.templateNo}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">{t.contractType}</span>
                </div>
                <p className="text-sm text-gray-500">
                  {isZh ? "卖方" : "Seller"}: {t.sellerName}
                  {t.sellerLegalPerson && ` · ${t.sellerLegalPerson}`}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {isZh ? `付款${t.paymentDays}天 · 提货${t.deliveryDays}工作日` : `Payment ${t.paymentDays}d · Pickup ${t.deliveryDays}d`}
                  {t.courtJurisdiction && ` · ${t.courtJurisdiction}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(t)} className="p-2 text-gray-400 hover:text-blue-600">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-2 text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 创建/编辑表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold">
                {editing ? (isZh ? "编辑模板" : "Edit Template") : (isZh ? "创建模板" : "New Template")}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "模板编号 *" : "Template No *"}</label>
                  <input value={form.templateNo} onChange={(e) => setForm({ ...form, templateNo: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" placeholder="SJZSN-2026-0725" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "合同标题 *" : "Title *"}</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" placeholder={isZh ? "农用拖拉机买卖合同" : "Sales Contract"} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "卖方名称 *" : "Seller Name *"}</label>
                  <input value={form.sellerName} onChange={(e) => setForm({ ...form, sellerName: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "统一社会信用代码" : "Credit Code"}</label>
                  <input value={form.sellerCreditCode} onChange={(e) => setForm({ ...form, sellerCreditCode: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "法定代表人" : "Legal Person"}</label>
                  <input value={form.sellerLegalPerson} onChange={(e) => setForm({ ...form, sellerLegalPerson: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "卖方电话" : "Seller Phone"}</label>
                  <input value={form.sellerPhone} onChange={(e) => setForm({ ...form, sellerPhone: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{isZh ? "卖方地址" : "Seller Address"}</label>
                <input value={form.sellerAddress} onChange={(e) => setForm({ ...form, sellerAddress: e.target.value })}
                  className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "开户银行" : "Bank Name"}</label>
                  <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "户名" : "Account Name"}</label>
                  <input value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "账号" : "Account No"}</label>
                  <input value={form.bankAccountNo} onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "付款期限(天)" : "Payment (days)"}</label>
                  <input type="number" value={form.paymentDays} onChange={(e) => setForm({ ...form, paymentDays: parseInt(e.target.value) || 2 })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "提货期限(工作日)" : "Pickup (days)"}</label>
                  <input type="number" value={form.deliveryDays} onChange={(e) => setForm({ ...form, deliveryDays: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{isZh ? "管辖法院" : "Court"}</label>
                  <input value={form.courtJurisdiction} onChange={(e) => setForm({ ...form, courtJurisdiction: e.target.value })}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{isZh ? "合同条款内容 *（支持Markdown）" : "Contract Content * (Markdown)"}</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm font-mono"
                  placeholder={isZh ? "合同条款内容... 支持变量：{{buyerName}} {{price}} {{paymentDeadline}}" : "Contract terms... Variables: {{buyerName}} {{price}}"} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowForm(false)} className="px-6 py-2 text-gray-500 hover:text-gray-700">
                  {isZh ? "取消" : "Cancel"}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isZh ? "保存" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
