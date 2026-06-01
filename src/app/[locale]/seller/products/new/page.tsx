"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

const CONDITIONS = [
  { value: "excellent", label: "优秀" },
  { value: "good", label: "良好" },
  { value: "fair", label: "一般" },
  { value: "poor", label: "较差" },
];

export default function NewProductPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<{ id: string; nameZh: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; nameZh: string }[]>([]);

  const [form, setForm] = useState({
    brandId: "", categoryId: "", modelName: "", year: 2020,
    workingHours: "", condition: "good", priceCny: "", location: "", descriptionZh: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    // 获取品牌和品类数据
    fetch("/api/brands-categories")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBrands(d.brands);
          setCategories(d.categories);
        }
      });
  }, []);

  // 还需要一个 API 来获取 brands/categories
  // 如果没有这个 API，用硬编码的
  useEffect(() => {
    if (brands.length === 0) {
      setBrands([
        {id:"claas",nameZh:"克拉斯"},{id:"krone",nameZh:"克罗尼"},{id:"new-holland",nameZh:"纽荷兰"},
        {id:"john-deere",nameZh:"约翰迪尔"},{id:"fendt",nameZh:"芬特"},{id:"case-ih",nameZh:"凯斯"},
        {id:"kuhn",nameZh:"库恩"},{id:"massey-ferguson",nameZh:"麦赛弗格森"},{id:"dongfanghong",nameZh:"东方红"},
        {id:"dexiang",nameZh:"德翔"},{id:"grain",nameZh:"格兰"},{id:"grimme",nameZh:"格立莫"},
      ]);
    }
    if (categories.length === 0) {
      setCategories([
        {id:"forage-harvester",nameZh:"青储机"},{id:"baler",nameZh:"打捆机"},{id:"tractor",nameZh:"拖拉机"},
        {id:"mower",nameZh:"割草机"},{id:"seeder",nameZh:"播种机"},{id:"wrapper",nameZh:"裹包机"},
        {id:"rake",nameZh:"搂草机"},{id:"stone-picker",nameZh:"捡石机"},{id:"harvester",nameZh:"收获机"},
      ]);
    }
  }, []);

  const handleSubmit = async () => {
    if (!form.brandId || !form.categoryId || !form.modelName || !form.priceCny || !form.location) {
      setResult({ success: false, message: "请填写完整信息（品牌、品类、型号、价格、位置为必填）" });
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/seller/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          workingHours: form.workingHours ? Number(form.workingHours) : undefined,
          priceCny: Number(form.priceCny),
        }),
      });
      const data = await res.json();

      if (data.success) {
        setResult({ success: true, message: `发布成功！剩余 ${data.creditsRemaining} 积分` });
        setTimeout(() => router.push("/zh/seller/products"), 2000);
      } else if (res.status === 401) {
        setResult({ success: false, message: "请先登录后再发布" });
      } else if (res.status === 403) {
        setResult({ success: false, message: `积分不足！当前 ${data.credits} 积分，发布需 ${data.required} 积分` });
      } else {
        setResult({ success: false, message: data.error || "发布失败" });
      }
    } catch {
      setResult({ success: false, message: "网络错误" });
    } finally {
      setSubmitting(false);
    }
  };

  const update = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/zh/seller/products" className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> 返回产品列表
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">发布新产品</h1>
      <p className="mb-8 text-sm text-gray-500">发布将消耗 1 积分</p>

      <div className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
        {/* 品牌 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">品牌 *</label>
          <select value={form.brandId} onChange={(e) => update("brandId", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
            <option value="">选择品牌</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.nameZh}</option>)}
          </select>
        </div>

        {/* 品类 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">品类 *</label>
          <select value={form.categoryId} onChange={(e) => update("categoryId", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
            <option value="">选择品类</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nameZh}</option>)}
          </select>
        </div>

        {/* 型号 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">型号 *</label>
          <input value={form.modelName} onChange={(e) => update("modelName", e.target.value)}
            placeholder="如: 970、FR450、5300RC"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
        </div>

        {/* 年份 + 工时 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">年份 *</label>
            <input type="number" value={form.year} onChange={(e) => update("year", e.target.value)}
              min={1990} max={2026}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">工时 (可选)</label>
            <input type="number" value={form.workingHours} onChange={(e) => update("workingHours", e.target.value)}
              placeholder="如: 5000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
        </div>

        {/* 成色 + 价格 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">成色 *</label>
            <select value={form.condition} onChange={(e) => update("condition", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">价格 (元) *</label>
            <input type="number" value={form.priceCny} onChange={(e) => update("priceCny", e.target.value)}
              placeholder="如: 1630000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
        </div>

        {/* 位置 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">位置 *</label>
          <input value={form.location} onChange={(e) => update("location", e.target.value)}
            placeholder="如: 河北、山东"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
        </div>

        {/* 描述 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">产品描述 (可选)</label>
          <textarea value={form.descriptionZh} onChange={(e) => update("descriptionZh", e.target.value)}
            rows={3} placeholder="描述产品状况、配置等"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
        </div>

        {/* 提示信息 */}
        {result && (
          <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>
            {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {result.message}
          </div>
        )}

        {/* 提交按钮 */}
        <button onClick={handleSubmit} disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "发布中..." : "消耗 1 积分发布产品"}
        </button>
      </div>
    </div>
  );
}
