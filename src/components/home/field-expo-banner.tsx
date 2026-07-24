"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Calendar, MapPin, Play, Clock } from "lucide-react";
import { useState, useEffect } from "react";

interface FieldExpoBannerProps {
  locale: string;
}

export function FieldExpoBanner({ locale }: FieldExpoBannerProps) {
  const isZh = locale === "zh";
  const [days, setDays] = useState(5);
  const [hours, setHours] = useState(0);

  useEffect(() => {
    const target = new Date("2026-07-29T09:00:00+08:00").getTime();
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setDays(Math.floor(diff / (1000 * 60 * 60 * 24)));
      setHours(Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-gradient-to-r from-green-700 via-green-600 to-emerald-500">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          {/* Left: text */}
          <div className="flex items-center gap-3">
            <div className="hidden rounded-lg bg-white/20 px-3 py-1 text-sm font-bold text-white sm:block">
              🔥 {isZh ? "地头展" : "Field Expo"}
            </div>
            <div className="text-center text-sm text-white sm:text-left">
              <span className="font-semibold">
                {isZh ? "第28届河北农机推广演示会" : "28th Hebei Agri Machinery Expo"}
              </span>
              <div className="flex items-center gap-2 text-green-100">
                <Calendar className="h-3 w-3" />
                <span>{isZh ? "7/29 · 元氏 · 神雕农机" : "Jul 29 · Yuanshi"}</span>
                <Clock className="ml-1 h-3 w-3" />
                <span>
                  {isZh
                    ? `倒计时 ${days}天 ${hours}小时`
                    : `${days}d ${hours}h`}
                </span>
              </div>
            </div>
          </div>

          {/* Right: CTA */}
          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/expo/28th-field-expo-2026`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-green-700 shadow transition hover:bg-green-50"
            >
              <Play className="h-4 w-4" />
              {isZh ? "展会详情" : "Expo Details"}
            </Link>
          </div>
        </div>

        {/* Mobile: GIF image bar */}
        <div className="mt-2 flex justify-center sm:hidden">
          <img
            src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/expo/28th-field-expo-2026/preview.gif"
            alt="展会"
            className="h-6 w-auto opacity-80"
          />
        </div>
      </div>
    </div>
  );
}
