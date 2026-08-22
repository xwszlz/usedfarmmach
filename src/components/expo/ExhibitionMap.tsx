"use client";
import { useState } from "react";
import Link from "next/link";
import { MapPin, Package, ArrowRight } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
interface BoothMapItem {
    id: string;
    name: string;
    hall: string;
    template: string;
    status: string;
    _count?: {
        showcaseItems: number;
    };
    showcaseItems?: {
        length: number;
    };
    merchant?: {
        name: string | null;
    } | null;
}
const HALLS = [
    { id: "tractor", nameZh: "\u62D6\u62C9\u673A\u9986", nameEn: "Tractor Hall", color: "#3b82f6", x: 50, y: 50, w: 280, h: 160 },
    { id: "harvester", nameZh: "\u6536\u83B7\u673A\u68B0\u9986", nameEn: "Harvester Hall", color: "#f59e0b", x: 370, y: 50, w: 280, h: 160 },
    { id: "planter", nameZh: "\u79CD\u690D\u673A\u68B0\u9986", nameEn: "Planter Hall", color: "#10b981", x: 50, y: 260, w: 280, h: 140 },
    { id: "sprayer", nameZh: "\u690D\u4FDD\u673A\u68B0\u9986", nameEn: "Sprayer Hall", color: "#8b5cf6", x: 370, y: 260, w: 280, h: 140 },
    { id: "comprehensive", nameZh: "\u7EFC\u5408\u9986", nameEn: "Comprehensive Hall", color: "#ef4444", x: 170, y: 440, w: 360, h: 120 },
];
export default function ExhibitionMap({ booths, locale }: {
    booths: BoothMapItem[];
    locale: string;
}) {
    const tr = useTr();
    const [hoveredHall, setHoveredHall] = useState<string | null>(null);
    const [selectedHall, setSelectedHall] = useState<string | null>(null);
    const t = locale === "zh" ? {
        title: tr("虚拟展馆地图"),
        entrance: "\u5165\u53E3",
        clickHint: "\u70B9\u51FB\u5C55\u9986\u67E5\u770B\u5C55\u4F4D",
        booths: "\u5C55\u4F4D",
        items: "\u5C55\u54C1",
        empty: "\u6682\u65E0\u5C55\u4F4D",
        enter: "\u8FDB\u5165",
        visitor: "\u8BBF\u5BA2\u4E2D\u5FC3",
    } : locale === "ru" ? {
        title: "\u041A\u0430\u0440\u0442\u0430 \u0432\u044B\u0441\u0442\u0430\u0432\u043A\u0438",
        entrance: "\u0412\u0445\u043E\u0434",
        clickHint: "\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u043D\u0430 \u0437\u0430\u043B",
        booths: "\u0441\u0442\u0435\u043D\u0434\u044B",
        items: "\u044D\u043A\u0441\u043F\u043E\u043D\u0430\u0442\u044B",
        empty: "\u041D\u0435\u0442 \u0441\u0442\u0435\u043D\u0434\u043E\u0432",
        enter: "\u0412\u043E\u0439\u0442\u0438",
        visitor: "\u0426\u0435\u043D\u0442\u0440",
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
        if (!boothsByHall[b.hall])
            boothsByHall[b.hall] = [];
        boothsByHall[b.hall].push(b);
    });
    const filteredBooths = selectedHall ? boothsByHall[selectedHall] || [] : [];
    return (<div className="space-y-4">
      {/* SVG Map */}
      <div className="overflow-x-auto rounded-xl border bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <svg viewBox="0 0 700 600" className="mx-auto" style={{ minWidth: 600, maxWidth: 700 }}>
          {/* Background */}
          <rect x="0" y="0" width="700" height="600" fill="transparent"/>

          {/* Entrance */}
          <rect x="280" y="570" width="140" height="25" fill="#475569" rx="4"/>
          <text x="350" y="588" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
            {t.entrance}
          </text>

          {/* Visitor Center */}
          <rect x="300" y="420" width="100" height="20" fill="#94a3b8" rx="3"/>
          <text x="350" y="434" textAnchor="middle" fill="white" fontSize="9">
            {t.visitor}
          </text>

          {/* Halls */}
          {HALLS.map((hall) => {
            const hallBooths = boothsByHall[hall.id] || [];
            const isHovered = hoveredHall === hall.id;
            const isSelected = selectedHall === hall.id;
            const itemCount = hallBooths.reduce((s, b) => s + (b._count?.showcaseItems || b.showcaseItems?.length || 0), 0);
            return (<g key={hall.id} onMouseEnter={() => setHoveredHall(hall.id)} onMouseLeave={() => setHoveredHall(null)} onClick={() => setSelectedHall(selectedHall === hall.id ? null : hall.id)} style={{ cursor: "pointer" }}>
                {/* Hall background */}
                <rect x={hall.x} y={hall.y} width={hall.w} height={hall.h} fill={hall.color} fillOpacity={isSelected ? 0.3 : isHovered ? 0.2 : 0.1} stroke={hall.color} strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5} rx="8"/>
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
                    return (<g key={b.id}>
                      <Link href={`/${locale}/expo/booth/${b.id}`}>
                        <rect x={bx} y={by} width={70} height={35} fill="white" stroke={hall.color} strokeWidth="1" rx="4" className="transition hover:fill-blue-50"/>
                        <text x={bx + 35} y={by + 15} textAnchor="middle" fill="#334155" fontSize="7" fontWeight="500">
                          {(b.merchant?.name || b.name).substring(0, 8)}
                        </text>
                        <text x={bx + 35} y={by + 26} textAnchor="middle" fill="#94a3b8" fontSize="6">
                          {b._count?.showcaseItems || b.showcaseItems?.length || 0} {t.items}
                        </text>
                      </Link>
                    </g>);
                })}

                {/* "More" indicator */}
                {hallBooths.length > 6 && (<text x={hall.x + hall.w / 2} y={hall.y + hall.h - 8} textAnchor="middle" fill={hall.color} fontSize="9" fontWeight="500">
                    +{hallBooths.length - 6} more...
                  </text>)}
              </g>);
        })}

          {/* Aisles */}
          <line x1="340" y1="50" x2="340" y2="400" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4,4"/>
          <line x1="50" y1="230" x2="650" y2="230" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4,4"/>
        </svg>
      </div>

      {/* Selected hall details */}
      {selectedHall && (<div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">
              {HALLS.find(h => h.id === selectedHall)?.[locale === "zh" ? "nameZh" : "nameEn"]}
            </h3>
            <button onClick={() => setSelectedHall(null)} className="text-sm text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
          {filteredBooths.length === 0 ? (<p className="py-4 text-center text-sm text-gray-400">{t.empty}</p>) : (<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredBooths.map(b => (<Link key={b.id} href={`/${locale}/expo/booth/${b.id}`} className="group flex items-center gap-3 rounded-lg border p-3 transition hover:border-blue-300 hover:bg-blue-50">
                  <MapPin className="h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-blue-500"/>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{b.merchant?.name || b.name}</p>
                    <p className="text-xs text-gray-400">
                      {b._count?.showcaseItems || b.showcaseItems?.length || 0} {t.items}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500"/>
                </Link>))}
            </div>)}
        </div>)}

      {!selectedHall && (<p className="text-center text-sm text-gray-400">{t.clickHint}</p>)}
    </div>);
}
