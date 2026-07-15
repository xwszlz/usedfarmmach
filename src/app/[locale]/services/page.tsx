import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp,
  ClipboardCheck,
  Truck,
  Landmark,
  ShieldCheck,
  MapPin,
  Lightbulb,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh";
  return {
    title: isZh
      ? "增值服务_AI估值_跨境物流_金融保险_一站式农机解决方案_神雕农机"
      : "Value-Added Services | AI Valuation · Logistics · Finance · One-Stop Agri Solutions",
    description: isZh
      ? "神雕农机增值服务中心：AI智能估值、第三方专业检测、跨境物流运输、金融保险、担保交易、线下服务网点、行业解决方案。一站式农机跨境贸易全链路服务。"
      : "AgriTrade Value-Added Services: AI valuation, third-party inspection, cross-border logistics, finance & insurance, escrow, service centers, industry solutions. One-stop machinery trade services.",
    alternates: {
      canonical: `${BASE_URL}/${locale}/services`,
      languages: {
        zh: `${BASE_URL}/zh/services`,
        en: `${BASE_URL}/en/services`,
      },
    },
    openGraph: {
      title: isZh ? "增值服务 — 神雕农机一站式跨境解决方案" : "Value-Added Services — AgriTrade One-Stop Solutions",
      description: isZh
        ? "7大增值服务矩阵：AI估值·专业检测·跨境物流·金融保险·担保交易·服务网点·行业方案。让二手农机跨境贸易更简单、更安全、更高效。"
        : "7 value-added services: AI Valuation, Inspection, Logistics, Finance, Escrow, Service Centers, Solutions. Making cross-border machinery trade simpler, safer, more efficient.",
      url: `${BASE_URL}/${locale}/services`,
      siteName: isZh ? "神雕农机" : "AgriTrade",
      locale: locale,
      type: "website",
    },
  };
}

interface ServiceCard {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  titleZh: string;
  titleEn: string;
  descZh: string;
  descEn: string;
  href: string;
  bgClass: string;
  iconClass: string;
  borderClass: string;
  tagZh?: string;
  tagEn?: string;
}

const SERVICES: ServiceCard[] = [
  {
    id: "ai-valuation",
    icon: TrendingUp,
    titleZh: "AI 智能估值",
    titleEn: "AI Valuation",
    descZh: "基于海量农机交易数据，AI精准评估设备残值与合理交易区间。支持多品牌、多机型对比分析，让每一笔交易都有据可依。",
    descEn: "AI-powered valuation based on massive machinery transaction data. Precise residual value assessment with multi-brand comparison. Data-driven trading decisions.",
    href: "/arena",
    bgClass: "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
    iconClass: "text-violet-600 dark:text-violet-400",
    borderClass: "border-violet-200 dark:border-violet-800",
    tagZh: "AI驱动",
    tagEn: "AI-Powered",
  },
  {
    id: "inspection",
    icon: ClipboardCheck,
    titleZh: "专业检测",
    titleEn: "Inspection",
    descZh: "第三方权威检测机构出具设备检测报告，涵盖发动机、液压系统、传动系统等20项关键指标。A/B/C/D四级评定，交易更透明。",
    descEn: "Third-party inspection reports covering 20 critical indicators including engine, hydraulics, and transmission. A/B/C/D grading for transparent transactions.",
    href: "/standards",
    bgClass: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30",
    iconClass: "text-blue-600 dark:text-blue-400",
    borderClass: "border-blue-200 dark:border-blue-800",
    tagZh: "权威认证",
    tagEn: "Certified",
  },
  {
    id: "logistics",
    icon: Truck,
    titleZh: "跨境物流",
    titleEn: "Logistics",
    descZh: "海运FCL/LCL整柜拼柜、空运急件、中亚铁路专线，覆盖全球主要港口。门到门一站式服务，实时追踪货物状态。",
    descEn: "Sea freight FCL/LCL, air express, Central Asia rail routes covering major global ports. Door-to-door service with real-time cargo tracking.",
    href: "/logistics",
    bgClass: "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    tagZh: "全球覆盖",
    tagEn: "Global",
  },
  {
    id: "finance",
    icon: Landmark,
    titleZh: "金融保险",
    titleEn: "Finance & Insurance",
    descZh: "农机贷款、交易保险、设备租赁三大金融产品。对接多家正规金融机构，年利率低至4.5%，最高额度500万元。",
    descEn: "Machinery loans, transaction insurance, equipment leasing. Partnered with licensed financial institutions. Rates from 4.5%, up to ¥5M credit line.",
    href: "/finance",
    bgClass: "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30",
    iconClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-amber-200 dark:border-amber-800",
    tagZh: "正规机构",
    tagEn: "Licensed",
  },
  {
    id: "escrow",
    icon: ShieldCheck,
    titleZh: "担保交易",
    titleEn: "Escrow Service",
    descZh: "神雕农机作为第三方资金托管方，确保买卖双方权益。先验货后付款，争议仲裁处理，降低跨境交易风险。",
    descEn: "AgriTrade as neutral third-party escrow agent protecting both buyer and seller. Inspect before payment, dispute resolution included. Risk-free cross-border trade.",
    href: "/escrow",
    bgClass: "bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30",
    iconClass: "text-rose-600 dark:text-rose-400",
    borderClass: "border-rose-200 dark:border-rose-800",
    tagZh: "资金安全",
    tagEn: "Secure",
  },
  {
    id: "service-network",
    icon: MapPin,
    titleZh: "服务网点",
    titleEn: "Service Centers",
    descZh: "覆盖全国主要农机产区的线下服务网络。设备检测、维修保养、评估鉴定、交易撮合、配件供应一站式服务。",
    descEn: "Nationwide offline service network covering major machinery regions. Inspection, repair, appraisal, deal matching, and parts supply all in one place.",
    href: "/service-network",
    bgClass: "bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30",
    iconClass: "text-teal-600 dark:text-teal-400",
    borderClass: "border-teal-200 dark:border-teal-800",
    tagZh: "全国覆盖",
    tagEn: "Nationwide",
  },
  {
    id: "solutions",
    icon: Lightbulb,
    titleZh: "行业方案",
    titleEn: "Industry Solutions",
    descZh: "大田种植、畜牧养殖、果园经济、设施农业4大国内方案 + 中亚、俄罗斯、东南亚3大出口方案。全场景农机配置推荐。",
    descEn: "4 domestic solutions (field crops, livestock, orchard, greenhouse) + 3 export solutions (Central Asia, Russia, SE Asia). Complete machinery lineup recommendations.",
    href: "/solutions",
    bgClass: "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30",
    iconClass: "text-orange-600 dark:text-orange-400",
    borderClass: "border-orange-200 dark:border-orange-800",
    tagZh: "7套方案",
    tagEn: "7 Plans",
  },
];

