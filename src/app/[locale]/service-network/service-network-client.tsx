"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Clock, Wrench, Search, Building, Store } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";

interface ServiceCenter {
  id: string;
  name: string;
  level: string;
  province: string;
  city: string | null;
  district: string | null;
  address: string;
  contactPerson: string | null;
  contactPhone: string | null;
  services: string[];
  businessHours: string | null;
  description: string | null;
}

const LEVEL_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  province: { label: "省级中心", color: "bg-blue-100 text-blue-700", icon: Building },
  city: { label: "市级网点", color: "bg-green-100 text-green-700", icon: Store },
  county: { label: "县域网点", color: "bg-amber-100 text-amber-700", icon: MapPin },
};

const SERVICE_LABELS: Record<string, string> = {
  inspection: "设备检测",
  repair: "维修保养",
  valuation: "评估鉴定",
  trade: "交易撮合",
  parts: "配件供应",
  transport: "物流运输",
};

export default function ServiceNetworkClient({
  grouped,
  summary,
  locale,
  error = false,
}: {
  grouped: Record<string, ServiceCenter[]>;
  summary: { total: number; provinceCount: number; provinceLevel: number; cityLevel: number; countyLevel: number };
  locale: string;
  error?: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const tr = useTr();

  const provinces = Object.keys(grouped).sort();

  // 筛选
  const filteredProvinces = provinces.filter((p) => {
    if (!searchTerm) return true;
    const centers = grouped[p];
    return (
      p.includes(searchTerm) ||
      centers.some(
        (c) =>
          c.name.includes(searchTerm) ||
          c.address.includes(searchTerm) ||
          c.city?.includes(searchTerm)
      )
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {tr("线下服务网络")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {tr("全国省级服务中心+县域服务网点，提供设备检测、维修、评估、交易等线下服务")}
        </p>
      </div>

      {/* 统计摘要 */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-primary-600">{summary.total}</p>
            <p className="text-xs text-gray-500">{tr("服务网点")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{summary.provinceCount}</p>
            <p className="text-xs text-gray-500">{tr("覆盖省份")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-green-600">{summary.provinceLevel}</p>
            <p className="text-xs text-gray-500">{tr("省级中心")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{summary.countyLevel}</p>
            <p className="text-xs text-gray-500">{tr("县域网点")}</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索栏 */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={tr("搜索省份、城市、网点名称...")}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* 无数据提示 */}
      {summary.total === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Wrench className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">
              {error
                ? (tr("服务网点数据暂时无法加载，请稍后重试"))
                : (tr("服务网点正在建设中，敬请期待"))}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              {tr("如需线下服务，请拨打客服热线：400-888-XXXX")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 按省份展示网点 */}
      <div className="space-y-6">
        {filteredProvinces.map((province) => (
          <div key={province}>
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-bold text-gray-900">{province}</h2>
              <Badge variant="secondary">{grouped[province].length}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grouped[province].map((center) => {
                const levelInfo = LEVEL_LABELS[center.level] || LEVEL_LABELS.county;
                const LevelIcon = levelInfo.icon;
                return (
                  <Card key={center.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{center.name}</CardTitle>
                        <Badge className={levelInfo.color}>
                          <LevelIcon className="mr-1 h-3 w-3" />
                          {levelInfo.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                        <span>
                          {center.city && `${center.city} `}
                          {center.district && `${center.district} `}
                          {center.address}
                        </span>
                      </div>
                      {center.contactPhone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{center.contactPhone}</span>
                          {center.contactPerson && (
                            <span className="text-gray-400">({center.contactPerson})</span>
                          )}
                        </div>
                      )}
                      {center.businessHours && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span>{center.businessHours}</span>
                        </div>
                      )}
                      {center.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {center.services.map((s) => (
                            <Badge key={s} variant="outline" className="text-xs">
                              {SERVICE_LABELS[s] || s}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {center.description && (
                        <p className="text-xs text-gray-400 pt-1">{center.description}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
