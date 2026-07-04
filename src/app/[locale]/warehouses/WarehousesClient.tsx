"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface Warehouse {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  city: string;
  address: string;
  warehouseType: string;
  capacity: number | null;
  area: number | null;
  services: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

export default function WarehousesClient() {
  const searchParams = useSearchParams();
  const locale = searchParams.get("locale") || "zh";
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("");
  const [filterType, setFilterType] = useState("");

  const warehouseTypes = [
    { value: "bonded", label: locale === "zh" ? "保税仓" : "Bonded Warehouse" },
    { value: "standard", label: locale === "zh" ? "普通仓" : "Standard Warehouse" },
    { value: "cold", label: locale === "zh" ? "冷链仓" : "Cold Storage" },
  ];

  useEffect(() => {
    fetchWarehouses();
  }, [filterCountry, filterType]);

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCountry) params.set("country", filterCountry);
      if (filterType) params.set("type", filterType);
      const res = await fetch(`/api/warehouses?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.warehouses || []);
      }
    } catch (e) {
      console.error("Failed to fetch warehouses:", e);
    }
    setLoading(false);
  };

  const getTypeLabel = (type: string) => {
    const found = warehouseTypes.find((t) => t.value === type);
    return found ? found.label : type;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bonded": return "🏭";
      case "cold": return "❄️";
      default: return "📦";
    }
  };

  const parseServices = (services: string | null): string[] => {
    if (!services) return [];
    try {
      return JSON.parse(services);
    } catch {
      return services.split(",").map((s) => s.trim()).filter(Boolean);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {locale === "zh" ? "海外仓信息" : "Overseas Warehouses"}
        </h1>
        <p className="text-gray-600 mb-8">
          {locale === "zh"
            ? "全球仓储资源 · 跨境物流节点"
            : "Global warehousing resources · Cross-border logistics nodes"}
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            placeholder={locale === "zh" ? "国家（如：Russia）" : "Country (e.g., Russia)"}
            className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{locale === "zh" ? "全部类型" : "All types"}</option>
            {warehouseTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Warehouse grid */}
        {loading ? (
          <p className="text-gray-500">{locale === "zh" ? "加载中..." : "Loading..."}</p>
        ) : warehouses.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            {locale === "zh" ? "暂无海外仓数据" : "No warehouse data available"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((wh) => {
              const services = parseServices(wh.services);
              return (
                <div key={wh.id} className="bg-white rounded-lg shadow p-5 hover:shadow-lg transition">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{getTypeIcon(wh.warehouseType)}</span>
                        <h3 className="font-semibold text-gray-900">
                          {locale === "zh" ? wh.name : wh.nameEn || wh.name}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-500">
                        📍 {wh.city}, {wh.country}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
                      wh.status === "active" ? "bg-green-100 text-green-700" :
                      wh.status === "full" ? "bg-orange-100 text-orange-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {getTypeLabel(wh.warehouseType)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{wh.address}</p>

                  {/* Specs */}
                  <div className="flex gap-4 text-sm text-gray-500 mb-3">
                    {wh.area && (
                      <span>{locale === "zh" ? "面积" : "Area"}: {wh.area.toLocaleString()} m²</span>
                    )}
                    {wh.capacity && (
                      <span>{locale === "zh" ? "容量" : "Capacity"}: {wh.capacity.toLocaleString()} m³</span>
                    )}
                  </div>

                  {/* Services */}
                  {services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {services.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Contact */}
                  {(wh.contactName || wh.contactPhone || wh.contactEmail) && (
                    <div className="pt-3 border-t text-sm text-gray-600">
                      {wh.contactName && <p>👤 {wh.contactName}</p>}
                      {wh.contactPhone && <p>📞 {wh.contactPhone}</p>}
                      {wh.contactEmail && <p>✉️ {wh.contactEmail}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