export default async function ServicesPage({
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
          { name: isZh ? "增值服务" : "Value-Added Services", url: `${BASE_URL}/${locale}/services` },
        ]}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 py-16 lg:py-24">
        {/* Background glow effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/5 blur-2xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
              <Sparkles className="h-4 w-4" />
              {isZh ? "7大增值服务矩阵" : "7 Value-Added Services"}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {isZh ? "增值服务" : "Value-Added Services"}
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              {isZh
                ? "从AI估值到跨境物流，从金融保险到线下服务 —— 一站式农机跨境贸易全链路解决方案"
                : "From AI valuation to cross-border logistics, from finance to offline service — one-stop full-chain solutions for global machinery trade."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400">
              <span className="rounded-full bg-slate-800 px-3 py-1">🔍 AI估值</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">📋 检测认证</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">🚚 物流运输</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">💰 金融保险</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">🛡️ 担保交易</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">🏢 线下网点</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">💡 行业方案</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="bg-gray-50 py-12 lg:py-20 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
              {isZh ? "选择您需要的服务" : "Choose Your Service"}
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {isZh
                ? "点击进入各项服务的专属页面，了解更多详情"
                : "Click into each service's dedicated page for more details."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              const title = isZh ? service.titleZh : service.titleEn;
              const desc = isZh ? service.descZh : service.descEn;
              const tag = isZh ? service.tagZh : service.tagEn;
              const href = `/${locale}${service.href}`;

              return (
                <Link
                  key={service.id}
                  href={href}
                  className={`group relative overflow-hidden rounded-2xl border ${service.borderClass} ${service.bgClass} p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50`}
                >
                  {/* Card glow on hover */}
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl dark:bg-white/5" />
                  </div>

                  <div className="relative">
                    {/* Icon + Tag */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${service.iconClass} bg-white/80 shadow-sm dark:bg-white/10`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      {tag && (
                        <span className="rounded-full border border-current px-2.5 py-0.5 text-xs font-medium opacity-60">
                          {tag}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                      {title}
                    </h3>

                    {/* Description */}
                    <p className="mb-5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {desc}
                    </p>

                    {/* CTA */}
                    <div className="flex items-center gap-1 text-sm font-medium text-gray-700 transition-colors group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white">
                      {isZh ? "了解详情" : "Learn More"}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="bg-white py-12 lg:py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-center text-white sm:p-12">
            <h2 className="text-2xl font-bold sm:text-3xl">
              {isZh ? "还没找到您需要的服务？" : "Can't find what you need?"}
            </h2>
            <p className="mt-3 text-lg text-violet-100">
              {isZh
                ? "联系我们的专家团队，为您定制专属的跨境农机贸易解决方案"
                : "Contact our expert team for customized cross-border machinery trade solutions."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <a
                href="mailto:jiusei0319@gmail.com"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-violet-700 transition-colors hover:bg-violet-50"
              >
                {isZh ? "📧 邮件咨询" : "📧 Email Us"}
              </a>
              <Link
                href={`/${locale}/about`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
              >
                {isZh ? "了解更多关于我们" : "More About Us"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
