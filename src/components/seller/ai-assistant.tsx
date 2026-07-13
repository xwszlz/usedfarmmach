"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Wand2, CheckCircle, AlertCircle, Loader2, Upload, Globe, Flag } from "lucide-react";

/**
 * AI 识别结果数据结构（与后端 /api/agents/seller-helper/recognize 返回的 data 一致）
 *
 * 字段说明：
 * - category: 品类名称（如 拖拉机/收割机/打捆机），后端从图片识别得到
 * - location: 产地显示文本（如 "山东潍坊" / "德国"），后端已解析
 * - country/province/city: 产地结构化字段（country 为 ISO code，如 CN/DE）
 * - referencePrice: 参考价格（人民币元），仅展示，不回填表单价格输入框
 */
interface AiRecognizedData {
  brand: string | null;
  modelName: string | null;
  year: number | null;
  enginePower: string | null;
  engineType: string | null;
  driveSystem: string | null;
  overallLength: string | null;
  overallWidth: string | null;
  overallHeight: string | null;
  netWeight: string | null;
  mainConfig: string | null;
  workingHours: number | null;
  condition: string | null;
  priceMode: string | null;
  tradeTerm: string | null;
  tradePort: string | null;
  isChineseBrand: boolean;
  confidence: number;
  // ── 新增字段 ──
  category: string | null;
  location: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  referencePrice: number | null;
}

interface SellerAiAssistantProps {
  imageFiles: File[];
  videoFile?: File | null;
  autoTrigger?: boolean;
  onFill: (data: {
    brandName: string;
    modelName: string;
    year: number;
    enginePower: string;
    engineType: string;
    driveSystem: string;
    overallLength: string;
    overallWidth: string;
    overallHeight: string;
    netWeight: string;
    mainConfig: string;
    workingHours: string;
    condition: string;
    priceMode: string;
    tradeTerm: string;
    tradePort: string;
    isChineseBrand: boolean;
    // ── 新增字段 ──
    category: string;
    country: string;
    province: string;
    city: string;
    referencePrice: number;
  }) => void;
}

const DRIVE_SYSTEM_MAP: Record<string, string> = {
  "2WD": "二驱",
  "4WD": "四驱",
  "Full Hydraulic": "全液压驱动",
};

const PRICE_MODE_MAP: Record<string, string> = {
  fob: "FOB（离岸价）",
  por: "询价(POR)",
};

/**
 * 从 N 张图片中智能选取最有代表性的 maxCount 张
 */
function selectBestImages(files: File[], maxCount = 6): File[] {
  if (files.length <= maxCount) return files;
  const selected: File[] = [files[0]];
  const step = (files.length - 1) / (maxCount - 1);
  for (let i = 1; i < maxCount - 1; i++) {
    selected.push(files[Math.round(i * step)]);
  }
  selected.push(files[files.length - 1]);
  return selected;
}

/**
 * 将 base64 图片上传到临时存储，获取 HTTP URL（供豆包 API 使用）
 * 豆包不支持 base64 data URI，只支持 HTTP URL
 */
async function uploadImageForAI(imageDataUrl: string): Promise<string | null> {
  try {
    const res = await fetch("/api/ai-image-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageData: imageDataUrl, folder: "ai-recognize" }),
    });
    const data = await res.json();
    if (data.success && data.data?.url) {
      return data.data.url;
    }
    console.warn("[AI] 上传失败:", data.error);
    return null;
  } catch (e) {
    console.warn("[AI] 上传异常:", e);
    return null;
  }
}

