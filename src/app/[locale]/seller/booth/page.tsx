"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Store, Upload, Save, Eye, Package, Trash2, Plus, ArrowUp, ArrowDown,
  CheckCircle, XCircle, Loader2, Image as ImageIcon, ExternalLink, Star
} from "lucide-react";

interface Booth {
  id: string;
  name: string;
  hall: string;
  template: string;
  status: string;
  coverImage: string | null;
  logoUrl: string | null;
  intro: string | null;
  sortIndex: number;
  expo?: { name: string; slug: string };
  showcaseItems: ShowcaseItem[];
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
  images: string[];
  videos: string[];
  description: string | null;
  status: string;
  sortIndex: number;
  viewCount: number;
  inquiryCount: number;
}

interface Product {
  id: string;
  modelName: string;
  year: number;
  priceCny: number;
  brand: { nameZh: string };
  category: { nameZh: string };
  images: { url: string }[];
}

const TEMPLATES = [
  { value: "standard", name: "标准版", desc: "封面图+设备列表+企业信息", icon: "📋", color: "blue" },
  { value: "premium", name: "高级版", desc: "轮播图+视频+设备+资质", icon: "✨", color: "purple" },
  { value: "flagship", name: "旗舰版", desc: "3D沉浸+多媒体+数据看板", icon: "🚀", color: "orange" },
];

const HALL_NAMES: Record<string, string> = {
  tractor: "拖拉机馆",
  harvester: "收获机械馆",
  planter: "种植机械馆",
  sprayer: "植保机械馆",
  comprehensive: "综合馆",
};

