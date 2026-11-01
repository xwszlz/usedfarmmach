"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, AlertTriangle, Bot } from "lucide-react";
import AnalysisReportView from "@/components/valuation/analysis-report-view";
import { isCnSite } from "@/config/site";
// 图片张数上限与服务端共用同一份定义（前端截取、服务端夹取）。
// 该模块只导出常量、零运行时依赖，可以安全地从 `"use client"` 组件 import；
// ⚠️ 一旦有人往该模块里加入 `node:*` 依赖，`next build` 会立刻失败（tsc/vitest 拦不住）。
import { MAX_DEEP_ANALYSIS_IMAGES } from "@/lib/ai/deep-analysis-limits";
// 超时 signal 用 `AbortController` + `setTimeout` 手工构造。
// ⚠️ 不要改回 `AbortSignal` 自带的 `timeout()` 静态方法：那是 2022 年才落地的新 API，
// 老浏览器 / 国产双核浏览器旧内核里它是 `undefined`，调用直接抛 `TypeError`，
// 用户点了按钮只会看到红字（2026-11 线上 P0 事故）。
// 客户端代码里禁止出现该 API，实现细节与原因见 `@/lib/net/abort-timeout`。
import { createTimeoutSignal, type TimeoutSignal } from "@/lib/net/abort-timeout";

/**
 * 客户端请求超时（300s = 5 分钟）。
 *
 * 取值必须落在「服务端总预算 285s」与「`.cn` 反代 `proxy_read_timeout` 330s」之间：
 *   不早于 285s → 不会抢在服务端自己的截断/失败返回之前把连接掐掉（否则用户永远拿到
 *                 "超时"而不是服务端精心构造的 JSON 错误）；
 *   不晚于 330s → 反代掐断之前浏览器已经放弃，用户看到的是可读文案而非"一直转圈"。
 */
const DEEP_ANALYSIS_CLIENT_TIMEOUT_MS = 300_000;

interface DeepAnalysisCardProps {
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
  /** 深度分析完成回调（结构化结果），供父组件 AiDeviceCenter 回灌估值卡（对齐估值中心 P3 联动） */
  onComplete?: (structured: Record<string, any> | null) => void;
}

