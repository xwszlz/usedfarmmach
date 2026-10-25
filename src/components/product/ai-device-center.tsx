"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Bot, Calculator, Target, ChevronDown } from "lucide-react";
import DeepAnalysisCard from "./deep-analysis-card";
import ProductValuationReport from "@/components/product/product-valuation-report";
import AiSalesStrategyCard from "./ai-sales-strategy-card";

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
  modelName?: string;
  workingHours?: number;
  condition?: string;
  region?: string;
  sellerPrice?: number | null;
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
  modelName,
  workingHours,
  condition,
  region,
  sellerPrice,
}: AiDeviceCenterProps) {
  const [deepOpen, setDeepOpen] = useState(false);
  const [valOpen, setValOpen] = useState(false);
  // 第四个 AI 能力模块：AI 销售策略（与深度分析/估值互斥展开）
  const [strategyOpen, setStrategyOpen] = useState(false);
  // P3 联动：深度分析结构化结果回灌估值卡（与估值中心一致）
  const [deepStructured, setDeepStructured] = useState<Record<string, any> | null>(null);

  // 手风琴互斥 + 展开自动滚动：面板上下堆叠，长面板在视口外展开时自动滚回顶部（移动端实测反馈）。
  const deepRef = useRef<HTMLDivElement>(null);
  const valRef = useRef<HTMLDivElement>(null);
  const strategyRef = useRef<HTMLDivElement>(null);

  const toggleDeep = () => {
    const next = !deepOpen;
    setDeepOpen(next);
    if (next) {
      setValOpen(false);
      setStrategyOpen(false);
    }
  };
  const toggleVal = () => {
    const next = !valOpen;
    setValOpen(next);
    if (next) {
      setDeepOpen(false);
      setStrategyOpen(false);
    }
  };
  const toggleStrategy = () => {
    const next = !strategyOpen;
    setStrategyOpen(next);
    if (next) {
      setDeepOpen(false);
      setValOpen(false);
    }
  };

  useEffect(() => {
    if (deepOpen) deepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [deepOpen]);
  useEffect(() => {
    if (valOpen) valRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [valOpen]);
  useEffect(() => {
    if (strategyOpen) strategyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [strategyOpen]);
  const zh = locale === "zh";

  const deepLabel = zh ? "AI 深度分析" : "AI Deep Analysis";
  const valLabel = zh ? "AI 智能估值" : "AI Valuation";
  const strategyLabel = zh ? "AI 销售策略" : "AI Sales Strategy";
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

      {/* 三个入口按钮（深度分析 / 估值 / 销售策略，互斥手风琴） */}
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
        <button
          onClick={toggleDeep}
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
          onClick={toggleVal}
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
        <button
          onClick={toggleStrategy}
          className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
            strategyOpen
              ? "border-emerald-400 bg-emerald-600 text-white shadow-sm"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          <Target className="h-4 w-4" />
          {strategyLabel}
          <ChevronDown className={`h-4 w-4 transition-transform ${strategyOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* 操作提示：估值卡为按需触发（autoLoad=false，避免未请求就耗积分），且单次实测 15-22 秒 */}
      <p className="-mt-1 px-5 pb-1 text-xs text-gray-500">
        {zh
          ? "「AI 智能估值」按需触发：展开后需再点一次「开始AI估值」，单次约需 15–20 秒，期间请勿关闭页面。"
          : "AI Valuation runs on demand - expand, then press Start AI Valuation. Takes ~15-20s."}
      </p>

      {/* 展开区：AI 深度分析（豆包报告） */}
      {deepOpen && (
        <div ref={deepRef} className="px-5 pb-5 scroll-mt-20">
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
            onComplete={setDeepStructured}
          />
        </div>
      )}

      {/* 展开区：AI 智能估值（豆包视觉 + 866万条补贴数据，点击触发） */}
      {valOpen && (
        <div ref={valRef} className="px-5 pb-5 scroll-mt-20">
          <ProductValuationReport
            productId={productId}
            locale={locale}
            isChineseBrand={isChineseBrand}
            brand={brandName}
            category={category}
            modelName={modelName}
            modelYear={year}
            horsepower={enginePower ? Number(enginePower) : undefined}
            hours={workingHours}
            region={region}
            condition={condition}
            sellerPrice={sellerPrice}
            deepAnalysis={deepStructured}
          />
        </div>
      )}

      {/* 展开区：AI 销售策略（第四个 AI 能力模块，LLM 生成 + 按量计费） */}
      {strategyOpen && (
        <div ref={strategyRef} className="px-5 pb-5 scroll-mt-20">
          <AiSalesStrategyCard
            productId={productId}
            productName={productName}
            category={category}
            imageUrls={imageUrls}
            videoUrls={videoUrls}
            locale={locale}
            isChineseBrand={isChineseBrand}
            brandName={brandName}
            modelName={modelName}
            year={year}
            enginePower={enginePower}
            region={region}
            sellerPrice={sellerPrice}
          />
        </div>
      )}
    </div>
  );
}
