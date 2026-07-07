"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Search, Package, Truck, ShieldCheck, Tag, Boxes, Zap, CheckCircle2, ArrowRight, Star } from "lucide-react";
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
      <div className="relative bg-gradient-to-br from-orange-600 via-red-500 to-amber-600 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 py-14 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white/20 backdrop-blur rounded-xl p-2">
                <Wrench className="h-7 w-7" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">
                {isZh ? "零配件专区" : "Parts & Components"}
              </h1>
            </div>
            <p className="text-white/90 text-lg max-w-2xl mb-6">
              {isZh
                ? "原厂配件 · 品牌兼容件 · 全国配送 · 质量保证 — 为您的农机提供全生命周期配件保障"
                : "OEM Parts · Compatible Components · Nationwide Delivery · Quality Guaranteed — Full lifecycle parts support for your machinery"}
            </p>

            {/* Stats */}
            <div className="flex flex-wrap gap-6 mb-6">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-white/80" />
                <span className="text-sm font-medium">{isZh ? "8大品类" : "8 Categories"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-white/80" />
                <span className="text-sm font-medium">{isZh ? "25+ SKU" : "25+ SKUs"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-white/80" />
                <span className="text-sm font-medium">{isZh ? "全国配送" : "Nationwide Shipping"}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-white/80" />
                <span className="text-sm font-medium">{isZh ? "质量保证" : "Quality Guarantee"}</span>
              </div>
            </div>

            {/* Embedded search */}
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={isZh ? "搜索配件名称、品牌、型号..." : "Search parts, brands, models..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="w-full pl-12 pr-32 py-4 rounded-xl text-gray-900 bg-white shadow-lg focus:outline-none focus:ring-4 focus:ring-white/30"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-colors"
              >
                {isZh ? "搜索" : "Search"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Service guarantees */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: ShieldCheck, zh: "正品保障", en: "Authentic Guarantee", color: "text-blue-600 bg-blue-50" },
            { icon: Truck, zh: "全国配送", en: "Nationwide Shipping", color: "text-green-600 bg-green-50" },
            { icon: Zap, zh: "快速发货", en: "Fast Dispatch", color: "text-orange-600 bg-orange-50" },
            { icon: CheckCircle2, zh: "售后无忧", en: "After-sales Support", color: "text-purple-600 bg-purple-50" },
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg p-3 ${item.color}`}>
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{isZh ? item.zh : item.en}</span>
            </div>
          ))}
        </div>

        {/* Category tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === "all"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-white text-gray-600 hover:bg-orange-50 border border-gray-200"
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
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-orange-50 border border-gray-200"
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
              const partDesc = isZh ? part.descriptionZh : (part.descriptionEn || part.descriptionZh);
              const catInfo = PART_CATEGORIES.find(c => c.id === part.category);
              return (
                <Card key={part.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
                  {/* Image */}
                  <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                    {part.images && part.images.length > 0 ? (
                      <img
                        src={getImageUrl(part.images[0])}
                        alt={partName}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Wrench className="h-12 w-12 text-gray-300" />
                      </div>
                    )}
                    {/* Stock badge overlay */}
                    <div className="absolute top-2 left-2">
                      <Badge className={`text-xs ${stockInfo.className} shadow-sm`}>
                        {isZh ? stockInfo.zh : stockInfo.en}
                      </Badge>
                    </div>
                    {/* Category tag overlay */}
                    {catInfo && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-xs bg-white/90 backdrop-blur shadow-sm">
                          {catInfo.icon} {isZh ? catInfo.nameZh : catInfo.nameEn}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    {/* Brand */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">{part.brand}</span>
                    </div>
                    {/* Name */}
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1.5 min-h-[2.5rem]">
                      {partName}
                    </h3>
                    {/* Description */}
                    {partDesc && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2 min-h-[2rem]">
                        {partDesc}
                      </p>
                    )}
                    {/* Compatible models */}
                    {part.compatibleModels && part.compatibleModels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {part.compatibleModels.slice(0, 3).map((model, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {model}
                          </span>
                        ))}
                        {part.compatibleModels.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-gray-400">
                            +{part.compatibleModels.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Price + CTA */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-xl font-bold text-orange-600">
                          ¥{part.price.toLocaleString()}
                        </span>
                      </div>
                      <Link
                        href={`/parts/${part.id}`}
                        className="inline-flex items-center gap-1 text-xs text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
                      >
                        {isZh ? "询价" : "Inquiry"}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* CTA section */}
        <div className="mt-12 rounded-2xl bg-gradient-to-r from-orange-600 to-red-500 p-8 md:p-12 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')", backgroundSize: "40px 40px" }} />
          <div className="relative z-10">
            <Star className="h-10 w-10 mx-auto mb-3 text-yellow-300" />
            <h2 className="text-2xl font-bold mb-3">
              {isZh ? "找不到需要的配件？" : "Can't find the part you need?"}
            </h2>
            <p className="text-white/90 mb-6 max-w-xl mx-auto">
              {isZh
                ? "告诉我们您的设备型号和需求，我们专业团队帮您全球 sourcing，48小时内报价"
                : "Tell us your equipment model and requirements. Our team will source globally and quote within 48 hours"}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/about#contact"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-orange-600 px-7 py-3.5 font-bold hover:bg-orange-50 transition-colors shadow-lg"
              >
                {isZh ? "提交需求" : "Submit Request"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-xl bg-white/20 backdrop-blur text-white px-7 py-3.5 font-medium hover:bg-white/30 transition-colors border border-white/30"
              >
                {isZh ? "浏览农机" : "Browse Machinery"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
