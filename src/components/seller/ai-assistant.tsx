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

/**
 * onFill 回调返回的数据类型（部分字段，仅包含用户勾选的字段）
 */
type AiFillData = Partial<{
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
  category: string;
  country: string;
  province: string;
  city: string;
  referencePrice: number;
}>;

interface SellerAiAssistantProps {
  /** 图片文件（发布模式使用，编辑模式可为空） */
  imageFiles?: File[];
  /** 图片URL列表（编辑模式使用，跳过压缩和上传步骤） */
  imageUrls?: string[];
  videoFile?: File | null;
  autoTrigger?: boolean;
  /** 编辑模式标志：编辑模式下AI有值但表单已有值时默认不勾选 */
  editMode?: boolean;
  /** 已填写的表单值，用于对比AI识别结果，决定默认勾选状态 */
  existingFormValues?: Record<string, any>;
  onFill: (data: AiFillData) => void;
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
 * 表单字段 key → AI识别数据 key 的映射
 * 用于字段级确认面板的渲染和选择性填充
 */
const FIELD_MAP: Record<string, keyof AiRecognizedData> = {
  brandName: "brand",
  modelName: "modelName",
  year: "year",
  enginePower: "enginePower",
  engineType: "engineType",
  driveSystem: "driveSystem",
  overallLength: "overallLength",
  overallWidth: "overallWidth",
  overallHeight: "overallHeight",
  netWeight: "netWeight",
  mainConfig: "mainConfig",
  workingHours: "workingHours",
  condition: "condition",
  priceMode: "priceMode",
  tradeTerm: "tradeTerm",
  tradePort: "tradePort",
  category: "category",
  country: "country",
  province: "province",
  city: "city",
};

/**
 * 字段显示标签（中文）
 */
const FIELD_LABELS: Record<string, string> = {
  brandName: "品牌",
  modelName: "型号",
  year: "年份",
  enginePower: "马力(HP)",
  engineType: "发动机类型",
  driveSystem: "驱动方式",
  overallLength: "总长(mm)",
  overallWidth: "总宽(mm)",
  overallHeight: "总高(mm)",
  netWeight: "整机净重(kg)",
  mainConfig: "主要配置",
  workingHours: "工作小时",
  condition: "成色",
  priceMode: "价格模式",
  tradeTerm: "贸易条款",
  tradePort: "发货港口",
  category: "品类",
  country: "国家",
  province: "省份",
  city: "城市",
};

/**
 * 字段显示单位（追加在值后面）
 */
const FIELD_UNITS: Record<string, string> = {
  year: " 年",
  workingHours: " h",
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
      const MAX_DIM = 1280;
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
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = URL.createObjectURL(file);
  });
}

