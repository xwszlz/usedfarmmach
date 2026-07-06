"use client";

import { useState, useCallback } from "react";
import {
  Factory,
  Tent,
  Package,
  Star,
  Flame,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Globe,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ===== Types =====
interface BrandData {
  id: string;
  nameZh: string;
  nameEn: string;
  brandTier: string | null;
  isChineseBrand: boolean;
  expoSlug: string | null;
  officialWebsite: string | null;
  establishedYear: number | null;
  exportVolume: string | null;
  expoStory: string | null;
}

interface BoothData {
  id: string;
  name: string;
  hall: string;
  pavilion: string;
  tier: string;
  status: string;
  sortIndex: number;
  brandId: string | null;
  brand: { nameZh: string; nameEn: string } | null;
  _count: { showcaseItems: number };
}

interface ItemData {
  id: string;
  brand: string | null;
  model: string | null;
  deviceType: string;
  hotScore: number;
  isFeatured: boolean;
  isNewLaunch: boolean;
  machineTier: string | null;
  msrpUsd: number | null;
  msrpCny: number | null;
  sortIndex: number;
  brandRel: { nameZh: string; brandTier: string | null; isChineseBrand: boolean } | null;
}

interface Props {
  brands: BrandData[];
  booths: BoothData[];
  items: ItemData[];
}

type TabType = "brands" | "booths" | "items";
type SaveState = "idle" | "saving" | "saved" | "error";

// ===== Tier Badge =====
function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-400">未设</span>;
  const styles: Record<string, string> = {
    flagship: "bg-red-100 text-red-700",
    premium: "bg-purple-100 text-purple-700",
    core: "bg-blue-100 text-blue-700",
    standard: "bg-gray-100 text-gray-600",
    showcase: "bg-green-100 text-green-700",
  };
  const labels: Record<string, string> = {
    flagship: "旗舰",
    premium: "核心",
    core: "核心",
    standard: "标准",
    showcase: "精选",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[tier] || "bg-gray-100 text-gray-600"}`}>
      {labels[tier] || tier}
    </span>
  );
}

function PavilionBadge({ pavilion }: { pavilion: string }) {
  const isChina = pavilion === "china";
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${isChina ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
      {isChina ? "🇨🇳 中国馆" : "🌍 国际馆"}
    </span>
  );
}

// ===== Brand Row =====
function BrandRow({ brand, onUpdate }: { brand: BrandData; onUpdate: (id: string, data: Record<string, unknown>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    brandTier: brand.brandTier || "",
    expoStory: brand.expoStory || "",
    officialWebsite: brand.officialWebsite || "",
    exportVolume: brand.exportVolume || "",
    establishedYear: brand.establishedYear || "",
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const handleSave = async () => {
    setSaveState("saving");
    const data: Record<string, unknown> = {};
    if (form.brandTier !== (brand.brandTier || "")) data.brandTier = form.brandTier || null;
    if (form.expoStory !== (brand.expoStory || "")) data.expoStory = form.expoStory;
    if (form.officialWebsite !== (brand.officialWebsite || "")) data.officialWebsite = form.officialWebsite;
    if (form.exportVolume !== (brand.exportVolume || "")) data.exportVolume = form.exportVolume;
    if (form.establishedYear !== (brand.establishedYear || "")) data.establishedYear = parseInt(String(form.establishedYear)) || null;

    const ok = await onUpdate(brand.id, data);
    setSaveState(ok ? "saved" : "error");
    if (ok) {
      setTimeout(() => { setEditing(false); setSaveState("idle"); }, 1000);
    } else {
      setTimeout(() => setSaveState("idle"), 2000);
    }
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900">{brand.nameZh}</div>
        <div className="text-xs text-gray-400">{brand.nameEn}</div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {brand.isChineseBrand && <span className="text-xs">🇨🇳</span>}
          <TierBadge tier={brand.brandTier} />
        </div>
      </td>
      <td className="px-3 py-2 text-sm text-gray-500">{brand.establishedYear || "-"}</td>
      <td className="px-3 py-2 text-sm text-gray-500">{brand.exportVolume || "-"}</td>
      <td className="px-3 py-2 text-sm text-gray-400 max-w-xs truncate">{brand.expoStory || "-"}</td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="rounded bg-green-600 p-1 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saveState === "saving" ? "..." : saveState === "saved" ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            </button>
            <button onClick={() => { setEditing(false); setSaveState("idle"); }} className="rounded bg-gray-200 p-1 hover:bg-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:text-blue-800">编辑</button>
        )}
      </td>
      {editing && (
        <td colSpan={6} className="px-3 py-3 bg-blue-50">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-gray-500">品牌等级</label>
              <select
                value={form.brandTier}
                onChange={(e) => setForm({ ...form, brandTier: e.target.value })}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                <option value="">未设</option>
                <option value="flagship">旗舰</option>
                <option value="premium">核心</option>
                <option value="standard">标准</option>
                <option value="showcase">精选</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">创立年份</label>
              <input
                type="number"
                value={form.establishedYear}
                onChange={(e) => setForm({ ...form, establishedYear: e.target.value })}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">出口量</label>
              <input
                type="text"
                value={form.exportVolume}
                onChange={(e) => setForm({ ...form, exportVolume: e.target.value })}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">官网</label>
              <input
                type="text"
                value={form.officialWebsite}
                onChange={(e) => setForm({ ...form, officialWebsite: e.target.value })}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="text-xs text-gray-500">品牌故事</label>
              <textarea
                value={form.expoStory}
                onChange={(e) => setForm({ ...form, expoStory: e.target.value })}
                rows={2}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
          </div>
        </td>
      )}
    </tr>
  );
}

// ===== Item Row =====
function ItemRow({ item, onUpdate }: { item: ItemData; onUpdate: (id: string, data: Record<string, unknown>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    hotScore: String(item.hotScore),
    machineTier: item.machineTier || "",
    msrpUsd: item.msrpUsd ? String(item.msrpUsd) : "",
    msrpCny: item.msrpCny ? String(item.msrpCny) : "",
    isFeatured: item.isFeatured,
    isNewLaunch: item.isNewLaunch,
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const handleSave = async () => {
    setSaveState("saving");
    const data: Record<string, unknown> = {};
    if (form.hotScore !== String(item.hotScore)) data.hotScore = parseFloat(form.hotScore) || 0;
    if (form.machineTier !== (item.machineTier || "")) data.machineTier = form.machineTier || null;
    if (form.msrpUsd !== (item.msrpUsd ? String(item.msrpUsd) : "")) data.msrpUsd = form.msrpUsd ? parseFloat(form.msrpUsd) : null;
    if (form.msrpCny !== (item.msrpCny ? String(item.msrpCny) : "")) data.msrpCny = form.msrpCny ? parseFloat(form.msrpCny) : null;
    if (form.isFeatured !== item.isFeatured) data.isFeatured = form.isFeatured;
    if (form.isNewLaunch !== item.isNewLaunch) data.isNewLaunch = form.isNewLaunch;

    const ok = await onUpdate(item.id, data);
    setSaveState(ok ? "saved" : "error");
    if (ok) {
      setTimeout(() => { setEditing(false); setSaveState("idle"); }, 1000);
    } else {
      setTimeout(() => setSaveState("idle"), 2000);
    }
  };

  const toggleFeatured = async () => {
    const newVal = !item.isFeatured;
    await onUpdate(item.id, { isFeatured: newVal });
  };

  const toggleNewLaunch = async () => {
    const newVal = !item.isNewLaunch;
    await onUpdate(item.id, { isNewLaunch: newVal });
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900 text-sm">{item.deviceType}</div>
        {item.model && <div className="text-xs text-gray-400">{item.model}</div>}
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">{item.brandRel?.nameZh || item.brand || "-"}</td>
      <td className="px-3 py-2">
        <TierBadge tier={item.machineTier} />
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-orange-600">
          <Flame className="h-3 w-3" />{item.hotScore}
        </span>
      </td>
      <td className="px-3 py-2 text-sm text-gray-500">
        {item.msrpCny ? `¥${(item.msrpCny / 10000).toFixed(1)}万` : "-"}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFeatured}
            className={`rounded p-1 ${item.isFeatured ? "text-yellow-500" : "text-gray-300 hover:text-gray-400"}`}
            title={item.isFeatured ? "取消精选" : "设为精选"}
          >
            <Star className={`h-4 w-4 ${item.isFeatured ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={toggleNewLaunch}
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${item.isNewLaunch ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
          >
            NEW
          </button>
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="rounded bg-green-600 p-1 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saveState === "saving" ? "..." : saveState === "saved" ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            </button>
            <button onClick={() => { setEditing(false); setSaveState("idle"); }} className="rounded bg-gray-200 p-1 hover:bg-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:text-blue-800">编辑</button>
        )}
      </td>
      {editing && (
        <td colSpan={7} className="px-3 py-3 bg-blue-50">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-gray-500">热度分数</label>
              <input
                type="number"
                step="0.1"
                value={form.hotScore}
                onChange={(e) => setForm({ ...form, hotScore: e.target.value })}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">技术等级</label>
              <select
                value={form.machineTier}
                onChange={(e) => setForm({ ...form, machineTier: e.target.value })}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                <option value="">未设</option>
                <option value="flagship">旗舰</option>
                <option value="high">高端</option>
                <option value="standard">标准</option>
                <option value="entry">入门</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">MSRP 人民币</label>
              <input
                type="number"
                value={form.msrpCny}
                onChange={(e) => setForm({ ...form, msrpCny: e.target.value })}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">MSRP USD</label>
              <input
                type="number"
                value={form.msrpUsd}
                onChange={(e) => setForm({ ...form, msrpUsd: e.target.value })}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
          </div>
        </td>
      )}
    </tr>
  );
}

