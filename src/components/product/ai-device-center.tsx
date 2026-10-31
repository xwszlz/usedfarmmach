"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Bot, Calculator, Target, ChevronDown, ScanEye } from "lucide-react";
import DeepAnalysisCard from "./deep-analysis-card";
import ProductValuationReport from "@/components/product/product-valuation-report";
import AiSalesStrategyCard from "./ai-sales-strategy-card";
import AiVisionRecognizeCard from "./ai-vision-recognize-card";

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
 * 产品页「AI 设备中心」—— 四个 AI 能力入口，纵向排列（1/2/3/4），手风琴互斥展开。
 *
 * 顺序依据老板 2026-10-29 拍板：**AI 视觉识别排第一**。
 * 原话：「为了解决用户发布产品他不专业的问题，我们用专业的 AI 图片视频识别给它规范一下，
 * 这是第一步。要有这个基础，我们的深度分析和估值还有销售策略才能更准确。」
 *
 * 四个子能力共用同一批产品图片/视频，均按 token 计费（豆包大模型统一出口）。
 * - 视觉识别：点击「开始 AI 视觉识别」触发（AiVisionRecognizeCard，默认不跑）
 * - 深度分析：点击「开始深度分析」触发（DeepAnalysisCard 自带按钮）
 * - 智能估值：点击「开始AI估值」触发（ValuationCard 已改为 autoLoad=false）
 * - 销售策略：点击生成后触发（AiSalesStrategyCard 自带按钮）
 */
/**
 * 序号徽章（1/2/3/4）：让老板一眼看出「上下排开四条」的先后顺序。
 * 展开态用半透明白底（按钮底色已变成实色），收起态用同色系的浅底。
 */
function StepBadge({
  index,
  active,
  tone,
}: {
  index: number;
  active: boolean;
  tone: "sky" | "purple" | "indigo" | "emerald";
}) {
  const idleTone =
    tone === "sky"
      ? "bg-sky-200/70 text-sky-800"
      : tone === "purple"
        ? "bg-purple-200/70 text-purple-800"
        : tone === "indigo"
          ? "bg-indigo-200/70 text-indigo-800"
          : "bg-emerald-200/70 text-emerald-800";
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
        active ? "bg-white/25 text-white" : idleTone
      }`}
    >
      {index}
    </span>
  );
}

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
  // 第 1 个 AI 能力模块：AI 视觉识别（其余三个的前置基础，排第一位）
  const [recognizeOpen, setRecognizeOpen] = useState(false);
  // P3 联动：深度分析结构化结果回灌估值卡（与估值中心一致）
  const [deepStructured, setDeepStructured] = useState<Record<string, any> | null>(null);

  // 手风琴互斥 + 展开自动滚动：面板上下堆叠，长面板在视口外展开时自动滚回顶部（移动端实测反馈）。
  const deepRef = useRef<HTMLDivElement>(null);
  const valRef = useRef<HTMLDivElement>(null);
  const strategyRef = useRef<HTMLDivElement>(null);
  const recognizeRef = useRef<HTMLDivElement>(null);

  const toggleDeep = () => {
    const next = !deepOpen;
    setDeepOpen(next);
    if (next) {
      setValOpen(false);
      setStrategyOpen(false);
      setRecognizeOpen(false);
    }
  };
  const toggleVal = () => {
    const next = !valOpen;
    setValOpen(next);
    if (next) {
      setDeepOpen(false);
      setStrategyOpen(false);
      setRecognizeOpen(false);
    }
  };
  const toggleStrategy = () => {
    const next = !strategyOpen;
    setStrategyOpen(next);
    if (next) {
      setDeepOpen(false);
      setValOpen(false);
      setRecognizeOpen(false);
    }
  };
  const toggleRecognize = () => {
    const next = !recognizeOpen;
    setRecognizeOpen(next);
    if (next) {
      setDeepOpen(false);
      setValOpen(false);
      setStrategyOpen(false);
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
  useEffect(() => {
    if (recognizeOpen) recognizeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [recognizeOpen]);
  const zh = locale === "zh";

  const recognizeLabel = zh ? "AI 视觉识别" : "AI Vision Recognition";
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

      {/* 四个入口按钮：竖向排列（老板要求上下排开四条），序号 1-4 标明先后关系 */}
      <div className="flex flex-col gap-2.5 p-5">
        {/* 1. AI 视觉识别（sky）—— 其余三个的前置基础，排第一位 */}
        <button
          onClick={toggleRecognize}
          className={`flex w-full items-center justify-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
            recognizeOpen
              ? "border-sky-400 bg-sky-600 text-white shadow-sm"
              : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
          }`}
        >
          <StepBadge index={1} active={recognizeOpen} tone="sky" />
          <ScanEye className="h-4 w-4 shrink-0" />
          {recognizeLabel}
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 transition-transform ${
              recognizeOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* 2. AI 深度分析（purple） */}
        <button
          onClick={toggleDeep}
          className={`flex w-full items-center justify-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
            deepOpen
              ? "border-purple-400 bg-purple-600 text-white shadow-sm"
              : "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
          }`}
        >
          <StepBadge index={2} active={deepOpen} tone="purple" />
          <Bot className="h-4 w-4 shrink-0" />
          {deepLabel}
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 transition-transform ${
              deepOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* 3. AI 智能估值（indigo） */}
        <button
          onClick={toggleVal}
          className={`flex w-full items-center justify-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
            valOpen
              ? "border-indigo-400 bg-indigo-600 text-white shadow-sm"
              : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          <StepBadge index={3} active={valOpen} tone="indigo" />
          <Calculator className="h-4 w-4 shrink-0" />
          {valLabel}
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 transition-transform ${
              valOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* 4. AI 销售策略（emerald） */}
        <button
          onClick={toggleStrategy}
          className={`flex w-full items-center justify-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
            strategyOpen
              ? "border-emerald-400 bg-emerald-600 text-white shadow-sm"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          <StepBadge index={4} active={strategyOpen} tone="emerald" />
          <Target className="h-4 w-4 shrink-0" />
          {strategyLabel}
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 transition-transform ${
              strategyOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* 操作提示：估值卡为按需触发（autoLoad=false，避免未请求就耗积分），且单次实测 15-22 秒 */}
      <p className="-mt-1 px-5 pb-1 text-xs text-gray-500">
        {zh
          ? "「AI 智能估值」按需触发：展开后需再点一次「开始AI估值」，单次约需 15–20 秒，期间请勿关闭页面。"
          : "AI Valuation runs on demand - expand, then press Start AI Valuation. Takes ~15-20s."}
      </p>

      {/* 展开区：AI 视觉识别（第 1 步，识别图片与视频 → 一键回填产品参数） */}
      {recognizeOpen && (
        <div ref={recognizeRef} className="px-5 pb-5 scroll-mt-20">
          <AiVisionRecognizeCard
            productId={productId}
            productName={productName}
            imageUrls={imageUrls}
            videoUrls={videoUrls}
            locale={locale}
            isChineseBrand={isChineseBrand}
          />
        </div>
      )}

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
