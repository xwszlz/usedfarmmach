"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Upload, Camera, Video, Image, Plus, X } from "lucide-react";
import Link from "next/link";

const CONDITIONS = [
  { value: "excellent", label: "优秀/全新" },
  { value: "good", label: "良好/正常使用" },
  { value: "fair", label: "一般/有磨损" },
  { value: "poor", label: "较差/需维修" },
];

const DRIVE_TYPES = ["二驱", "四驱", "其他"];
const COVER_ASPECT_RATIO = 16 / 9;

export default function NewProductPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<{ id: string; nameZh: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; nameZh: string }[]>([]);

  // 品牌/品类切换
  const [brandMode, setBrandMode] = useState<"select" | "custom">("select");
  const [catMode, setCatMode] = useState<"select" | "custom">("custom");

  const [form, setForm] = useState({
    brandId: "", brandName: "", categoryId: "", categoryName: "",
    modelName: "", year: 2020, workingHours: "", condition: "good",
    priceCny: "", location: "",
    // 结构化描述
    descPower: "", descDrive: "二驱", descHeader: "",
    descEngineHours: "", descRollerHours: "", descOther: "",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/brands-categories").then(r => r.json()).then(d => {
      if (d.success) { setBrands(d.brands); setCategories(d.categories); }
    });
  }, []);

  const update = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // 验证图片尺寸比例
    const img = new window.Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      if (ratio < 1.5 || ratio > 2.0) {
        setResult({ success: false, message: "封面图建议 16:9 比例（如 1920×1080）。当前宽高比约 " + ratio.toFixed(2) });
      }
    };
    img.src = URL.createObjectURL(f);
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 100 * 1024 * 1024) {
      setResult({ success: false, message: "视频文件过大，请压缩至 100MB 以下" });
      return;
    }
    setVideoFile(f);
    setVideoPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!form.modelName || !form.priceCny || !form.location) {
      setResult({ success: false, message: "请填写完整信息（型号、价格、位置为必填）" });
      return;
    }
    if (brandMode === "select" && !form.brandId) {
      setResult({ success: false, message: "请选择品牌" }); return;
    }
    if (brandMode === "custom" && !form.brandName) {
      setResult({ success: false, message: "请输入自定义品牌" }); return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("brandId", form.brandId);
      fd.append("brandName", form.brandName);
      fd.append("categoryId", form.categoryId);
      fd.append("categoryName", form.categoryName || "其他");
      fd.append("modelName", form.modelName);
      fd.append("year", String(form.year));
      fd.append("workingHours", form.workingHours);
      fd.append("condition", form.condition);
      fd.append("priceCny", form.priceCny);
      fd.append("location", form.location);
      fd.append("descPower", form.descPower);
      fd.append("descDrive", form.descDrive);
      fd.append("descHeader", form.descHeader);
      fd.append("descEngineHours", form.descEngineHours);
      fd.append("descRollerHours", form.descRollerHours);
      fd.append("descOther", form.descOther);
      if (coverFile) fd.append("coverImage", coverFile);
      if (videoFile) fd.append("video", videoFile);

      const res = await fetch("/api/seller/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();

      if (data.success) {
        setResult({ success: true, message: `发布成功！剩余 ${data.creditsRemaining} 积分` });
        setTimeout(() => router.push("/zh/seller/products"), 2000);
      } else if (res.status === 401) {
        setResult({ success: false, message: "请先登录后再发布" });
      } else if (res.status === 403) {
        setResult({ success: false, message: `积分不足！当前 ${data.credits} 积分` });
      } else {
        setResult({ success: false, message: data.error || "发布失败" });
      }
    } catch {
      setResult({ success: false, message: "网络错误" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/zh/seller/products" className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> 返回产品列表
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">发布新产品</h1>
      <p className="mb-8 text-sm text-gray-500">发布消耗 1 积分。支持自定义品牌/品类，上传 16:9 封面图和运转视频</p>

      <div className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
        {/* ====== 基本信息 ====== */}
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">基本信息</h2>

        {/* 品牌 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">品牌 *</label>
            <button onClick={() => { setBrandMode(brandMode === "select" ? "custom" : "select"); setForm(f => ({ ...f, brandId: "", brandName: "" })); }}
              className="text-xs text-primary-600 hover:text-primary-700">
              {brandMode === "select" ? "找不到品牌？自定义输入" : "从列表选择"}
            </button>
          </div>
          {brandMode === "select" ? (
            <select value={form.brandId} onChange={e => update("brandId", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none">
              <option value="">选择品牌</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.nameZh}</option>)}
            </select>
          ) : (
            <input value={form.brandName} onChange={e => update("brandName", e.target.value)}
              placeholder="输入品牌名称，如：克拉斯、纽荷兰、约翰迪尔"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
          )}
        </div>

        {/* 品类 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">品类 *</label>
            <button onClick={() => { setCatMode(catMode === "select" ? "custom" : "select"); setForm(f => ({ ...f, categoryId: "", categoryName: "" })); }}
              className="text-xs text-primary-600 hover:text-primary-700">
              {catMode === "select" ? "找不到品类？自定义输入" : "从列表选择"}
            </button>
          </div>
          {catMode === "select" ? (
            <select value={form.categoryId} onChange={e => update("categoryId", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none">
              <option value="">选择品类</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.nameZh}</option>)}
            </select>
          ) : (
            <input value={form.categoryName} onChange={e => update("categoryName", e.target.value)}
              placeholder="输入品类名称，如：青储机、打捆机、拖拉机"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
          )}
        </div>

        {/* 型号 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">型号 *</label>
          <input value={form.modelName} onChange={e => update("modelName", e.target.value)}
            placeholder="如: 970、FR450、5300RC"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
        </div>

        {/* 年份 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">出厂年份 *</label>
          <input type="number" value={form.year} onChange={e => update("year", e.target.value)}
            min={1980} max={2026}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
        </div>

        {/* ====== 核心参数 ====== */}
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">核心参数</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">马力 (HP)</label>
            <input value={form.descPower} onChange={e => update("descPower", e.target.value)}
              placeholder="如: 400" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">驱动方式</label>
            <select value={form.descDrive} onChange={e => update("descDrive", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none">
              {DRIVE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">发动机小时数</label>
            <input value={form.descEngineHours} onChange={e => update("descEngineHours", e.target.value)}
              placeholder="如: 4600" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">轧辊/工作小时数</label>
            <input value={form.descRollerHours} onChange={e => update("descRollerHours", e.target.value)}
              placeholder="如: 3250" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">割台型号及宽度</label>
            <input value={form.descHeader} onChange={e => update("descHeader", e.target.value)}
              placeholder="如: 冠军445 4.5米" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">成色 *</label>
            <select value={form.condition} onChange={e => update("condition", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none">
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* ====== 价格与位置 ====== */}
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">价格与位置</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">价格 (元) *</label>
            <input type="number" value={form.priceCny} onChange={e => update("priceCny", e.target.value)}
              placeholder="如: 1630000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
            <p className="mt-1 text-xs text-gray-400">¥{form.priceCny ? (Number(form.priceCny) / 10000).toFixed(1) : "0"}万</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">位置 *</label>
            <input value={form.location} onChange={e => update("location", e.target.value)}
              placeholder="如: 河北石家庄"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
        </div>

        {/* ====== 封面图（16:9） ====== */}
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">封面图（建议 16:9）</h2>

        <div
          onClick={() => coverInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:border-primary-400 hover:bg-primary-50"
          style={coverPreview ? { minHeight: 200 } : {}}
        >
          {coverPreview ? (
            <div className="relative w-full">
              <img src={coverPreview} alt="封面预览" className="mx-auto max-h-64 rounded-lg object-contain" style={{ aspectRatio: "16/9" }} />
              <button onClick={(e) => { e.stopPropagation(); setCoverFile(null); setCoverPreview(""); }}
                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              <Camera className="mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">点击上传 16:9 封面图</p>
              <p className="mt-1 text-xs text-gray-400">推荐尺寸 1920×1080 像素，JPEG/PNG</p>
            </>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
        </div>

        {/* ====== 运转视频 ====== */}
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">农机运转/全貌视频</h2>

        <div
          onClick={() => videoInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:border-primary-400 hover:bg-primary-50"
        >
          {videoPreview ? (
            <div className="relative w-full">
              <video src={videoPreview} controls className="mx-auto max-h-64 rounded-lg" />
              <p className="mt-2 text-center text-xs text-gray-500">{videoFile?.name} ({(videoFile!.size / 1024 / 1024).toFixed(1)}MB)</p>
              <button onClick={(e) => { e.stopPropagation(); setVideoFile(null); setVideoPreview(""); }}
                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              <Video className="mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">点击上传运转视频</p>
              <p className="mt-1 text-xs text-gray-400">MP4 格式，100MB 以内。拍摄整机全貌和运转状态</p>
            </>
          )}
          <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
        </div>

        {/* ====== 补充描述 ====== */}
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">补充描述（可选）</h2>

        <div>
          <textarea value={form.descOther} onChange={e => update("descOther", e.target.value)}
            rows={3} placeholder="其他需要补充的信息：维修历史、附带配件、特殊配置等"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
        </div>

        {/* ====== 结果提示 ====== */}
        {result && (
          <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {result.message}
          </div>
        )}

        {/* ====== 提交 ====== */}
        <button onClick={handleSubmit} disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {submitting ? "发布中..." : "消耗 1 积分发布产品"}
        </button>
      </div>
    </div>
  );
}