// ===== Main Component =====
export default function ManageClient({ brands, booths, items }: Props) {
  const [tab, setTab] = useState<TabType>("brands");
  const [brandSearch, setBrandSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [expandedBooth, setExpandedBooth] = useState<string | null>(null);

  const updateBrand = useCallback(async (id: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/expo/brand/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const updateItem = useCallback(async (id: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/expo/item/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const filteredBrands = brands.filter(
    (b) => b.nameZh.includes(brandSearch) || b.nameEn.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const filteredItems = items.filter(
    (i) =>
      i.deviceType.includes(itemSearch) ||
      (i.model || "").includes(itemSearch) ||
      (i.brandRel?.nameZh || "").includes(itemSearch)
  );

  const chinaBrands = brands.filter((b) => b.isChineseBrand).length;
  const globalBrands = brands.length - chinaBrands;
  const featuredCount = items.filter((i) => i.isFeatured).length;
  const newLaunchCount = items.filter((i) => i.isNewLaunch).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">展会内容管理</h1>
        <p className="mt-1 text-sm text-gray-500">
          管理品牌等级 · 展位配置 · 展品热度 · 精选标记
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Factory className="h-4 w-4" />
            <span className="text-xs">品牌总数</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {brands.length}
            <span className="ml-2 text-xs font-normal text-gray-400">
              🇨🇳 {chinaBrands} · 🌍 {globalBrands}
            </span>
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Tent className="h-4 w-4" />
            <span className="text-xs">展位总数</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{booths.length}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Package className="h-4 w-4" />
            <span className="text-xs">展品总数</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{items.length}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Star className="h-4 w-4" />
            <span className="text-xs">精选 / 新品</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {featuredCount}
            <span className="ml-1 text-sm text-green-600">/ {newLaunchCount}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b">
        {([
          { key: "brands" as const, label: `品牌管理 (${brands.length})`, icon: Factory },
          { key: "booths" as const, label: `展位管理 (${booths.length})`, icon: Tent },
          { key: "items" as const, label: `展品管理 (${items.length})`, icon: Package },
        ]).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Brands Tab */}
      {tab === "brands" && (
        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b p-3">
            <input
              type="text"
              placeholder="搜索品牌名称..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              className="w-full max-w-md rounded border px-3 py-1.5 text-sm"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">品牌</th>
                  <th className="px-3 py-2">等级</th>
                  <th className="px-3 py-2">创立</th>
                  <th className="px-3 py-2">出口量</th>
                  <th className="px-3 py-2">品牌故事</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.map((brand) => (
                  <BrandRow key={brand.id} brand={brand} onUpdate={updateBrand} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Booths Tab */}
      {tab === "booths" && (
        <div className="space-y-2">
          {booths.map((booth) => (
            <div key={booth.id} className="rounded-lg bg-white shadow-sm">
              <button
                onClick={() => setExpandedBooth(expandedBooth === booth.id ? null : booth.id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  {expandedBooth === booth.id ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{booth.name}</div>
                    <div className="text-xs text-gray-400">
                      {booth.brand?.nameZh || "未关联品牌"} · {booth.hall}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PavilionBadge pavilion={booth.pavilion} />
                  <TierBadge tier={booth.tier} />
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {booth._count.showcaseItems} 台展品
                  </span>
                  <span className="text-xs text-gray-400">排序: {booth.sortIndex}</span>
                </div>
              </button>
              {expandedBooth === booth.id && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <label className="text-xs text-gray-500">展位名称</label>
                      <div className="text-sm text-gray-900">{booth.name}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">所在展馆</label>
                      <div className="text-sm text-gray-900">{booth.hall}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">分区</label>
                      <div className="text-sm text-gray-900">{booth.pavilion === "china" ? "中国品牌馆" : "国际标杆馆"}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">状态</label>
                      <div className="text-sm text-gray-900">{booth.status}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">
                    展位编辑需通过数据库操作或种子脚本修改。此处为只读查看。
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Items Tab */}
      {tab === "items" && (
        <div className="rounded-lg bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-3">
            <input
              type="text"
              placeholder="搜索展品名称/型号/品牌..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full max-w-md rounded border px-3 py-1.5 text-sm"
            />
            <div className="ml-3 flex items-center gap-2 text-xs text-gray-400">
              <AlertCircle className="h-3 w-3" />
              点击 ⭐ 快速切换精选，点击 NEW 切换新品
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">展品</th>
                  <th className="px-3 py-2">品牌</th>
                  <th className="px-3 py-2">等级</th>
                  <th className="px-3 py-2">热度</th>
                  <th className="px-3 py-2">MSRP</th>
                  <th className="px-3 py-2">精选/新品</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <ItemRow key={item.id} item={item} onUpdate={updateItem} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
