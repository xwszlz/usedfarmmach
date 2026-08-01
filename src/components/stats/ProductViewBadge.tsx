"use client";

import { useEffect, useState } from "react";
import { trackView } from "@/lib/stats";

interface ProductViewBadgeProps {
  productId: string;
  /** SSR 传入的初始浏览量，避免首屏空白 */
  initialViewCount?: number;
  locale?: string;
}

/**
 * 产品详情页浏览量标注（公开）。
 * 挂载即调用 track('product', productId) 自增并展示最新累计值。
 * 文案：🔥 已被浏览 N 次
 */
export function ProductViewBadge({
  productId,
  initialViewCount = 0,
  locale = "zh",
}: ProductViewBadgeProps) {
  const [count, setCount] = useState<number>(initialViewCount);

  useEffect(() => {
    let cancelled = false;
    trackView("product", productId).then((c) => {
      if (!cancelled && c !== null) setCount(c);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const label =
    locale === "zh"
      ? `🔥 已被浏览 ${count.toLocaleString()} 次`
      : `🔥 Viewed ${count.toLocaleString()} times`;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-orange-600">
      {label}
    </span>
  );
}
