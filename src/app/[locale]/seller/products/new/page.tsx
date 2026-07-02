"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Upload, Camera, Video, Image, Plus, X } from "lucide-react";
import Link from "next/link";
import SellerAiAssistant from "@/components/seller/ai-assistant";

const CONDITIONS = [
  { value: "excellent", label: "优秀/全新" },
  { value: "good", label: "良好/正常使用" },
  { value: "fair", label: "一般/有磨损" },
  { value: "poor", label: "较差/需维修" },
];

const DRIVE_SYSTEMS = ["二驱", "四驱", "全液压驱动"];
const TRADE_TERMS = ["FOB", "CIF", "CFR", "EXW", "其他"];
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
    // 详细规格（与 Prisma schema 一致，不使用废弃旧字段名）
    enginePower: "", engineType: "柴油发动机", driveSystem: "二驱",
    overallLength: "", overallWidth: "", overallHeight: "", netWeight: "",
    mainConfig: "", condition: "good",
    // 贸易信息
    priceMode: "por", tradeTerm: "FOB", tradePort: "Qingdao",
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<{ url: string; name: string }[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/brands-categories").then(r => r.json()).then(d => {
      if (d.success) { setBrands(d.brands); setCategories(d.categories); }
    });
  }, []);

  const update = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 最多 8 张
    const total = imageFiles.length + files.length;
    if (total > 8) {
      setResult({ success: false, message: `最多上传 8 张图片，当前已有 ${imageFiles.length} 张` });
      return;
    }

    // 验证每张图
    const validFiles: File[] = [];
    files.forEach((f) => {
      if (f.size > 10 * 1024 * 1024) {
        setResult({ success: false, message: `图片 ${f.name} 超过 10MB，请压缩后上传` });
        return;
      }
      validFiles.push(f);
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (ratio < 1.0 || ratio > 2.5) {
          setResult({ success: false, message: `图片 ${f.name} 比例建议 4:3 ~ 16:9。当前约 ${ratio.toFixed(2)}` });
        }
      };
      img.src = URL.createObjectURL(f);
    });

    setImageFiles((prev) => [...prev, ...validFiles]);
    setImagePreviews((prev) => [
      ...prev,
      ...validFiles.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
    ]);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
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
      fd.append("workingHours", "");
      fd.append("condition", form.condition);
      fd.append("priceCny", form.priceCny);
      fd.append("location", form.location);
      // 新规格字段（与 Prisma schema 一致）
      fd.append("enginePower", form.enginePower);
      fd.append("engineType", form.engineType);
      fd.append("driveSystem", form.driveSystem);
      fd.append("overallLength", form.overallLength);
      fd.append("overallWidth", form.overallWidth);
      fd.append("overallHeight", form.overallHeight);
      fd.append("netWeight", form.netWeight);
      fd.append("mainConfig", form.mainConfig);
      fd.append("descOther", form.descOther || "");
      // 贸易信息
      fd.append("priceMode", form.priceMode);
      fd.append("tradeTerm", form.tradeTerm);
      fd.append("tradePort", form.tradePort);
      imageFiles.forEach((f) => fd.append("images", f));
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

      {/* AI 拍照识别助手 */}
      <div className="mb-8">
        <SellerAiAssistant
          onFill={(data) => {
            setForm((f) => ({
              ...f,
              brandName: data.brandName,
              modelName: data.modelName,
              year: data.year,
              workingHours: data.workingHours,
              condition: data.condition,
            }));
            // 如果有品牌名，尝试切换到自定义品牌模式
            if (data.brandName) {
              setBrandMode("custom");
            }
          }}
        />
      </div>

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

        {/* ====== 价格与位置 ====== */
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

        {/* ====== 产品图片 ====== */}
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">产品图片（整机和关键部位）</h2>

        <div className="space-y-3">
          {/* 已上传图片网格 */}
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {imagePreviews.map((img, idx) => (
                <div key={idx} className="relative rounded-lg border border-gray-200 bg-gray-50 p-1">
                  <img src={img.url} alt={img.name} className="h-24 w-full rounded object-cover" />
                  {/* 标签：第1张封面，其余细节 */}
                  <span className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${idx === 0 ? "bg-primary-600 text-white" : "bg-gray-600 text-white"}`}>
                    {idx === 0 ? "封面" : "细节"}
                  </span>
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 继续添加按钮 */}
          {imagePreviews.length < 8 && (
            <div
              onClick={() => imageInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors hover:border-primary-400 hover:bg-primary-50"
            >
              <Camera className="mb-1 h-6 w-6 text-gray-300" />
              <p className="text-xs font-medium text-gray-600">
                {imagePreviews.length === 0 ? "点击上传产品图片" : "继续添加图片"}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                建议拍摄：整机全貌、发动机、割台、驾驶室、轮胎/履带
              </p>
              <p className="text-[11px] text-gray-400">
                {imagePreviews.length}/8 张，单张不超过 10MB
              </p>
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
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

        {/* ====== 详细规格 ====== */}
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">详细规格（推荐填写，提升曝光）</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">额定马力 (HP)</label>
            <input type="number" value={form.enginePower} onChange={e => update("enginePower", e.target.value)}
              placeholder="如: 480" min={0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">发动机类型</label>
            <input value={form.engineType} onChange={e => update("engineType", e.target.value)}
              placeholder="柴油发动机"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">驱动方式</label>
            <select value={form.driveSystem} onChange={e => update("driveSystem", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none">
              {DRIVE_SYSTEMS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">成色 *</label>
            <select value={form.condition} onChange={e => update("condition", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none">
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">主要配置</label>
            <input value={form.mainConfig} onChange={e => update("mainConfig", e.target.value)}
              placeholder="如: 冠军445割台, 自动导航"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div></div>
        </div>

        <p className="text-xs text-gray-400 -mt-2">外形尺寸 (mm)</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">总长</label>
            <input type="number" value={form.overallLength} onChange={e => update("overallLength", e.target.value)}
              placeholder="mm" min={0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">总宽</label>
            <input type="number" value={form.overallWidth} onChange={e => update("overallWidth", e.target.value)}
              placeholder="mm" min={0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">总高</label>
            <input type="number" value={form.overallHeight} onChange={e => update("overallHeight", e.target.value)}
              placeholder="mm" min={0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">整机重量 (KG)</label>
          <input type="number" value={form.netWeight} onChange={e => update("netWeight", e.target.value)}
            placeholder="如: 14000" min={0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
        </div>

        {/* ====== 贸易信息 ====== */}
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">贸易信息</h2>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">价格模式</label>
            <select value={form.priceMode} onChange={e => update("priceMode", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none">
              <option value="fob">FOB（固定价格）</option>
              <option value="por">询价 (POR)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">贸易术语</label>
            <select value={form.tradeTerm} onChange={e => update("tradeTerm", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none">
              {TRADE_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">发货港口</label>
            <select value={form.tradePort} onChange={e => update("tradePort", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none">
              <option value="青岛">青岛</option>
              <option value="上海">上海</option>
              <option value="天津">天津</option>
              <option value="广州">广州</option>
              <option value="连云港">连云港</option>
              <option value="宁波">宁波</option>
              <option value="其他">其他</option>
            </select>
          </div>
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