/**
 * 压缩图片到合理尺寸（最大 1280px，JPEG 质量 0.75）
 * 比之前 800px/0.6 稍微提高质量，让豆包识别更准确
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_DIM = 1280; // 提高到1280px（豆包识别更准）
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.75)); // 提高到0.75质量
    };
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = URL.createObjectURL(file);
  });
}

export default function SellerAiAssistant({ imageFiles, videoFile = null, onFill, autoTrigger = true }: SellerAiAssistantProps) {
  const [recognizing, setRecognizing] = useState(false);
  const [recognized, setRecognized] = useState<AiRecognizedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("");
  const [engineMode, setEngineMode] = useState<"auto" | "domestic" | "international">("auto");
  const [autoRecognizing, setAutoRecognizing] = useState(false);

  // 自动触发控制：确保只触发一次
  const autoTriggeredRef = useRef(false);

  const handleRecognize = async () => {
    if (imageFiles.length === 0) {
      setError("请先上传至少一张图片");
      return;
    }

    setRecognizing(true);
    setError(null);
    setRecognized(null);

    try {
      // 1. 智能选图 + 压缩（提高质量：1280px / 75%）
      setPhase("正在压缩图片...");
      const bestImages = selectBestImages(imageFiles, 4); // 4张提高铭牌被选中概率
      const imageDataUrls = await Promise.all(
        bestImages.map(async (file) => {
          try {
            return await compressImage(file);
          } catch {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error("图片读取失败"));
              reader.readAsDataURL(file);
            });
          }
        })
      );

      // 2. 上传每张图片到 OSS，获取 HTTP URL（豆包只支持HTTP URL，不支持base64）
      setPhase("正在上传图片到AI服务器...");
      const uploadPromises = imageDataUrls.map((dataUrl) => uploadImageForAI(dataUrl));
      const uploadResults = await Promise.allSettled(uploadPromises);

      const imageUrls: string[] = [];
      let uploadFailCount = 0;
      uploadResults.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value) {
          imageUrls.push(result.value);
        } else {
          console.warn(`[AI] 第${idx + 1}张图片上传失败`);
          uploadFailCount++;
        }
      });

      if (imageUrls.length === 0) {
        throw new Error("所有图片上传失败，请检查网络后重试");
      }

      if (uploadFailCount > 0) {
        console.warn(`[AI] ${uploadFailCount}/${imageDataUrls.length} 张图片上传失败，剩余 ${imageUrls.length} 张继续识别`);
      }

      // 3. 调用识别 API（内部API路由，豆包→Gemini→OpenRouter 三级降级）
      setPhase(`AI 智能识别中...(${imageUrls.length}张图片)`);
      const res = await fetch("/api/agents/seller-helper/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls,
          isChineseBrand: engineMode === "domestic" ? true : undefined,
        }),
      });

      let data: any;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text().catch(() => "");
        if (res.status === 413 || text.includes("Entity") || text.includes("Large")) {
          throw new Error("上传图片过大，请减少到2-3张");
        }
        if (!res.ok) {
          throw new Error(text || `服务器异常(HTTP ${res.status})`);
        }
        try { data = JSON.parse(text); } catch {
          throw new Error(text?.substring(0, 200) || "服务器响应异常");
        }
      }

      if (!data.success) {
        throw new Error(data.error || "识别失败");
      }

      setRecognized(data.data);
    } catch (err: any) {
      setError(err.message || "识别失败，请稍后重试");
    } finally {
      setRecognizing(false);
      setAutoRecognizing(false);
      setPhase("");
    }
  };

  // 自动触发：上传第一张图片后自动开始识别（只触发一次）
  // 图片清空后重置 ref，允许下次再次自动触发
  useEffect(() => {
    if (imageFiles.length === 0) {
      autoTriggeredRef.current = false;
      return;
    }
    if (
      autoTrigger &&
      !autoTriggeredRef.current &&
      !recognizing &&
      !recognized
    ) {
      autoTriggeredRef.current = true;
      setAutoRecognizing(true);
      handleRecognize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFiles.length, autoTrigger, recognizing, recognized]);

  const handleFill = () => {
    if (!recognized) return;
    // 兜底：若后端未给 country 但判定为国内品牌，则默认 CN
    const fallbackCountry = recognized.country
      || (recognized.isChineseBrand ? "CN" : "");
    onFill({
      brandName: recognized.brand || "",
      modelName: recognized.modelName || "",
      year: recognized.year || 2020,
      enginePower: recognized.enginePower || "",
      engineType: recognized.engineType || "Diesel Engine",
      driveSystem: recognized.driveSystem || "2WD",
      overallLength: recognized.overallLength || "",
      overallWidth: recognized.overallWidth || "",
      overallHeight: recognized.overallHeight || "",
      netWeight: recognized.netWeight || "",
      mainConfig: recognized.mainConfig || "",
      workingHours: recognized.workingHours ? String(recognized.workingHours) : "",
      condition: recognized.condition || "good",
      priceMode: recognized.priceMode || "por",
      tradeTerm: recognized.tradeTerm || "FOB",
      tradePort: recognized.tradePort || "",
      isChineseBrand: recognized.isChineseBrand ?? false,
      // ── 新增字段 ──
      category: recognized.category || "",
      country: fallbackCountry,
      province: recognized.province || "",
      city: recognized.city || "",
      referencePrice: recognized.referencePrice || 0,
      // 注意：referencePrice 不回填表单价格输入框，仅在识别结果面板和价格输入框旁展示
    });
  };

  const conditionMap: Record<string, string> = {
    excellent: "优秀/全新",
    good: "良好/正常使用",
    fair: "一般/有磨损",
    poor: "较差/需维修",
  };

  const renderField = (label: string, value: string | null | undefined, unit?: string) => {
    if (!value) return null;
    return (
      <div className="flex justify-between">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-gray-900">{value}{unit || ""}</span>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-600" />
        <h3 className="text-base font-bold text-gray-900">AI 智能识别</h3>
        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700">
          已上传 {imageFiles.length} 张
        </span>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        基于已上传的 {imageFiles.length} 张图片，自动识别农机品牌、型号、参数等信息。图片越多识别越准。
      </p>

      {/* 引擎模式选择器 */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600">识别引擎：</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setEngineMode("auto")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              engineMode === "auto"
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Globe className="mr-1 inline h-3 w-3" />
            自动
          </button>
          <button
            onClick={() => setEngineMode("domestic")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              engineMode === "domestic"
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Flag className="mr-1 inline h-3 w-3" />
            国内农机
          </button>
          <button
            onClick={() => setEngineMode("international")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              engineMode === "international"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Globe className="mr-1 inline h-3 w-3" />
            国际农机
          </button>
        </div>
      </div>

      {/* 自动识别温和提示条（仅在自动触发且识别中时显示） */}
      {autoRecognizing && recognizing && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-600">
          <Sparkles className="h-4 w-4 flex-shrink-0" />
          已上传图片，AI 正在自动识别参数，您可先填写其他信息
        </div>
      )}

      {/* 无图片但有视频时的友好提示 */}
      {imageFiles.length === 0 && videoFile && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          请上传农机图片以启用 AI 识别（视频可作为补充）
        </div>
      )}

      {/* 识别按钮 */}
      <button
        onClick={handleRecognize}
        disabled={recognizing || imageFiles.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {recognizing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {autoRecognizing ? (phase || "AI 正在自动识别...") : (phase || "识别中...")}
          </>
        ) : recognized ? (
          <>
            <Wand2 className="h-4 w-4" />
            重新识别 ({imageFiles.length} 张图片)
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            开始智能识别 ({imageFiles.length} 张图片)
          </>
        )}
      </button>

      {/* 错误提示 */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 识别结果 */}
      {recognized && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              识别成功（置信度 {Math.round(recognized.confidence * 100)}%）
            </span>
            {recognized.isChineseBrand !== undefined && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                recognized.isChineseBrand
                  ? "bg-red-100 text-red-700"
                  : "bg-blue-100 text-blue-700"
              }`}>
                {recognized.isChineseBrand ? "国内品牌" : "国际品牌"}
              </span>
            )}
          </div>

          <div className="space-y-2 text-sm">
            {renderField("品类", recognized.category)}
            {renderField("品牌", recognized.brand)}
            {renderField("型号", recognized.modelName)}
            {recognized.year && renderField("年份", `${recognized.year} 年`)}
            {renderField("产地", recognized.location)}
            {renderField("马力(HP)", recognized.enginePower)}
            {renderField("发动机类型", recognized.engineType)}
            {renderField("驱动方式", DRIVE_SYSTEM_MAP[recognized.driveSystem || ""] || recognized.driveSystem)}
            {renderField("总长(mm)", recognized.overallLength)}
            {renderField("总宽(mm)", recognized.overallWidth)}
            {renderField("总高(mm)", recognized.overallHeight)}
            {renderField("整机净重(kg)", recognized.netWeight)}
            {renderField("主要配置", recognized.mainConfig)}
            {recognized.workingHours && renderField("工作小时", `${recognized.workingHours} h`)}
            {recognized.condition && renderField("成色", conditionMap[recognized.condition] || recognized.condition)}
            {renderField("价格模式", PRICE_MODE_MAP[recognized.priceMode || ""] || recognized.priceMode)}
            {renderField("贸易条款", recognized.tradeTerm)}
            {renderField("发货港口", recognized.tradePort)}
          </div>

          {/* 参考价格（仅展示，不回填表单价格输入框） */}
          {recognized.referencePrice != null && recognized.referencePrice > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-md bg-amber-50 px-3 py-1.5 text-sm">
              <span className="text-gray-500">参考价格</span>
              <span className="font-medium text-amber-700">
                ¥{recognized.referencePrice.toLocaleString()} 元
                <span className="ml-1 text-[10px] text-gray-400">（仅供参考，需手动填写）</span>
              </span>
            </div>
          )}

          <button
            onClick={handleFill}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-green-600 bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
          >
            <Upload className="h-4 w-4" />
            一键填充到表单
          </button>
        </div>
      )}
    </div>
  );
}
