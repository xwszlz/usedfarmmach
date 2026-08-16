"use client";

import { useState, useEffect, useRef } from "react";
import {
  Shield, Check, FileDown,
  Printer, TrendingUp, AlertCircle,
  ArrowLeft, Sparkles,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

type Tier = "basic" | "standard" | "premium";
type PaymentMethod = "wechat" | "alipay";
type Step = "select" | "paying" | "generating" | "done";

interface DeepReportSectionProps {
  productId?: string;
  productName?: string;
  brand?: string;
  model?: string;
  year?: number;
  horsepower?: number;
  category?: string;
  valuationResult?: {
    estimatedValue?: number;
    confidenceScore?: number;
    priceRange?: { low: number; high: number };
  } | null;
  locale?: string;
  showPublishButton?: boolean;
}

// ============================================================
// Tier definitions
// ============================================================

const TIERS: Record<Tier, {
  name: string;
  nameEn: string;
  price: number;
  features: string[];
  featuresEn: string[];
  recommended?: boolean;
}> = {
  basic: {
    name: "基础版",
    nameEn: "Basic",
    price: 9,
    features: ["市场对比分析", "估值依据详细拆解", "基础购买建议"],
    featuresEn: ["Market comparison", "Valuation breakdown", "Basic buying advice"],
  },
  standard: {
    name: "标准版",
    nameEn: "Standard",
    price: 19,
    features: ["基础版全部内容", "价格趋势分析", "补贴退坡影响", "深度购买建议(时机/议价/风险)"],
    featuresEn: ["All basic content", "Price trend analysis", "Subsidy impact", "Deep buying advice"],
    recommended: true,
  },
  premium: {
    name: "旗舰版",
    nameEn: "Premium",
    price: 29,
    features: ["标准版全部内容", "出口套利分析(中美价差)", "维修成本预估", "投资回报分析(残值/年化)"],
    featuresEn: ["All standard content", "Export arbitrage", "Maintenance cost", "ROI analysis"],
  },
};

// ============================================================
// Real payment QR code (uploaded by site owner)
// ============================================================

const REAL_QR_CODES: Record<PaymentMethod, { src: string; label: string; tip: string }> = {
  wechat: {
    src: "/qrcode/wechat-pay.png",
    label: "微信支付",
    tip: "神雕农机 老许建辉（经营）",
  },
  alipay: {
    src: "/qrcode/alipay.jpg",
    label: "支付宝",
    tip: "扫码支付 ¥X",
  },
};

// ============================================================
// Main component
// ============================================================

export function DeepReportSection({
  productId,
  productName,
  brand,
  model,
  year,
  horsepower,
  category,
  valuationResult,
  locale = "zh",
  showPublishButton = false,
}: DeepReportSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [selectedTier, setSelectedTier] = useState<Tier>("standard");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wechat");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPublishForm, setShowPublishForm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isZh = locale === "zh";

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Start payment: create order, show QR
  const handleStartPayment = async () => {
    setError(null);
    setStep("paying");
    try {
      const res = await fetch("/api/deep-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_order",
          tier: selectedTier,
          paymentMethod,
          productId,
          productName,
          productInfo: { brand, model, year, horsepower, category },
          valuationResult,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderId(data.data.orderId);
      } else {
        setError(data.error || "Failed to create order");
        setStep("select");
      }
    } catch {
      // Mock mode: simulate order creation
      const mockOrderId = `DR${Date.now()}`;
      setOrderId(mockOrderId);
    }
  };

  // User confirms they have paid (信任模式) - 直接进入生成
  const handleConfirmPaid = () => {
    // Notify backend (mark as paid in mock mode)
    if (orderId) {
      fetch("/api/deep-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate_payment", orderId }),
      }).catch(() => {});
    }
    // Auto-start generation
    setTimeout(() => handleGenerate(), 300);
  };

  // Generate report
  const handleGenerate = async () => {
    setStep("generating");
    setCountdown(10);

    // Countdown timer
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Generate report
    try {
      const res = await fetch("/api/deep-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          orderId,
          tier: selectedTier,
          productInfo: { brand, model, year, horsepower, category },
          valuationResult,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReportHtml(data.data.reportHtml);
        setStep("done");
      } else {
        setError(data.error || (isZh ? "报告生成失败，请重试" : "Failed to generate report"));
        setStep("select");
      }
    } catch {
      setError(isZh ? "网络错误，请重试" : "Network error, please retry");
      setStep("select");
    }
  };

  // Reset to start
  const handleReset = () => {
    setStep("select");
    setOrderId(null);
    setReportHtml(null);
    setCountdown(10);
    setError(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // ============================================================
  // Render
  // ============================================================

  if (!expanded) {
    return (
      <div className="mt-3 flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs text-purple-700">
          <Shield className="h-3.5 w-3.5" />
          <span>
            {isZh
              ? "深度估值报告 — 市场对比·趋势分析·购买建议（¥9-29）"
              : "Deep valuation report — Market analysis·Trends·Buying advice (¥9-29)"}
          </span>
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 transition-colors"
        >
          {isZh ? "深度报告" : "Deep report"}
          <TrendingUp className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/50 to-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-purple-700 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-white">
          <Sparkles className="h-4 w-4" />
          {isZh ? "深度估值报告" : "Deep valuation report"}
          <span className="ml-1 rounded-full bg-purple-500 px-2 py-0.5 text-[10px]">
            {isZh ? "付费" : "Paid"}
          </span>
        </div>
        <button
          onClick={() => { setExpanded(false); handleReset(); }}
          className="text-xs text-purple-200 hover:text-white"
        >
          {isZh ? "收起 ▲" : "Close ▲"}
        </button>
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-red-50 p-2.5 text-xs text-red-600">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
            <button
              onClick={() => setError(null)}
              className="rounded bg-red-100 px-2 py-1 font-medium hover:bg-red-200"
            >
              {isZh ? "重试" : "Retry"}
            </button>
          </div>
        )}

        {/* Step: Select tier */}
        {step === "select" && (
          <>
            {/* Three tiers */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(Object.keys(TIERS) as Tier[]).map((key) => {
                const tier = TIERS[key];
                const isSelected = selectedTier === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTier(key)}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                      isSelected
                        ? "border-purple-500 bg-purple-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-purple-300"
                    }`}
                  >
                    {tier.recommended && (
                      <span className="absolute -top-2 right-3 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-medium text-white">
                        {isZh ? "推荐" : "Recommended"}
                      </span>
                    )}
                    <div className="mb-1 text-sm font-medium text-gray-800">
                      {isZh ? tier.name : tier.nameEn}
                    </div>
                    <div className="mb-2 text-2xl font-bold text-purple-700">
                      ¥{tier.price}
                    </div>
                    <ul className="space-y-1">
                      {(isZh ? tier.features : tier.featuresEn).map((f, i) => (
                        <li key={i} className="flex items-start gap-1 text-[11px] text-gray-600">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* Payment method */}
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-gray-700">
                {isZh ? "支付方式" : "Payment method"}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentMethod("wechat")}
                  className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm transition-all ${
                    paymentMethod === "wechat"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-600 hover:border-green-300"
                  }`}
                >
                  <span className="text-base">💚</span>
                  {isZh ? "微信支付" : "WeChat Pay"}
                </button>
                <button
                  onClick={() => setPaymentMethod("alipay")}
                  className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm transition-all ${
                    paymentMethod === "alipay"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-blue-300"
                  }`}
                >
                  <span className="text-base">💙</span>
                  {isZh ? "支付宝" : "Alipay"}
                </button>
              </div>
            </div>

            {/* Pay button */}
            <button
              onClick={handleStartPayment}
              className="mt-4 w-full rounded-lg bg-purple-600 py-3 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              {isZh
                ? `确认下单 · 扫码支付 ¥${TIERS[selectedTier].price}`
                : `Confirm · Pay ¥${TIERS[selectedTier].price} via QR`}
            </button>
            <div className="mt-2 text-center text-[10px] text-gray-400">
              {isZh
                ? "付款后在页面查看报告，支持在线查看 / 下载 / 打印"
                : "View report on page after payment. Supports online view / download / print"}
            </div>
          </>
        )}

        {/* Step: Paying (QR code) */}
        {step === "paying" && (
          <div className="flex flex-col items-center py-6">
            <div className="mb-1 text-sm font-medium text-gray-700">
              {isZh ? `${TIERS[selectedTier].name} · ¥${TIERS[selectedTier].price}` : `${TIERS[selectedTier].nameEn} · ¥${TIERS[selectedTier].price}`}
            </div>
            <div className="mb-3 text-xs text-gray-500">
              {isZh ? `订单号: ${orderId}` : `Order: ${orderId}`}
            </div>
            <div className="rounded-xl border-2 border-gray-100 bg-white p-3 shadow-sm">
              <img
                src={REAL_QR_CODES[paymentMethod].src}
                alt={REAL_QR_CODES[paymentMethod].label}
                width={180}
                height={180}
                className="block"
              />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {REAL_QR_CODES[paymentMethod].tip}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-600">
              <AlertCircle className="h-3 w-3" />
              {isZh
                ? "请使用微信/支付宝扫一扫，付款后点击下方按钮"
                : "Please scan to pay, then click the button below"}
            </div>

            {/* Confirm payment button (信任模式) */}
            <button
              onClick={handleConfirmPaid}
              className="mt-4 w-full max-w-xs rounded-lg bg-green-600 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm"
            >
              {isZh ? "✓ 我已付款，立即生成报告" : "✓ I've paid, generate report now"}
            </button>
            <button
              onClick={handleReset}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600"
            >
              {isZh ? "← 返回重新选择" : "← Back"}
            </button>
          </div>
        )}

        {/* Step: Generating (sync) */}
        {step === "generating" && (
          <div className="flex flex-col items-center py-8">
            <div className="relative mb-4 h-20 w-20">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#E5E7EB" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34" fill="none" stroke="#7C3AED" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - (10 - countdown) / 10)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-purple-700">
                {countdown}s
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {isZh ? "正在生成深度估值报告..." : "Generating deep valuation report..."}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {isZh
                ? "AI正在分析市场数据，请稍候..."
                : "AI is analyzing market data, please wait..."}
            </div>
          </div>
        )}

        {/* Step: Done — show report */}
        {step === "done" && reportHtml && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                <Check className="h-4 w-4 text-green-600" />
                {isZh ? "报告已生成" : "Report ready"}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  <Printer className="h-3 w-3" />
                  {isZh ? "打印" : "Print"}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([reportHtml], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `deep-report-${orderId || Date.now()}.html`;
                    a.click();
                  }}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  <FileDown className="h-3 w-3" />
                  {isZh ? "下载" : "Download"}
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 rounded-lg border border-purple-200 px-2.5 py-1 text-xs text-purple-600 hover:bg-purple-50"
                >
                  <ArrowLeft className="h-3 w-3" />
                  {isZh ? "重新选择" : "Reset"}
                </button>
              </div>
            </div>
            <div
              className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: reportHtml }}
            />
          </div>
        )}

        {/* Publish button (homepage only) */}
        {showPublishButton && step === "select" && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowPublishForm(!showPublishForm)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              <TrendingUp className="h-4 w-4" />
              {isZh ? "估价后一键发布出售" : "Publish for sale after valuation"}
            </button>
            {showPublishForm && (
              <div className="mt-3 rounded-lg bg-green-50 p-3">
                <p className="mb-2 text-xs text-green-700">
                  {isZh
                    ? "将您的农机设备信息发布到交易平台，让全球买家看到"
                    : "Publish your machinery to the platform for global buyers"}
                </p>
                <button
                  onClick={() => {
                    window.location.href = `/${locale}/seller/products/new?prefill=true&brand=${encodeURIComponent(brand || "")}&model=${encodeURIComponent(model || "")}&category=${encodeURIComponent(category || "")}&year=${year || ""}&hp=${horsepower || ""}`;
                  }}
                  className="w-full rounded-lg bg-green-600 py-2 text-xs font-medium text-white hover:bg-green-700"
                >
                  {isZh ? "前往发布 →" : "Go to publish →"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
