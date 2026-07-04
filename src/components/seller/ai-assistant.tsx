"use client";

import { useState, useRef } from "react";
import { Camera, Sparkles, Wand2, CheckCircle, AlertCircle, Loader2, Upload } from "lucide-react";
import { matchPortByLocation } from "@/lib/port-matcher";

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
  confidence: number;
}

interface SellerAiAssistantProps {
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

export default function SellerAiAssistant({ onFill }: SellerAiAssistantProps) {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [recognizing, setRecognizing] = useState(false);
  const [recognized, setRecognized] = useState<AiRecognizedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 最多 5 张用于 AI 识别（与网站发布页上限一致）
    const total = imageFiles.length + files.length;
    if (total > 5) {
      setError("AI 识别最多上传 5 张图片");
      return;
    }

    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    setError(null);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRecognize = async () => {
    if (imageFiles.length === 0) {
      setError("请先上传至少一张图片");
      return;
    }

    setRecognizing(true);
    setError(null);
    setRecognized(null);

    try {
      // 将图片转为 base64 data URL
      const imageDataUrls = await Promise.all(
        imageFiles.map(async (file) => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("图片读取失败"));
            reader.readAsDataURL(file);
          });
        })
      );

      const res = await fetch("/api/agents/seller-helper/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: imageDataUrls }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "识别失败");
      }

      setRecognized(data.data);
    } catch (err: any) {
      setError(err.message || "识别失败，请稍后重试");
    } finally {
      setRecognizing(false);
    }
  };

  const handleFill = () => {
    if (!recognized) return;

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
      tradePort: recognized.tradePort || matchPortByLocation(""),
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
        <h3 className="text-base font-bold text-gray-900">AI 智能识车</h3>
        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700">
          Beta
        </span>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        上传农机照片（整机全貌、铭牌、驾驶室），AI 自动识别全部规格字段，一键填充表单
      </p>

      {/* 图片上传区域 */}
      <div className="mb-4">
        {imagePreviews.length > 0 && (
          <div className="mb-3 grid grid-cols-5 gap-2">
            {imagePreviews.map((url, idx) => (
              <div key={idx} className="relative rounded-lg border border-gray-200 bg-gray-50 p-1">
                <img src={url} alt="" className="h-16 w-full rounded object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                >
                  <span className="block text-[10px] leading-none">×</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {imagePreviews.length < 5 && (
          <div
            onClick={() => imageInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary-300 bg-primary-50/50 p-4 transition-colors hover:border-primary-500 hover:bg-primary-50"
          >
            <Camera className="mb-1 h-6 w-6 text-primary-400" />
            <p className="text-xs font-medium text-primary-700">
              {imagePreviews.length === 0 ? "点击上传农机照片" : "继续添加"}
            </p>
            <p className="text-[11px] text-primary-400">建议：整机全貌、型号铭牌、驾驶室、轮胎/底盘</p>
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

      {/* 识别按钮 */}
      <button
        onClick={handleRecognize}
        disabled={recognizing || imageFiles.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {recognizing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            AI 识别中...
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            开始 AI 识别
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
          </div>

          <div className="space-y-2 text-sm">
            {renderField("品牌", recognized.brand)}
            {renderField("型号", recognized.modelName)}
            {recognized.year && renderField("年份", `${recognized.year} 年`)}
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
