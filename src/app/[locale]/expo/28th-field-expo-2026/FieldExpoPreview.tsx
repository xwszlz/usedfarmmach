"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Calendar, MapPin, Clock, Play, ChevronRight, Users, Image as ImageIcon } from "lucide-react";

interface FieldExpoPreviewProps {
  locale: string;
}

const EXHIBITORS = [
  { name: "唐山鑫万达实业", product: "青贮饲料收获割台·智能压捆机", category: "青储机", inLib: true, brandSlug: "BR-唐山鑫万达" },
  { name: "郑州龙丰农业机械", product: "1LFT-455液压自动调幅犁·驱播机", category: "耕地机", inLib: true, brandSlug: "BR-郑州龙丰" },
  { name: "中机美诺科技", product: "9360C自走式饲料收获机", category: "青储机", inLib: true, brandSlug: "BR-中机美诺" },
  { name: "西安亚澳农机", product: "旋播施肥一体机", category: "播种机", inLib: true, brandSlug: "BR-西安亚澳" },
  { name: "河北利裕丰机械", product: "9QZ-2600B青饲料收获机", category: "青储机", inLib: true, brandSlug: "BR-河北利裕丰" },
  { name: "宁晋县陆风制动", product: "深松联合整地机", category: "整地机械", inLib: true, brandSlug: "BR-宁晋陆风" },
  { name: "石家庄美迪机械", product: "9QS-6000S青饲料收获机", category: "青储机", inLib: true, brandSlug: "BR-石家庄美迪" },
  { name: "山东当康农业装备", product: "驱动耙播种机", category: "播种机", inLib: true, brandSlug: "BR-山东当康" },
  { name: "晋州市冀丰农机", product: "雷沃4QZ-3QA2青饲料收获机", category: "青储机", inLib: true, brandSlug: "BR-晋州冀丰" },
  { name: "河北农哈哈机械", product: "播种机·智能耕整设备", category: "播种机", inLib: true, brandSlug: "BR-河北农哈哈" },
];

const DEMO_SCHEDULE = [
  { time: "10:00-10:30", event: "拖拉机耕地演示", machines: "东方红/雷沃" },
  { time: "10:45-11:15", event: "联合收割机作业演示", machines: "雷沃/CLAAS" },
  { time: "11:30-12:00", event: "青储机/打捆机演示", machines: "中机美诺/利裕丰" },
  { time: "14:00-14:30", event: "植保无人机演示", machines: "大疆/极飞" },
  { time: "15:00-15:30", event: "综合联合作业", machines: "耕-种-管-收全链" },
];