export default function SellerBoothPage() {
  const router = useRouter();
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [uploading, setUploading] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const fetchBooths = useCallback(async () => {
    if (!token) { router.push("/zh/auth/login"); return; }
    try {
      const res = await fetch("/api/seller/booth", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setBooths(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  const fetchProducts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/seller/products", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setProducts(data.data);
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  useEffect(() => {
    fetchBooths();
    fetchProducts();
  }, [fetchBooths, fetchProducts]);

  // Upload image to OSS
  const uploadImage = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (data.success) return data.url;
      throw new Error(data.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Update booth field
  const updateBooth = async (boothId: string, field: string, value: unknown) => {
    setSaving(true);
    try {
      const res = await fetch("/api/seller/booth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: boothId, [field]: value }),
      });
      const data = await res.json();
      if (data.success) {
        setBooths(prev => prev.map(b => b.id === boothId ? { ...b, [field]: value } : b));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  // Add item from product
  const addItemFromProduct = async (boothId: string, productId: string) => {
    const res = await fetch("/api/seller/booth/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ boothId, productId }),
    });
    const data = await res.json();
    if (data.success) {
      fetchBooths();
      setShowAddItem(false);
    }
  };

  // Delete item
  const deleteItem = async (itemId: string) => {
    if (!confirm("确认删除此展品？")) return;
    const res = await fetch(`/api/seller/booth/items?id=${itemId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) fetchBooths();
  };

  // Move item order
  const moveItem = async (boothId: string, itemId: string, direction: "up" | "down") => {
    const booth = booths.find(b => b.id === boothId);
    if (!booth) return;
    const items = [...booth.showcaseItems].sort((a, b) => a.sortIndex - b.sortIndex);
    const idx = items.findIndex(i => i.id === itemId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    // Swap sortIndex
    const item1 = items[idx];
    const item2 = items[swapIdx];
    await Promise.all([
      fetch("/api/seller/booth/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: item1.id, sortIndex: item2.sortIndex }),
      }),
      fetch("/api/seller/booth/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: item2.id, sortIndex: item1.sortIndex }),
      }),
    ]);
    fetchBooths();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  if (!token) {
    return <div className="py-20 text-center text-gray-500">请先登录</div>;
  }

  if (booths.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Store className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-900">您还没有展位</h2>
          <p className="mt-2 text-sm text-gray-500">
            展位由管理员分配。请联系管理员或在招商意向表中提交申请，获得展位后即可在此管理您的线上展厅。
          </p>
          <Link href="/zh/expo#inquiry-form" className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
            申请参展
          </Link>
        </div>
      </div>
    );
  }

  const booth = booths[0]; // For now, one booth per seller

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Store className="h-6 w-6 text-blue-600" />
            我的展位
          </h1>
          <p className="mt-1 text-sm text-gray-500">{booth.name} · {HALL_NAMES[booth.hall] || booth.hall}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" />已保存</span>}
          <Link href={`/zh/expo/booth/${booth.id}`} target="_blank"
            className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Eye className="h-4 w-4" />预览 <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            onClick={() => updateBooth(booth.id, "status", booth.status === "published" ? "offline" : "published")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white ${
              booth.status === "published" ? "bg-red-500 hover:bg-red-600" : "bg-green-600 hover:bg-green-700"
            }`}>
            {booth.status === "published" ? <><XCircle className="h-4 w-4" />下架</> : <><CheckCircle className="h-4 w-4" />发布</>}
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${
        booth.status === "published" ? "bg-green-50 text-green-700" :
        booth.status === "configured" ? "bg-yellow-50 text-yellow-700" :
        "bg-gray-50 text-gray-600"
      }`}>
        {booth.status === "published" ? "✅ 展位已上线，买家可以浏览" :
         booth.status === "configured" ? "⚠️ 展位已配置，点击右上角\"发布\"上线" :
         "📋 展位待配置，请完善信息后发布"}
      </div>

      {/* Template Selection */}
      <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-900">展位模板</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.value}
              onClick={() => updateBooth(booth.id, "template", tpl.value)}
              className={`rounded-xl border-2 p-4 text-left transition ${
                booth.template === tpl.value
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                  : "border-gray-200 hover:border-gray-300"
              }`}>
              <div className="text-2xl">{tpl.icon}</div>
              <p className="mt-1 font-bold text-gray-900">{tpl.name}</p>
              <p className="mt-1 text-xs text-gray-500">{tpl.desc}</p>
              {booth.template === tpl.value && (
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600">
                  <CheckCircle className="h-3 w-3" />当前模板
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Images */}
      <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-900">展位图片</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Cover Image */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">封面图（推荐 1200×400）</label>
            <div className="flex items-center gap-3">
              <div className="h-24 w-40 overflow-hidden rounded-lg border bg-gray-100">
                {booth.coverImage ? (
                  <img src={booth.coverImage} alt="封面" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300"><ImageIcon className="h-6 w-6" /></div>
                )}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) { const url = await uploadImage(file); updateBooth(booth.id, "coverImage", url); }
                  }} />
                <span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${uploading ? "opacity-50" : "hover:bg-gray-50"}`}>
                  <Upload className="h-3.5 w-3.5" />{uploading ? "上传中..." : "上传"}
                </span>
              </label>
            </div>
          </div>
          {/* Logo */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">企业Logo（推荐 200×200）</label>
            <div className="flex items-center gap-3">
              <div className="h-24 w-24 overflow-hidden rounded-lg border bg-gray-100">
                {booth.logoUrl ? (
                  <img src={booth.logoUrl} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300"><ImageIcon className="h-6 w-6" /></div>
                )}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) { const url = await uploadImage(file); updateBooth(booth.id, "logoUrl", url); }
                  }} />
                <span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${uploading ? "opacity-50" : "hover:bg-gray-50"}`}>
                  <Upload className="h-3.5 w-3.5" />{uploading ? "上传中..." : "上传"}
                </span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Company Intro */}
      <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-900">企业介绍</h2>
        <textarea
          defaultValue={booth.intro || ""}
          onBlur={(e) => updateBooth(booth.id, "intro", e.target.value)}
          rows={4}
          placeholder="介绍您的企业、主营产品、服务优势等..."
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">失焦自动保存</p>
      </section>

      {/* Device Management */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Package className="h-4 w-4 text-blue-600" />
           展品设备 ({booth.showcaseItems.length})
          </h2>
          <button onClick={() => setShowAddItem(!showAddItem)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" />添加设备
          </button>
        </div>

        {/* Add from products */}
        {showAddItem && (
          <div className="mb-4 rounded-lg border bg-gray-50 p-4">
            <p className="mb-2 text-xs font-medium text-gray-600">从已有产品导入：</p>
            <div className="max-h-60 overflow-y-auto">
              {products.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-400">暂无产品，请先在"我的产品"中发布</p>
              ) : (
                <div className="space-y-2">
                  {products.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-white p-2">
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                        {p.images[0] ? <img src={p.images[0].url} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{p.brand?.nameZh} {p.modelName}</p>
                        <p className="text-xs text-gray-400">{p.year} · ¥{p.priceCny?.toLocaleString()}</p>
                      </div>
                      <button onClick={() => addItemFromProduct(booth.id, p.id)}
                        className="flex-shrink-0 rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">
                        导入
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items list */}
        {booth.showcaseItems.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed py-8 text-center text-gray-400">
            <Package className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm">暂无展品，点击"添加设备"导入</p>
          </div>
        ) : (
          <div className="space-y-2">
            {booth.showcaseItems.sort((a, b) => a.sortIndex - b.sortIndex).map((item, idx, arr) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveItem(booth.id, item.id, "up")} disabled={idx === 0}
                    className="text-gray-400 hover:text-blue-600 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveItem(booth.id, item.id, "down")} disabled={idx === arr.length - 1}
                    className="text-gray-400 hover:text-blue-600 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {item.images?.[0] ? <img src={item.images[0]} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{item.brand} {item.model || item.deviceType}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{item.year || "—"}</span>
                    {item.price && <span className="font-bold text-orange-500">¥{item.price.toLocaleString()}</span>}
                    <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{item.viewCount}</span>
                    <span className="flex items-center gap-0.5"><Star className="h-3 w-3" />{item.inquiryCount}</span>
                  </div>
                </div>
                <button onClick={() => deleteItem(item.id)}
                  className="flex-shrink-0 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
