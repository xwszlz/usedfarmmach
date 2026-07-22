"use client";

import { useState, useEffect, useRef } from "react";
import {
  Shield, Check, Clock, Mail, Smartphone, FileDown,
  Printer, Share2, Loader2, TrendingUp, AlertCircle,
  QrCode, ArrowLeft, Sparkles,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

type Tier = "basic" | "standard" | "premium";
type PaymentMethod = "wechat" | "alipay";
type GenerateMode = "sync" | "async";
type Step = "select" | "paying" | "paid" | "generating" | "done" | "async-submitted";

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
    price: 99,
    features: ["市场对比分析", "估值依据详细拆解", "基础购买建议"],
    featuresEn: ["Market comparison", "Valuation breakdown", "Basic buying advice"],
  },
  standard: {
    name: "标准版",
    nameEn: "Standard",
    price: 199,
    features: ["基础版全部内容", "价格趋势分析", "补贴退坡影响", "深度购买建议(时机/议价/风险)"],
    featuresEn: ["All basic content", "Price trend analysis", "Subsidy impact", "Deep buying advice"],
    recommended: true,
  },
  premium: {
    name: "旗舰版",
    nameEn: "Premium",
    price: 299,
    features: ["标准版全部内容", "出口套利分析(中美价差)", "维修成本预估", "投资回报分析(残值/年化)"],
    featuresEn: ["All standard content", "Export arbitrage", "Maintenance cost", "ROI analysis"],
  },
};

// ============================================================
// Mock QR code SVG (placeholder for real payment QR)
// ============================================================

