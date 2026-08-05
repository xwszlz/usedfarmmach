import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, FaqStructuredData } from "@/components/seo/structured-data";
import LogisticsClient from "./LogisticsClient";
import LogisticsQuoteForm from "@/components/logistics/logistics-quote-form";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("logistics", locale, "/logistics");
}

export default async function LogisticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const logisticsFaqs = [
    {
      question: locale === "zh" ? "二手农机跨境运输需要哪些手续？" : "What documents are needed for cross-border farm machinery shipping?",
      answer: locale === "zh"
        ? "需要设备发票、出口报关单、装箱单、提单、原产地证等。神雕农机提供一站式代办服务，全程无需您操心。"
        : "You need equipment invoices, export customs declaration, packing list, bill of lading, certificate of origin, etc. AgriTrade provides one-stop handling service.",
    },
    {
      question: locale === "zh" ? "整柜运输（FCL）和拼柜运输（LCL）怎么选？" : "How to choose between FCL and LCL shipping?",
      answer: locale === "zh"
        ? "大批量采购（3台以上大型设备）建议FCL整柜直达更经济；中小批量或试单建议LCL拼柜灵活便捷。我们的物流顾问会根据您的实际需求推荐最优方案。"
        : "For bulk purchases (3+ large machines), FCL is more economical. For small/medium batches or trial orders, LCL is flexible and convenient. Our logistics advisors will recommend the best option.",
    },
    {
      question: locale === "zh" ? "运输途中设备损坏怎么办？" : "What if equipment is damaged during transit?",
      answer: locale === "zh"
        ? "我们提供全程运输保险，覆盖海运、陆运全环节。如发生损坏，保险赔付流程透明高效。所有设备出运前均经过专业打包加固，最大限度降低运输风险。"
        : "We provide full-transit insurance covering sea and land transport. In case of damage, the insurance claim process is transparent and efficient. All equipment is professionally packed before shipping.",
    },
    {
      question: locale === "zh" ? "出口到非洲/俄罗斯需要多长时间？" : "How long does shipping to Africa/Russia take?",
      answer: locale === "zh"
        ? "俄罗斯方向：铁路运输约15-20天，海运约25-30天。非洲方向：海运约30-45天，空运约5-10天（适合紧急需求）。具体时效因目的港而异。"
        : "Russia: railway ~15-20 days, sea ~25-30 days. Africa: sea ~30-45 days, air ~5-10 days (for urgent needs). Actual timing varies by destination port.",
    },
  ];

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "物流方案" : "Logistics", url: `${BASE_URL}/${locale}/logistics` },
        ]}
      />
      <FaqStructuredData faqs={logisticsFaqs} />
      <LogisticsClient />
      <div className="container mx-auto px-4 py-8">
        <LogisticsQuoteForm locale={locale} />
      </div>
    </>
  );
}
