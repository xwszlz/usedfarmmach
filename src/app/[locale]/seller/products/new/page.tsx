"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Camera, Video, Plus, X, Sparkles } from "lucide-react";
import Link from "next/link";
import SellerAiAssistant from "@/components/seller/ai-assistant";
import SalesStrategyCard from "@/components/seller/sales-strategy-card";
import { matchPortByLocation } from "@/lib/port-matcher";

const CONDITIONS = [
  { value: "excellent", label: "优秀/全新" },
  { value: "good", label: "良好/正常使用" },
  { value: "fair", label: "一般/有磨损" },
  { value: "poor", label: "较差/需维修" },
];

const DRIVE_SYSTEMS = ["二驱", "四驱", "全液压驱动"];
const TRADE_TERMS = ["FOB", "CIF", "CFR", "EXW", "其他"];
const MAX_IMAGES = 12;

// 拍摄建议标签（不强制对应位置）
const PHOTO_SUGGESTIONS = [
  "整机全貌", "型号铭牌", "驾驶室", "发动机舱",
  "作业机构", "轮胎/底盘", "后视图", "仪表盘",
  "割台/附件", "侧面全身", "细节特写", "损伤部位",
];

export default function NewProductPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<{ id: string; nameZh: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; nameZh: string }[]>([]);

  const [brandMode, setBrandMode] = useState<"select" | "custom">("select");
  const [catMode, setCatMode] = useState<"select" | "custom">("custom");

  const [form, setForm] = useState({
    brandId: "", brandName: "", categoryId: "", categoryName: "",
    modelName: "", year: 2020, workingHours: "", condition: "good",
    priceCny: "", location: "",
    enginePower: "", engineType: "柴油发动机", driveSystem: "二驱",
    overallLength: "", overallWidth: "", overallHeight: "", netWeight: "",
    mainConfig: "", descOther: "",
    priceMode: "por", tradeTerm: "FOB", tradePort: "Qingdao",
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<{ url: string; name: string }[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aiValuation, setAiValuation] = useState<any>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/brands-categories").then(r => r.json()).then(d => {
      if (d.success) { setBrands(d.brands); setCategories(d.categories); }
    });
  }, []);

  const update = (key: string, value: any) => {
    setForm(f => ({ ...f, [key]: value }));
    if (key === "location" && value) {
      const matchedPort = matchPortByLocation(value);
      setForm(f => ({ ...f, tradePort: matchedPort }));
    }
    // 清除AI填充标记（用户手动修改了）
    setAiFilledFields(prev => { const n = new Set(prev); n.delete(key); return n; });
  };

  // ===== Step 1: 图片上传 =====
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const total = imageFiles.length + files.length;
    if (total > MAX_IMAGES) {
      setResult({ success: false, message: `最多上传 ${MAX_IMAGES} 张图片，当前已有 ${imageFiles.length} 张` });
      return;
    }

    const validFiles: File[] = [];
    files.forEach((f) => {
      if (f.size > 10 * 1024 * 1024) {
        setResult({ success: false, message: `图片 ${f.name} 超过 10MB，请压缩后上传` });
        return;
      }
      validFiles.push(f);
    });

    setImageFiles((prev) => [...prev, ...validFiles]);
    setImagePreviews((prev) => [
      ...prev,
      ...validFiles.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
    ]);
    // 清除提示
    if (result && !result.success) setResult(null);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // ===== Step 2: 视频上传 =====
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

  // ===== AI 识别回调 =====
  const handleAiFill = (data: any) => {
    const filledKeys = new Set<string>();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== "" && value !== undefined && value !== null) {
        filledKeys.add(key);
      }
    });
    setAiFilledFields(filledKeys);
    setForm((f) => ({
      ...f,
      brandName: data.brandName || f.brandName,
      modelName: data.modelName || f.modelName,
      year: data.year || f.year,
      enginePower: data.enginePower || f.enginePower,
      engineType: data.engineType || f.engineType,
      driveSystem: data.driveSystem || f.driveSystem,
      overallLength: data.overallLength || f.overallLength,
      overallWidth: data.overallWidth || f.overallWidth,
      overallHeight: data.overallHeight || f.overallHeight,
      netWeight: data.netWeight || f.netWeight,
      mainConfig: data.mainConfig || f.mainConfig,
      workingHours: data.workingHours || f.workingHours,
      condition: data.condition || f.condition,
      priceMode: data.priceMode || f.priceMode,
      tradeTerm: data.tradeTerm || f.tradeTerm,
      tradePort: data.tradePort || f.tradePort,
    }));
    if (data.brandName) setBrandMode("custom");
    setResult({ success: true, message: "AI 识别结果已填充到表单，请核对绿色标记的字段" });
  };

  // ===== 提交 =====
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
    if (imageFiles.length === 0) {
      setResult({ success: false, message: "请至少上传一张图片" });
      return;
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
      fd.append("enginePower", form.enginePower);
      fd.append("engineType", form.engineType);
      fd.append("driveSystem", form.driveSystem);
      fd.append("overallLength", form.overallLength);
      fd.append("overallWidth", form.overallWidth);
      fd.append("overallHeight", form.overallHeight);
      fd.append("netWeight", form.netWeight);
      fd.append("mainConfig", form.mainConfig);
      fd.append("descOther", form.descOther || "");
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

  // AI填充字段的高亮样式
  const fieldClass = (key: string) =>
    aiFilledFields.has(key)
      ? "w-full rounded-lg border border-green-400 bg-green-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
      : "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/zh/seller/products" className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> 返回产品列表
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">发布新产品</h1>
      <p className="mb-8 text-sm text-gray-500">
        先传图片 → 传视频 → 智能识别 → 确认参数 → 查看估值 → 发布（消耗 1 积分）
      </p>

      {/* ===== Step 1: 上传图片 ===== */}
      <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">1</span>
          <h2 className="text-base font-bold text-gray-800">上传农机图片</h2>
          <span className="text-xs text-gray-400">{imageFiles.length}/{MAX_IMAGES} 张</span>
        </div>

        {/* 拍摄建议 */}
        <div className="mb-4 flex flex-wrap gap-2">
          {PHOTO_SUGGESTIONS.map((s, i) => (
            <span key={s} className={`rounded-full px-2.5 py-1 text-[11px] ${
              i < imageFiles.length ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-400"
            }`}>
              {i < imageFiles.length && "✓ "}{s}
            </span>
          ))}
        </div>

        {/* 已上传图片网格 */}
        {imagePreviews.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {imagePreviews.map((img, idx) => (
              <div key={idx} className="relative rounded-lg border border-gray-200 bg-gray-50 p-1">
                <img src={img.url} alt={img.name} className="h-24 w-full rounded object-cover" />
                <span className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  idx === 0 ? "bg-primary-600 text-white" : "bg-gray-600 text-white"
                }`}>
                  {idx === 0 ? "封面" : `图${idx + 1}`}
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

        {/* 上传按钮 */}
        {imagePreviews.length < MAX_IMAGES && (
          <div
            onClick={() => imageInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            <Camera className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              {imagePreviews.length === 0 ? "点击上传农机图片" : "继续添加图片"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              最多 {MAX_IMAGES} 张，单张不超过 10MB。图片越多识别越准确
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

      {/* ===== Step 2: 上传视频 ===== */}
      <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">2</span>
          <h2 className="text-base font-bold text-gray-800">上传运转视频</h2>
          <span className="text-xs text-gray-400">可选，有视频估值更准</span>
        </div>

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
              <p className="mt-1 text-xs text-gray-400">MP4格式, 100MB内。建议: 绕机全景+发动机启动+作业演示+仪表展示</p>
            </>
          )}
          <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
        </div>
      </div>

      {/* ===== Step 3: 智能识别 + 估值 ===== */}
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white ${
            imageFiles.length > 0 ? "bg-primary-600" : "bg-gray-300"
          }`}>3</span>
          <h2 className="text-base font-bold text-gray-800">智能识别 + 估值</h2>
        </div>

        <SellerAiAssistant
          imageFiles={imageFiles}
          onFill={handleAiFill}
          onValuation={setAiValuation}
        />
      </div>

      {/* ===== Step 4: 确认/修正参数 ===== */}
      <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">4</span>
          <h2 className="text-base font-bold text-gray-800">确认农机参数</h2>
          {aiFilledFields.size > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
              {aiFilledFields.size} 个字段已由 AI 填充
            </span>
          )}
        </div>

        {/* 基本信息 */}
        <h3 className="mb-3 text-sm font-bold text-gray-700 border-b pb-1">基本信息</h3>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">品牌 *</label>
            <button onClick={() => { setBrandMode(brandMode === "select" ? "custom" : "select"); setForm(f => ({ ...f, brandId: "", brandName: "" })); }}
              className="text-xs text-primary-600 hover:text-primary-700">
              {brandMode === "select" ? "找不到品牌？自定义输入" : "从列表选择"}
            </button>
          </div>
          {brandMode === "select" ? (
            <select value={form.brandId} onChange={e => update("brandId", e.target.value)}
              className={fieldClass("brandId")}>
              <option value="">选择品牌</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.nameZh}</option>)}
            </select>
          ) : (
            <input value={form.brandName} onChange={e => update("brandName", e.target.value)}
              placeholder="输入品牌名称，如：克拉斯、纽荷兰、约翰迪尔"
              className={fieldClass("brandName")} />
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">品类 *</label>
            <button onClick={() => { setCatMode(catMode === "select" ? "custom" : "select"); setForm(f => ({ ...f, categoryId: "", categoryName: "" })); }}
              className="text-xs text-primary-600 hover:text-primary-700">
              {catMode === "select" ? "找不到品类？自定义输入" : "从列表选择"}
            </button>
          </div>
          {catMode === "select" ? (
            <select value={form.categoryId} onChange={e => update("categoryId", e.target.value)}
              className={fieldClass("categoryId")}>
              <option value="">选择品类</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.nameZh}</option>)}
            </select>
          ) : (
            <input value={form.categoryName} onChange={e => update("categoryName", e.target.value)}
              placeholder="输入品类名称，如：青储机、打捆机、拖拉机"
              className={fieldClass("categoryName")} />
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">型号 *</label>
          <input value={form.modelName} onChange={e => update("modelName", e.target.value)}
            placeholder="如: 970、FR450、5300RC" className={fieldClass("modelName")} />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">出厂年份 *</label>
            <input type="number" value={form.year} onChange={e => update("year", e.target.value)}
              min={1980} max={2026} className={fieldClass("year")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">成色 *</label>
            <select value={form.condition} onChange={e => update("condition", e.target.value)}
              className={fieldClass("condition")}>
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* 价格与位置 */}
        <h3 className="mb-3 mt-6 text-sm font-bold text-gray-700 border-b pb-1">价格与位置</h3>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">价格 (元) *</label>
            <input type="number" value={form.priceCny} onChange={e => update("priceCny", e.target.value)}
              placeholder="如: 1630000" className={fieldClass("priceCny")} />
            <p className="mt-1 text-xs text-gray-400">¥{form.priceCny ? (Number(form.priceCny) / 10000).toFixed(1) : "0"}万</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">位置 *</label>
            <input value={form.location} onChange={e => update("location", e.target.value)}
              placeholder="如: 河北石家庄" className={fieldClass("location")} />
          </div>
        </div>

        {/* 详细规格 */}
        <h3 className="mb-3 mt-6 text-sm font-bold text-gray-700 border-b pb-1">详细规格（推荐填写，提升曝光）</h3>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">额定马力 (HP)</label>
            <input type="number" value={form.enginePower} onChange={e => update("enginePower", e.target.value)}
              placeholder="如: 480" min={0} className={fieldClass("enginePower")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">发动机类型</label>
            <input value={form.engineType} onChange={e => update("engineType", e.target.value)}
              placeholder="柴油发动机" className={fieldClass("engineType")} />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">驱动方式</label>
            <select value={form.driveSystem} onChange={e => update("driveSystem", e.target.value)}
              className={fieldClass("driveSystem")}>
              {DRIVE_SYSTEMS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">主要配置</label>
            <input value={form.mainConfig} onChange={e => update("mainConfig", e.target.value)}
              placeholder="如: 冠军445割台, 自动导航" className={fieldClass("mainConfig")} />
          </div>
        </div>

        <p className="mb-2 text-xs text-gray-400">外形尺寸 (mm)</p>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">总长</label>
            <input type="number" value={form.overallLength} onChange={e => update("overallLength", e.target.value)}
              placeholder="mm" min={0} className={fieldClass("overallLength")} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">总宽</label>
            <input type="number" value={form.overallWidth} onChange={e => update("overallWidth", e.target.value)}
              placeholder="mm" min={0} className={fieldClass("overallWidth")} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">总高</label>
            <input type="number" value={form.overallHeight} onChange={e => update("overallHeight", e.target.value)}
              placeholder="mm" min={0} className={fieldClass("overallHeight")} />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">整机重量 (KG)</label>
          <input type="number" value={form.netWeight} onChange={e => update("netWeight", e.target.value)}
            placeholder="如: 14000" min={0} className={fieldClass("netWeight")} />
        </div>

        {/* 贸易信息 */}
        <h3 className="mb-3 mt-6 text-sm font-bold text-gray-700 border-b pb-1">贸易信息</h3>

        <div className="mb-4 grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">价格模式</label>
            <select value={form.priceMode} onChange={e => update("priceMode", e.target.value)}
              className={fieldClass("priceMode")}>
              <option value="fob">FOB（固定价格）</option>
              <option value="por">询价 (POR)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">贸易术语</label>
            <select value={form.tradeTerm} onChange={e => update("tradeTerm", e.target.value)}
              className={fieldClass("tradeTerm")}>
              {TRADE_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">发货港口</label>
            <select value={form.tradePort} onChange={e => update("tradePort", e.target.value)}
              className={fieldClass("tradePort")}>
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

        {/* 补充描述 */}
        <h3 className="mb-3 mt-6 text-sm font-bold text-gray-700 border-b pb-1">补充描述（可选）</h3>
        <textarea value={form.descOther} onChange={e => update("descOther", e.target.value)}
          rows={3} placeholder="其他需要补充的信息：维修历史、附带配件、特殊配置等"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none" />
      </div>

      {/* ===== Step 5: 估值与销售建议 ===== */}
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white ${
            form.brandName && form.priceCny ? "bg-primary-600" : "bg-gray-300"
          }`}>5</span>
          <h2 className="text-base font-bold text-gray-800">估值报告 + 销售建议</h2>
        </div>

        {/* AI 估值卡片 */}
        {aiValuation && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-800">AI 估值参考</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-white p-2">
                <p className="text-xs text-gray-500">最低</p>
                <p className="text-sm font-bold text-gray-700">
                  {aiValuation.lowEstimate > 0 ? `¥${(aiValuation.lowEstimate / 10000).toFixed(1)}万` : "--"}
                </p>
              </div>
              <div className="rounded-lg bg-primary-50 p-2">
                <p className="text-xs text-primary-600">参考价</p>
                <p className="text-base font-bold text-primary-700">
                  {aiValuation.estimatedValue > 0 ? `¥${(aiValuation.estimatedValue / 10000).toFixed(1)}万` : "--"}
                </p>
              </div>
              <div className="rounded-lg bg-white p-2">
                <p className="text-xs text-gray-500">最高</p>
                <p className="text-sm font-bold text-gray-700">
                  {aiValuation.highEstimate > 0 ? `¥${(aiValuation.highEstimate / 10000).toFixed(1)}万` : "--"}
                </p>
              </div>
            </div>
            {form.priceCny && aiValuation.estimatedValue > 0 && (
              <p className="mt-2 text-center text-xs">
                <span className={Number(form.priceCny) > aiValuation.estimatedValue * 1.1 ? "text-red-500" : Number(form.priceCny) < aiValuation.estimatedValue * 0.9 ? "text-green-500" : "text-gray-500"}>
                  {Number(form.priceCny) > aiValuation.estimatedValue * 1.1
                    ? "您的报价高于估值 10%+，建议适当下调"
                    : Number(form.priceCny) < aiValuation.estimatedValue * 0.9
                    ? "您的报价低于估值 10%+，定价有竞争力"
                    : "您的报价在合理估值范围内"}
                </span>
              </p>
            )}
          </div>
        )}

        {/* 销售策略卡片 */}
        <SalesStrategyCard
          brand={brandMode === "select" ? brands.find(b => b.id === form.brandId)?.nameZh || "" : form.brandName}
          category={catMode === "select" ? categories.find(c => c.id === form.categoryId)?.nameZh || "" : form.categoryName}
          modelName={form.modelName}
          year={Number(form.year) || undefined}
          priceCny={form.priceCny ? Number(form.priceCny) : undefined}
          condition={form.condition}
          workingHours={form.workingHours ? parseInt(form.workingHours) : undefined}
          location={form.location}
        />
      </div>

      {/* ===== 结果提示 ===== */}
      {result && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg p-3 text-sm ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {result.message}
        </div>
      )}

      {/* ===== Step 6: 提交 ===== */}
      <button onClick={handleSubmit} disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {submitting ? "发布中..." : "消耗 1 积分发布产品"}
      </button>
    </div>
  );
}