function MockQRCode({ size = 160 }: { size?: number }) {
  const cells = [];
  const grid = 21;
  const cellSize = size / grid;
  // Pseudo-random pattern based on fixed seed
  const pattern = [
    1,1,1,1,1,1,1,0,1,0,1,1,0,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,1,0,0,1,0,0,1,0,1,0,0,0,0,0,1,
    1,0,1,1,1,0,1,1,0,0,1,1,0,1,1,0,1,1,1,0,1,
    1,0,1,1,1,0,1,0,1,1,0,0,0,0,1,0,1,1,1,0,1,
    1,0,1,1,1,0,1,0,0,1,1,1,0,1,1,0,1,1,1,0,1,
    1,0,0,0,0,0,1,0,1,0,0,1,1,0,1,0,0,0,0,0,1,
    1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1,
    0,0,0,0,0,0,0,0,1,1,0,1,0,1,0,0,0,0,0,0,0,
    1,0,1,1,0,1,1,1,0,0,1,0,1,1,1,0,1,0,1,0,1,
    0,1,0,0,1,0,0,1,1,1,0,1,0,0,1,0,0,1,0,1,0,
    1,1,1,0,1,1,0,0,0,1,1,1,1,0,0,1,1,0,1,1,1,
    0,0,1,1,0,0,1,1,1,0,0,1,0,1,1,0,0,1,0,0,1,
    1,1,0,0,1,1,0,1,0,1,1,0,1,0,0,1,1,0,1,1,0,
    0,0,0,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,0,
    1,1,1,1,1,1,1,0,0,1,1,0,1,0,1,1,0,1,1,1,1,
    1,0,0,0,0,0,1,0,1,0,0,1,0,1,1,0,0,0,0,0,1,
    1,0,1,1,1,0,1,1,1,1,0,0,1,0,0,1,1,1,1,0,1,
    1,0,1,1,1,0,1,0,0,1,1,1,0,1,1,0,1,1,1,0,1,
    1,0,1,1,1,0,1,0,1,0,0,1,1,0,1,0,1,1,1,0,1,
    1,0,0,0,0,0,1,0,0,1,1,0,0,1,0,0,0,0,0,0,1,
    1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1,
  ];
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      if (pattern[i * grid + j]) {
        cells.push(
          <rect
            key={`${i}-${j}`}
            x={j * cellSize}
            y={i * cellSize}
            width={cellSize}
            height={cellSize}
            fill="#1a1a1a"
          />
        );
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="#fff" />
      {cells}
    </svg>
  );
}

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
  const [generateMode, setGenerateMode] = useState<GenerateMode>("sync");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [contactInfo, setContactInfo] = useState("");
  const [contactType, setContactType] = useState<"email" | "phone">("email");
  const [error, setError] = useState<string | null>(null);
  const [showPublishForm, setShowPublishForm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isZh = locale === "zh";

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Start payment: create order and show QR
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
          productInfo: { brand, model, year, horsepower, category },
          valuationResult,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderId(data.data.orderId);
        // Start polling for payment status
        startPaymentPolling(data.data.orderId);
      } else {
        setError(data.error || "Failed to create order");
        setStep("select");
      }
    } catch {
      // Mock mode: simulate order creation
      const mockOrderId = `DR${Date.now()}`;
      setOrderId(mockOrderId);
      // Auto-simulate payment after 5 seconds for demo
      pollRef.current = setInterval(async () => {
        if (mockOrderId) {
          clearInterval(pollRef.current!);
          // Simulate payment success
          setStep("paid");
        }
      }, 5000);
    }
  };

  // Poll payment status
  const startPaymentPolling = (oid: string) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 100) {
        // 5 minutes timeout
        clearInterval(pollRef.current!);
        setError(isZh ? "支付超时，请重试" : "Payment timeout, please retry");
        setStep("select");
        return;
      }
      try {
        const res = await fetch(`/api/deep-report?action=payment_status&orderId=${oid}`);
        const data = await res.json();
        if (data.success && data.data.paid) {
          clearInterval(pollRef.current!);
          setStep("paid");
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);
  };

  // Simulate payment (for demo/testing)
  const handleSimulatePayment = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStep("paid");
  };

  // Start report generation
  const handleGenerate = async () => {
    if (generateMode === "sync") {
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
            mode: "sync",
            productInfo: { brand, model, year, horsepower, category },
            valuationResult,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setReportHtml(data.data.reportHtml);
          setStep("done");
        } else {
          // Mock report
          setReportHtml(generateMockReport(selectedTier));
          setStep("done");
        }
      } catch {
        // Mock report for demo
        setTimeout(() => {
          setReportHtml(generateMockReport(selectedTier));
          setStep("done");
        }, 2000);
      }
    } else {
      // Async mode
      if (!contactInfo) {
        setError(isZh ? "请填写联系方式" : "Please enter contact info");
        return;
      }
      setError(null);
      try {
        await fetch("/api/deep-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate",
            orderId,
            tier: selectedTier,
            mode: "async",
            contactInfo,
            contactType,
            productInfo: { brand, model, year, horsepower, category },
            valuationResult,
          }),
        });
      } catch {
        // Ignore API errors in demo mode
      }
      setStep("async-submitted");
    }
  };

  // Reset to start
  const handleReset = () => {
    setStep("select");
    setOrderId(null);
    setReportHtml(null);
    setContactInfo("");
    setCountdown(10);
    setError(null);
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
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
              ? "深度估值报告 — 市场对比·趋势分析·购买建议（¥99-299）"
              : "Deep valuation report — Market analysis·Trends·Buying advice (¥99-299)"}
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
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
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

            {/* Generate mode */}
            <div className="mt-3">
              <div className="mb-2 text-xs font-medium text-gray-700">
                {isZh ? "报告生成方式" : "Report generation"}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setGenerateMode("sync")}
                  className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm transition-all ${
                    generateMode === "sync"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 text-gray-600 hover:border-purple-300"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {isZh ? "同步等待 (约10秒)" : "Sync (~10s)"}
                </button>
                <button
                  onClick={() => setGenerateMode("async")}
                  className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm transition-all ${
                    generateMode === "async"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 text-gray-600 hover:border-purple-300"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  {isZh ? "异步通知 (邮箱/微信)" : "Async (email/WeChat)"}
                </button>
              </div>
            </div>

            {/* Async contact info */}
            {generateMode === "async" && (
              <div className="mt-3 rounded-lg bg-gray-50 p-3">
                <div className="mb-2 flex gap-2">
                  <button
                    onClick={() => setContactType("email")}
                    className={`rounded px-3 py-1 text-xs ${
                      contactType === "email" ? "bg-purple-600 text-white" : "bg-white text-gray-600 border border-gray-200"
                    }`}
                  >
                    {isZh ? "邮箱" : "Email"}
                  </button>
                  <button
                    onClick={() => setContactType("phone")}
                    className={`rounded px-3 py-1 text-xs ${
                      contactType === "phone" ? "bg-purple-600 text-white" : "bg-white text-gray-600 border border-gray-200"
                    }`}
                  >
                    {isZh ? "手机(微信)" : "Phone (WeChat)"}
                  </button>
                </div>
                <input
                  type={contactType === "email" ? "email" : "tel"}
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder={contactType === "email" ? "your@email.com" : "138XXXXXXXX"}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>
            )}

            {/* Pay button */}
            <button
              onClick={handleStartPayment}
              className="mt-4 w-full rounded-lg bg-purple-600 py-3 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              {isZh ? `扫码支付 ¥${TIERS[selectedTier].price}` : `Pay ¥${TIERS[selectedTier].price} via QR`}
            </button>
          </>
        )}

        {/* Step: Paying (QR code) */}
        {step === "paying" && (
          <div className="flex flex-col items-center py-6">
            <div className="mb-3 text-sm font-medium text-gray-700">
              {isZh ? `${TIERS[selectedTier].name} · ¥${TIERS[selectedTier].price}` : `${TIERS[selectedTier].nameEn} · ¥${TIERS[selectedTier].price}`}
            </div>
            <div className="rounded-xl border-2 border-gray-100 p-3">
              <MockQRCode size={160} />
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isZh
                ? `${paymentMethod === "wechat" ? "微信" : "支付宝"}扫码支付中...`
                : `Waiting for ${paymentMethod === "wechat" ? "WeChat" : "Alipay"} payment...`}
            </div>
            {/* Demo: simulate payment button */}
            <button
              onClick={handleSimulatePayment}
              className="mt-3 rounded-lg border border-green-300 bg-green-50 px-4 py-1.5 text-xs text-green-700 hover:bg-green-100"
            >
              {isZh ? "[测试] 模拟支付成功" : "[Test] Simulate payment success"}
            </button>
            <button
              onClick={handleReset}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600"
            >
              {isZh ? "← 返回重新选择" : "← Back"}
            </button>
          </div>
        )}

        {/* Step: Paid — confirm and generate */}
        {step === "paid" && (
          <div className="flex flex-col items-center py-4">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <div className="mb-1 text-sm font-medium text-gray-800">
              {isZh ? "支付成功！" : "Payment successful!"}
            </div>
            <div className="mb-4 text-xs text-gray-500">
              {isZh
                ? `${TIERS[selectedTier].name} · ¥${TIERS[selectedTier].price} · 订单号 ${orderId}`
                : `${TIERS[selectedTier].nameEn} · ¥${TIERS[selectedTier].price} · Order ${orderId}`}
            </div>
            <button
              onClick={handleGenerate}
              className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              {generateMode === "sync"
                ? isZh ? "立即生成报告 (约10秒)" : "Generate now (~10s)"
                : isZh ? "提交并后台生成" : "Submit for async generation"}
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
              {isZh ? "AI正在分析市场数据、趋势和套利机会" : "AI is analyzing market data, trends and arbitrage"}
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
                    a.download = `deep-report-${orderId}.html`;
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

        {/* Step: Async submitted */}
        {step === "async-submitted" && (
          <div className="flex flex-col items-center py-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mb-1 text-sm font-medium text-gray-800">
              {isZh ? "已提交后台生成" : "Submitted for generation"}
            </div>
            <div className="mb-3 text-center text-xs text-gray-500">
              {isZh
                ? `报告将在1-3分钟内生成完毕，我们将通过${contactType === "email" ? "邮件" : "微信"}发送到 ${contactInfo}`
                : `Report will be ready in 1-3 minutes. We'll notify you via ${contactType === "email" ? "email" : "WeChat"} at ${contactInfo}`}
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
              {isZh
                ? "订单号: " + orderId + "（请妥善保存，可用于查询报告状态）"
                : "Order: " + orderId}
            </div>
            <button
              onClick={handleReset}
              className="mt-4 text-xs text-gray-400 hover:text-gray-600"
            >
              {isZh ? "← 返回" : "← Back"}
            </button>
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
                    window.location.href = `/${locale}/products/new?prefill=true&brand=${encodeURIComponent(brand || "")}&model=${encodeURIComponent(model || "")}&year=${year || ""}&hp=${horsepower || ""}`;
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

// ============================================================
// Mock report generator (for demo/testing)
// ============================================================

function generateMockReport(tier: Tier): string {
  const tierName = TIERS[tier].name;
  const features = TIERS[tier].features;

  let sections = `
    <div style="border-bottom: 2px solid #7C3AED; padding-bottom: 8px; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #7C3AED; font-size: 18px;">深度估值报告 · ${tierName}</h2>
      <p style="margin: 4px 0 0; color: #999; font-size: 12px;">生成时间: ${new Date().toLocaleString("zh-CN")} | 报告编号: DR${Date.now()}</p>
    </div>
  `;

  // Section 1: Market comparison (all tiers)
  sections += `
    <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">一、市场对比分析</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr style="background: #F3F4F6;">
        <th style="padding: 6px; text-align: left; border: 1px solid #E5E7EB;">对比项</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #E5E7EB;">价格</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #E5E7EB;">与估值差异</th>
      </tr>
      <tr>
        <td style="padding: 6px; border: 1px solid #E5E7EB;">AI智能估值</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB; color: #7C3AED; font-weight: bold;">¥101,342</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB;">基准</td>
      </tr>
      <tr>
        <td style="padding: 6px; border: 1px solid #E5E7EB;">同型号在售均价</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB;">¥108,500</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB; color: #10B981;">+7.0%</td>
      </tr>
      <tr>
        <td style="padding: 6px; border: 1px solid #E5E7EB;">近3月成交均价</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB;">¥98,200</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB; color: #EF4444;">-3.1%</td>
      </tr>
    </table>
  `;

  // Section 2: Valuation breakdown (all tiers)
  sections += `
    <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">二、估值依据详细拆解</h3>
    <div style="background: #F9FAFB; border-radius: 8px; padding: 12px; font-size: 13px;">
      <div style="margin-bottom: 6px;"><strong>估值公式：</strong>新机基准价 × 折旧系数 × 品牌溢价 × 地区修正 × 补贴趋势</div>
      <div style="margin-bottom: 4px;">新机基准价: ¥165,000 (马力回归: ¥1,240/HP × 155HP - ¥27,800)</div>
      <div style="margin-bottom: 4px;">折旧系数: 0.85 (5年, 年均7-8%)</div>
      <div style="margin-bottom: 4px;">品牌溢价: 1.50 (东方红-高溢价品牌)</div>
      <div style="margin-bottom: 4px;">地区修正: 0.95 (河北地区)</div>
      <div style="margin-bottom: 4px;">补贴趋势: 0.97 (2025年补贴退坡29.3%)</div>
      <div style="border-top: 1px solid #E5E7EB; margin-top: 6px; padding-top: 6px;">
        <strong>最终估值: ¥101,342</strong> (置信度87%)
      </div>
    </div>
  `;

  // Section 3: Trend analysis (standard + premium)
  if (tier === "standard" || tier === "premium") {
    sections += `
      <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">三、价格趋势分析</h3>
      <div style="background: #F9FAFB; border-radius: 8px; padding: 12px; font-size: 13px;">
        <p style="margin: 0 0 6px;"><strong>品牌趋势：</strong>东方红品牌近2年二手市场价格上涨3.2%，主要受新机涨价和补贴退坡驱动。</p>
        <p style="margin: 0 0 6px;"><strong>品类趋势：</strong>轮式拖拉机155马力段属于中大马力区间，市场需求稳定增长，年均涨幅2-4%。</p>
        <p style="margin: 0 0 6px;"><strong>补贴退坡影响：</strong>2022年中央补贴¥14,134 → 2025年¥9,991（下降29.3%），新机实际购入成本上升，利好二手市场。</p>
        <p style="margin: 0;"><strong>季节性：</strong>3-5月春耕前为需求高峰，建议在1-2月淡季购入可获更优价格。</p>
      </div>
    `;
  }

  // Section 4: Deep buying advice (standard + premium)
  if (tier === "standard" || tier === "premium") {
    sections += `
      <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">四、深度购买建议</h3>
      <div style="background: #FEF3C7; border-radius: 8px; padding: 12px; font-size: 13px;">
        <p style="margin: 0 0 6px;"><strong>购买评级：可议价</strong></p>
        <p style="margin: 0 0 6px;"><strong>合理价格区间：</strong>¥96,000 - ¥106,000</p>
        <p style="margin: 0 0 6px;"><strong>建议砍价目标：</strong>¥101,000以内（当前卖家报价偏高18.4%）</p>
        <p style="margin: 0 0 6px;"><strong>最佳购买时机：</strong>1-2月淡季，卖家资金压力大时议价空间更大</p>
        <p style="margin: 0 0 6px;"><strong>议价策略：</strong>以AI估值¥101,342为锚点，重点强调补贴退坡后新机涨价对二手的传导效应已部分体现</p>
        <p style="margin: 0;"><strong>风险评估：</strong>低风险。东方红品牌保值率高（品牌系数1.50），5年后残值预计¥68,000-75,000</p>
      </div>
    `;
  }

  // Section 5: Export arbitrage (premium only)
  if (tier === "premium") {
    sections += `
      <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">五、出口套利分析</h3>
      <div style="background: #ECFDF5; border-radius: 8px; padding: 12px; font-size: 13px;">
        <p style="margin: 0 0 6px;"><strong>中美价差：</strong>同款美国市场均价 $18,500 (约¥133,200)，高于国内估值31.5%</p>
        <p style="margin: 0 0 6px;"><strong>出口可行性：</strong>可行。中国产拖拉机出口至东南亚/非洲/中亚有显著价格优势</p>
        <p style="margin: 0 0 6px;"><strong>预估利润：</strong>到岸成本¥115,000 → 目标国售价¥138,000 → 净利润¥23,000 (利润率20%)</p>
        <p style="margin: 0;"><strong>建议：</strong>如以¥101,342购入，出口至乌兹别克斯坦/肯尼亚利润空间最大</p>
      </div>
      <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">六、维修成本预估</h3>
      <div style="background: #F9FAFB; border-radius: 8px; padding: 12px; font-size: 13px;">
        <p style="margin: 0 0 6px;"><strong>常见故障：</strong>液压系统密封件老化（5年机龄高发）、离合器片磨损</p>
        <p style="margin: 0 0 6px;"><strong>年均维修费：</strong>¥3,000-5,000（正常使用强度）</p>
        <p style="margin: 0 0 6px;"><strong>大修周期：</strong>每2000-3000工时一次，费用约¥8,000-15,000</p>
        <p style="margin: 0;"><strong>建议：</strong>购入后建议预留¥5,000维修基金</p>
      </div>
      <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">七、投资回报分析</h3>
      <div style="background: #F9FAFB; border-radius: 8px; padding: 12px; font-size: 13px;">
        <p style="margin: 0 0 6px;"><strong>5年残值率：</strong>67-72%（东方红品牌保值率优于行业均值）</p>
        <p style="margin: 0 0 6px;"><strong>年化贬值：</strong>6-7%（低于行业8%均值）</p>
        <p style="margin: 0 0 6px;"><strong>持有成本：</strong>年维修¥4,000 + 年贬值¥7,000 = 年持有¥11,000</p>
        <p style="margin: 0;"><strong>投资评级：</strong>稳健型。适合自用+转售双需求</p>
      </div>
    `;
  }

  // Footer
  sections += `
    <div style="border-top: 1px solid #E5E7EB; margin-top: 20px; padding-top: 12px;">
      <p style="margin: 0; color: #999; font-size: 11px;">
        免责声明：本报告由AI估值引擎基于520万条补贴数据和市场模型自动生成，仅供决策参考，不构成投资或交易建议。
        实际成交价格受车况、市场供需、谈判等多重因素影响。报告编号: DR${Date.now()} | ${tierName}
      </p>
    </div>
  `;

  return sections;
}
