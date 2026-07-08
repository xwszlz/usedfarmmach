"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Wrench, Search, Package, Truck, ShieldCheck, Tag, Boxes, Zap, CheckCircle2, ArrowRight, Star, X, Filter } from "lucide-react";
import PartsCatalogNav, { type CatalogTreeNode } from "@/components/parts/PartsCatalogNav";
import PartsGrid from "@/components/parts/PartsGrid";
import PartsBreadcrumb from "@/components/parts/PartsBreadcrumb";
import type { PartCardData } from "@/components/parts/PartCard";

interface PartsClientProps {
  locale: string;
  initialCatalogTree: CatalogTreeNode[];
}

interface PartsApiResponse {
  success: boolean;
  data: PartCardData[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    brands: string[];
  };
}

export default function PartsClient({ locale, initialCatalogTree }: PartsClientProps) {
  const isZh = locale === "zh";

  // Navigation state
  const [catalogTree] = useState<CatalogTreeNode[]>(initialCatalogTree);
  const [selectedMachineType, setSelectedMachineType] = useState<string | null>(null);
  const [selectedSubSystem, setSelectedSubSystem] = useState<string | null>(null);
  const [selectedComponentGroup, setSelectedComponentGroup] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>("all");
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);

  // Data state
  const [parts, setParts] = useState<PartCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Mobile nav toggle
  const [showMobileNav, setShowMobileNav] = useState(false);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch parts from API
  const fetchParts = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (selectedMachineType) params.set("machineType", selectedMachineType);
      if (selectedSubSystem) params.set("subSystem", selectedSubSystem);
      if (selectedComponentGroup) params.set("componentGroup", selectedComponentGroup);
      if (selectedBrand) params.set("brand", selectedBrand);
      if (selectedStockStatus && selectedStockStatus !== "all") params.set("stockStatus", selectedStockStatus);
      if (searchQuery.trim()) params.set("keyword", searchQuery.trim());
      params.set("page", String(page));
      params.set("pageSize", "12");

      const res = await fetch(`/api/parts?${params.toString()}`);
      if (res.ok) {
        const json: PartsApiResponse = await res.json();
        if (json.success) {
          setParts(json.data || []);
          setTotalPages(json.pagination?.totalPages || 1);
          setTotal(json.pagination?.total || 0);
          setAvailableBrands(json.filters?.brands || []);
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
  }, [selectedMachineType, selectedSubSystem, selectedComponentGroup, selectedBrand, selectedStockStatus, searchQuery, page]);

  // Fetch parts when filters change
  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  };

  // Navigation selection handler
  const handleNavSelect = (
    mt: string | null,
    ss: string | null,
    cg: string | null
  ) => {
    setSelectedMachineType(mt);
    setSelectedSubSystem(ss);
    setSelectedComponentGroup(cg);
    setSelectedBrand(""); // Reset brand filter when navigation changes
    setPage(1);
    setShowMobileNav(false);
  };

  // Brand filter handler
  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setPage(1);
  };

  // Stock status filter handler
  const handleStockStatusChange = (status: string) => {
    setSelectedStockStatus(status);
    setPage(1);
  };

  // Page change handler
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    // Scroll to top of parts grid
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 300, behavior: "smooth" });
    }
  };

  // Get breadcrumb names
  const getBreadcrumbNames = () => {
    let mtName: string | undefined;
    let ssName: string | undefined;
    let cgName: string | undefined;

    if (selectedMachineType && catalogTree.length > 0) {
      const mt = catalogTree.find((m) => m.code === selectedMachineType);
      if (mt) {
        mtName = isZh ? mt.nameZh : mt.nameEn;
        if (selectedSubSystem) {
          const ss = mt.subSystems.find((s) => s.code === selectedSubSystem);
          if (ss) {
            ssName = isZh ? ss.nameZh : ss.nameEn;
            if (selectedComponentGroup) {
              const cg = ss.componentGroups.find((c) => c.code === selectedComponentGroup);
              if (cg) {
                cgName = isZh ? cg.nameZh : cg.nameEn;
              }
            }
          }
        }
      }
    }

    return { mtName, ssName, cgName };
  };

  const { mtName, ssName, cgName } = getBreadcrumbNames();

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
                ? "四级分类导航 · 原厂配件 · 品牌兼容件 · 全国配送 — 为您的农机提供全生命周期配件保障"
                : "Four-Level Catalog · OEM Parts · Compatible Components · Nationwide Delivery — Full lifecycle parts support"}
            </p>

            {/* Stats */}
            <div className="flex flex-wrap gap-6 mb-6">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-white/80" />
                <span className="text-sm font-medium">{isZh ? "14大品类" : "14 Categories"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-white/80" />
                <span className="text-sm font-medium">{isZh ? "60+ SKU" : "60+ SKUs"}</span>
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
                placeholder={isZh ? "搜索配件名称、品牌、OEM编号..." : "Search parts, brands, OEM numbers..."}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 bg-white shadow-lg focus:outline-none focus:ring-4 focus:ring-white/30"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
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

        {/* Breadcrumb */}
        <PartsBreadcrumb
          locale={locale}
          machineTypeName={mtName}
          subSystemName={ssName}
          componentGroupName={cgName}
        />

        {/* Mobile nav toggle */}
        <button
          onClick={() => setShowMobileNav(!showMobileNav)}
          className="lg:hidden mb-4 w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-orange-600" />
            {isZh ? "配件分类导航" : "Parts Catalog"}
          </span>
          {showMobileNav ? <X className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        </button>

        {/* Main layout: left nav + right content */}
        <div className="flex gap-6">
          {/* Left navigation - desktop */}
          <div className={`w-64 flex-shrink-0 ${showMobileNav ? "block fixed inset-0 z-50 bg-black/50 lg:bg-transparent lg:static lg:z-auto" : "hidden lg:block"}`}>
            <div className={`lg:sticky lg:top-4 ${showMobileNav ? "h-full overflow-y-auto p-4 lg:p-0" : ""}`}>
              {showMobileNav && (
                <div className="lg:hidden flex justify-end mb-2">
                  <button onClick={() => setShowMobileNav(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>
              )}
              <PartsCatalogNav
                catalogTree={catalogTree}
                selectedMachineType={selectedMachineType}
                selectedSubSystem={selectedSubSystem}
                selectedComponentGroup={selectedComponentGroup}
                onSelect={handleNavSelect}
                locale={locale}
              />
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0">
            {/* Filter bar */}
            <div className="mb-4 flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 p-3">
              {/* Brand filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">{isZh ? "品牌:" : "Brand:"}</span>
                <select
                  value={selectedBrand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">{isZh ? "全部" : "All"}</option>
                  {availableBrands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock status filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">{isZh ? "库存:" : "Stock:"}</span>
                <select
                  value={selectedStockStatus}
                  onChange={(e) => handleStockStatusChange(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="all">{isZh ? "全部" : "All"}</option>
                  <option value="in_stock">{isZh ? "有货" : "In Stock"}</option>
                  <option value="low_stock">{isZh ? "库存紧张" : "Low Stock"}</option>
                  <option value="out_of_stock">{isZh ? "缺货" : "Out of Stock"}</option>
                </select>
              </div>

              {/* Clear filters */}
              {(selectedBrand || selectedMachineType || selectedSubSystem || selectedComponentGroup || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedBrand("");
                    setSearchQuery("");
                    handleNavSelect(null, null, null);
                    setSelectedStockStatus("all");
                  }}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium ml-auto"
                >
                  {isZh ? "清除筛选" : "Clear Filters"}
                </button>
              )}
            </div>

            {/* Parts grid */}
            <PartsGrid
              parts={parts}
              loading={loading}
              error={error}
              locale={locale}
              page={page}
              totalPages={totalPages}
              total={total}
              onPageChange={handlePageChange}
            />
          </div>
        </div>

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
              <a
                href="/about#contact"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-orange-600 px-7 py-3.5 font-bold hover:bg-orange-50 transition-colors shadow-lg"
              >
                {isZh ? "提交需求" : "Submit Request"}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/products"
                className="inline-flex items-center gap-2 rounded-xl bg-white/20 backdrop-blur text-white px-7 py-3.5 font-medium hover:bg-white/30 transition-colors border border-white/30"
              >
                {isZh ? "浏览农机" : "Browse Machinery"}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
