"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { cn, formatPrice } from "@/lib/utils";
import { CNY_PER_USD_STATIC } from "@/lib/exchange-rate-constants";
import {
  CurrencySelect,
  loadRates,
  STATIC_RATES,
  formatInCurrency,
} from "@/components/product/currency-switcher";

interface InternationalPriceData {
  priceForeignCny: number;
  priceForeignRaw?: number | null;
  currency?: string;
  source?: string;
  sourceDate?: string;
  country?: string;
}

interface PriceDisplayProps {
  priceCny: number;
  priceUsd: number | null;
  locale: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  internationalPrice?: InternationalPriceData | null;
  /** 是否渲染币种下拉（产品卡片默认开，密集列表可关） */
  showCurrencySwitcher?: boolean;
}

export function PriceDisplay({
  priceCny,
  priceUsd,
  locale,
  showLabel = true,
  size = "md",
  className,
  internationalPrice,
  showCurrencySwitcher = true,
}: PriceDisplayProps) {
  const t = useTranslations("products.card");

  // 多币种展示：用户可选显示币种（默认 CNY，行为不变）
  const [displayCurrency, setDisplayCurrency] = useState<string>("CNY");
  const [rates, setRates] = useState<Record<string, number>>(STATIC_RATES);

  useEffect(() => {
    let alive = true;
    loadRates()
      .then((r) => {
        if (alive) setRates(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Use real international price if available
  const intlPriceCny = internationalPrice?.priceForeignCny || null;
  // USD→CNY 折算改用动态静态兜底 CNY_PER_USD_STATIC（替代旧 7.25）
  const effectivePriceUsd = intlPriceCny || (priceUsd ? priceUsd * CNY_PER_USD_STATIC : null);

  // Calculate arbitrage based on real data（CNY 视角，仅在 CNY 展示时呈现）
  const arbitrage = intlPriceCny
    ? Math.round(((priceCny - intlPriceCny) / intlPriceCny) * 100)
    : effectivePriceUsd
      ? Math.round(((priceCny - effectivePriceUsd) / effectivePriceUsd) * 100)
      : null;

  const sizeStyles = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };

  // 次级价格：默认展示国际/USD 价；用户切到非 CNY 时按动态汇率折算产品 CNY 价
  const renderSecondary = (): string | null => {
    if (displayCurrency !== "CNY") {
      return formatInCurrency(priceCny, displayCurrency, rates);
    }
    if (internationalPrice?.priceForeignRaw && internationalPrice?.currency) {
      const curr = internationalPrice.currency;
      const symbol = curr === "EUR" ? "€" : "$";
      return `${symbol}${internationalPrice.priceForeignRaw.toLocaleString()}`;
    }
    if (priceUsd) return formatPrice(priceUsd, "usd");
    return null;
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className={cn("font-bold text-primary-700", sizeStyles[size])}>
        {!priceCny || (priceCny > 0 && priceCny < 100) ? "价格面议" : formatPrice(priceCny, "cny")}
      </div>
      {(intlPriceCny || priceUsd || displayCurrency !== "CNY") && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {renderSecondary() || "-"}
          </span>
          {showLabel && (
            <span className="text-xs text-gray-400">
              ({locale === "zh" ? t("usPrice") : locale === "ru" ? t("usPrice") : t("chinaPrice")})
            </span>
          )}
          {displayCurrency === "CNY" && arbitrage !== null && Math.abs(arbitrage) > 10 && (
            <span
              className={cn(
                "text-xs font-medium",
                arbitrage < 0 ? "text-green-600" : "text-accent-600"
              )}
            >
              {arbitrage > 0 ? "+" : ""}
              {arbitrage}%
            </span>
          )}
        </div>
      )}
      {showCurrencySwitcher && (
        <div className="pt-1">
          <CurrencySelect value={displayCurrency} onChange={setDisplayCurrency} />
        </div>
      )}
      {internationalPrice?.source && (
        <p className="text-xs text-gray-400">
          {internationalPrice.source}
          {internationalPrice.sourceDate && (
            <span>
              {" · "}
              {internationalPrice.sourceDate.slice(0, 4)}-{internationalPrice.sourceDate.slice(4, 6)}-{internationalPrice.sourceDate.slice(6, 8)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
