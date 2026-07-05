"use client";

import { useState } from "react";
import { Sparkles, Wand2, CheckCircle, AlertCircle, Loader2, Upload, TrendingUp } from "lucide-react";
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

interface ValuationData {
  estimatedValue: number;
  lowEstimate: number;
  highEstimate: number;
  confidence: number;
  factors: string[];
  currency: string;
}

interface SellerAiAssistantProps {
  imageFiles: File[];
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
  onValuation?: (data: ValuationData | null) => void;
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
 * 策略：取首张(封面) + 末张(通常是铭牌) + 中间均匀取样
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
 * 压缩图片到合理尺寸
 * 最大 800px，JPEG 质量 0.6，确保 12 张总 payload < 3MB
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_DIM = 800;
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
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = URL.createObjectURL(file);
  });
}

export default function SellerAiAssistant({ imageFiles, onFill, onValuation }: SellerAiAssistantProps) {
  const [recognizing, setRecognizing] = useState(false);
  const [recognized, setRecognized] = useState<AiRecognizedData | null>(null);
  const [valuation, setValuation] = useState<ValuationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("");

  const handleRecognize = async () => {
    if (imageFiles.length === 0) {
      setError("请先上传至少一张图片");
      return;
    }

    setRecognizing(true);
    setError(null);
    setRecognized(null);
    setValuation(null);
    onValuation?.(null);

    try {
      // 1. 智能选图 + 压缩
      setPhase("正在压缩图片...");
      const bestImages = selectBestImages(imageFiles, 6);
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

      // 2. Payload 大小检查
      const bodyStr = JSON.stringify({ imageDataUris: imageDataUrls });
      if (bodyStr.length > 3.5 * 1024 * 1024) {
        setError(`图片数据过大(${(bodyStr.length / 1024 / 1024).toFixed(1)}MB)，请减少图片数量`);
        return;
      }

      // 3. 调用识别 API
      setPhase("AI 识别中...");
      const res = await fetch("/api/agents/seller-helper/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
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

      // 4. 并行调用估值 API（用识别到的参数，跳过图片分析因为图还没上传）
      setPhase("正在生成估值报告...");
      try {
        const recog = data.data as AiRecognizedData;
        const valRes = await fetch("/api/valuation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: recog.brand || undefined,
            category: recog.brand || undefined, // 识别API不返回category，用brand兜底
            year: recog.year || undefined,
            condition: recog.condition || undefined,
            enginePower: recog.enginePower ? Number(recog.enginePower) : undefined,
            driveSystem: recog.driveSystem || undefined,
            mainConfig: recog.mainConfig || undefined,
            netWeight: recog.netWeight ? Number(recog.netWeight) : undefined,
            overallLength: recog.overallLength ? Number(recog.overallLength) : undefined,
            overallWidth: recog.overallWidth ? Number(recog.overallWidth) : undefined,
            overallHeight: recog.overallHeight ? Number(recog.overallHeight) : undefined,
            useV4: true,
            skipImageAnalysis: true,
          }),
        });

        if (valRes.ok) {
          const valData = await valRes.json();
          if (valData.success || valData.estimatedValue) {
            const valResult: ValuationData = {
              estimatedValue: valData.estimatedValue || valData.data?.estimatedValue || 0,
              lowEstimate: valData.lowEstimate || valData.data?.lowEstimate || 0,
              highEstimate: valData.highEstimate || valData.data?.highEstimate || 0,
              confidence: valData.confidence || valData.data?.confidence || 0,
              factors: valData.factors || valData.data?.factors || [],
              currency: valData.currency || valData.data?.currency || "CNY",
            };
            setValuation(valResult);
            onValuation?.(valResult);
          }
        }
      } catch {
        // 估值失败不影响识别流程
        console.warn("估值获取失败，不影响识别");
      }
    } catch (err: any) {
      setError(err.message || "识别失败，请稍后重试");
    } finally {
      setRecognizing(false);
      setPhase("");
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
        <h3 className="text-base font-bold text-gray-900">智能识别 + 估值</h3>
        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700">
          已上传 {imageFiles.length} 张
        </span>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        基于已上传的 {imageFiles.length} 张图片，自动识别农机参数并生成估值报告。图片越多识别越准。
      </p>

      {/* 识别按钮 */}
      <button
        onClick={handleRecognize}
        disabled={recognizing || imageFiles.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {recognizing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {phase || "识别中..."}
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

          {/* 估值结果 */}
          {valuation && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">AI 估值参考</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-500">最低估值</p>
                  <p className="text-sm font-bold text-gray-700">
                    {valuation.lowEstimate > 0 ? `¥${(valuation.lowEstimate / 10000).toFixed(1)}万` : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-primary-600">参考估值</p>
                  <p className="text-base font-bold text-primary-700">
                    {valuation.estimatedValue > 0 ? `¥${(valuation.estimatedValue / 10000).toFixed(1)}万` : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">最高估值</p>
                  <p className="text-sm font-bold text-gray-700">
                    {valuation.highEstimate > 0 ? `¥${(valuation.highEstimate / 10000).toFixed(1)}万` : "--"}
                  </p>
                </div>
              </div>
              {valuation.factors.length > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  影响因素：{valuation.factors.slice(0, 3).join("、")}
                </p>
              )}
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