export function FieldExpoPreview({ locale }: FieldExpoPreviewProps) {
  const t = useTranslations();
  const isZh = locale === "zh";

  // Countdown calculation (target: 2026-07-29)
  const target = new Date("2026-07-29T09:00:00+08:00");
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-green-700 via-green-600 to-green-500 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            {/* Left: Text */}
            <div>
              <p className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-medium">
                🔥 {isZh ? "第28届 · 真机下地 · 实效演示" : "28th Edition · Live Demos"}
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {isZh ? "河北农机新机具新技术推广演示会" : "Hebei Agricultural Machinery Expo"}
              </h1>
              <div className="mt-6 space-y-3 text-lg text-green-100">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <span>2026年7月29日（周四）</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <span>{isZh ? "石家庄·元氏县·神雕农机" : "Yuanshi County, Shijiazhuang"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span>{isZh ? "~20家国内头部农机品牌" : "~20 Top Domestic Brands"}</span>
                </div>
              </div>

              {/* Countdown */}
              <div className="mt-8 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="text-lg font-semibold">
                    {isZh ? `倒计时 ${days}天 ${hours}小时` : `${days}d ${hours}h remaining`}
                  </span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#demo-schedule"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-green-700 shadow-lg transition hover:bg-green-50"
                >
                  <Play className="h-5 w-5" />
                  {isZh ? "查看演示时间" : "Demo Schedule"}
                </a>
                <Link
                  href={`/${locale}/expo/china-brands`}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  {isZh ? "浏览品牌库" : "Browse Brands"}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Right: GIF */}
            <div className="flex items-center justify-center">
              <div className="relative rounded-2xl bg-white/10 p-6 backdrop-blur-sm">
                <img
                  src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/expo/28th-field-expo-2026/preview.gif"
                  alt="第28届河北农机新机具新技术推广演示会"
                  className="h-auto w-full max-w-md rounded-lg shadow-2xl"
                />
                <p className="mt-3 text-center text-base font-medium text-white">
                  🔥 {isZh ? "线下实地演示 · 5场作业" : "5 Live Field Demos"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            <div>
              <div className="text-2xl font-bold text-green-600">~20</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{isZh ? "参展品牌" : "Exhibitors"}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">5+</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{isZh ? "品类覆盖" : "Categories"}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">5场</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{isZh ? "实地作业演示" : "Live Demos"}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">全天</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{isZh ? "线上直播" : "Live Streaming"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Exhibitor List */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "参展企业 & 展品预告" : "Exhibitors & Products"}
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">{isZh ? "企业" : "Company"}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">{isZh ? "核心展品" : "Products"}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">{isZh ? "品类" : "Category"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {EXHIBITORS.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {e.inLib && e.brandSlug ? (
                        <Link href={`/${locale}/expo`} className="text-green-600 hover:underline dark:text-green-400">
                          {e.name}
                        </Link>
                      ) : (
                        <span>{e.name}</span>
                      )}
                      {e.inLib && (
                        <span className="ml-2 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                          {isZh ? "品牌库已收录" : "In Brand Lib"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.product}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                        {e.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {isZh ? "以上为已公布参展企业（仅限来源·北方农业机械公众号），更多企业请以现场为准。" : "List based on published information. More exhibitors at the event."}
          </p>
        </div>
      </section>

      {/* Demo Schedule */}
      <section id="demo-schedule" className="bg-gray-50 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "实地作业演示时间表" : "Live Demo Schedule"}
          </h2>
          <div className="space-y-3">
            {DEMO_SCHEDULE.map((s, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
                <div className="flex-shrink-0 rounded-lg bg-green-100 px-3 py-2 text-center dark:bg-green-900">
                  <div className="text-sm font-bold text-green-700 dark:text-green-300">{s.time}</div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">{s.event}</div>
                  <div className="text-sm text-gray-500">{s.machines}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Assets */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "神雕农机 · 平台实力" : "Platform Strength"}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { num: "309", label: isZh ? "品牌收录" : "Brands" },
              { num: "618", label: isZh ? "配件入库" : "Parts" },
              { num: "14", label: isZh ? "品类手册" : "Manuals" },
              { num: "8", label: isZh ? "语种覆盖" : "Languages" },
            ].map((stat, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-4 text-center dark:border-gray-800">
                <div className="text-3xl font-bold text-green-600">{stat.num}</div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-green-700 to-green-500 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold">
            {isZh ? "品牌入库，全球可见" : "Brands In, World Sees"}
          </h2>
          <p className="mt-3 text-green-100">
            {isZh ? "入驻神雕农机，参与永不落幕的农机世界展会" : "Join Shendiao for the Always-On Expo"}
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href={`/${locale}/expo`}
              className="rounded-lg bg-white px-8 py-3 font-semibold text-green-700 shadow-lg transition hover:bg-green-50"
            >
              {isZh ? "进入世界农机博览会" : "Enter World Expo"}
            </Link>
            <Link
              href={`/${locale}/expo/booth`}
              className="rounded-lg border border-white/30 bg-white/10 px-8 py-3 font-semibold backdrop-blur-sm transition hover:bg-white/20"
            >
              {isZh ? "开通自助展台" : "Open Self-Expo Booth"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
