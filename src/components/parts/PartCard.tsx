"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getImageUrl } from "@/lib/image-url";

export interface PartCardData {
  id: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  nameRu: string;
  brand: string;
  oemNumber: string | null;
  price: number;
  currency: string;
  stockStatus: string;
  images: string[];
  isOEM: boolean;
}

interface PartCardProps {
  part: PartCardData;
  locale: string;
}

const STOCK_LABELS: Record<string, { zh: string; en: string; className: string }> = {
  in_stock: { zh: "有货", en: "In Stock", className: "bg-green-100 text-green-700" },
  low_stock: { zh: "库存紧张", en: "Low Stock", className: "bg-amber-100 text-amber-700" },
  out_of_stock: { zh: "缺货", en: "Out of Stock", className: "bg-gray-100 text-gray-500" },
  preorder: { zh: "预订", en: "Pre-order", className: "bg-blue-100 text-blue-700" },
};

export default function PartCard({ part, locale }: PartCardProps) {
  const isZh = locale === "zh";
  const stockInfo = STOCK_LABELS[part.stockStatus] || STOCK_LABELS.in_stock;
  const partName = isZh ? part.nameZh : (part.nameEn || part.nameZh);

  return (
    <Link href={`/${locale}/parts/${part.id}`} className="block group">
      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
        {/* Image */}
        <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
          {part.images && part.images.length > 0 ? (
            <img
              src={getImageUrl(part.images[0])}
              alt={partName}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100">
              <Wrench className="h-12 w-12 text-gray-300" />
            </div>
          )}
          {/* Stock badge */}
          <div className="absolute top-2 left-2">
            <Badge className={`text-xs ${stockInfo.className} shadow-sm`}>
              {isZh ? stockInfo.zh : stockInfo.en}
            </Badge>
          </div>
          {/* OEM/Aftermarket badge */}
          {part.isOEM && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="text-xs bg-white/90 backdrop-blur shadow-sm">
                OEM
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4 flex flex-col h-full">
          {/* Brand + OEM Number */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide truncate">
              {part.brand}
            </span>
            {part.oemNumber && (
              <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                {part.oemNumber}
              </span>
            )}
          </div>

          {/* Name */}
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
            {partName}
          </h3>

          {/* SKU */}
          <p className="text-[10px] text-gray-400 font-mono mb-3">{part.sku}</p>

          {/* Price + CTA */}
          <div className="mt-auto flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <span className="text-xl font-bold text-orange-600">
                ¥{part.price.toLocaleString()}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg font-medium transition-colors">
              {isZh ? "询价" : "Inquiry"}
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
