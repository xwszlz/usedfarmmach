"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2, Globe, Video, BarChart3, Shield, ChevronRight, CheckCircle2, Sparkles } from "lucide-react";

interface SelfBoothLandingProps {
  locale: string;
}

export default function SelfBoothLanding({ locale }: SelfBoothLandingProps) {
  const t = useTranslations();
  const isZh = locale === "zh";

  const tiers = [
    {
      name: isZh ? "免费版" : "Free",
      price: isZh ? "¥0/年" : "¥0/yr",
      period: isZh ? "永久免费" : "Always Free",
      features: [
        isZh ? "品牌收录于品牌库" : "Brand listed in directory",
        isZh ? "5台展品上线" : "5 exhibits online",
        isZh ? "中文展示" : "Chinese language",
        isZh ? "基础浏览量统计" : "Basic page views",
        isZh ? "邮箱询盘通知" : "Email inquiry alerts",
      ],
      cta: isZh ? "免费开通" : "Start Free",
      ctaHref: "/expo/brand-claim?tier=free",
      popular: false,
      gradient: "from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
      border: "border-gray-200 dark:border-gray-700",
    },
    {
      name: isZh ? "Pro" : "Pro",
      price: isZh ? "¥380/年" : "¥380/yr",
      period: isZh ? "日均¥1.04" : "¥1.04/day",
      features: [
        isZh ? "品牌库优先收录" : "Priority brand listing",
        isZh ? "20台展品" : "20 exhibits",
        isZh ? "中文+英文双语" : "Chinese + English",
        isZh ? "3条产品视频" : "3 product videos",
        isZh ? "月度浏览/询盘报告" : "Monthly analytics report",
        isZh ? "邮件+短信询盘通知" : "Email + SMS alerts",
      ],
      cta: isZh ? "开通Pro" : "Get Pro",
      ctaHref: "/expo/brand-claim?tier=pro",
      popular: true,
      gradient: "from-blue-500 to-cyan-500",
      border: "border-blue-500",
    },
    {
      name: isZh ? "旗舰版" : "Flagship",
      price: isZh ? "¥980/年" : "¥980/yr",
      period: isZh ? "日均¥2.68" : "¥2.68/day",
      features: [
        isZh ? "品牌库置顶展示" : "Top brand placement",
        isZh ? "50台展品" : "50 exhibits",
        isZh ? "中/英/俄三语" : "Chinese/English/Russian",
        isZh ? "10条产品视频" : "10 product videos",
        isZh ? "周度报告+竞品对比" : "Weekly report + competitor",
        isZh ? "优先SEO排名" : "Priority SEO ranking",
        isZh ? "月轮播推荐位" : "Monthly featured slot",
      ],
      cta: isZh ? "开通旗舰" : "Get Flagship",
      ctaHref: "/expo/brand-claim?tier=flagship",
      popular: false,
      gradient: "from-purple-500 to-pink-500",
      border: "border-purple-500",
    },
    {
      name: isZh ? "战略版" : "Strategic",
      price: isZh ? "¥2,880/年" : "¥2,880/yr",
      period: isZh ? "日均¥7.89" : "¥7.89/day",
      features: [
        isZh ? "品牌库首页推荐" : "Homepage featured",
        isZh ? "无限展品" : "Unlimited exhibits",
        isZh ? "全8语种覆盖" : "All 8 languages",
        isZh ? "无限视频+VR展示" : "Unlimited video + VR",
        isZh ? "实时数据+行业对比" : "Real-time + industry data",
        isZh ? "SEO置顶+品牌词保护" : "Top SEO + brand term",
        isZh ? "季度专题置顶位" : "Quarterly featured",
        isZh ? "1对1客户经理" : "Dedicated account mgr",
      ],
      cta: isZh ? "联系开通" : "Contact Us",
      ctaHref: "/expo/brand-claim?tier=strategic",
      popular: false,
      gradient: "from-amber-500 to-orange-600",
      border: "border-amber-500",
    },
  ];

  const brandAssets = [
    { num: "309", label: isZh ? "品牌已收录" : "Brands Listed" },
    { num: "618", label: isZh ? "配件入库" : "Parts in DB" },
    { num: "14", label: isZh ? "品类手册" : "Manuals" },
    { num: "8", label: isZh ? "语种覆盖" : "Languages" },
    { num: "180+", label: isZh ? "月均询盘" : "Avg Monthly Inquiries" },
    { num: "28届", label: isZh ? "地头展背书" : "Field Expo Heritage" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 inline-block rounded-full bg-white/20 px-4 py-1 text-sm font-semibold">
              {isZh ? "✨ 品牌入库 · 全球可见" : "✨ Brands In · World Sees"}
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {isZh ? "开通您的自助展台" : "Open Your Self-Expo Booth"}
            </h1>
            <p className="mt-4 text-lg text-green-100">
              {isZh
                ? "5分钟完成注册，自动生成品牌专属页面，纳入「永不落幕的农机世界展会」体系"
                : "5-minute registration, auto-generated brand page, join the Always-On Expo system."}
            </p>
          </div>

          {/* Trust bar */}
          <div className="mt-10 grid grid-cols-3 gap-4 sm:grid-cols-6">
            {brandAssets.map((a, i) => (
              <div key={i} className="rounded-lg bg-white/10 p-3 text-center backdrop-blur-sm">
                <div className="text-xl font-bold">{a.num}</div>
                <div className="text-xs text-green-200">{a.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Why Self Booth */}
      <section className="border-b border-gray-200 py-12 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "为什么选择自助展台？" : "Why Choose Self-Expo Booth?"}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Globe className="h-8 w-8 text-green-600" />,
                title: isZh ? "永久在线" : "Always Online",
                desc: isZh ? "不受线下展会时间限制，24小时×365天持续曝光，买家随时访问" : "24/7/365 global exposure, buyers visit anytime",
              },
              {
                icon: <Building2 className="h-8 w-8 text-blue-600" />,
                title: isZh ? "自主发布" : "Self-Publish",
                desc: isZh ? "品牌信息、展品、视频、联系方式全部自助管理，实时更新" : "Manage brand info, products, videos, and contacts — all self-service",
              },
              {
                icon: <Video className="h-8 w-8 text-purple-600" />,
                title: isZh ? "多语种展示" : "Multi-Language",
                desc: isZh ? "从中文到8语种，覆盖200+国家买家，Pro版起即含英/俄" : "From Chinese to 8 languages, covering 200+ country buyers",
              },
              {
                icon: <BarChart3 className="h-8 w-8 text-amber-600" />,
                title: isZh ? "数据驱动" : "Data-Driven",
                desc: isZh ? "浏览量、询盘量、来源分析一目了然，优化参展策略" : "Page views, inquiries, source analysis — optimize your strategy",
              },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
                <div className="mb-4">{item.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "选择适合您的版本" : "Choose Your Tier"}
          </h2>
          <div className="grid gap-6 lg:grid-cols-4">
            {tiers.map((tier, i) => (
              <div
                key={i}
                className={`relative flex flex-col rounded-2xl border-2 ${tier.border} ${tier.gradient} p-6 shadow-sm`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white shadow">
                    <Sparkles className="mr-1 inline-block h-3 w-3" />
                    {isZh ? "推荐" : "Popular"}
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{tier.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{tier.price}</span>
                    <span className="ml-1 text-sm text-gray-500">{tier.period}</span>
                  </div>
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/${locale}${tier.ctaHref}`}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-center font-semibold shadow transition ${
                    tier.popular
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                  }`}
                >
                  {tier.cta}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment */}
      <section id="payment" className="py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "扫码付款" : "Scan to Pay"}
          </h2>
          <p className="mb-8 text-center text-sm text-gray-500">
            {isZh ? "选择版本后，使用微信或支付宝扫码付款，付款确认后24小时内开通" : "Scan to pay after tier selection. Activated within 24 hours after payment confirmed."}
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* WeChat */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                💚 微信支付
              </div>
              <div className="flex justify-center">
                <img
                  src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/payment/wechat-qr.png"
                  alt="微信支付二维码"
                  className="h-56 w-56 rounded-lg border border-gray-200 object-contain p-2 dark:border-gray-700"
                />
              </div>
              <p className="mt-3 text-xs text-gray-500">扫一扫即可付款</p>
            </div>

            {/* Alipay */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                💙 支付宝支付
              </div>
              <div className="flex justify-center">
                <img
                  src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/payment/alipay-qr.jpg"
                  alt="支付宝支付二维码"
                  className="h-56 w-56 rounded-lg border border-gray-200 object-contain p-2 dark:border-gray-700"
                />
              </div>
              <p className="mt-3 text-xs text-gray-500">扫一扫即可付款</p>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">
            {isZh ? "付款后请将截图发送至 932133255@qq.com 或致电 +86 18633878701 确认" : "After payment, send screenshot to 932133255@qq.com or call +86 18633878701."}
          </p>
        </div>
      </section>

      {/* How it works - 5 steps */}
      <section className="bg-gray-50 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "5步开通自助展台" : "5 Steps to Open Your Booth"}
          </h2>
          <div className="grid gap-6 sm:grid-cols-5">
            {[
              { step: "1", title: isZh ? "注册账号" : "Register", desc: isZh ? "填写企业信息，选择版本" : "Company info & tier selection" },
              { step: "2", title: isZh ? "品牌档案" : "Brand Profile", desc: isZh ? "上传Logo、简介、定位、品类" : "Logo, intro, positioning" },
              { step: "3", title: isZh ? "发布展品" : "List Products", desc: isZh ? "上传机型照片、视频、参数" : "Upload products, photos, videos" },
              { step: "4", title: isZh ? "提交审核" : "Submit for Review", desc: isZh ? "AI自动审+人工抽检" : "AI review + human spot-check" },
              { step: "5", title: isZh ? "开通上线" : "Go Live!", desc: isZh ? "获得专属品牌页和二维码" : "Get your brand page & QR code" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl bg-white p-6 text-center shadow-sm dark:bg-gray-800">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
                  {s.step}
                </div>
                <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <Shield className="mx-auto mb-4 h-10 w-10 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "已有309个品牌入驻，下一个就是您" : "309 Brands Already In — You're Next"}
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {isZh
              ? "品牌入库即获全球曝光。从免费版开始，无风险试水。"
              : "Brand Listing = Global Exposure. Start free, no risk."}
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href={`/${locale}/expo/brand-claim`}
              className="rounded-lg bg-green-600 px-8 py-3 font-semibold text-white shadow-lg transition hover:bg-green-700"
            >
              {isZh ? "免费开通→" : "Start Free →"}
            </Link>
            <Link
              href={`/${locale}/expo`}
              className="rounded-lg border border-gray-300 px-8 py-3 font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
            >
              {isZh ? "浏览展会" : "Browse Expo"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
