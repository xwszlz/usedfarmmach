import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import Link from "next/link";
import { Wheat, Beef, Apple, Home, ArrowRight, CheckCircle2, Globe, Tractor, Ship } from "lucide-react";

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
  // === 出口导向方案 ===
  {
    id: "central-asia-export",
    icon: Globe,
    titleZh: "中亚市场出口方案",
    titleEn: "Central Asia Export Solution",
    descZh: "面向哈萨克斯坦、乌兹别克斯坦等中亚国家的农机出口方案。该地区以小麦和棉花种植为主，气候干旱少雨，需要耐高温、抗风沙的农机设备。覆盖从耕种到收获的全套设备配置。",
    descEn: "Machinery export solution for Kazakhstan, Uzbekistan and other Central Asian countries. The region focuses on wheat and cotton farming with an arid climate requiring heat and dust-resistant equipment.",
    color: "from-teal-500 to-cyan-700",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    climate: {
      zh: "温带大陆性气候，夏季炎热干燥（35-45°C），冬季寒冷（-20°C以下），降水稀少，风沙大",
      en: "Temperate continental climate, hot dry summers (35-45°C), cold winters (below -20°C), low precipitation, frequent dust storms",
    },
    mainCrops: { zh: "小麦、棉花、玉米、水稻", en: "Wheat, Cotton, Corn, Rice" },
    exportNotes: [
      "哈萨克斯坦进口农机需提供EAC认证（欧亚经济联盟认证）",
      "建议配备防尘型空气滤芯和加强型散热系统",
      "棉花采摘机需适应当地长绒棉品种",
      "售后配件须通过阿拉木图海外仓备货",
      "付款方式推荐信用证（L/C）或T/T预付30%",
    ],
    scenarios: [
      { zh: "小麦耕种收", en: "Wheat Production", equipment: ["大马力拖拉机 150-300HP", "气力式播种机", "谷物联合收割机", "圆盘耙"] },
      { zh: "棉花种植收获", en: "Cotton Farming", equipment: ["采棉机", "精量播种机", "高地隙喷雾机", "棉秆粉碎还田机"] },
      { zh: "灌溉设备", en: "Irrigation", equipment: ["中心支轴式喷灌机", "滴灌系统", "水泵机组"] },
      { zh: "产后处理", en: "Post-Harvest", equipment: ["粮食烘干机", "粮食仓储设备", "棉花打包机"] },
    ],
    brands: ["John Deere", "Case IH", "CLAAS", "Kubota"],
  },
  {
    id: "russia-export",
    icon: Tractor,
    titleZh: "俄罗斯市场出口方案",
    titleEn: "Russia Export Solution",
    descZh: "面向俄罗斯市场的农机出口方案，覆盖大面积耕作和马铃薯收获两大核心场景。俄罗斯拥有全球最大的耕地面积，以大型农场为主，需要高效率、大宽幅的农机设备。冬季漫长严寒，设备须具备低温启动能力。",
    descEn: "Machinery export solution for the Russian market, covering large-scale farming and potato harvesting. Russia has the world's largest arable land area with large-scale farms requiring high-efficiency, wide-working-width equipment with cold-start capability.",
    color: "from-indigo-500 to-blue-800",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    climate: {
      zh: "温带大陆性/寒带气候，冬季漫长严寒（-30°C至-50°C），夏季短促温暖（15-25°C），冻土期长",
      en: "Temperate continental / subarctic climate, long cold winters (-30°C to -50°C), short warm summers (15-25°C), long permafrost period",
    },
    mainCrops: { zh: "小麦、大麦、马铃薯、甜菜、向日葵", en: "Wheat, Barley, Potato, Sugar Beet, Sunflower" },
    exportNotes: [
      "俄罗斯进口农机需提供EAC认证和OTTS认证（拖拉机型号批准书）",
      "设备须配备发动机预热系统和低温蓄电池（-40°C启动）",
      "液压系统须使用低温液压油（VG32或更低粘度）",
      "大宽幅设备（收割机割台6-9米）适应当地大地块作业",
      "售后配件须通过莫斯科/克拉斯诺达尔海外仓备货",
      "推荐FOB大连港/天津港交货，买方承担内陆运输",
    ],
    scenarios: [
      { zh: "大面积耕作", en: "Large-Scale Tillage", equipment: ["400马力以上拖拉机", "12-16铧犁", "重型圆盘耙(宽6-9米)", "深松机"] },
      { zh: "粮食收获", en: "Grain Harvesting", equipment: ["大型联合收割机(割台7-9米)", "秸秆粉碎还田机", "运粮车"] },
      { zh: "马铃薯收获", en: "Potato Harvesting", equipment: ["马铃薯收获机(2-4行)", "马铃薯播种机", "分级分选设备"] },
      { zh: "冬季维护", en: "Winter Maintenance", equipment: ["发动机预热器", "防冻液", "低温润滑脂", "设备库房供暖"] },
    ],
    brands: ["John Deere", "CLAAS", "New Holland", "Krone"],
  },
  {
    id: "sea-export",
    icon: Ship,
    titleZh: "东南亚市场出口方案",
    titleEn: "Southeast Asia Export Solution",
    descZh: "面向东南亚市场的农机出口方案，重点覆盖水稻种植和甘蔗收获两大场景。东南亚热带季风气候，高温高湿，雨季降水充沛。设备须具备防锈防腐、水田通过性强的特点，适应小地块和梯田作业。",
    descEn: "Machinery export solution for Southeast Asia, focusing on rice planting and sugarcane harvesting. Tropical monsoon climate with high temperature, humidity, and heavy rainfall. Equipment must be rust-resistant and suitable for small plots and terraced fields.",
    color: "from-lime-500 to-green-700",
    bgColor: "bg-lime-50",
    borderColor: "border-lime-200",
    climate: {
      zh: "热带季风气候，全年高温（25-35°C），湿度大（70-90%），分旱季和雨季，雨季降水集中",
      en: "Tropical monsoon climate, year-round high temperatures (25-35°C), high humidity (70-90%), distinct dry and wet seasons",
    },
    mainCrops: { zh: "水稻、甘蔗、橡胶、棕榈油", en: "Rice, Sugarcane, Rubber, Palm Oil" },
    exportNotes: [
      "越南/泰国/缅甸进口农机需提供产地证（CO）和检验检疫证书",
      "设备须进行防锈防腐处理（电镀/不锈钢/特殊涂层）",
      "水田作业设备须配备防滑轮/铁轮和加高进气口",
      "小型化设备（50-80马力）适应当地小地块和梯田",
      "售后配件须通过曼谷/胡志明海外仓备货",
      "推荐CIF交货，由卖方安排海运至目的港",
    ],
    scenarios: [
      { zh: "水稻种植", en: "Rice Cultivation", equipment: ["水田拖拉机 50-80HP", "插秧机", "水稻联合收割机", "微耕机"] },
      { zh: "甘蔗收获", en: "Sugarcane Harvesting", equipment: ["甘蔗收割机", "甘蔗种植机", "甘蔗装载机", "运输挂车"] },
      { zh: "植保灌溉", en: "Protection & Irrigation", equipment: ["自走式喷药机", "植保无人机", "水泵机组", "喷灌设备"] },
      { zh: "产后加工", en: "Post-Harvest Processing", equipment: ["稻米烘干机", "碾米机", "甘蔗压榨机", "仓储设备"] },
    ],
    brands: ["Kubota", "John Deere", "New Holland", "CLAAS"],
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
                    {/* Export-specific info (climate, crops, export notes) */}
                    {(solution as any).climate && (
                      <div className="mb-4 rounded-lg bg-white/70 p-4 space-y-2">
                        <div className="flex gap-2 text-sm">
                          <span className="font-medium text-gray-700 shrink-0">{isZh ? "气候特点" : "Climate"}:</span>
                          <span className="text-gray-600">{isZh ? (solution as any).climate.zh : (solution as any).climate.en}</span>
                        </div>
                        {(solution as any).mainCrops && (
                          <div className="flex gap-2 text-sm">
                            <span className="font-medium text-gray-700 shrink-0">{isZh ? "主要作物" : "Main Crops"}:</span>
                            <span className="text-gray-600">{isZh ? (solution as any).mainCrops.zh : (solution as any).mainCrops.en}</span>
                          </div>
                        )}
                      </div>
                    )}

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

                    {/* Export notes */}
                    {(solution as any).exportNotes && (solution as any).exportNotes.length > 0 && (
                      <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
                        <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                          <Ship className="h-4 w-4" />
                          {isZh ? "出口注意事项" : "Export Notes"}
                        </h3>
                        <ul className="space-y-1">
                          {(solution as any).exportNotes.map((note: string, idx: number) => (
                            <li key={idx} className="text-sm text-amber-700 flex gap-2">
                              <span className="text-amber-400">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

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
