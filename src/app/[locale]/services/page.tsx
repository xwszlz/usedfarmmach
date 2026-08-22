import { translate } from "@/lib/i18n-runtime";
import type { Metadata } from "next";
import Link from "next/link";
import { Brain, TrendingUp, ClipboardCheck, Truck, Landmark, MapPin, Lightbulb, ArrowRight, Sparkles, } from "lucide-react";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";
export async function generateMetadata({ params, }: {
    params: Promise<{
        locale: string;
    }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const isZh = locale === "zh";
    return {
        title: translate("增值服务_AI估值_跨境物流_金融保险_一站式农机解决方案_神雕农机", locale),
        description: translate("神雕农机增值服务中心：AI智能估价、智能跨境套利、第三方专业检测、跨境物流运输、金融保险、线下服务网点、行业解决方案。一站式农机跨境贸易全链路服务。", locale),
        alternates: {
            canonical: `${BASE_URL}/${locale}/services`,
            languages: {
                zh: `${BASE_URL}/zh/services`,
                en: `${BASE_URL}/en/services`,
            },
        },
        openGraph: {
            title: translate("增值服务 — 神雕农机一站式跨境解决方案", locale),
            description: translate("7大增值服务矩阵：AI估价·跨境套利·专业检测·跨境物流·金融保险·服务网点·行业方案。让二手农机跨境贸易更简单、更安全、更高效。", locale),
            url: `${BASE_URL}/${locale}/services`,
            siteName: translate("神雕农机", locale),
            locale: locale,
            type: "website",
        },
    };
}
interface ServiceCard {
    id: string;
    icon: React.ComponentType<{
        className?: string;
    }>;
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
        id: "ai-valuation-price",
        icon: Brain,
        titleZh: "AI\u667A\u80FD\u4F30\u4EF7",
        titleEn: "AI Valuation",
        descZh: "\u57FA\u4E8E\u54C1\u724C\u3001\u5E74\u4EFD\u3001\u5DE5\u65F6\u7B49\u591A\u7EF4\u5EA6\u7CBE\u51C6\u4F30\u4EF7\u3002\u652F\u6301\u591A\u54C1\u724C\u3001\u591A\u673A\u578B\u5BF9\u6BD4\u5206\u6790\uFF0C\u8BA9\u6BCF\u4E00\u7B14\u4EA4\u6613\u90FD\u6709\u636E\u53EF\u4F9D\u3002",
        descEn: "Multi-dimensional pricing based on brand, year, and hours. Multi-brand comparison for data-driven trading decisions.",
        href: "/services/valuation",
        bgClass: "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
        iconClass: "text-violet-600 dark:text-violet-400",
        borderClass: "border-violet-200 dark:border-violet-800",
        tagZh: "AI\u9A71\u52A8",
        tagEn: "AI-Powered",
    },
    {
        id: "arbitrage",
        icon: TrendingUp,
        titleZh: "\u667A\u80FD\u8DE8\u5883\u5957\u5229",
        titleEn: "Smart Arbitrage",
        descZh: "\u5B9E\u65F6\u4E2D\u5916\u4EF7\u683C\u5BF9\u6BD4\uFF0C\u53D1\u73B0\u5957\u5229\u6295\u8D44\u673A\u4F1A\u3002\u57FA\u4E8E\u5168\u7403\u519C\u673A\u5E02\u573A\u884C\u60C5\uFF0C\u667A\u80FD\u63A8\u8350\u8DE8\u5883\u5957\u5229\u65B9\u6848\u3002",
        descEn: "Real-time cross-border price comparison. Smart arbitrage recommendations based on global machinery market data.",
        href: "/arbitrage-calculator",
        bgClass: "bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30",
        iconClass: "text-cyan-600 dark:text-cyan-400",
        borderClass: "border-cyan-200 dark:border-cyan-800",
        tagZh: "\u5B9E\u65F6\u6570\u636E",
        tagEn: "Real-Time",
    },
    {
        id: "inspection",
        icon: ClipboardCheck,
        titleZh: "\u4E13\u4E1A\u68C0\u6D4B",
        titleEn: "Inspection",
        descZh: "\u7B2C\u4E09\u65B9\u6743\u5A01\u68C0\u6D4B\u673A\u6784\u51FA\u5177\u8BBE\u5907\u68C0\u6D4B\u62A5\u544A\uFF0C\u6DB5\u76D6\u53D1\u52A8\u673A\u3001\u6DB2\u538B\u7CFB\u7EDF\u3001\u4F20\u52A8\u7CFB\u7EDF\u7B4920\u9879\u5173\u952E\u6307\u6807\u3002A/B/C/D\u56DB\u7EA7\u8BC4\u5B9A\uFF0C\u4EA4\u6613\u66F4\u900F\u660E\u3002",
        descEn: "Third-party inspection reports covering 20 critical indicators including engine, hydraulics, and transmission. A/B/C/D grading for transparent transactions.",
        href: "/standards",
        bgClass: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30",
        iconClass: "text-blue-600 dark:text-blue-400",
        borderClass: "border-blue-200 dark:border-blue-800",
        tagZh: "\u6743\u5A01\u8BA4\u8BC1",
        tagEn: "Certified",
    },
    {
        id: "logistics",
        icon: Truck,
        titleZh: "\u8DE8\u5883\u7269\u6D41",
        titleEn: "Logistics",
        descZh: "\u6D77\u8FD0FCL/LCL\u6574\u67DC\u62FC\u67DC\u3001\u7A7A\u8FD0\u6025\u4EF6\u3001\u4E2D\u4E9A\u94C1\u8DEF\u4E13\u7EBF\uFF0C\u8986\u76D6\u5168\u7403\u4E3B\u8981\u6E2F\u53E3\u3002\u95E8\u5230\u95E8\u4E00\u7AD9\u5F0F\u670D\u52A1\uFF0C\u5B9E\u65F6\u8FFD\u8E2A\u8D27\u7269\u72B6\u6001\u3002",
        descEn: "Sea freight FCL/LCL, air express, Central Asia rail routes covering major global ports. Door-to-door service with real-time cargo tracking.",
        href: "/logistics",
        bgClass: "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30",
        iconClass: "text-emerald-600 dark:text-emerald-400",
        borderClass: "border-emerald-200 dark:border-emerald-800",
        tagZh: "\u5168\u7403\u8986\u76D6",
        tagEn: "Global",
    },
    {
        id: "finance",
        icon: Landmark,
        titleZh: "\u91D1\u878D\u4FDD\u9669",
        titleEn: "Finance & Insurance",
        descZh: "\u519C\u673A\u8D37\u6B3E\u3001\u4EA4\u6613\u4FDD\u9669\u3001\u8BBE\u5907\u79DF\u8D41\u4E09\u5927\u91D1\u878D\u4EA7\u54C1\u3002\u5BF9\u63A5\u591A\u5BB6\u6B63\u89C4\u91D1\u878D\u673A\u6784\uFF0C\u5E74\u5229\u7387\u4F4E\u81F34.5%\uFF0C\u6700\u9AD8\u989D\u5EA6500\u4E07\u5143\u3002",
        descEn: "Machinery loans, transaction insurance, equipment leasing. Partnered with licensed financial institutions. Rates from 4.5%, up to \u00A55M credit line.",
        href: "/finance",
        bgClass: "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30",
        iconClass: "text-amber-600 dark:text-amber-400",
        borderClass: "border-amber-200 dark:border-amber-800",
        tagZh: "\u6B63\u89C4\u673A\u6784",
        tagEn: "Licensed",
    },
    {
        id: "service-network",
        icon: MapPin,
        titleZh: "\u670D\u52A1\u7F51\u70B9",
        titleEn: "Service Centers",
        descZh: "\u8986\u76D6\u5168\u56FD\u4E3B\u8981\u519C\u673A\u4EA7\u533A\u7684\u7EBF\u4E0B\u670D\u52A1\u7F51\u7EDC\u3002\u8BBE\u5907\u68C0\u6D4B\u3001\u7EF4\u4FEE\u4FDD\u517B\u3001\u8BC4\u4F30\u9274\u5B9A\u3001\u4EA4\u6613\u64AE\u5408\u3001\u914D\u4EF6\u4F9B\u5E94\u4E00\u7AD9\u5F0F\u670D\u52A1\u3002",
        descEn: "Nationwide offline service network covering major machinery regions. Inspection, repair, appraisal, deal matching, and parts supply all in one place.",
        href: "/service-network",
        bgClass: "bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30",
        iconClass: "text-teal-600 dark:text-teal-400",
        borderClass: "border-teal-200 dark:border-teal-800",
        tagZh: "\u5168\u56FD\u8986\u76D6",
        tagEn: "Nationwide",
    },
    {
        id: "solutions",
        icon: Lightbulb,
        titleZh: "\u884C\u4E1A\u65B9\u6848",
        titleEn: "Industry Solutions",
        descZh: "\u5927\u7530\u79CD\u690D\u3001\u755C\u7267\u517B\u6B96\u3001\u679C\u56ED\u7ECF\u6D4E\u3001\u8BBE\u65BD\u519C\u4E1A4\u5927\u56FD\u5185\u65B9\u6848 + \u4E2D\u4E9A\u3001\u4FC4\u7F57\u65AF\u3001\u4E1C\u5357\u4E9A3\u5927\u51FA\u53E3\u65B9\u6848\u3002\u5168\u573A\u666F\u519C\u673A\u914D\u7F6E\u63A8\u8350\u3002",
        descEn: "4 domestic solutions (field crops, livestock, orchard, greenhouse) + 3 export solutions (Central Asia, Russia, SE Asia). Complete machinery lineup recommendations.",
        href: "/solutions",
        bgClass: "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30",
        iconClass: "text-orange-600 dark:text-orange-400",
        borderClass: "border-orange-200 dark:border-orange-800",
        tagZh: "7\u5957\u65B9\u6848",
        tagEn: "7 Plans",
    },
];
export default async function ServicesPage({ params, }: {
    params: Promise<{
        locale: string;
    }>;
}) {
    const { locale } = await params;
    const isZh = locale === "zh";
    return (<>
      <BreadcrumbStructuredData locale={locale} items={[
            { name: translate("首页", locale), url: `${BASE_URL}/${locale}` },
            { name: translate("增值服务", locale), url: `${BASE_URL}/${locale}/services` },
        ]}/>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 py-16 lg:py-24">
        {/* Background glow effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl"/>
          <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl"/>
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/5 blur-2xl"/>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
              <Sparkles className="h-4 w-4"/>
              {translate("8大增值服务矩阵", locale)}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {translate("增值服务", locale)}
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              {translate("从AI估值到跨境物流，从金融保险到线下服务 —— 一站式农机跨境贸易全链路解决方案", locale)}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400">
              <span className="rounded-full bg-slate-800 px-3 py-1">{translate("🧠 AI估价", locale)}</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">{translate("📈 跨境套利", locale)}</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">{translate("📋 检测认证", locale)}</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">{translate("🚚 物流运输", locale)}</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">{translate("💰 金融保险", locale)}</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">{translate("🏢 线下网点", locale)}</span>
              <span className="rounded-full bg-slate-800 px-3 py-1">{translate("💡 行业方案", locale)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="bg-gray-50 py-12 lg:py-20 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
              {translate("选择您需要的服务", locale)}
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {translate("点击进入各项服务的专属页面，了解更多详情", locale)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => {
            const Icon = service.icon;
            const title = isZh ? service.titleZh : service.titleEn;
            const desc = isZh ? service.descZh : service.descEn;
            const tag = isZh ? service.tagZh : service.tagEn;
            const href = `/${locale}${service.href}`;
            return (<Link key={service.id} href={href} className={`group relative overflow-hidden rounded-2xl border ${service.borderClass} ${service.bgClass} p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50`}>
                  {/* Card glow on hover */}
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl dark:bg-white/5"/>
                  </div>

                  <div className="relative">
                    {/* Icon + Tag */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${service.iconClass} bg-white/80 shadow-sm dark:bg-white/10`}>
                        <Icon className="h-6 w-6"/>
                      </div>
                      {tag && (<span className="rounded-full border border-current px-2.5 py-0.5 text-xs font-medium opacity-60">
                          {tag}
                        </span>)}
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
                      {translate("了解详情", locale)}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/>
                    </div>
                  </div>
                </Link>);
        })}
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="bg-white py-12 lg:py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-center text-white sm:p-12">
            <h2 className="text-2xl font-bold sm:text-3xl">
              {translate("还没找到您需要的服务？", locale)}
            </h2>
            <p className="mt-3 text-lg text-violet-100">
              {translate("联系我们的专家团队，为您定制专属的跨境农机贸易解决方案", locale)}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <a href="mailto:jiusei0319@gmail.com" className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-violet-700 transition-colors hover:bg-violet-50">
                {translate("📧 邮件咨询", locale)}
              </a>
              <Link href={`/${locale}/about`} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10">
                {translate("了解更多关于我们", locale)}
                <ArrowRight className="h-4 w-4"/>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>);
}
