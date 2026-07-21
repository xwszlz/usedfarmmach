"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Camera, Video, Plus, X, Sparkles } from "lucide-react";
import Link from "next/link";
import SellerAiAssistant from "@/components/seller/ai-assistant";
import { matchPortByLocation } from "@/lib/port-matcher";
import { CHINA_PROVINCES, INTERNATIONAL_COUNTRIES, findCountryInText } from "@/lib/location-data";
import { buildLocationText } from "@/lib/location-parser";

const CONDITIONS = [
  { value: "excellent", label: "优秀/全新" },
  { value: "good", label: "良好/正常使用" },
  { value: "fair", label: "一般/有磨损" },
  { value: "poor", label: "较差/需维修" },
];

const DRIVE_SYSTEMS = ["二驱", "四驱", "全液压驱动"];
const TRADE_TERMS = ["FOB", "CIF", "CFR", "EXW", "其他"];
const MAX_IMAGES_NO_VIDEO = 12;
const MAX_IMAGES_WITH_VIDEO = 5; // 有视频时图片限制，防止总大小超 4.5MB

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
  const [locationMode, setLocationMode] = useState<"domestic" | "international">("domestic");

  const [form, setForm] = useState({
    brandId: "", brandName: "", categoryId: "", categoryName: "",
    modelName: "", year: 2020, workingHours: "", condition: "good",
    priceCny: "", location: "",
    country: "CN" as string, province: "" as string, city: "" as string,
    enginePower: "", engineType: "柴油发动机", driveSystem: "二驱",
    overallLength: "", overallWidth: "", overallHeight: "", netWeight: "",
    mainConfig: "", descOther: "",
    priceMode: "por", tradeTerm: "FOB", tradePort: "天津",
    isChineseBrand: false as boolean,
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<{ url: string; name: string }[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);

  // 动态图片上限：有视频时限制 5 张，防止总大小超 4.5MB
  const maxImages = videoFiles.length > 0 ? MAX_IMAGES_WITH_VIDEO : MAX_IMAGES_NO_VIDEO;
  const [videoPreviews, setVideoPreviews] = useState<{ url: string; name: string; duration: number }[]>([]);
  const [aiTriggerVideo, setAiTriggerVideo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [aiReferencePrice, setAiReferencePrice] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/brands-categories").then(r => r.json()).then(d => {
      if (d.success) { setBrands(d.brands); setCategories(d.categories); }
    });
  }, []);

  const update = (key: string, value: any) => {
    setForm(f => {
      const newForm = { ...f, [key]: value };
      // 当产地结构化字段变化时，自动拼接 location 显示文本
      if (key === "country" || key === "province" || key === "city") {
        const locText = buildLocationText(
          key === "country" ? value : newForm.country,
          key === "province" ? value : newForm.province,
          key === "city" ? value : newForm.city
        );
        if (locText) {
          newForm.location = locText;
          // 自动匹配发货港口
          const matchedPort = matchPortByLocation(locText);
          if (matchedPort) newForm.tradePort = matchedPort;
        }
      }
      // 旧的 location 直接输入时也匹配港口
      if (key === "location" && value) {
        const matchedPort = matchPortByLocation(value);
        newForm.tradePort = matchedPort;
      }
      return newForm;
    });
    // 清除AI填充标记（用户手动修改了）
    setAiFilledFields(prev => { const n = new Set(prev); n.delete(key); return n; });
  };

  // 切换产地模式时重置相关字段
  const handleLocationModeChange = (mode: "domestic" | "international") => {
    setLocationMode(mode);
    if (mode === "domestic") {
      setForm(f => ({ ...f, country: "CN", province: "", city: "", location: "" }));
    } else {
      setForm(f => ({ ...f, country: "", province: "", city: "", location: "" }));
    }
  };

  // 省份变更时更新城市列表和 location 文本
  const handleProvinceChange = (provinceName: string) => {
    setForm(f => {
      const newForm = { ...f, province: provinceName, city: "" };
      const locText = buildLocationText("CN", provinceName, "");
      if (locText) {
        newForm.location = locText;
        const matchedPort = matchPortByLocation(locText);
        if (matchedPort) newForm.tradePort = matchedPort;
      }
      return newForm;
    });
    setAiFilledFields(prev => { const n = new Set(prev); n.delete("province"); return n; });
  };

  // 城市变更时更新 location 文本
  const handleCityChange = (cityName: string) => {
    setForm(f => {
      const newForm = { ...f, city: cityName };
      const locText = buildLocationText("CN", newForm.province, cityName);
      if (locText) {
        newForm.location = locText;
        const matchedPort = matchPortByLocation(locText);
        if (matchedPort) newForm.tradePort = matchedPort;
      }
      return newForm;
    });
    setAiFilledFields(prev => { const n = new Set(prev); n.delete("city"); return n; });
  };

  // 国际国家变更时更新 location 文本
  const handleCountryChange = (countryCode: string) => {
    setForm(f => {
      const newForm = { ...f, country: countryCode };
      const locText = buildLocationText(countryCode, "", "");
      if (locText) {
        newForm.location = locText;
      }
      return newForm;
    });
    setAiFilledFields(prev => { const n = new Set(prev); n.delete("country"); return n; });
  };

  // 获取当前选中省份的城市列表
  const currentProvinceCities = CHINA_PROVINCES.find(p => p.nameZh === form.province)?.cities || [];

  // ===== Step 1: 图片上传 =====
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const total = imageFiles.length + files.length;
    if (total > maxImages) {
      setResult({ success: false, message: `最多上传 ${maxImages} 张图片（${videoFiles.length > 0 ? "已上传视频，图片限制减少" : "当前已有 " + imageFiles.length + " 张"}）` });
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
    // 上传图片后清除视频触发（图片优先）
    if (aiTriggerVideo) setAiTriggerVideo(null);
    // 清除提示
    if (result && !result.success) setResult(null);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // ===== Step 2: 视频上传（多视频，最多3个）=====
  const MAX_VIDEOS = 3;
  const MAX_VIDEO_DURATION = 60; // 秒
  const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 检查总数
    const remaining = MAX_VIDEOS - videoFiles.length;
    if (remaining <= 0) {
      setResult({ success: false, message: `最多上传 ${MAX_VIDEOS} 个视频` });
      return;
    }

    const toAdd: File[] = [];
    const previewsToAdd: { url: string; name: string; duration: number }[] = [];

    for (const f of files.slice(0, remaining)) {
      // 校验文件大小
      if (f.size > MAX_VIDEO_SIZE) {
        setResult({ success: false, message: `视频文件不能超过 20MB（${f.name}）` });
        continue;
      }
      toAdd.push(f);
      previewsToAdd.push({
        url: URL.createObjectURL(f),
        name: f.name,
        duration: 0, // 时长在提交时通过 video 元素读取
      });
    }

    if (toAdd.length > 0) {
      setVideoFiles(prev => [...prev, ...toAdd]);
      setVideoPreviews(prev => [...prev, ...previewsToAdd]);
      // 如果没有图片，设置第一个视频作为AI触发源
      if (imageFiles.length === 0 && videoFiles.length === 0) {
        setAiTriggerVideo(toAdd[0]);
      }
    }

    // 清空 input 以便重复选择
    e.target.value = "";
  };

  const handleDeleteVideo = (idx: number) => {
    URL.revokeObjectURL(videoPreviews[idx]?.url);
    setVideoFiles(prev => prev.filter((_, i) => i !== idx));
    setVideoPreviews(prev => prev.filter((_, i) => i !== idx));
    if (idx === 0 && videoFiles.length === 1) {
      setAiTriggerVideo(null);
    }
  };

  // 读取视频时长
  const getVideoDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve(Math.round(video.duration) || 0);
      };
      video.onerror = () => resolve(0);
      video.src = url;
    });
  };

  // ===== AI 识别回调 =====
  const handleAiFill = (data: any) => {
    const filledKeys = new Set<string>();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== "" && value !== undefined && value !== null) {
        filledKeys.add(key);
      }
    });

    // ── 品类匹配：优先匹配数据库已有 Category，匹配不到则回退自定义输入 ──
    let matchedCategoryId = "";
    let matchedCategoryName = "";
    let nextCatMode: "select" | "custom" = "custom";
    if (data.category) {
      const matched = categories.find((c) => c.nameZh === data.category);
      if (matched) {
        matchedCategoryId = matched.id;
        matchedCategoryName = matched.nameZh;
        nextCatMode = "select";
        filledKeys.add("categoryId");
        filledKeys.add("categoryName");
      } else {
        // 模糊匹配（包含关系），提升命中率
        const fuzzy = categories.find(
          (c) => c.nameZh.includes(data.category) || data.category.includes(c.nameZh)
        );
        if (fuzzy) {
          matchedCategoryId = fuzzy.id;
          matchedCategoryName = fuzzy.nameZh;
          nextCatMode = "select";
          filledKeys.add("categoryId");
          filledKeys.add("categoryName");
        } else {
          matchedCategoryName = data.category;
          nextCatMode = "custom";
          filledKeys.add("categoryName");
        }
      }
    }
    setAiFilledFields(filledKeys);

    // ── 产地：后端已结构化为 country(ISO code)/province/city ──
    // 兼容后端偶发返回国家名的情况，统一转为 ISO code
    let countryCode = data.country || "";
    if (countryCode && countryCode !== "CN" && countryCode.length > 2) {
      const countryData = findCountryInText(countryCode);
      if (countryData) countryCode = countryData.code;
    }
    const aiProvince = data.province || "";
    const aiCity = data.city || "";
    const isDomestic = countryCode === "CN" || (!countryCode && !!aiProvince);
    const effectiveCountry = isDomestic ? "CN" : countryCode;
    const locText = buildLocationText(effectiveCountry, aiProvince, aiCity);

    setForm((f) => {
      const newForm = {
        ...f,
        brandName: data.brandName || f.brandName,
        modelName: data.modelName || f.modelName,
        categoryId: matchedCategoryId || f.categoryId,
        categoryName: matchedCategoryName || f.categoryName,
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
        // 后端已将港口归一化为中文标准港口名
        tradePort: data.tradePort || f.tradePort,
        isChineseBrand: data.isChineseBrand ?? f.isChineseBrand,
        country: effectiveCountry || f.country,
        province: isDomestic ? aiProvince : "",
        city: isDomestic ? aiCity : "",
        location: locText || f.location,
        // 注意：价格 (priceCny) 不由 AI 填充，参考价格仅在 AI 识别结果面板展示
      };
      // 国内且有省份：按省份精确匹配最近港口（优先于后端推断）
      if (isDomestic && aiProvince && locText) {
        newForm.tradePort = matchPortByLocation(locText);
      }
      return newForm;
    });

    // 品类模式切换
    if (data.category) setCatMode(nextCatMode);

    // 参考价格仅存储，不填入价格输入框
    if (data.referencePrice) {
      setAiReferencePrice(data.referencePrice);
    }

    // 产地模式切换
    if (!isDomestic && effectiveCountry) {
      setLocationMode("international");
    } else if (isDomestic) {
      setLocationMode("domestic");
    }

    if (data.brandName) setBrandMode("custom");
    setResult({ success: true, message: `AI 识别结果已填充到表单${data.isChineseBrand ? "（国内农机）" : "（国际农机）"}，请核对绿色标记的字段` });
  };

  // ===== Canvas 图片压缩（避免超过 Vercel 4.5MB 请求体限制）=====
  // 策略：先按 1024px/quality0.6 压；如果仍 >1MB，二次压到 800px/quality0.5
  const compressImageOnce = (file: File, maxDim: number, quality: number): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height / width) * maxDim);
            width = maxDim;
          } else {
            width = Math.round((width / height) * maxDim);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
              resolve(compressed);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const compressImage = async (file: File, hasVideo: boolean): Promise<File> => {
    if (file.size < 200 * 1024) return file; // <200KB 不压
    // 有视频时压更狠：视频占 3-4MB，5张图必须 < 0.5MB 总量
    const maxDim = hasVideo ? 600 : 1024;
    const quality = hasVideo ? 0.45 : 0.6;
    let compressed = await compressImageOnce(file, maxDim, quality);
    if (compressed.size > 500 * 1024) {
      compressed = await compressImageOnce(compressed, hasVideo ? 480 : 800, hasVideo ? 0.4 : 0.5);
    }
    return compressed;
  };

  // ===== 提交 =====
  const handleSubmit = async () => {
    if (!form.modelName || !form.priceCny) {
      setResult({ success: false, message: "请填写完整信息（型号、价格为必填）" });
      return;
    }
    // 产地校验：国内需选择省份，国际需选择国家
    if (locationMode === "domestic" && !form.province) {
      setResult({ success: false, message: "请选择产地省份" });
      return;
    }
    if (locationMode === "international" && !form.country) {
      setResult({ success: false, message: "请选择产地国家" });
      return;
    }
    if (!form.location) {
      setResult({ success: false, message: "产地信息不完整" });
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
      fd.append("country", form.country);
      fd.append("province", form.province);
      fd.append("city", form.city);
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
      fd.append("isChineseBrand", String(form.isChineseBrand));

      // 压缩图片后再上传（避免超过 Vercel 4.5MB 请求体限制）
      const hasVideo = videoFiles.length > 0;
      setResult({ success: false, message: "正在压缩图片..." });
      const compressedImages: File[] = [];
      for (const f of imageFiles) {
        const compressed = await compressImage(f, hasVideo);
        compressedImages.push(compressed);
      }
      const totalImageSize = compressedImages.reduce((sum, f) => sum + f.size, 0);

      // 校验视频文件大小和时长
      const videoDurations: number[] = [];
      for (let i = 0; i < videoPreviews.length; i++) {
        const dur = await getVideoDuration(videoPreviews[i].url);
        videoDurations.push(dur);
        if (dur > MAX_VIDEO_DURATION) {
          setResult({ success: false, message: `视频时长不能超过 ${MAX_VIDEO_DURATION} 秒（${videoPreviews[i].name}）` });
          return;
        }
      }

      const totalVideoSize = videoFiles.reduce((sum, f) => sum + f.size, 0);
      // 单视频不能超过 3.5MB（否则5张图没空间了）
      if (hasVideo && videoFiles.some(f => f.size > 3.5 * 1024 * 1024)) {
        setResult({ success: false, message: "已上传视频，单个视频不能超过 3.5MB，请先压缩视频（建议用微信转发给自己再保存，可大幅压缩）" });
        return;
      }
      const totalSize = totalImageSize + totalVideoSize;
      // Vercel serverless body 限制约 4.5MB，提到硬顶，靠图片压缩保证不超
      if (totalSize > 4.5 * 1024 * 1024) {
        setResult({ success: false, message: `上传数据过大（${(totalSize / 1024 / 1024).toFixed(1)}MB），请减少图片数量或先压缩视频后再重试` });
        return;
      }

      compressedImages.forEach((f) => fd.append("images", f));
      videoFiles.forEach((f) => fd.append("videos", f));
      if (videoDurations.length > 0) {
        fd.append("videoDurations", JSON.stringify(videoDurations));
      }

      const res = await fetch("/api/seller/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      let data;
      try {
        data = await res.json();
      } catch {
        data = { success: false, error: `服务器返回异常（HTTP ${res.status}）` };
      }

      if (data.success) {
        setResult({ success: true, message: `发布成功！剩余 ${data.creditsRemaining} 积分` });
        setTimeout(() => router.push("/zh/seller/products"), 2500);
      } else if (res.status === 401) {
        setResult({ success: false, message: "请先登录后再发布" });
      } else if (res.status === 403) {
        setResult({ success: false, message: `积分不足！当前 ${data.credits} 积分` });
      } else if (res.status === 413) {
        setResult({ success: false, message: "上传数据过大，请减少图片数量或压缩后重试" });
      } else {
        setResult({ success: false, message: data.error || `发布失败（HTTP ${res.status}）` });
      }
    } catch (err: any) {
      console.error("[Publish] 发布失败:", err);
      const errMsg = err?.message || String(err) || "未知错误";
      setResult({
        success: false,
        message: errMsg.includes("fetch") || errMsg.includes("Failed to fetch")
          ? "网络连接失败，请检查网络后重试（若反复出现，可能是上传文件过大）"
          : `发布异常：${errMsg.substring(0, 100)}`,
      });
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
        先传图片 → 传视频 → 智能识别 → 确认参数 → 发布（消耗 1 积分） v0722
      </p>

      {/* ===== Step 1: 上传图片 ===== */}
      <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">1</span>
          <h2 className="text-base font-bold text-gray-800">上传农机图片</h2>
          <span className="text-xs text-gray-400">{imageFiles.length}/{maxImages} 张{videoFiles.length > 0 && "（已上传视频，限5张）"}</span>
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
        {imagePreviews.length < maxImages && (
          <div
            onClick={() => imageInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            <Camera className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              {imagePreviews.length === 0 ? "点击上传农机图片" : "继续添加图片"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              最多 {maxImages} 张{videoFiles.length > 0 ? "（已上传视频，图片压缩更狠）" : "，单张不超过 10MB。图片越多识别越准确"}
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

      {/* ===== Step 2: 上传运转视频（最多3个）===== */}
      <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">2</span>
          <h2 className="text-base font-bold text-gray-800">上传运转视频</h2>
          <span className="text-xs text-gray-400">可选，最多3个，60秒/20MB内{videoFiles.length > 0 && " ⚠️ 有视频时图片限5张"}</span>
        </div>

        {/* 已选视频列表 */}
        {videoPreviews.length > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {videoPreviews.map((vp, idx) => (
              <div key={idx} className="relative">
                <video src={vp.url} controls className="w-full max-h-48 rounded-lg" />
                <p className="mt-1 text-center text-xs text-gray-500">
                  {vp.name} ({(videoFiles[idx]?.size / 1024 / 1024 || 0).toFixed(1)}MB)
                </p>
                <button onClick={() => handleDeleteVideo(idx)}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 上传按钮（未满3个时显示） */}
        {videoFiles.length < MAX_VIDEOS && (
          <div
            onClick={() => videoInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            <Video className="mb-2 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              点击上传视频（{videoFiles.length}/{MAX_VIDEOS}）
            </p>
            <p className="mt-1 text-xs text-gray-400">MP4格式，60秒内，20MB内。建议: 绕机全景+发动机启动+作业演示</p>
          </div>
        )}
        <input ref={videoInputRef} type="file" accept="video/*" multiple onChange={handleVideoSelect} className="hidden" />
      </div>

      {/* ===== Step 3: 智能识别 ===== */}
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white ${
            imageFiles.length > 0 ? "bg-primary-600" : "bg-gray-300"
          }`}>3</span>
          <h2 className="text-base font-bold text-gray-800">AI 智能识别</h2>
        </div>

        <SellerAiAssistant
          imageFiles={imageFiles}
          videoFile={aiTriggerVideo}
          onFill={handleAiFill}
          autoTrigger={true}
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
            {form.priceCny && Number(form.priceCny) > 0 && Number(form.priceCny) < 1000 && (
              <p className="mt-1 text-xs text-red-500">
                ⚠️ 价格过低，请确认单位为元（如 16 万请填 160000）
              </p>
            )}
            {aiReferencePrice !== null && aiReferencePrice > 0 && (
              <p className="mt-1 text-xs text-blue-500">
                AI参考价格: ¥{aiReferencePrice.toLocaleString()} ({(aiReferencePrice / 10000).toFixed(1)}万)
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">产地 *</label>
            {/* 国内/国际切换 */}
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleLocationModeChange("domestic")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  locationMode === "domestic"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                国内
              </button>
              <button
                type="button"
                onClick={() => handleLocationModeChange("international")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  locationMode === "international"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                国际
              </button>
            </div>
            {/* 国内：省/市选择器 */}
            {locationMode === "domestic" ? (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.province}
                  onChange={e => handleProvinceChange(e.target.value)}
                  className={fieldClass("province")}
                >
                  <option value="">选择省份</option>
                  {CHINA_PROVINCES.map(p => (
                    <option key={p.nameZh} value={p.nameZh}>{p.nameZh}</option>
                  ))}
                </select>
                <select
                  value={form.city}
                  onChange={e => handleCityChange(e.target.value)}
                  disabled={!form.province}
                  className={fieldClass("city")}
                >
                  <option value="">选择城市</option>
                  {currentProvinceCities.map(c => (
                    <option key={c.nameZh} value={c.nameZh}>{c.nameZh}</option>
                  ))}
                </select>
              </div>
            ) : (
              /* 国际：国家选择器 */
              <select
                value={form.country}
                onChange={e => handleCountryChange(e.target.value)}
                className={fieldClass("country")}
              >
                <option value="">选择国家</option>
                {INTERNATIONAL_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.nameZh}</option>
                ))}
              </select>
            )}
            {/* 显示自动生成的 location 文本 */}
            {form.location && (
              <p className="mt-1 text-xs text-gray-400">产地：{form.location}</p>
            )}
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
              <option value="青岛港">青岛港</option>
              <option value="上海港">上海港</option>
              <option value="天津港">天津港</option>
              <option value="广州港">广州港</option>
              <option value="连云港">连云港</option>
              <option value="宁波港">宁波港</option>
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
