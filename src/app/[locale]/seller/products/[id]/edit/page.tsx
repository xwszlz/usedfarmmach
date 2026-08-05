"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Save, Sparkles } from "lucide-react";
import SellerAiAssistant from "@/components/seller/ai-assistant";

interface ProductDetail {
  id: string;
  modelName: string;
  year: number;
  workingHours: number | null;
  condition: string;
  priceCny: number;
  location: string;
  country: string | null;
  province: string | null;
  city: string | null;
  engineType: string | null;
  enginePower: number | null;
  driveSystem: string | null;
  mainConfig: string | null;
  overallLength: number | null;
  overallWidth: number | null;
  overallHeight: number | null;
  netWeight: number | null;
  brand: { id: string; nameZh: string; nameEn: string; isChineseBrand: boolean };
  category: { id: string; nameZh: string; nameEn: string };
  images: { url: string }[];
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const locale = params.locale as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [showAi, setShowAi] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // 加载产品数据
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`/api/seller/products/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const found: ProductDetail = d.data;
          setProduct(found);
          setForm({
            brandName: found.brand?.nameZh || "",
            modelName: found.modelName || "",
            year: found.year || 2020,
            workingHours: found.workingHours ?? "",
            engineType: found.engineType || "",
            enginePower: found.enginePower ?? "",
            driveSystem: found.driveSystem || "",
            mainConfig: found.mainConfig || "",
            overallLength: found.overallLength ?? "",
            overallWidth: found.overallWidth ?? "",
            overallHeight: found.overallHeight ?? "",
            netWeight: found.netWeight ?? "",
            condition: found.condition || "good",
            priceCny: found.priceCny || "",
            category: found.category?.nameZh || "",
            country: found.country || "",
            province: found.province || "",
            city: found.city || "",
            location: found.location || "",
          });
          // 提取图片URL（用于AI重新识别）
          const urls = (found.images || []).map((img) => img.url);
          setImageUrls(urls);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // 更新表单字段
  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // AI回填（只更新勾选的字段）
  const handleAiFill = (data: Record<string, any>) => {
    setForm((prev) => ({ ...prev, ...data }));
  };

  // 保存产品
  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/seller/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          workingHours: form.workingHours ? Number(form.workingHours) : null,
          enginePower: form.enginePower ? Number(form.enginePower) : null,
          overallLength: form.overallLength ? Number(form.overallLength) : null,
          overallWidth: form.overallWidth ? Number(form.overallWidth) : null,
          overallHeight: form.overallHeight ? Number(form.overallHeight) : null,
          netWeight: form.netWeight ? Number(form.netWeight) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("保存成功！");
        router.push(`/${locale}/seller/products`);
      } else {
        alert("保存失败：" + (data.error || "未知错误"));
      }
    } catch (err: any) {
      alert("保存失败：" + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!product) {
    return (
      <div className="py-20 text-center text-gray-500">产品不存在或无权编辑</div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">编辑产品</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAi(!showAi)}
            className="flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100"
          >
            <Sparkles className="h-4 w-4" />
            {showAi ? "关闭AI识别" : "重新AI识别"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存
          </button>
        </div>
      </div>

      {/* AI识别面板（URL模式） */}
      {showAi && (
        <div className="mb-6">
          <SellerAiAssistant
            imageUrls={imageUrls}
            imageFiles={[]}
            existingFormValues={form}
            onFill={handleAiFill}
            autoTrigger={false}
            editMode={true}
          />
        </div>
      )}

      {/* 编辑表单 */}
      <div className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
        {/* 基本参数 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              品牌
            </label>
            <input
              value={form.brandName || ""}
              onChange={(e) => updateField("brandName", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              型号
            </label>
            <input
              value={form.modelName || ""}
              onChange={(e) => updateField("modelName", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              年份 *
            </label>
            <input
              type="number"
              value={form.year || ""}
              onChange={(e) => updateField("year", Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              工作小时
            </label>
            <input
              type="number"
              value={form.workingHours || ""}
              onChange={(e) =>
                updateField("workingHours", e.target.value)
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              发动机类型
            </label>
            <input
              value={form.engineType || ""}
              onChange={(e) => updateField("engineType", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              额定功率(HP)
            </label>
            <input
              type="number"
              value={form.enginePower || ""}
              onChange={(e) =>
                updateField("enginePower", e.target.value)
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              传动方式
            </label>
            <input
              value={form.driveSystem || ""}
              onChange={(e) => updateField("driveSystem", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              设备状况
            </label>
            <select
              value={form.condition || "good"}
              onChange={(e) => updateField("condition", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="excellent">优秀/全新</option>
              <option value="good">良好/正常使用</option>
              <option value="fair">一般/有磨损</option>
              <option value="poor">较差/需维修</option>
            </select>
          </div>
        </div>

        {/* 规格参数（方案A重点：补齐这些空字段） */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            规格参数
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                外形长(mm)
              </label>
              <input
                type="number"
                value={form.overallLength || ""}
                onChange={(e) =>
                  updateField("overallLength", e.target.value)
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                外形宽(mm)
              </label>
              <input
                type="number"
                value={form.overallWidth || ""}
                onChange={(e) =>
                  updateField("overallWidth", e.target.value)
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                外形高(mm)
              </label>
              <input
                type="number"
                value={form.overallHeight || ""}
                onChange={(e) =>
                  updateField("overallHeight", e.target.value)
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                整机重量(KG)
              </label>
              <input
                type="number"
                value={form.netWeight || ""}
                onChange={(e) => updateField("netWeight", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                主要配置
              </label>
              <textarea
                value={form.mainConfig || ""}
                onChange={(e) => updateField("mainConfig", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                rows={2}
                placeholder="如：空调驾驶室、前配重、后三点悬挂、动力输出轴"
              />
            </div>
          </div>
        </div>

        {/* 价格 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">价格</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              价格（元）*
            </label>
            <input
              type="number"
              value={form.priceCny || ""}
              onChange={(e) => updateField("priceCny", Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t pt-4">
          <button
            onClick={() => router.back()}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}
