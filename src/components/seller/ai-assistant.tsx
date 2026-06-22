"use client";

import { useState, useRef } from "react";
import { Camera, Sparkles, Wand2, CheckCircle, AlertCircle, Loader2, Upload } from "lucide-react";

interface AiRecognizedData {
  brand: string | null;
  modelName: string | null;
  year: number | null;
  workingHours: number | null;
  condition: string | null;
  features: string | null;
  confidence: number;
}

interface SellerAiAssistantProps {
  onFill: (data: {
    brandName: string;
    modelName: string;
    year: number;
    workingHours: string;
    condition: string;
  }) => void;
}

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

    // 最多 3 张用于 AI 识别
    const total = imageFiles.length + files.length;
    if (total > 3) {
      setError("AI 识别最多上传 3 张图片");
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
      // 将图片转为 base64 data URL（避免 OSS 依赖，更可靠）
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

      // 调用 AI 识别 API（直接传 base64 图片）
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
      workingHours: recognized.workingHours ? String(recognized.workingHours) : "",
      condition: recognized.condition || "good",
    });
  };

  const conditionMap: Record<string, string> = {
    excellent: "优秀/全新",
    good: "良好/正常使用",
    fair: "一般/有磨损",
    poor: "较差/需维修",
  };

  return (
    <div className="rounded-xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-600" />
        <h3 className="text-base font-bold text-gray-900">AI 拍照识别</h3>
        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700">
          Beta
        </span>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        上传农机照片，AI 自动识别品牌、型号、年份等信息，一键填充表单
      </p>

      {/* 图片上传区域 */}
      <div className="mb-4">
        {imagePreviews.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {imagePreviews.map((url, idx) => (
              <div key={idx} className="relative rounded-lg border border-gray-200 bg-gray-50 p-1">
                <img src={url} alt="" className="h-20 w-full rounded object-cover" />
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

        {imagePreviews.length < 3 && (
          <div
            onClick={() => imageInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary-300 bg-primary-50/50 p-4 transition-colors hover:border-primary-500 hover:bg-primary-50"
          >
            <Camera className="mb-1 h-6 w-6 text-primary-400" />
            <p className="text-xs font-medium text-primary-700">
              {imagePreviews.length === 0 ? "点击上传农机照片" : "继续添加"}
            </p>
            <p className="text-[11px] text-primary-400">建议：整机全貌、型号铭牌、驾驶室</p>
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
            {recognized.brand && (
              <div className="flex justify-between">
                <span className="text-gray-500">品牌</span>
                <span className="font-medium text-gray-900">{recognized.brand}</span>
              </div>
            )}
            {recognized.modelName && (
              <div className="flex justify-between">
                <span className="text-gray-500">型号</span>
                <span className="font-medium text-gray-900">{recognized.modelName}</span>
              </div>
            )}
            {recognized.year && (
              <div className="flex justify-between">
                <span className="text-gray-500">年份</span>
                <span className="font-medium text-gray-900">{recognized.year} 年</span>
              </div>
            )}
            {recognized.workingHours && (
              <div className="flex justify-between">
                <span className="text-gray-500">工作小时</span>
                <span className="font-medium text-gray-900">{recognized.workingHours} h</span>
              </div>
            )}
            {recognized.condition && (
              <div className="flex justify-between">
                <span className="text-gray-500">状况</span>
                <span className="font-medium text-gray-900">
                  {conditionMap[recognized.condition] || recognized.condition}
                </span>
              </div>
            )}
            {recognized.features && (
              <div className="flex justify-between">
                <span className="text-gray-500">特征</span>
                <span className="font-medium text-gray-900">{recognized.features}</span>
              </div>
            )}
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