export default function SellerAiAssistant({
  imageFiles = [],
  imageUrls: propImageUrls,
  videoFile = null,
  onFill,
  autoTrigger = true,
  editMode = false,
  existingFormValues,
}: SellerAiAssistantProps) {
  const [recognizing, setRecognizing] = useState(false);
  const [recognized, setRecognized] = useState<AiRecognizedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("");
  const [engineMode, setEngineMode] = useState<"auto" | "domestic" | "international">("auto");
  const [autoRecognizing, setAutoRecognizing] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  // 自动触发控制：确保只触发一次
  const autoTriggeredRef = useRef(false);

  // 计算图片数量（文件或URL）
  const totalImages = (imageFiles?.length || 0) + (propImageUrls?.length || 0);
  const isUrlMode = (propImageUrls?.length || 0) > 0 && (imageFiles?.length || 0) === 0;

  const handleRecognize = async () => {
    if (totalImages === 0) {
      setError("请先上传至少一张图片");
      return;
    }

    setRecognizing(true);
    setError(null);
    setRecognized(null);
    setSelectedFields(new Set());

    try {
      let finalImageUrls: string[];

      if (isUrlMode) {
        // ── URL模式：直接使用已有URL，跳过压缩和上传 ──
        finalImageUrls = propImageUrls!;
        setPhase(`AI 智能识别中...(${finalImageUrls.length}张图片)`);
      } else {
        // ── 文件模式：压缩 → 上传 → 识别 ──
        setPhase("正在压缩图片...");
        const bestImages = selectBestImages(imageFiles!, 4);
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

        setPhase("正在上传图片到AI服务器...");
        const uploadPromises = imageDataUrls.map((dataUrl) => uploadImageForAI(dataUrl));
        const uploadResults = await Promise.allSettled(uploadPromises);

        finalImageUrls = [];
        let uploadFailCount = 0;
        uploadResults.forEach((result, idx) => {
          if (result.status === "fulfilled" && result.value) {
            finalImageUrls.push(result.value);
          } else {
            console.warn(`[AI] 第${idx + 1}张图片上传失败`);
            uploadFailCount++;
          }
        });

        if (finalImageUrls.length === 0) {
          throw new Error("所有图片上传失败，请检查网络后重试");
        }

        if (uploadFailCount > 0) {
          console.warn(
            `[AI] ${uploadFailCount}/${imageDataUrls.length} 张图片上传失败，剩余 ${finalImageUrls.length} 张继续识别`
          );
        }

        setPhase(`AI 智能识别中...(${finalImageUrls.length}张图片)`);
      }

      // 调用识别 API（内部API路由，豆包→Gemini→OpenRouter 三级降级）
      const res = await fetch("/api/agents/seller-helper/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls: finalImageUrls,
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
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(text?.substring(0, 200) || "服务器响应异常");
        }
      }

      if (!data.success) {
        throw new Error(data.error || "识别失败");
      }

      setRecognized(data.data);

      // ── 初始化勾选状态 ──
      const initialSelected = new Set<string>();
      for (const [formKey, aiKey] of Object.entries(FIELD_MAP)) {
        const aiValue = (data.data as any)[aiKey];
        if (aiValue) {
          if (editMode) {
            // 编辑模式：仅当表单无值且AI有值时勾选
            const existingValue = existingFormValues?.[formKey];
            if (!existingValue || existingValue === "") {
              initialSelected.add(formKey);
            }
          } else {
            // 发布模式：AI有值就勾选
            initialSelected.add(formKey);
          }
        }
      }
      setSelectedFields(initialSelected);
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
    if (totalImages === 0) {
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
  }, [totalImages, autoTrigger, recognizing, recognized]);

  /**
   * 选择性填充：只填充用户勾选的字段
   */
  const handleSelectiveFill = () => {
    if (!recognized) return;

    const filled: Record<string, any> = {};

    for (const [formKey, aiKey] of Object.entries(FIELD_MAP)) {
      if (selectedFields.has(formKey)) {
        const rawValue = (recognized as any)[aiKey];
        // 对特定字段应用默认值
        if (formKey === "year" && !rawValue) {
          filled[formKey] = 2020;
        } else if (formKey === "engineType" && !rawValue) {
          filled[formKey] = "Diesel Engine";
        } else if (formKey === "driveSystem" && !rawValue) {
          filled[formKey] = "2WD";
        } else if (formKey === "condition" && !rawValue) {
          filled[formKey] = "good";
        } else if (formKey === "priceMode" && !rawValue) {
          filled[formKey] = "por";
        } else if (formKey === "tradeTerm" && !rawValue) {
          filled[formKey] = "FOB";
        } else if (formKey === "workingHours") {
          filled[formKey] = rawValue ? String(rawValue) : "";
        } else {
          filled[formKey] = rawValue || "";
        }
      }
    }

    // 兜底：若后端未给 country 但判定为国内品牌，则默认 CN
    if (selectedFields.has("country")) {
      filled.country = recognized.country || (recognized.isChineseBrand ? "CN" : "");
    }

    // 附加非勾选的元数据字段
    const result: AiFillData = {
      ...filled,
      isChineseBrand: recognized.isChineseBrand ?? false,
      referencePrice: recognized.referencePrice || 0,
    };

    onFill(result);
  };

  const conditionMap: Record<string, string> = {
    excellent: "优秀/全新",
    good: "良好/正常使用",
    fair: "一般/有磨损",
    poor: "较差/需维修",
  };

  /**
   * 渲染带 checkbox 的字段行（方案B：字段级确认）
   */
  const renderFieldWithCheckbox = (formKey: string) => {
    const aiKey = FIELD_MAP[formKey];
    if (!aiKey || !recognized) return null;

    const label = FIELD_LABELS[formKey] || formKey;
    const unit = FIELD_UNITS[formKey] || "";
    const rawAiValue = (recognized as any)[aiKey];

    // 格式化显示值
    let aiDisplayValue: string | null = null;
    if (rawAiValue != null && rawAiValue !== "") {
      if (formKey === "driveSystem") {
        aiDisplayValue = DRIVE_SYSTEM_MAP[rawAiValue] || rawAiValue;
      } else if (formKey === "priceMode") {
        aiDisplayValue = PRICE_MODE_MAP[rawAiValue] || rawAiValue;
      } else if (formKey === "condition") {
        aiDisplayValue = conditionMap[rawAiValue] || rawAiValue;
      } else {
        aiDisplayValue = String(rawAiValue);
      }
    }

    // AI无值 → 灰色不可勾选
    if (!aiDisplayValue) {
      return (
        <div
          key={formKey}
          className="flex items-center justify-between text-sm text-gray-400"
        >
          <span className="flex items-center gap-2">
            <div className="h-4 w-4 rounded border border-gray-200 bg-gray-100" />
            {label}
          </span>
          <span>无识别结果</span>
        </div>
      );
    }

    const existingValue = existingFormValues?.[formKey];
    const hasExisting =
      existingValue != null &&
      existingValue !== "" &&
      existingValue !== 0 &&
      !(typeof existingValue === "number" && isNaN(existingValue));
    const isConflict = hasExisting && editMode;
    const isChecked = selectedFields.has(formKey);
    const displayValue = `${aiDisplayValue}${unit}`;

    return (
      <div key={formKey} className="flex items-center justify-between text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => {
              const next = new Set(selectedFields);
              if (isChecked) {
                next.delete(formKey);
              } else {
                next.add(formKey);
              }
              setSelectedFields(next);
            }}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className={isConflict ? "text-gray-500" : "text-gray-700"}>
            {label}
          </span>
          {isConflict && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              将覆盖现有值
            </span>
          )}
          {recognized.confidence < 0.6 && (
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
              低置信度
            </span>
          )}
        </label>
        <span
          className={`font-medium ${isChecked ? "text-green-700" : "text-gray-400"}`}
        >
          {displayValue}
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-600" />
        <h3 className="text-base font-bold text-gray-900">AI 智能识别</h3>
        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700">
          已上传 {totalImages} 张
        </span>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        {isUrlMode
          ? `基于产品已有 ${totalImages} 张图片，自动识别农机品牌、型号、参数等信息。`
          : `基于已上传的 ${totalImages} 张图片，自动识别农机品牌、型号、参数等信息。图片越多识别越准。`}
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
      {totalImages === 0 && videoFile && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          请上传农机图片以启用 AI 识别（视频可作为补充）
        </div>
      )}

      {/* 识别按钮 */}
      <button
        onClick={handleRecognize}
        disabled={recognizing || totalImages === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {recognizing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {autoRecognizing ? phase || "AI 正在自动识别..." : phase || "识别中..."}
          </>
        ) : recognized ? (
          <>
            <Wand2 className="h-4 w-4" />
            重新识别 ({totalImages} 张图片)
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            开始智能识别 ({totalImages} 张图片)
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
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  recognized.isChineseBrand
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {recognized.isChineseBrand ? "国内品牌" : "国际品牌"}
              </span>
            )}
          </div>

          {/* 字段级确认列表（方案B） */}
          <div className="space-y-2">
            {renderFieldWithCheckbox("category")}
            {renderFieldWithCheckbox("brandName")}
            {renderFieldWithCheckbox("modelName")}
            {renderFieldWithCheckbox("year")}
            {renderFieldWithCheckbox("enginePower")}
            {renderFieldWithCheckbox("engineType")}
            {renderFieldWithCheckbox("driveSystem")}
            {renderFieldWithCheckbox("overallLength")}
            {renderFieldWithCheckbox("overallWidth")}
            {renderFieldWithCheckbox("overallHeight")}
            {renderFieldWithCheckbox("netWeight")}
            {renderFieldWithCheckbox("mainConfig")}
            {renderFieldWithCheckbox("workingHours")}
            {renderFieldWithCheckbox("condition")}
            {renderFieldWithCheckbox("priceMode")}
            {renderFieldWithCheckbox("tradeTerm")}
            {renderFieldWithCheckbox("tradePort")}
            {renderFieldWithCheckbox("country")}
            {renderFieldWithCheckbox("province")}
            {renderFieldWithCheckbox("city")}
          </div>

          {/* 参考价格（仅展示，不回填表单价格输入框） */}
          {recognized.referencePrice != null && recognized.referencePrice > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-md bg-amber-50 px-3 py-1.5 text-sm">
              <span className="text-gray-500">参考价格</span>
              <span className="font-medium text-amber-700">
                ¥{recognized.referencePrice.toLocaleString()} 元
                <span className="ml-1 text-[10px] text-gray-400">
                  （仅供参考，需手动填写）
                </span>
              </span>
            </div>
          )}

          {/* 选择性填充按钮（方案B） */}
          <button
            onClick={handleSelectiveFill}
            disabled={selectedFields.size === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-green-600 bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:hover:bg-green-600"
          >
            <Upload className="h-4 w-4" />
            填充已选字段（{selectedFields.size}项）
          </button>
        </div>
      )}
    </div>
  );
}
