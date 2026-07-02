"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Brand {
  id: string;
  nameZh: string;
  nameEn: string;
}

interface Category {
  id: string;
  nameZh: string;
  nameEn: string;
}

interface ProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
}

interface ProductData {
  id: string;
  modelName: string;
  year: number;
  workingHours: number | null;
  condition: string;
  priceCny: number;
  priceUsd: number | null;
  location: string;
  descriptionZh: string | null;
  brandId: string;
  categoryId: string;
  status: string;
  brand: Brand;
  category: Category;
  images: ProductImage[];
  enginePower: number | null;
  engineType: string | null;
  driveSystem: string | null;
  overallLength: number | null;
  overallWidth: number | null;
  overallHeight: number | null;
  netWeight: number | null;
  mainConfig: string | null;
  priceMode: string;
  tradeTerm: string;
  tradePort: string | null;
}

interface Props {
  product: ProductData;
  brands: Brand[];
  categories: Category[];
}

const CONDITIONS = [
  { value: "excellent", label: "Excellent 极佳" },
  { value: "good", label: "Good 良好" },
  { value: "fair", label: "Fair 一般" },
  { value: "poor", label: "Poor 较差" },
];

const STATUSES = [
  { value: "active", label: "在售" },
  { value: "sold", label: "已售" },
  { value: "draft", label: "草稿" },
  { value: "archived", label: "归档" },
];

const DRIVE_SYSTEMS = [
  { value: "2WD", label: "2WD" },
  { value: "4WD", label: "4WD" },
  { value: "Full Hydraulic", label: "Full Hydraulic" },
];

const PRICE_MODES = [
  { value: "fixed", label: "Fixed Price (固定价格)" },
  { value: "por", label: "Price on Request (询价)" },
];

const TRADE_TERMS = [
  { value: "FOB", label: "FOB" },
  { value: "CIF", label: "CIF" },
  { value: "EXW", label: "EXW" },
];

