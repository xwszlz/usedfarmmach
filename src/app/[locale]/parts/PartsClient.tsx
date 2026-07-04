"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Search, Package, Truck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getImageUrl } from "@/lib/image-url";

interface PartItem {
  id: string;
  name: string;
  nameEn?: string;
  brand?: string;
  category: string;
  price: number;
  priceUnit: string;
  image?: string;
  description?: string;
  inStock: boolean;
  compatibleModels?: string[];
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

// 示例零配件数据（后续对接数据库）
const SAMPLE_PARTS: PartItem[] = [
  { id: "p1", name: "约翰迪尔发动机滤芯组", nameEn: "John Deere Engine Filter Kit", brand: "John Deere", category: "filters", price: 380, priceUnit: "CNY", inStock: true, compatibleModels: ["5045E", "5055E", "5065E"] },
  { id: "p2", name: "克拉斯液压泵", nameEn: "CLAAS Hydraulic Pump", brand: "CLAAS", category: "hydraulic", price: 12500, priceUnit: "CNY", inStock: true, compatibleModels: ["LEXION 770", "LEXION 780"] },
  { id: "p3", name: "纽荷兰离合器片", nameEn: "New Holland Clutch Disc", brand: "New Holland", category: "transmission", price: 2800, priceUnit: "CNY", inStock: true, compatibleModels: ["TD5.90", "TD5.110"] },
  { id: "p4", name: "库恩割刀总成", nameEn: "KUHN Cutter Bar Assembly", brand: "KUHN", category: "body", price: 8500, priceUnit: "CNY", inStock: false, compatibleModels: ["FC 313", "FC 316"] },
  { id: "p5", name: "通用发电机总成", nameEn: "Universal Alternator Assembly", brand: "Bosch", category: "electrical", price: 1600, priceUnit: "CNY", inStock: true, compatibleModels: ["通用12V/24V"] },
  { id: "p6", name: "拖拉机前轮胎 11.2-24", nameEn: "Tractor Front Tire 11.2-24", brand: "Apollo", category: "tires", price: 1200, priceUnit: "CNY", inStock: true },
  { id: "p7", name: "收割机链条 50-H", nameEn: "Harvester Chain 50-H", brand: "Universal", category: "transmission", price: 450, priceUnit: "CNY", inStock: true },
  { id: "p8", name: "液压油缸密封件组", nameEn: "Hydraulic Cylinder Seal Kit", brand: "Parker", category: "bearings", price: 320, priceUnit: "CNY", inStock: true },
];

export default function PartsClient({ locale }: { locale: string }) {
  const isZh = locale === "zh";
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [parts] = useState<PartItem[]>(SAMPLE_PARTS);

  const filteredParts = parts.filter((part) => {
    const matchCategory = selectedCategory === "all" || part.category === selectedCategory;
    const matchSearch =
      !searchQuery ||
      part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (part.nameEn || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (part.brand || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
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
          {isZh ? `共 ${filteredParts.length} 个配件` : `${filteredParts.length} parts found`}
        </div>

        {/* Parts grid */}
        {filteredParts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{isZh ? "暂无匹配的配件" : "No matching parts found"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredParts.map((part) => (
              <Card key={part.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {part.image ? (
                    <img
                      src={getImageUrl(part.image)}
                      alt={isZh ? part.name : part.nameEn || part.name}
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
                    {part.inStock ? (
                      <Badge className="text-xs bg-green-100 text-green-700">
                        {isZh ? "有货" : "In Stock"}
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-gray-100 text-gray-500">
                        {isZh ? "缺货" : "Out of Stock"}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">
                    {isZh ? part.name : part.nameEn || part.name}
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
                      <span className="text-xs text-gray-400 ml-1">/{part.priceUnit}</span>
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
            ))}
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
