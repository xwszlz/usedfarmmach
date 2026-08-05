// ───────────────────────────────────────────────
// 聊天中的产品卡片组件
// 紧凑、可点击、显示关键信：图片/品牌/型号/年份/价格/套利标签
// ───────────────────────────────────────────────

import React from "react";
import { ChevronRight, TrendingUp, Truck } from "lucide-react";
import type { ChatLocale } from "@/lib/agents/buyer-chat/types";

export interface ProductCardData {
  id: string;
  brand: string;
  modelName: string;
  year: number;
  priceCny: number;
  priceUsd?: number | null;
  imageUrl?: string;
  arbitragePercent?: number | null;
}

interface ProductCardProps {
  product: ProductCardData;
  locale?: ChatLocale;
  onProductClick?: (productId: string) => void;
}

const CURRENCY_LABELS: Record<string, Record<string, string>> = {
  zh: { price: "国内价", profit: "套利空间" },
  en: { price: "Domestic Price", profit: "Arbitrage Gap" },
  ru: { price: "Цена в Китае", profit: "Арбитраж" },
  es: { price: "Precio Doméstico", profit: "Diferencia" },
  pt: { price: "Precio Doméstico", profit: "Diferença" },
  fr: { price: "Prix Domestic", profit: "Écart" },
  ar: { price: "السعر المحلي", profit: "فجوة" },
  hi: { price: "घरेलू मूल्य", profit: "अंतर" },
};

export function ProductCard({ product, locale = "en", onProductClick }: ProductCardProps) {
  const t = CURRENCY_LABELS[locale] || CURRENCY_LABELS.en;

  const handleClick = () => {
    onProductClick?.(product.id);
  };

  const profiPct = product.arbitragePercent;
  let badgeColor = "bg-gray-100 text-gray-600";
  let badgeText = "";
  if (profiPct !== null && profiPct !== undefined) {
    if (profiPct > 50) {
      badgeColor = "bg-red-500 text-white";
      badgeText = `🔥 +${profiPct}%`;
    } else if (profiPct > 20) {
      badgeColor = "bg-orange-400 text-white";
      badgeText = `+${profiPct}%`;
    } else if (profiPct > 0) {
      badgeColor = "bg-green-500 text-white";
      badgeText = `+${profiPct}%`;
    } else if (profiPct < 0) {
      badgeColor = "bg-blue-500 text-white";
      badgeText = `${profiPct}%`;
    }
  }

  return (
    <div
      onClick={handleClick}
      className="mt-2 flex cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
      style={{ maxWidth: 320 }}
    >
      {/* 图片 */}
      <div className="relative h-20 w-20 flex-shrink-0 bg-gray-100">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={`${product.brand} ${product.modelName}`}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
            N/A
          </div>
        )}
        {/* 套利标签 */}
        {badgeText && (
          <span
            className={`absolute left-0 top-0 rounded-br-lg px-1.5 py-0.5 text-[10px] font-bold ${badgeColor}`}
          >
            {badgeText}
          </span>
        )}
      </div>

      {/* 信息区 */}
      <div className="flex flex-1 flex-col justify-center px-3 py-1.5 text-sm">
        {/* 品牌+型号 */}
        <p className="font-semibold text-gray-800 leading-tight">
          {product.brand} {product.modelName}
        </p>
        {/* 年份 */}
        <p className="text-xs text-gray-500">{product.year}</p>
        {/* 价格 */}
        <div className="mt-0.5 flex items-center gap-1">
          <span className="text-sm font-bold text-red-600">
            ¥{product.priceCny.toLocaleString()}
          </span>
          {product.priceUsd && (
            <span className="text-xs text-gray-400">
              / ${product.priceUsd.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* 箭头 */}
      <div className="flex items-center pr-2 text-gray-300">
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}

// ── 产品卡片列表（消息内渲染用）─────────────────────────
interface ProductCardListProps {
  products: ProductCardData[];
  locale?: ChatLocale;
  onProductClick?: (productId: string) => void;
}

export function ProductCardList({ products, locale = "en", onProductClick }: ProductCardListProps) {
  if (!products || products.length === 0) return null;

  return (
    <div className="space-y-2">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} locale={locale} onProductClick={onProductClick} />
      ))}
    </div>
  );
}
