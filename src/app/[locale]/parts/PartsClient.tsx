"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Search, Package, Truck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getImageUrl } from "@/lib/image-url";

interface PartItem {
  id: string;
  nameZh: string;
  nameEn: string;
  nameRu: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  stockStatus: string; // in_stock, low_stock, out_of_stock
  compatibleModels: string[];
  images: string[];
  descriptionZh: string | null;
  descriptionEn: string | null;
  descriptionRu: string | null;
}

// 零配件分类
const PART_CATEGORIES = [
  { id: "engine", nameZh: "发动机配件", nameEn: "Engine Parts", icon: "🔧" },
  { id: "hydraulic", nameZh: "液压系统", nameEn: "Hydraulic System", icon: "⚙️" },
  { id: "transmission", nameZh: "传动系统", nameEn: "Transmission", icon: "🔩" },
  { id: "electrical", nameZh: "电气系统", nameEn: "Electrical", icon: "⚡" },
  { id: "filters", nameZh: "滤芯滤清", nameEn: "Filters", icon: "🧹" },
  { id: "tires", nameZh: "轮胎轮毂", nameEn: "Tires & Wheels", icon: "🛞" },
  { id: "bearings", nameZh: "轴承密封", nameEn: "Bearings & Seals", icon: "🔵" },
  { id: "body", nameZh: "车身外观", nameEn: "Body Parts", icon: "🚜" },
];

const STOCK_LABELS: Record<string, { zh: string; en: string; className: string }> = {
  in_stock: { zh: "有货", en: "In Stock", className: "bg-green-100 text-green-700" },
  low_stock: { zh: "库存紧张", en: "Low Stock", className: "bg-amber-100 text-amber-700" },
  out_of_stock: { zh: "缺货", en: "Out of Stock", className: "bg-gray-100 text-gray-500" },
};

export default function PartsClient({ locale }: { locale: string }) {
  const isZh = locale === "zh";
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [parts, setParts] = useState<PartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchParts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const fetchParts = async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (searchQuery.trim()) params.set("keyword", searchQuery.trim());
      const res = await fetch(`/api/parts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setParts(json.data || []);
        } else {
          setParts([]);
          setError(true);
        }
      } else {
        setParts([]);
        setError(true);
      }
    } catch (e) {
      console.error("Failed to fetch parts:", e);
      setParts([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // 搜索时触发请求
  const handleSearch = () => {
    fetchParts();
  };

  // 客户端二次筛选（搜索词在服务端也做了，这里确保即时过滤）
  const filteredParts = parts.filter((part) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      part.nameZh.toLowerCase().includes(q) ||
      part.nameEn.toLowerCase().includes(q) ||
      part.brand.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-4">
            <Wrench className="h-8 w-8" />
            <h1 className="text-3xl font-bold">
              {isZh ? "零配件专区" : "Parts & Components"}
            </h1>
          </div>
          <p className="text-white/90 text-lg max-w-2xl">
            {isZh
              ? "原厂配件 · 品牌兼容件 · 全国配送 · 质量保证"
              : "OEM Parts · Compatible Components · Nationwide Delivery · Quality Guaranteed"}
          </p>
          <div className="flex gap-6 mt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span className="text-sm">{isZh ? "8大品类" : "8 Categories"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              <span className="text-sm">{isZh ? "全国配送" : "Nationwide Shipping"}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm">{isZh ? "质量保证" : "Quality Guarantee"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search bar */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={isZh ? "搜索配件名称、品牌、型号..." : "Search parts, brands, models..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === "all"
                ? "bg-orange-500 text-white"
                : "bg-white text-gray-600 hover:bg-orange-50"
            }`}
          >
            {isZh ? "全部" : "All"}
          </button>
          {PART_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-orange-500 text-white"
                  : "bg-white text-gray-600 hover:bg-orange-50"
              }`}
            >
              <span className="mr-1">{cat.icon}</span>
              {isZh ? cat.nameZh : cat.nameEn}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-gray-500">
          {loading
            ? (isZh ? "加载中..." : "Loading...")
            : (isZh ? `共 ${filteredParts.length} 个配件` : `${filteredParts.length} parts found`)}
        </div>

        {/* Parts grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-gray-400">
            <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{isZh ? "配件数据暂时无法加载，请稍后重试" : "Parts data is temporarily unavailable"}</p>
          </div>
        ) : filteredParts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{isZh ? "暂无匹配的配件" : "No matching parts found"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredParts.map((part) => {
              const stockInfo = STOCK_LABELS[part.stockStatus] || STOCK_LABELS.in_stock;
              const partName = isZh ? part.nameZh : (part.nameEn || part.nameZh);
              return (
                <Card key={part.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {part.images && part.images.length > 0 ? (
                      <img
                        src={getImageUrl(part.images[0])}
                        alt={partName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Wrench className="h-12 w-12 text-gray-300" />
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {part.brand && (
                        <Badge variant="secondary" className="text-xs">{part.brand}</Badge>
                      )}
                      <Badge className={`text-xs ${stockInfo.className}`}>
                        {isZh ? stockInfo.zh : stockInfo.en}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">
                      {partName}
                    </h3>
                    {part.compatibleModels && part.compatibleModels.length > 0 && (
                      <p className="text-xs text-gray-400 mb-2">
                        {isZh ? "兼容型号" : "Compatible"}: {part.compatibleModels.join(", ")}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-orange-600">
                          ¥{part.price.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">/{part.currency}</span>
                      </div>
                      <Link
                        href={`/parts/${part.id}`}
                        className="text-xs text-orange-500 hover:underline"
                      >
                        {isZh ? "询价" : "Inquiry"}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* CTA section */}
        <div className="mt-12 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isZh ? "找不到需要的配件？" : "Can't find the part you need?"}
          </h2>
          <p className="text-gray-600 mb-4">
            {isZh
              ? "告诉我们您的设备型号，我们帮您 sourcing"
              : "Tell us your equipment model, we'll source it for you"}
          </p>
          <Link
            href="/about#contact"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-white font-medium hover:bg-orange-600 transition-colors"
          >
            {isZh ? "提交需求" : "Submit Request"}
          </Link>
        </div>
      </div>
    </div>
  );
}
