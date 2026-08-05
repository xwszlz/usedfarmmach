"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";

interface MaintenanceRecord {
  id: string;
  maintenanceType: string;
  title: string;
  description: string | null;
  cost: number | null;
  status: string;
  scheduledDate: string | null;
  completedDate: string | null;
  technician: string | null;
  notes: string | null;
  rating: number | null;
  createdAt: string;
  product: {
    id: string;
    modelName: string;
    year: number;
    brand: { nameZh: string; nameEn: string };
  };
  warranty: { id: string; warrantyType: string; endDate: string } | null;
  serviceCenter: { id: string; name: string; province: string; city: string | null } | null;
}

const TYPE_MAP: Record<string, { zh: string; en: string; icon: string }> = {
  routine: { zh: "日常保养", en: "Routine", icon: "🔧" },
  repair: { zh: "维修", en: "Repair", icon: "🛠️" },
  inspection: { zh: "检测", en: "Inspection", icon: "🔍" },
  emergency: { zh: "紧急维修", en: "Emergency", icon: "🚨" },
};

const STATUS_MAP: Record<string, { zh: string; en: string; color: string }> = {
  scheduled: { zh: "已预约", en: "Scheduled", color: "bg-blue-100 text-blue-700" },
  in_progress: { zh: "进行中", en: "In Progress", color: "bg-yellow-100 text-yellow-700" },
  completed: { zh: "已完成", en: "Completed", color: "bg-green-100 text-green-700" },
  cancelled: { zh: "已取消", en: "Cancelled", color: "bg-gray-100 text-gray-500" },
};

export default function MaintenanceClient() {
  const locale = useLocale();
  const isZh = locale === "zh";
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await fetch("/api/maintenance", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setRecords(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch records:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isZh ? "售后维保记录" : "Maintenance Records"}
      </h1>

      {records.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <p className="text-gray-400 text-lg">
            {isZh ? "暂无维保记录" : "No maintenance records"}
          </p>
          <p className="text-gray-400 text-sm mt-2">
            {isZh ? "在产品详情页可以预约维修服务" : "Schedule maintenance from product detail page"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => {
            const typeInfo = TYPE_MAP[record.maintenanceType] || TYPE_MAP.repair;
            const statusInfo = STATUS_MAP[record.status] || STATUS_MAP.scheduled;
            return (
              <div key={record.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <span className="text-2xl">{typeInfo.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{record.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {record.product.brand.nameZh} {record.product.modelName} · {record.product.year}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                          {isZh ? typeInfo.zh : typeInfo.en}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                          {isZh ? statusInfo.zh : statusInfo.en}
                        </span>
                        {record.warranty && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            {isZh ? "质保内" : "Under Warranty"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {record.cost !== null && (
                      <p className="font-semibold text-gray-900">¥{record.cost.toLocaleString()}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(record.createdAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm">
                  {record.scheduledDate && (
                    <div>
                      <span className="text-gray-400">{isZh ? "预约时间" : "Scheduled"}: </span>
                      <span className="text-gray-700">
                        {new Date(record.scheduledDate).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                      </span>
                    </div>
                  )}
                  {record.completedDate && (
                    <div>
                      <span className="text-gray-400">{isZh ? "完成时间" : "Completed"}: </span>
                      <span className="text-gray-700">
                        {new Date(record.completedDate).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                      </span>
                    </div>
                  )}
                  {record.technician && (
                    <div>
                      <span className="text-gray-400">{isZh ? "维修技师" : "Technician"}: </span>
                      <span className="text-gray-700">{record.technician}</span>
                    </div>
                  )}
                  {record.serviceCenter && (
                    <div>
                      <span className="text-gray-400">{isZh ? "服务网点" : "Service Center"}: </span>
                      <span className="text-gray-700">{record.serviceCenter.name}</span>
                    </div>
                  )}
                  {record.rating && (
                    <div>
                      <span className="text-gray-400">{isZh ? "评分" : "Rating"}: </span>
                      <span className="text-yellow-500">{"⭐".repeat(record.rating)}</span>
                    </div>
                  )}
                </div>

                {record.description && (
                  <p className="mt-2 text-sm text-gray-600">{record.description}</p>
                )}
                {record.notes && (
                  <div className="mt-2 bg-gray-50 rounded p-2 text-sm text-gray-600">
                    <span className="font-medium">{isZh ? "备注" : "Notes"}: </span>
                    {record.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
