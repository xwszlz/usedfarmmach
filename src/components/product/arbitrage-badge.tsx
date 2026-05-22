"use client";

import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";

interface ArbitrageBadgeProps {
  percent: number;
  className?: string;
  source?: string | null;
}

export function ArbitrageBadge({ percent, className, source }: ArbitrageBadgeProps) {
  const t = useTranslations("products.card");

  const isPositive = percent > 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-semibold text-accent-700 ${className ?? ""}`}
      title={source ? `数据来源: ${source}` : undefined}
    >
      <TrendingUp className="h-3 w-3" />
      {isPositive ? "+" : ""}
      {t("arbitragePercent", { percent })}
    </span>
  );
}
