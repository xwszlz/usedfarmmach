"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Trash2, Save, LogIn, LogOut, Package, Eye, BarChart3,
  ExternalLink, Loader2, Image as ImageIcon
} from "lucide-react";

interface BoothManageClientProps {
  locale: string;
}

interface ShowcaseItem {
  id: string;
  deviceType: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  workingHours: number | null;
  condition: string | null;
  price: number | null;
  currency: string;
  images: string[];
  description: string | null;
  status: string;
  sortIndex: number;
  viewCount: number;
  inquiryCount: number;
}

interface BoothData {
  id: string;
  name: string;
  template: string;
  tier: string;
  status: string;
  intro: string | null;
  showcaseItems: ShowcaseItem[];
  _count: { expoInquiries: number };
}

export default function BoothManageClient({ locale }: BoothManageClientProps) {
  const isZh = locale === "zh";
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [booth, setBooth] = useState<BoothData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ShowcaseItem> & { isNew?: boolean }>({});

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me");
      const json = await res.json();
      if (json.success) {
        setUser(json.data.user);
        await fetchBooth();
      }
    } catch { /* not logged in */ }
    setLoading(false);
  }

  async function fetchBooth() {
    try {
      const res = await fetch("/api/expo/booth/manage");
      const json = await res.json();
      if (json.success) setBooth(json.data);
    } catch { /* no booth yet */ }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const json = await res.json();
      if (json.success) {
        setUser(json.data.user);
        await fetchBooth();
      } else {
        setLoginError(json.error || "登录失败");
      }
    } catch {
      setLoginError("登录失败，请重试");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout");
    setUser(null);
    setBooth(null);
  }

  async function saveShowcaseItem(item: Partial<ShowcaseItem>) {
    setSaving(true);
    try {
      const res = await fetch("/api/expo/booth/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const json = await res.json();
      if (json.success) {
        await fetchBooth();
        setEditForm({});
      } else {
        alert(json.error || "保存失败");
      }
    } catch {
      alert("保存失败");
    }
    setSaving(false);
  }

  async function deleteShowcaseItem(id: string) {
    if (!confirm(isZh ? "确定删除该展品？" : "Delete this item?")) return;
    try {
      await fetch(`/api/expo/booth/manage?id=${id}`, { method: "DELETE" });
      await fetchBooth();
    } catch {
      alert("删除失败");
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Not logged in — show login form
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "自助展台管理" : "Booth Management"}
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500">
            {isZh ? "登录后管理您的展品和询盘" : "Login to manage your booth"}
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {isZh ? "账号" : "Username"}
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {isZh ? "密码" : "Password"}
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                required
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-600">{loginError}</p>
            )}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              <LogIn className="h-4 w-4" />
              {isZh ? "登录" : "Login"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-400">
            {isZh ? "新入驻品牌请联系管理员获取账号" : "Contact admin for account"}
          </p>
        </div>
      </div>
    );
  }

  // Logged in — show dashboard
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "我的自助展台" : "My Self-Expo Booth"}
          </h1>
          <p className="text-sm text-gray-500">
            {user.companyName} · {user.username}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {booth && (
            <Link
              href={`/${locale}/expo/booth/${booth.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
            >
              <Eye className="h-4 w-4" />
              {isZh ? "查看展台" : "View Booth"}
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
          >
            <LogOut className="h-4 w-4" />
            {isZh ? "退出" : "Logout"}
          </button>
        </div>
      </div>

      {/* Stats */}
      {booth && (
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 p-4 text-center dark:border-gray-800">
            <div className="text-2xl font-bold text-green-600">{booth.showcaseItems.length}</div>
            <div className="text-sm text-gray-500">{isZh ? "展品数" : "Items"}</div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 text-center dark:border-gray-800">
            <div className="text-2xl font-bold text-blue-600">
              {booth.showcaseItems.reduce((s, i) => s + i.viewCount, 0)}
            </div>
            <div className="text-sm text-gray-500">{isZh ? "总浏览" : "Views"}</div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 text-center dark:border-gray-800">
            <div className="text-2xl font-bold text-purple-600">{booth._count.expoInquiries}</div>
            <div className="text-sm text-gray-500">{isZh ? "询盘" : "Inquiries"}</div>
          </div>
        </div>
      )}

      {/* Item list */}
      {booth && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isZh ? "展品管理" : "Item Management"}
            </h2>
            <button
              onClick={() => setEditForm({ isNew: true, deviceType: "", brand: "", model: "" })}
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              {isZh ? "添加展品" : "Add Item"}
            </button>
          </div>

          {/* Item list */}
          <div className="space-y-3">
            {booth.showcaseItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
                <Package className="mx-auto mb-2 h-10 w-10" />
                <p>{isZh ? "还没有展品，点击上方添加" : "No items yet. Click Add Item."}</p>
              </div>
            )}

            {booth.showcaseItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {item.brand} {item.model}
                      </h3>
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {item.deviceType}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs ${
                        item.status === "published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {item.status === "published" ? (isZh ? "已发布" : "Published") : (isZh ? "草稿" : "Draft")}
                      </span>
                    </div>
                    {item.year && (
                      <p className="mt-1 text-sm text-gray-500">
                        {item.year}年 · {item.workingHours ? `${item.workingHours}h` : ""}
                        {item.price ? ` · ¥${item.price.toLocaleString()}` : ""}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{item.viewCount}</span>
                      <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{item.inquiryCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditForm({ ...item, isNew: false });
                        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition hover:bg-gray-50 dark:border-gray-600"
                    >
                      {isZh ? "编辑" : "Edit"}
                    </button>
                    <button
                      onClick={() => deleteShowcaseItem(item.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Edit form */}
          {editForm.deviceType !== undefined && (
            <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                {editForm.isNew ? (isZh ? "添加展品" : "Add Item") : (isZh ? "编辑展品" : "Edit Item")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isZh ? "设备类型 *" : "Device Type *"}
                  </label>
                  <input
                    value={editForm.deviceType || ""}
                    onChange={(e) => setEditForm({ ...editForm, deviceType: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                    placeholder={isZh ? "例如：拖拉机" : "e.g. Tractor"}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isZh ? "品牌" : "Brand"}
                  </label>
                  <input
                    value={editForm.brand || ""}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                    placeholder={isZh ? "例如：东方红" : "e.g. YTO"}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isZh ? "型号" : "Model"}
                  </label>
                  <input
                    value={editForm.model || ""}
                    onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                    placeholder={isZh ? "例如：LX2004" : "e.g. LX2004"}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isZh ? "年份" : "Year"}
                  </label>
                  <input
                    type="number"
                    value={editForm.year || ""}
                    onChange={(e) => setEditForm({ ...editForm, year: parseInt(e.target.value) || null })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                    placeholder="2022"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isZh ? "工作小时" : "Hours"}
                  </label>
                  <input
                    type="number"
                    value={editForm.workingHours || ""}
                    onChange={(e) => setEditForm({ ...editForm, workingHours: parseInt(e.target.value) || null })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                    placeholder="2000"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isZh ? "价格 (¥)" : "Price (CNY)"}
                  </label>
                  <input
                    type="number"
                    value={editForm.price || ""}
                    onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || null })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                    placeholder="88000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isZh ? "描述" : "Description"}
                  </label>
                  <textarea
                    value={editForm.description || ""}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                    placeholder={isZh ? "机器状况、备注信息..." : "Machine condition, notes..."}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setEditForm({})}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-600"
                >
                  {isZh ? "取消" : "Cancel"}
                </button>
                <button
                  onClick={() => saveShowcaseItem(editForm)}
                  disabled={saving || !editForm.deviceType}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isZh ? "保存" : "Save"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* No booth yet */}
      {!booth && (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <Package className="mx-auto mb-3 h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isZh ? "您还没有自助展台" : "No Booth Yet"}
          </h2>
          <p className="mt-2 text-gray-500">
            {isZh ? "请先通过品牌入驻提交申请，审核通过后即可管理展台" : "Submit a brand claim to get started."}
          </p>
          <Link
            href={`/${locale}/expo/brand-claim`}
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition hover:bg-green-700"
          >
            <ExternalLink className="h-4 w-4" />
            {isZh ? "去入驻" : "Claim Booth"}
          </Link>
        </div>
      )}
    </div>
  );
}