export default function DeepAnalysisCard({
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
  onComplete,
}: DeepAnalysisCardProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [structured, setStructured] = useState<Record<string, any> | null>(null);
  const [modelUsed, setModelUsed] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  /**
   * 服务端「截断契约」的两个布尔字段（见 deep-analysis/route.ts 文件头）：
   * `truncated` = 正文不完整；`budgetExhausted` = 原因是总预算不足。
   * 为 true 时在报告顶部显示黄色提示条 —— 截断**不能静默**成功。
   */
  const [truncated, setTruncated] = useState(false);
  const [budgetExhausted, setBudgetExhausted] = useState(false);

  // 最多取 8 张图（老板 2026-10-29 拍板，见 MAX_DEEP_ANALYSIS_IMAGES）。
  // 图片由服务端**并行**下载且整体受 45s 预算封顶，所以放开张数不会线性拉长耗时。
  const selectedImages = imageUrls.slice(0, MAX_DEEP_ANALYSIS_IMAGES);

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
    setLocked(false);
    setTruncated(false);
    setBudgetExhausted(false);

    /**
     * 超时 signal 在 `try` 外声明：`fetch` 之前就要建好（要传给 signal），
     * 而 `finally` 里必须能拿到它调用 `dispose()` 取消定时器。
     */
    let timeoutSignal: TimeoutSignal | null = null;

    try {
      timeoutSignal = createTimeoutSignal(DEEP_ANALYSIS_CLIENT_TIMEOUT_MS);
      const res = await fetch("/api/agents/seller-helper/deep-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        /**
         * 客户端超时：300s。
         *
         * 为什么必须加：服务端总预算 285s，`.cn` 反代 `proxy_read_timeout` 330s。
         * 浏览器侧若裸 fetch、不设超时，一旦反代/容器出问题，用户会看到按钮无限转圈；
         * 更糟的是各浏览器的默认超时（有的长达数分钟）会把「服务端已经失败」掩盖成「还在算」。
         * 取 300s：> 服务端 285s 预算（不抢在服务端之前掐断），< 反代 330s。
         *
         * 用 `createTimeoutSignal()` 而非 `AbortSignal` 自带的 `timeout()` 静态方法：
         * 后者在 Chrome 103 / Safari 16 / Firefox 100 之前不存在，老浏览器里调用即 `TypeError`。
         */
        signal: timeoutSignal.signal,
        body: JSON.stringify({
          imageUrls: selectedImages,
          videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
          isChineseBrand,
          productName: productName || undefined,
          category: category || undefined,
          brandName: brandName || undefined,
          year: year || undefined,
          enginePower: enginePower || undefined,
          // AI 输出语种（服务端 `resolveAiLocale` 的 body 优先级最高）：
          // 不带这一项，`.com` 的俄语/西语用户会拿到中文报告。
          locale,
        }),
      });

      let data: any;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error("[DeepAnalysis] 非JSON响应:", text.substring(0, 200));
        throw new Error(
          locale === "zh"
            ? "AI服务返回异常，请稍后重试"
            : "AI service returned an unexpected response"
        );
      }

      if (!res.ok || !data.success) {
        // 503 + ALL_MODELS_FAILED：把服务端 debug（各模型真实报错）透出到界面，
        // 否则只显示笼统文案，排查时完全看不出根因。
        if (res.status === 503 && data.code === "ALL_MODELS_FAILED") {
          console.error("[DeepAnalysis] 全部模型失败，完整响应:", data);
          const details = Array.isArray(data.debug)
            ? data.debug.slice(0, 2).join(" / ")
            : "";
          throw new Error(
            locale === "zh"
              ? `AI服务暂时不可用（模型均调用失败）。技术细节：${details || "无"}`
              : `AI service unavailable (all models failed). Details: ${details || "none"}`
          );
        }
        throw new Error(data.error || data.message || `${locale === "zh" ? "分析失败" : "Analysis failed"} (${res.status})`);
      }

      setReport(data.data.analysis || "");
      setStructured(data.data.structured || null);
      onComplete?.(data.data.structured || null);
      setModelUsed(data.data.model || "");
      // 截断标记：服务端明确回传的契约字段（缺失按 false 处理，向后兼容旧版响应）
      setTruncated(data.data.truncated === true);
      setBudgetExhausted(data.data.budgetExhausted === true);
      setLocked(true);
    } catch (err: any) {
      /**
       * 超时单独一条文案（不要掉进「AI服务返回异常」的笼统分支）：
       * 现在超时由 `createTimeoutSignal()` 里的手工 `controller.abort()` 触发，
       * 抛出的 `err.name` 是 `AbortError`；
       * 同时保留 `TimeoutError` 判断 —— 兼容旧浏览器的 polyfill、以及将来若切回
       * `AbortSignal` 自带的 `timeout()` 时的语义。两者命中同一条「分析超时」文案。
       */
      const errName = String(err?.name || "");
      if (errName === "TimeoutError" || errName === "AbortError") {
        console.error("[DeepAnalysis] 客户端超时:", DEEP_ANALYSIS_CLIENT_TIMEOUT_MS, "ms");
        setError(
          locale === "zh"
            ? "分析超时（超过 5 分钟），请稍后重试或减少图片数量"
            : "Analysis timed out (over 5 minutes). Please retry later or use fewer images"
        );
      } else {
        setError(err.message || (locale === "zh" ? "深度分析失败，请稍后重试" : "Analysis failed, please try again"));
      }
    } finally {
      // 请求已结束（成功 / 失败 / 超时），取消定时器，避免组件卸载后仍挂着 300s 的 setTimeout。
      timeoutSignal?.dispose();
      setAnalyzing(false);
    }
  };

  const title = locale === "zh" ? "AI 深度分析" : "AI Deep Analysis";
  /**
   * 站点口径（`.cn` 服务国内卖家 / `.com` 服务全球卖家）。
   *
   * 历史文案在 `.com` 国际站也写「国内农机引擎 / 国内设备分析」—— 那边的用户是
   * 俄罗斯、巴西、中东的买家/卖家，被问「国内设备分析」完全说不通。
   * 所以：`.cn` 保留原中文/英文表述，`.com` 一律用站点中立的英文表述。
   */
  const cnSite = isCnSite();
  const engineTag = cnSite
    ? isChineseBrand
      ? (locale === "zh" ? "国内农机引擎" : "Domestic Engine")
      : (locale === "zh" ? "国际农机引擎" : "International Engine")
    : "Global farm machinery engine";
  const desc = cnSite
    ? isChineseBrand
      ? (locale === "zh"
        ? `接入大模型，对 ${productName} 进行详尽的国内设备分析（技术参数、操作维修、车况评估、购买建议）`
        : `Powered by AI Model — comprehensive domestic equipment analysis for ${productName}`)
      : (locale === "zh"
        ? `接入大模型，对 ${productName} 进行详尽的设备分析（技术参数、操作维修、车况评估、验机要点、购买建议）`
        : `Powered by AI Model — comprehensive equipment analysis for ${productName}`)
    : `Multimodal AI analysis of ${productName} — technical specs, operation & maintenance, condition assessment, inspection checklist and buying advice.`;
  const btnText = analyzing
    // 真实耗时实测 100~265s（见 route.ts MAX_TOKENS 注释里的 tokens/s 数据），
    // 旧文案「约15-30秒」与事实相差一个数量级，属误导用户，已按实测改为「1-4 分钟」。
    ? (locale === "zh" ? "分析中（约 1-4 分钟）..." : "Analyzing (1-4 min)...")
    : (locale === "zh" ? "开始深度分析" : "Start Deep Analysis");
  const reportTitle = locale === "zh" ? "深度分析报告" : "Deep Analysis Report";
  const zh = locale === "zh";
  const noImageText = locale === "zh"
    ? "当前产品无图片，无法进行AI深度分析"
    : "No product images available for AI analysis";

  return (
    <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-5 w-5 text-purple-600" />
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {isChineseBrand !== undefined && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            isChineseBrand
              ? "bg-red-100 text-red-700"
              : "bg-blue-100 text-blue-700"
          }`}>
            {engineTag}
          </span>
        )}
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
        <div className="mt-4">
          {/* 截断提示条：服务端 `truncated`/`budgetExhausted` 为真时**必须**可见，
              否则用户会把半截报告当成完整结论（曾经的静默失败）。 */}
          {truncated && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                {zh
                  ? (budgetExhausted
                    ? "本次分析因时间预算限制被截断，内容可能不完整，请稍后重试"
                    : "本次分析内容被截断，可能不完整，请稍后重试")
                  : (budgetExhausted
                    ? "This analysis was truncated due to the time budget; the content may be incomplete. Please try again later"
                    : "This analysis was truncated and may be incomplete. Please try again later")}
              </span>
            </div>
          )}
          <AnalysisReportView
            report={report}
            structured={structured}
            isChineseBrand={isChineseBrand}
            brandName={brandName}
            categoryName={productName}
            locale={locale}
            locked={locked}
            onUnlock={() => setLocked(false)}
          />
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="mt-3 w-full rounded-lg border border-purple-300 py-2 text-xs text-purple-600 hover:bg-purple-50 disabled:opacity-50"
          >
            {zh ? "重新分析" : "Re-analyze"}
          </button>
        </div>
      )}
    </div>
  );
}
