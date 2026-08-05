"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface Rental {
  id: string;
  rentalType: string;
  pricePerDay: number | null;
  pricePerMonth: number | null;
  pricePerYear: number | null;
  deposit: number | null;
  minRentalPeriod: number | null;
  maxRentalPeriod: number | null;
  deliveryAvailable: boolean;
  deliveryFee: number | null;
  status: string;
  createdAt: string;
  product: {
    id: string;
    modelName: string;
    year: number;
    workingHours: number | null;
    condition: string;
    location: string;
    enginePower: number | null;
    brand: { nameZh: string; nameEn: string };
    images: { url: string }[];
  };
}

export default function RentalsClient() {
  const searchParams = useSearchParams();
  const locale = searchParams.get("locale") || "zh";
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");

  const rentalTypes = [
    { value: "daily", label: locale === "zh" ? "日租" : "Daily" },
    { value: "monthly", label: locale === "zh" ? "月租" : "Monthly" },
    { value: "yearly", label: locale === "zh" ? "年租" : "Yearly" },
  ];

  useEffect(() => {
    fetchRentals();
  }, [filterType]);

  const fetchRentals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "available" });
      if (filterType) params.set("type", filterType);
      const res = await fetch(`/api/rentals?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRentals(data.rentals || []);
      }
    } catch (e) {
      console.error("Failed to fetch rentals:", e);
    }
    setLoading(false);
  };

  const getTypeLabel = (type: string) => {
    const found = rentalTypes.find((t) => t.value === type);
    return found ? found.label : type;
  };

  const getPriceDisplay = (rental: Rental) => {
    if (rental.rentalType === "daily" && rental.pricePerDay) {
      return { price: `¥${rental.pricePerDay.toLocaleString()}`, unit: locale === "zh" ? "/天" : "/day" };
    }
    if (rental.rentalType === "monthly" && rental.pricePerMonth) {
      return { price: `¥${rental.pricePerMonth.toLocaleString()}`, unit: locale === "zh" ? "/月" : "/month" };
    }
    if (rental.rentalType === "yearly" && rental.pricePerYear) {
      return { price: `¥${rental.pricePerYear.toLocaleString()}`, unit: locale === "zh" ? "/年" : "/year" };
    }
    return { price: locale === "zh" ? "面议" : "Negotiable", unit: "" };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {locale === "zh" ? "农机租赁" : "Machinery Rental"}
        </h1>
        <p className="text-gray-600 mb-8">
          {locale === "zh"
            ? "灵活租赁方案 · 日租/月租/年租 · 含配送"
            : "Flexible rental options · Daily / Monthly / Yearly · Delivery available"}
        </p>

        {/* Type filter */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilterType("")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              !filterType ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {locale === "zh" ? "全部" : "All"}
          </button>
          {rentalTypes.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filterType === t.value ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Rentals grid */}
        {loading ? (
          <p className="text-gray-500">{locale === "zh" ? "加载中..." : "Loading..."}</p>
        ) : rentals.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            {locale === "zh" ? "暂无可租赁设备" : "No rental equipment available"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rentals.map((rental) => {
              const priceInfo = getPriceDisplay(rental);
              const imgUrl = rental.product.images[0]?.url || "/placeholder.png";

              return (
                <div key={rental.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
                  {/* Image */}
                  <div className="relative h-48 bg-gray-200">
                    <img src={imgUrl} alt={rental.product.modelName} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 text-xs rounded-full font-medium">
                      {getTypeLabel(rental.rentalType)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-500">
                        {locale === "zh" ? rental.product.brand.nameZh : rental.product.brand.nameEn}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{rental.product.modelName}</h3>

                    <div className="flex gap-3 text-sm text-gray-500 mb-3">
                      <span>{rental.product.year}{locale === "zh" ? "年" : ""}</span>
                      {rental.product.workingHours && (
                        <span>{rental.product.workingHours}h</span>
                      )}
                      {rental.product.enginePower && (
                        <span>{rental.product.enginePower}HP</span>
                      )}
                      <span>📍 {rental.product.location}</span>
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold text-blue-600">{priceInfo.price}</span>
                      <span className="text-sm text-gray-500">{priceInfo.unit}</span>
                    </div>

                    {/* Additional info */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {rental.deposit && (
                        <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded">
                          {locale === "zh" ? "押金" : "Deposit"}: ¥{rental.deposit.toLocaleString()}
                        </span>
                      )}
                      {rental.minRentalPeriod && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {locale === "zh" ? "最短" : "Min"}: {rental.minRentalPeriod}{rental.rentalType === "daily" ? (locale === "zh" ? "天" : "d") : rental.rentalType === "monthly" ? (locale === "zh" ? "月" : "m") : (locale === "zh" ? "年" : "y")}
                        </span>
                      )}
                      {rental.deliveryAvailable && (
                        <span className="px-2 py-1 bg-green-50 text-green-600 rounded">
                          {locale === "zh" ? "✓ 可配送" : "✓ Delivery"}
                        </span>
                      )}
                    </div>

                    {/* CTA */}
                    <a
                      href={`/products/${rental.product.id}`}
                      className="block w-full text-center mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                      {locale === "zh" ? "查看详情" : "View Details"}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