export function ProductEditForm({ product, brands, categories }: Props) {
  const router = useRouter();

  const [form, setForm] = useState({
    modelName: product.modelName,
    year: product.year,
    workingHours: product.workingHours ?? null as number | null,
    condition: product.condition,
    priceCny: product.priceCny,
    location: product.location,
    descriptionZh: product.descriptionZh || "",
    brandId: product.brandId,
    categoryId: product.categoryId,
    status: product.status,
    enginePower: product.enginePower ?? null as number | null,
    engineType: product.engineType || "Diesel Engine",
    driveSystem: product.driveSystem || "2WD",
    overallLength: product.overallLength ?? null as number | null,
    overallWidth: product.overallWidth ?? null as number | null,
    overallHeight: product.overallHeight ?? null as number | null,
    netWeight: product.netWeight ?? null as number | null,
    mainConfig: product.mainConfig || "",
    priceMode: product.priceMode || "por",
    tradeTerm: product.tradeTerm || "FOB",
    tradePort: product.tradePort || "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChange = (field: string, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          modelName: form.modelName,
          year: Number(form.year),
          workingHours: form.workingHours,
          condition: form.condition,
          priceCny: Number(form.priceCny),
          location: form.location,
          descriptionZh: form.descriptionZh || null,
          brandId: form.brandId,
          categoryId: form.categoryId,
          status: form.status,
          enginePower: form.enginePower,
          engineType: form.engineType || null,
          driveSystem: form.driveSystem || null,
          overallLength: form.overallLength,
          overallWidth: form.overallWidth,
          overallHeight: form.overallHeight,
          netWeight: form.netWeight,
          mainConfig: form.mainConfig || null,
          priceMode: form.priceMode,
          tradeTerm: form.tradeTerm,
          tradePort: form.tradePort || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "保存成功！" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "保存失败" });
      }
    } catch {
      setMessage({ type: "error", text: "网络错误，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const displayYear = form.year.toString() === "0" ? "" : form.year.toString();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">基本信息</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">型号 *</span>
            <input
              type="text"
              value={form.modelName}
              onChange={(e) => handleChange("modelName", e.target.value)}
              required
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">年份 *</span>
            <input
              type="number"
              value={displayYear}
              onChange={(e) => handleChange("year", Number(e.target.value))}
              min={1980}
              max={2030}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">工作时长 (小时)</span>
            <input
              type="number"
              value={form.workingHours ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                handleChange("workingHours", val === "" ? null : Number(val));
              }}
              min={0}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">成色 *</span>
            <select
              value={form.condition}
              onChange={(e) => handleChange("condition", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">价格 (CNY) *</span>
            <input
              type="number"
              value={form.priceCny || ""}
              onChange={(e) => handleChange("priceCny", Number(e.target.value))}
              min={0}
              step={100}
              required
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">位置 *</span>
            <input
              type="text"
              value={form.location}
              onChange={(e) => handleChange("location", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">品牌 *</span>
            <select
              value={form.brandId}
              onChange={(e) => handleChange("brandId", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.nameZh} ({b.nameEn})</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">品类 *</span>
            <select
              value={form.categoryId}
              onChange={(e) => handleChange("categoryId", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nameZh}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">状态</span>
            <select
              value={form.status}
              onChange={(e) => handleChange("status", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Engine & Dimensions */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">引擎与规格参数</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">额定马力 (HP)</span>
            <input
              type="number"
              value={form.enginePower ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                handleChange("enginePower", val === "" ? null : Number(val));
              }}
              min={0}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">发动机类型</span>
            <input
              type="text"
              value={form.engineType}
              onChange={(e) => handleChange("engineType", e.target.value)}
              placeholder="Diesel Engine"
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">驱动方式</span>
            <select
              value={form.driveSystem || ""}
              onChange={(e) => handleChange("driveSystem", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">未设置</option>
              {DRIVE_SYSTEMS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">总长 (mm)</span>
            <input
              type="number"
              value={form.overallLength ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                handleChange("overallLength", val === "" ? null : Number(val));
              }}
              min={0}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">总宽 (mm)</span>
            <input
              type="number"
              value={form.overallWidth ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                handleChange("overallWidth", val === "" ? null : Number(val));
              }}
              min={0}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">总高 (mm)</span>
            <input
              type="number"
              value={form.overallHeight ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                handleChange("overallHeight", val === "" ? null : Number(val));
              }}
              min={0}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">整机重量 (KG)</span>
            <input
              type="number"
              value={form.netWeight ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                handleChange("netWeight", val === "" ? null : Number(val));
              }}
              min={0}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-gray-500">主要配置</span>
            <input
              type="text"
              value={form.mainConfig}
              onChange={(e) => handleChange("mainConfig", e.target.value)}
              placeholder="如: 冠军445割台, 四轮驱动, 自动导航"
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
        </div>
      </div>

      {/* Trade Info */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">贸易信息</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">价格模式</span>
            <select
              value={form.priceMode}
              onChange={(e) => handleChange("priceMode", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PRICE_MODES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">贸易术语</span>
            <select
              value={form.tradeTerm}
              onChange={(e) => handleChange("tradeTerm", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {TRADE_TERMS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">发货港口</span>
            <input
              type="text"
              value={form.tradePort}
              onChange={(e) => handleChange("tradePort", e.target.value)}
              placeholder="如: Qingdao"
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">描述信息 (中文)</h2>
        </div>
        <div className="p-6">
          <textarea
            value={form.descriptionZh}
            onChange={(e) => handleChange("descriptionZh", e.target.value)}
            rows={5}
            placeholder="产品描述、配置详情、注意事项等..."
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Images Preview */}
      {product.images.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold text-gray-900">产品图片 ({product.images.length})</h2>
          </div>
          <div className="flex flex-wrap gap-3 p-6">
            {product.images.map((img) => (
              <div
                key={img.id}
                className="relative h-24 w-32 overflow-hidden rounded-lg border bg-gray-50"
              >
                <img
                  src={`https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com${img.url}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {img.isPrimary && (
                  <span className="absolute bottom-1 left-1 rounded bg-primary-600 px-1.5 py-0.5 text-[10px] text-white">
                    主图
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "保存中..." : "保存修改"}
        </button>
        <Link
          href="../products"
          className="rounded-lg border px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          返回列表
        </Link>
      </div>
    </form>
  );
}
