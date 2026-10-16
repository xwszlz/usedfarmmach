"use client";

import { useState } from "react";
import { Sparkles, Bot, Calculator, ChevronDown } from "lucide-react";
import DeepAnalysisCard from "./deep-analysis-card";
import { ValuationCard } from "@/components/valuation/valuation-card";

interface AiDeviceCenterProps {
  productId: string;
  productName: string;
  category?: string;
  imageUrls: string[];
  videoUrls?: string[];
  locale?: string;
  isChineseBrand?: boolean;
  brandName?: string;
  year?: number;
  enginePower?: string;
}

/**
 * 产品页「AI 设备中心」—— 将原先分离的两张卡（AI 深度分析 + AI 智能估值）
 * 合并为一个大卡：两个按钮，深度分析在前、估值在后（按用户要求排序）。
 *
 * 两个子能力共用同一批产品图片/视频，均按 token 计费（豆包大模型统一出口）。
 * - 深度分析：点击「开始深度分析」触发（DeepAnalysisCard 自带按钮）
 * - 智能估值：点击「开始AI估值」触发（ValuationCard 已改为 autoLoad=false）
 */
export default function AiDeviceCenter({
  productId,
  productName,
  category,
  imageUrls,
  videoUrls = [],
  locale = "zh",
  isChineseBrand,
  brandName,
  year,
  enginePower,
}: AiDeviceCenterProps) {
  const [deepOpen, setDeepOpen] = useState(false);
  const [valOpen, setValOpen] = useState(false);
  const zh = locale === "zh";

  const deepLabel = zh ? "AI 深度分析" : "AI Deep Analysis";
  const valLabel = zh ? "AI 智能估值" : "AI Valuation";
  const metaLabel = zh ? "豆包大模型 · 按量计费（每次消耗积分）" : "Doubao LLM · pay-per-use";

  return (
    <div className="overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-sm">
      {/* 大卡头部 */}
      <div className="flex items-center gap-2 border-b border-purple-100 px-5 py-4">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <h3 className="text-base font-bold text-gray-900">{zh ? "AI 设备中心" : "AI Device Center"}</h3>
        <span className="ml-auto rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
          {metaLabel}
        </span>
      </div>

      {/* 两个入口按钮（深度分析在前、估值在后） */}
      <div className="grid grid-cols-2 gap-3 p-5">
        <button
          onClick={() => setDeepOpen((o) => !o)}
          className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
            deepOpen
              ? "border-purple-400 bg-purple-600 text-white shadow-sm"
              : "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
          }`}
        >
          <Bot className="h-4 w-4" />
          {deepLabel}
          <ChevronDown className={`h-4 w-4 transition-transform ${deepOpen ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={() => setValOpen((o) => !o)}
          className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
            valOpen
              ? "border-indigo-400 bg-indigo-600 text-white shadow-sm"
              : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          <Calculator className="h-4 w-4" />
          {valLabel}
          <ChevronDown className={`h-4 w-4 transition-transform ${valOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* 展开区：AI 深度分析（豆包报告） */}
      {deepOpen && (
        <div className="px-5 pb-5">
          <DeepAnalysisCard
            productId={productId}
            productName={productName}
            category={category}
            imageUrls={imageUrls}
            videoUrls={videoUrls}
            locale={locale}
            isChineseBrand={isChineseBrand}
            brandName={brandName}
            year={year}
            enginePower={enginePower}
          />
        </div>
      )}

      {/* 展开区：AI 智能估值（豆包视觉 + 866万条补贴数据，点击触发） */}
      {valOpen && (
        <div className="px-5 pb-5">
          <ValuationCard
            productId={productId}
            productName={productName}
            locale={locale}
            autoLoad={false}
          />
        </div>
      )}
    </div>
  );
}
