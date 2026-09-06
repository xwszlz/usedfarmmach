"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Lock, Loader2, Mail, ShieldCheck, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";

// ============================================================
// P0 留资引擎 — 游客估值结果解锁卡片（valuation-result-gate）
//
// variant="gate"  : 游客拿到区间化模糊结果（±12%），详细拆解打码，
//                   输入邮箱调 POST /api/valuation/unlock 解锁精确值
// variant="limit" : 游客 429（每日 3 次已用完）引导留资，同样支持
//                   邮箱解锁（服务端会用 valuationParams 重算精确值）
//
// 解锁成功后通过 onUnlocked(precise) 通知父组件切换为精确结果视图。
// Mobile 友好：小屏纵向堆叠、全宽按钮、触控友好的输入尺寸。
// ============================================================

export interface BlurredValuation {
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  confidence: number;
}

interface ValuationResultGateProps {
  blurred?: BlurredValuation;
  /** 估值输入参数，解锁时原样回传给 unlock 接口做服务端重算 */
  valuationParams: Record<string, unknown>;
  onUnlocked: (precise: Record<string, unknown>) => void;
  variant?: "gate" | "limit";
}

function formatMoney(value: number): string {
  if (value >= 10000) return `¥${(value / 10000).toFixed(1)}万`;
  return `¥${value.toLocaleString()}`;
}

export default function ValuationResultGate({
  blurred,
  valuationParams,
  onUnlocked,
  variant = "gate",
}: ValuationResultGateProps) {
  const t = useTranslations("valuationGate");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleUnlock = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError(t("emailInvalid"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/valuation/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          locale,
          valuationParams,
          estimate: null, // 精确值由服务端用 valuationParams 重算，防伪造
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.precise) {
        onUnlocked(data.precise as Record<string, unknown>);
      } else if (res.status === 400 && data.error === "INVALID_EMAIL") {
        setError(t("emailInvalid"));
      } else {
        setError(t("unlockFailed"));
      }
    } catch {
      setError(t("unlockFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary-200 bg-white shadow-sm">
      {variant === "limit" ? (
        /* ── 429 引导留资模式 ── */
        <div className="p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-semibold">{t("limitReached")}</span>
          </div>
          <p className="mb-4 text-sm text-gray-500">{t("limitReachedDesc")}</p>
          <EmailForm
            email={email} setEmail={setEmail} error={error} submitting={submitting}
            onUnlock={handleUnlock} t={t}
          />
        </div>
      ) : (
        /* ── 区间价 + 拆解打码 + 解锁表单 ── */
        <div className="p-5 sm:p-6">
          {/* 区间价大字展示（Mobile 小屏纵向堆叠） */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-1.5 text-sm text-gray-500">
                <TrendingUp className="h-4 w-4 text-primary-600" />
                {t("rangeLabel")}
              </div>
              <div className="text-2xl font-bold text-primary-700 sm:text-4xl">
                {formatMoney(blurred?.priceLow ?? 0)} ~ {formatMoney(blurred?.priceHigh ?? 0)}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {t("midHint")} {formatMoney(blurred?.priceMid ?? 0)}
              </div>
            </div>
            {/* 置信度（模糊结果仍可见） */}
            <div className="flex items-center gap-2 sm:flex-col sm:text-right">
              <span className="text-xs text-gray-400">{t("confidenceLabel")}</span>
              <span className="text-lg font-semibold text-gray-700">
                {blurred?.confidence ?? 0}%
              </span>
            </div>
          </div>

          {/* 详细拆解区：CSS blur 打码 + 锁图标覆盖 */}
          <div className="relative mt-5 overflow-hidden rounded-lg border border-gray-100">
            <div className="pointer-events-none select-none p-4 blur-[6px]" aria-hidden="true">
              {["新机基准价", "年份折旧", "地区修正", "品牌溢价", "估值公式"].map((row) => (
                <div key={row} className="flex items-center justify-between border-b border-gray-50 py-2 last:border-0">
                  <span className="text-sm text-gray-500">{row}</span>
                  <span className="text-sm font-medium text-gray-700">×0.00</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40">
              <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                <Lock className="h-4 w-4 text-primary-600" />
                <span className="text-xs font-medium text-gray-700 sm:text-sm">
                  {t("blurredNotice")}
                </span>
              </div>
            </div>
          </div>

          {/* 解锁表单 */}
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Sparkles className="h-4 w-4 text-primary-600" />
              {t("unlockTitle")}
            </div>
            <p className="mb-3 text-xs text-gray-500">{t("unlockDesc")}</p>
            <EmailForm
              email={email} setEmail={setEmail} error={error} submitting={submitting}
              onUnlock={handleUnlock} t={t}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// 邮箱输入 + 解锁按钮（横排 → 小屏纵排）
function EmailForm({
  email, setEmail, error, submitting, onUnlock, t,
}: {
  email: string;
  setEmail: (v: string) => void;
  error: string;
  submitting: boolean;
  onUnlock: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onUnlock(); }}
            placeholder={t("emailPlaceholder")}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <button
          onClick={onUnlock}
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {submitting ? t("unlocking") : t("unlockButton")}
        </button>
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}
      <p className="text-xs text-gray-400">{t("privacyNote")}</p>
    </div>
  );
}
