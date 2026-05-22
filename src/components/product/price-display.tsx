"use client";

import { useTranslations } from "next-intl";
import { cn, formatPrice } from "@/lib/utils";

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
}

export function PriceDisplay({
  priceCny,
  priceUsd,
  locale,
  showLabel = true,
  size = "md",
  className,
  internationalPrice,
}: PriceDisplayProps) {
  const t = useTranslations("products.card");

  // Use real international price if available
  const intlPriceCny = internationalPrice?.priceForeignCny || null;
  const effectivePriceUsd = intlPriceCny || (priceUsd ? priceUsd * 7.25 : null);

  // Calculate arbitrage based on real data
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

  // Format the international price for display
  const formatIntlPrice = () => {
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
        {formatPrice(priceCny, "cny")}
      </div>
      {(intlPriceCny || priceUsd) && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {formatIntlPrice() || "-"}
          </span>
          {showLabel && (
            <span className="text-xs text-gray-400">
              ({locale === "zh" ? t("usPrice") : t("chinaPrice")})
            </span>
          )}
          {arbitrage !== null && Math.abs(arbitrage) > 10 && (
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
