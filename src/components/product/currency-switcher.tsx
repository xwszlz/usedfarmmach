"use client";

/**
 * 多币种展示组件（客户端，SSR 安全）。
 * - 列出全部 15 个支持币种（CURRENCY_INFO / SUPPORTED_CURRENCIES）。
 * - 模块级缓存：全站共享一次 /api/exchange-rates 请求（动态实时汇率）。
 * - 选择持久化到 localStorage；无 Provider，组件自管状态，便于局部嵌入价格展示。
 */
import {
  CURRENCY_INFO,
  SUPPORTED_CURRENCIES,
} from "@/config/exchange-rates";

/** 静态兜底（与 config 同步），SSR/离线时使用 */
export const STATIC_RATES: Record<string, number> = {
  CNY: 1,
  USD: 0.14943,
  EUR: 0.13335,
  GBP: 0.11303,
  JPY: 23.648,
  AUD: 0.21405,
  CAD: 0.21258,
  CHF: 0.12419,
  RUB: 12.73,
  INR: 14.4549,
  BRL: 0.74789,
  MXN: 2.7196,
  KRW: 200.46,
  TRY: 7.3479,
  ZAR: 2.4705,
};

type Rates = Record<string, number>;

let ratesPromise: Promise<Rates> | null = null;

/** 模块级缓存：全站共享一次 /api/exchange-rates 请求，避免卡片列表 N 次打接口 */
export function loadRates(): Promise<Rates> {
  if (!ratesPromise) {
    ratesPromise = fetch("/api/exchange-rates")
      .then((r) => r.json())
      .then((j: unknown) => {
        const next: Rates = { CNY: 1 };
        const data = (j as { data?: Array<{ targetCurrency: string; rate: number }> }).data;
        if (Array.isArray(data)) {
          for (const d of data) {
            if (typeof d?.rate === "number") next[d.targetCurrency] = d.rate;
          }
        }
        return next;
      })
      .catch(() => STATIC_RATES);
  }
  return ratesPromise;
}

/** 把 CNY 价格按汇率折算成目标币种展示字符串 */
export function formatInCurrency(
  cny: number,
  currency: string,
  rates: Rates
): string {
  const rate = rates[currency] ?? STATIC_RATES[currency] ?? 1;
  const value = currency === "CNY" ? cny : cny * rate;
  const info = CURRENCY_INFO[currency];
  const symbol = info?.symbol ?? "";
  if (currency === "CNY") return `¥${Math.round(value).toLocaleString("zh-CN")}`;
  if (currency === "USD") return `$${Math.round(value).toLocaleString("en-US")}`;
  return `${symbol}${Math.round(value).toLocaleString("en-US")}`;
}

export function CurrencySelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (c: string) => void;
  className?: string;
}) {
  return (
    <select
      aria-label="选择显示币种"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-700"
      }
    >
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {CURRENCY_INFO[c]?.nameZh ?? c} ({c})
        </option>
      ))}
    </select>
  );
}
