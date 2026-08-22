"use client";
import { translate } from "@/lib/i18n-runtime";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Calendar, MapPin, Play, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { isCnSite } from "@/config/site";
import { useTr } from "@/lib/i18n-tr";
interface FieldExpoBannerProps {
    locale: string;
}
export function FieldExpoBanner({ locale }: FieldExpoBannerProps) {
  const tr = useTr();
    const isZh = locale === "zh";
    const isCn = isCnSite();
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
    return (<div className="bg-gradient-to-r from-green-700 via-green-600 to-emerald-500">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          {/* Left: text */}
          <div className="flex items-center gap-3">
            <div className="hidden rounded-lg bg-white/20 px-3 py-1 text-sm font-bold text-white sm:block">
              🔥 {isCn ? (tr("地头展")) : (tr("真实作业验证"))}
            </div>
            <div className="text-center text-sm text-white sm:text-left">
              <span className="font-semibold">
                {isCn
            ? (tr("第28届河北农机推广演示会"))
            : (tr("神雕展翼 · 真实作业视频"))}
              </span>
              {isCn ? (<div className="flex items-center gap-2 text-green-100">
                  <Calendar className="h-3 w-3"/>
                  <span>{tr("7/29 · 元氏 · 神雕农机")}</span>
                  <Clock className="ml-1 h-3 w-3"/>
                  <span>
                    {isZh
                ? `倒计时 ${days}天 ${hours}小时`
                : `${days}d ${hours}h`}
                  </span>
                </div>) : (<div className="flex items-center gap-2 text-green-100">
                  <Play className="h-3 w-3"/>
                  <span>{tr("真机下地 · 实效验证")}</span>
                </div>)}
            </div>
          </div>

          {/* Right: CTA */}
          <div className="flex items-center gap-2">
            <Link href={`/${locale}${isCn ? "/expo/28th-field-expo-2026" : "/expo/field-videos"}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-green-700 shadow transition hover:bg-green-50">
              <Play className="h-4 w-4"/>
              {isCn ? (tr("展会详情")) : (tr("观看作业视频"))}
            </Link>
          </div>
        </div>

        {/* Mobile: GIF image bar */}
        <div className="mt-2 flex justify-center sm:hidden">
          <img src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/expo/28th-field-expo-2026/preview.gif" alt={tr("展会")} className="h-6 w-auto opacity-80"/>
        </div>
      </div>
    </div>);
}
