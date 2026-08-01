"use client";

import { useEffect, useState } from "react";
import { trackView } from "@/lib/stats";

interface CategoryViewBadgeProps {
  categoryId: string;
  /** 栏目名称（展示用，可选） */
  categoryName?: string;
  /** SSR 传入的初始浏览量 */
  initialViewCount?: number;
  locale?: string;
}

/**
 * 栏目/列表页浏览量标注（公开）。
 * 挂载即调用 track('category', categoryId) 自增并展示最新累计值。
 * 文案：本栏目「X」已被浏览 N 次 / 本栏目已被浏览 N 次
 */
export function CategoryViewBadge({
  categoryId,
  categoryName,
  initialViewCount = 0,
  locale = "zh",
}: CategoryViewBadgeProps) {
  const [count, setCount] = useState<number>(initialViewCount);

  useEffect(() => {
    let cancelled = false;
    trackView("category", categoryId).then((c) => {
      if (!cancelled && c !== null) setCount(c);
    });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const label =
    locale === "zh"
      ? categoryName
        ? `本栏目「${categoryName}」已被浏览 ${count.toLocaleString()} 次`
        : `本栏目已被浏览 ${count.toLocaleString()} 次`
      : categoryName
        ? `${categoryName} viewed ${count.toLocaleString()} times`
        : `Category viewed ${count.toLocaleString()} times`;

  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600">
      <span className="text-blue-400">👁</span>
      {label}
    </div>
  );
}
