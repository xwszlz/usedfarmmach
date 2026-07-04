import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import Link from "next/link";
import { Wheat, Beef, Apple, Home, ArrowRight, CheckCircle2 } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("solutions", locale, "/solutions");
}

const SOLUTIONS = [
  {
    id: "field-crop",
    icon: Wheat,
    titleZh: "大田种植解决方案",
    titleEn: "Field Crop Solutions",
    descZh: "从耕整地到收获的全流程农机配置，覆盖小麦、玉米、水稻等主要粮食作物。提供拖拉机、收割机、播种机、犁地机等设备选型建议。",
    descEn: "Complete machinery lineup from tillage to harvest for wheat, corn, rice and other grain crops. Tractors, harvesters, seeders, and plows selection.",
    color: "from-amber-400 to-orange-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    scenarios: [
      { zh: "耕整地作业", en: "Tillage Operations", equipment: ["大马力拖拉机 100-300HP", "铧式犁", "圆盘耙", "深松机"] },
      { zh: "播种施肥", en: "Seeding & Fertilizing", equipment: ["气力式播种机", "施肥播种一体机", "精准变量播种机"] },
      { zh: "植保喷药", en: "Crop Protection", equipment: ["自走式喷药机", "高地隙喷雾机", "植保无人机"] },
      { zh: "收获作业", en: "Harvesting", equipment: ["谷物联合收割机", "玉米收割机", "秸秆粉碎还田机"] },
    ],
    brands: ["John Deere", "CLAAS", "New Holland", "Krone"],
  },
  {
    id: "livestock",
    icon: Beef,
    titleZh: "畜牧养殖解决方案",
    titleEn: "Livestock Farming Solutions",
    descZh: "饲草种植、收割、加工、喂养全链路农机配置。覆盖青储机、打捆机、裹包机、搂草机等牧草机械设备。",
    descEn: "Forage planting, harvesting, processing, and feeding machinery. Silage harvesters, balers, wrappers, rakes, and tedders.",
    color: "from-green-400 to-emerald-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    scenarios: [
      { zh: "饲草收割", en: "Forage Harvesting", equipment: ["青饲料收获机", "割草压扁机", "旋转式割草机"] },
      { zh: "牧草处理", en: "Forage Processing", equipment: ["打捆机（方捆/圆捆）", "裹包机", "搂草机", "摊晒机"] },
      { zh: "饲料制备", en: "Feed Preparation", equipment: ["TMR全混合日粮搅拌车", "饲料粉碎机", "颗粒压制机"] },
      { zh: "粪污处理", en: "Manure Management", equipment: ["撒肥车", "刮粪板系统", "粪污固液分离机"] },
    ],
    brands: ["CLAAS", "Krone", "KUHN", "Pöttinger"],
  },
  {
    id: "orchard",
    icon: Apple,
    titleZh: "果园经济解决方案",
    titleEn: "Orchard Solutions",
    descZh: "果园专用矮化拖拉机、植保设备、采摘辅助设备配置方案。适用于苹果、柑橘、葡萄等各类果园。",
    descEn: "Specialized low-profile tractors, orchard sprayers, and harvesting aids for apples, citrus, vineyards, and more.",
    color: "from-rose-400 to-pink-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    scenarios: [
      { zh: "果园动力", en: "Orchard Power", equipment: ["矮化果园拖拉机 50-100HP", "窄轨距拖拉机", "电动农机"] },
      { zh: "植保防护", en: "Crop Protection", equipment: ["果园风送式喷雾机", "迷雾机", "太阳能杀虫灯"] },
      { zh: "除草管理", en: "Weed Management", equipment: ["行间除草机", "旋耕机", "碎草机"] },
      { zh: "采收运输", en: "Harvesting & Transport", equipment: ["采摘平台", "果园搬运车", "升降作业台"] },
    ],
    brands: ["John Deere", "New Holland", "KUHN", "BCS"],
  },
  {
    id: "greenhouse",
    icon: Home,
    titleZh: "设施农业解决方案",
    titleEn: "Greenhouse Solutions",
    descZh: "温室大棚专用小型农机、智能灌溉、环境控制设备配置。适用于蔬菜、花卉、草莓等设施农业。",
    descEn: "Compact greenhouse machinery, smart irrigation, and climate control equipment for vegetables, flowers, and strawberries.",
    color: "from-cyan-400 to-blue-600",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
    scenarios: [
      { zh: "耕作整地", en: "Tillage", equipment: ["微耕机", "旋耕机", "起垄机", "做畦机"] },
      { zh: "灌溉施肥", en: "Irrigation & Fertigation", equipment: ["滴灌系统", "水肥一体化机", "微喷灌设备"] },
      { zh: "环境调控", en: "Climate Control", equipment: ["湿帘风机系统", "卷帘器", "补光灯", "CO₂发生器"] },
      { zh: "植保采收", en: "Protection & Harvest", equipment: ["烟雾机", "电动喷雾器", "采摘车", "搬运车"] },
    ],
    brands: ["Universal", "KUHN", "Bosch"],
  },
];

export default async function SolutionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh";

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: isZh ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: isZh ? "行业方案" : "Solutions", url: `${BASE_URL}/${locale}/solutions` },
        ]}
      />
      <div className="min-h-screen bg-gray-50">
        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white">
          <div className="container mx-auto px-4 py-16">
            <h1 className="text-4xl font-bold mb-4">
              {isZh ? "行业解决方案" : "Industry Solutions"}
            </h1>
            <p className="text-white/80 text-lg max-w-3xl">
              {isZh
                ? "针对不同农业场景，提供从设备选型到运维管理的全套农机解决方案"
                : "Tailored machinery solutions for different agricultural scenarios, from equipment selection to maintenance"}
            </p>
          </div>
        </div>

        {/* Solutions */}
        <div className="container mx-auto px-4 py-12">
          <div className="space-y-12">
            {SOLUTIONS.map((solution) => {
              const Icon = solution.icon;
              return (
                <div
                  key={solution.id}
                  className={`rounded-2xl border-2 ${solution.borderColor} ${solution.bgColor} overflow-hidden`}
                >
                  {/* Header */}
                  <div className={`bg-gradient-to-r ${solution.color} px-6 py-8 text-white`}>
                    <div className="flex items-center gap-4">
                      <div className="rounded-xl bg-white/20 p-3">
                        <Icon className="h-8 w-8" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">
                          {isZh ? solution.titleZh : solution.titleEn}
                        </h2>
                        <p className="text-white/80 text-sm mt-1">
                          {isZh ? solution.descZh : solution.descEn}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Scenarios */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {solution.scenarios.map((scenario, idx) => (
                        <div key={idx} className="rounded-lg bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <h3 className="font-semibold text-gray-900">
                              {isZh ? scenario.zh : scenario.en}
                            </h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {scenario.equipment.map((eq, eidx) => (
                              <span
                                key={eidx}
                                className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
                              >
                                {eq}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Brands */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm text-gray-500">
                        {isZh ? "推荐品牌" : "Recommended Brands"}:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {solution.brands.map((brand) => (
                          <Link
                            key={brand}
                            href={`/brand/${brand.toLowerCase().replace(/\s+/g, "-")}`}
                            className="rounded-lg bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-200"
                          >
                            {brand}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* CTA */}
                    <Link
                      href={`/products?solution=${solution.id}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                      {isZh ? "查看相关设备" : "Browse Related Equipment"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
