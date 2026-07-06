"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp, Bot } from "lucide-react";

interface DeepAnalysisCardProps {
  productId: string;
  productName: string;
  imageUrls: string[];
  videoUrls?: string[];
  locale?: string;
}

export default function DeepAnalysisCard({
  productId,
  productName,
  imageUrls,
  videoUrls = [],
  locale = "zh",
}: DeepAnalysisCardProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [structured, setStructured] = useState<Record<string, any> | null>(null);
  const [modelUsed, setModelUsed] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 只取前3张图片（豆包处理够用，避免超时）
  const selectedImages = imageUrls.slice(0, 3);

  const handleAnalyze = async () => {
    if (selectedImages.length === 0) {
      setError(locale === "zh" ? "该产品暂无图片，无法进行深度分析" : "No images available for analysis");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setReport(null);
    setStructured(null);
    setModelUsed("");
    setExpanded(true);

    try {
      const res = await fetch("/api/agents/seller-helper/deep-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls: selectedImages,
          videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || `${locale === "zh" ? "分析失败" : "Analysis failed"} (${res.status})`);
      }

      setReport(data.data.analysis || "");
      setStructured(data.data.structured || null);
      setModelUsed(data.data.model || "");
    } catch (err: any) {
      setError(err.message || (locale === "zh" ? "深度分析失败，请稍后重试" : "Analysis failed, please try again"));
    } finally {
      setAnalyzing(false);
    }
  };

  const title = locale === "zh" ? "AI 深度分析" : "AI Deep Analysis";
  const desc = locale === "zh"
    ? `接入豆包大模型，对 ${productName} 进行详尽的设备分析（技术参数、操作维修、市场参考价、购买建议）`
    : `Powered by Doubao AI — comprehensive equipment analysis for ${productName}`;
  const btnText = analyzing
    ? (locale === "zh" ? "分析中（约15-30秒）..." : "Analyzing...")
    : (locale === "zh" ? "开始深度分析" : "Start Deep Analysis");
  const reportTitle = locale === "zh" ? "深度分析报告" : "Deep Analysis Report";
  const noImageText = locale === "zh"
    ? "当前产品无图片，无法进行AI深度分析"
    : "No product images available for AI analysis";

  return (
    <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-5 w-5 text-purple-600" />
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {modelUsed && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
            {modelUsed}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-4 text-sm text-gray-500">{desc}</p>

      {/* No images warning */}
      {selectedImages.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {noImageText}
        </div>
      )}

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={analyzing || selectedImages.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {analyzing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {btnText}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {btnText}
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="mt-4 overflow-hidden rounded-lg border border-purple-200 bg-white">
          {/* Report Header - Collapsible */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between bg-purple-50 px-4 py-3 text-left transition-colors hover:bg-purple-100"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-purple-800">
              <Sparkles className="h-4 w-4" />
              {reportTitle}
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-purple-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-purple-500" />
            )}
          </button>

          {/* Report Body */}
          {expanded && (
            <div className="border-t border-purple-100 p-4">
              {/* Markdown Report */}
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{
                  __html: report
                    .replace(/## /g, '<h2 class="text-base font-bold text-gray-900 mt-4 mb-2">')
                    .replace(/### /g, '<h3 class="text-sm font-bold text-gray-800 mt-3 mb-1">')
                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                    .replace(/^- (.*)/gm, '<li class="ml-4 list-disc">$1</li>')
                    .replace(/\n/g, "<br />"),
                }}
              />

              {/* Structured Data Summary */}
              {structured && structured.brand && (
                <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm">
                  <p className="font-medium text-green-800">
                    {locale === "zh" ? "识别设备" : "Identified Equipment"}：{structured.brand}{" "}
                    {structured.modelName || ""}
                    {structured.year && ` (${structured.year})`}
                  </p>
                  {structured.estimatedPriceCny && (
                    <p className="mt-1 text-green-700">
                      {locale === "zh" ? "市场参考价" : "Market Reference Price"}：¥
                      {structured.estimatedPriceCny}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
