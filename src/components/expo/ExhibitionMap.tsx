"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Package, ArrowRight } from "lucide-react";

interface BoothMapItem {
  id: string;
  name: string;
  hall: string;
  template: string;
  status: string;
  _count?: { showcaseItems: number };
  showcaseItems?: { length: number };
  merchant?: { name: string | null } | null;
}

const HALLS = [
  { id: "tractor", nameZh: "拖拉机馆", nameEn: "Tractor Hall", color: "#3b82f6", x: 50, y: 50, w: 280, h: 160 },
  { id: "harvester", nameZh: "收获机械馆", nameEn: "Harvester Hall", color: "#f59e0b", x: 370, y: 50, w: 280, h: 160 },
  { id: "planter", nameZh: "种植机械馆", nameEn: "Planter Hall", color: "#10b981", x: 50, y: 260, w: 280, h: 140 },
  { id: "sprayer", nameZh: "植保机械馆", nameEn: "Sprayer Hall", color: "#8b5cf6", x: 370, y: 260, w: 280, h: 140 },
  { id: "comprehensive", nameZh: "综合馆", nameEn: "Comprehensive Hall", color: "#ef4444", x: 170, y: 440, w: 360, h: 120 },
];

export default function ExhibitionMap({ booths, locale }: {
  booths: BoothMapItem[];
  locale: string;
}) {
  const [hoveredHall, setHoveredHall] = useState<string | null>(null);
  const [selectedHall, setSelectedHall] = useState<string | null>(null);

  const t = locale === "zh" ? {
    title: "虚拟展馆地图",
    entrance: "入口",
    clickHint: "点击展馆查看展位",
    booths: "展位",
    items: "展品",
    empty: "暂无展位",
    enter: "进入",
    visitor: "访客中心",
  } : locale === "ru" ? {
    title: "Карта выставки",
    entrance: "Вход",
    clickHint: "Нажмите на зал",
    booths: "стенды",
    items: "экспонаты",
    empty: "Нет стендов",
    enter: "Войти",
    visitor: "Центр",
  } : {
    title: "Exhibition Map",
    entrance: "Entrance",
    clickHint: "Click a hall",
    booths: "booths",
    items: "items",
    empty: "No booths",
    enter: "Enter",
    visitor: "Center",
  };

  // Group booths by hall
  const boothsByHall: Record<string, BoothMapItem[]> = {};
  booths.forEach(b => {
    if (!boothsByHall[b.hall]) boothsByHall[b.hall] = [];
    boothsByHall[b.hall].push(b);
  });

  const filteredBooths = selectedHall ? boothsByHall[selectedHall] || [] : [];

  return (
    <div className="space-y-4">
      {/* SVG Map */}
      <div className="overflow-x-auto rounded-xl border bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <svg viewBox="0 0 700 600" className="mx-auto" style={{ minWidth: 600, maxWidth: 700 }}>
          {/* Background */}
          <rect x="0" y="0" width="700" height="600" fill="transparent" />

          {/* Entrance */}
          <rect x="280" y="570" width="140" height="25" fill="#475569" rx="4" />
          <text x="350" y="588" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
            {t.entrance}
          </text>

          {/* Visitor Center */}
          <rect x="300" y="420" width="100" height="20" fill="#94a3b8" rx="3" />
          <text x="350" y="434" textAnchor="middle" fill="white" fontSize="9">
            {t.visitor}
          </text>

          {/* Halls */}
          {HALLS.map((hall) => {
            const hallBooths = boothsByHall[hall.id] || [];
            const isHovered = hoveredHall === hall.id;
            const isSelected = selectedHall === hall.id;
            const itemCount = hallBooths.reduce((s, b) => s + (b._count?.showcaseItems || b.showcaseItems?.length || 0), 0);

            return (
              <g key={hall.id}
                onMouseEnter={() => setHoveredHall(hall.id)}
                onMouseLeave={() => setHoveredHall(null)}
                onClick={() => setSelectedHall(selectedHall === hall.id ? null : hall.id)}
                style={{ cursor: "pointer" }}>
                {/* Hall background */}
                <rect
                  x={hall.x} y={hall.y} width={hall.w} height={hall.h}
                  fill={hall.color}
                  fillOpacity={isSelected ? 0.3 : isHovered ? 0.2 : 0.1}
                  stroke={hall.color}
                  strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5}
                  rx="8"
                />
                {/* Hall name */}
                <text x={hall.x + hall.w / 2} y={hall.y + 24} textAnchor="middle" fill={hall.color} fontSize="14" fontWeight="bold">
                  {locale === "zh" ? hall.nameZh : hall.nameEn}
                </text>
                {/* Stats */}
                <text x={hall.x + hall.w / 2} y={hall.y + 42} textAnchor="middle" fill="#64748b" fontSize="11">
                  {hallBooths.length} {t.booths} · {itemCount} {t.items}
                </text>

                {/* Mini booth markers */}
                {hallBooths.slice(0, 6).map((b, i) => {
                  const col = i % 3;
                  const row = Math.floor(i / 3);
                  const bx = hall.x + 30 + col * 80;
                  const by = hall.y + 55 + row * 45;
                  return (
                    <g key={b.id}>
                      <Link href={`/${locale}/expo/booth/${b.id}`}>
                        <rect x={bx} y={by} width={70} height={35} fill="white" stroke={hall.color} strokeWidth="1" rx="4" className="transition hover:fill-blue-50" />
                        <text x={bx + 35} y={by + 15} textAnchor="middle" fill="#334155" fontSize="7" fontWeight="500">
                          {(b.merchant?.name || b.name).substring(0, 8)}
                        </text>
                        <text x={bx + 35} y={by + 26} textAnchor="middle" fill="#94a3b8" fontSize="6">
                          {b._count?.showcaseItems || b.showcaseItems?.length || 0} {t.items}
                        </text>
                      </Link>
                    </g>
                  );
                })}

                {/* "More" indicator */}
                {hallBooths.length > 6 && (
                  <text x={hall.x + hall.w / 2} y={hall.y + hall.h - 8} textAnchor="middle" fill={hall.color} fontSize="9" fontWeight="500">
                    +{hallBooths.length - 6} more...
                  </text>
                )}
              </g>
            );
          })}

          {/* Aisles */}
          <line x1="340" y1="50" x2="340" y2="400" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4,4" />
          <line x1="50" y1="230" x2="650" y2="230" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4,4" />
        </svg>
      </div>

      {/* Selected hall details */}
      {selectedHall && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">
              {HALLS.find(h => h.id === selectedHall)?.[locale === "zh" ? "nameZh" : "nameEn"]}
            </h3>
            <button onClick={() => setSelectedHall(null)} className="text-sm text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
          {filteredBooths.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">{t.empty}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredBooths.map(b => (
                <Link key={b.id} href={`/${locale}/expo/booth/${b.id}`}
                  className="group flex items-center gap-3 rounded-lg border p-3 transition hover:border-blue-300 hover:bg-blue-50">
                  <MapPin className="h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{b.merchant?.name || b.name}</p>
                    <p className="text-xs text-gray-400">
                      {b._count?.showcaseItems || b.showcaseItems?.length || 0} {t.items}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedHall && (
        <p className="text-center text-sm text-gray-400">{t.clickHint}</p>
      )}
    </div>
  );
}
