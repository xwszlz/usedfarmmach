"use client";

import { translate } from "@/lib/i18n-runtime";
import Link from "next/link";
import { Play } from "lucide-react";

interface FieldExpoBannerProps {
  locale: string;
}

/**
 * 神雕展翼 · 真实作业视频 —— 首页常设入口条。
 *
 * 2026-09-25 改版（老板决策：「地头展常年常设入口，改为神雕展翼」）：
 *   原为「第28届河北农机地头展」倒计时条，展期 2026-07-29 **早已过期**，
 *   线上长期显示「倒计时 0天 0小时」；且 .cn 分支指向另一个过期页
 *   /expo/28th-field-expo-2026。现改为**常年常设**：两侧统一落地
 *   /expo/field-videos（神雕展翼），无日期、无倒计时。
 */
export function FieldExpoBanner({ locale }: FieldExpoBannerProps) {
  return (
    <div className="bg-gradient-to-r from-green-700 via-green-600 to-emerald-500">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          {/* Left: text */}
          <div className="flex items-center gap-3">
            <div className="hidden rounded-lg bg-white/20 px-3 py-1 text-sm font-bold text-white sm:block">
              🔥 {translate("真实作业验证", locale)}
            </div>
            <div className="text-center text-sm text-white sm:text-left">
              <span className="font-semibold">{translate("神雕展翼 · 真实作业视频", locale)}</span>
              <div className="flex items-center gap-2 text-green-100">
                <Play className="h-3 w-3" />
                <span>{translate("真机下地 · 实效验证", locale)}</span>
              </div>
            </div>
          </div>

          {/* Right: CTA */}
          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/expo/field-videos`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-green-700 shadow transition hover:bg-green-50"
            >
              <Play className="h-4 w-4" />
              {translate("观看作业视频", locale)}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
