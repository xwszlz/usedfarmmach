import type { Metadata } from "next";
import { TianjinLanding } from "./TianjinLanding";
import { generatePageMetadata } from "@/lib/seo-metadata";
import {
  BreadcrumbStructuredData,
  FaqStructuredData,
} from "@/components/seo/structured-data";
import { ExpoEventJsonLd } from "@/components/expo/ExpoEventJsonLd";
import { TJ_FAQS, pickFaqs } from "@/components/expo/expo-faqs";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";
const PAGE_PATH = "/expo/tianjin-2026";

// ─────── TDK（截流「展会名 + 参展/入驻」搜索词）───────
const TDK: Record<string, { title: string; description: string; keywords: string[] }> = {
  zh: {
    title: "天津农机展2026_10月26-28中国国际农机展_展商入驻神雕农机",
    description:
      "2026中国国际农业机械展览会10月26–28日在天津举办。神雕农机以参展企业身份到场，为参展企业开通8语种线上展台（神雕云展），365天在线、全球买家可见。线上展台可免费开通，现场登记即可。",
    keywords: ["天津农机展", "2026中国国际农机展", "天津农机博览会", "农机展参展", "线上展台入驻"],
  },
  en: {
    title: "China International Agricultural Machinery Exhibition 2026 | Oct 26-28 Tianjin",
    description:
      "The 2026 China International Agricultural Machinery Exhibition runs Oct 26-28, 2026 in Tianjin. Shendiao attends as an exhibitor and opens an 8-language online booth (Shendiao Cloud Expo) — 365 days online, visible to global buyers. Free to open, register on site.",
    keywords: [
      "Tianjin farm machinery expo",
      "China International Agricultural Machinery Exhibition 2026",
      "Tianjin agricultural machinery exhibition",
      "online booth for machinery exhibitors",
    ],
  },
  ru: {
    title: "Китайская международная выставка сельхозтехники 2026 | 26-28 октября, Тяньцзинь",
    description:
      "Китайская международная выставка сельхозтехники 2026 пройдёт 26–28 октября 2026 года в Тяньцзине. Shendiao участвует как экспонент и открывает онлайн-стенд Shendiao Cloud Expo на 8 языках — 365 дней онлайн, видно покупателям по всему миру.",
    keywords: [
      "выставка сельхозтехники Тяньцзинь",
      "Китайская международная выставка сельхозтехники 2026",
      "онлайн-стенд для экспонентов",
    ],
  },
};

// ─────── Event 结构化数据（organizer 只填真实主办方；官网未核实则不输出 url）───────
const EVENT_NAME: Record<string, string> = {
  zh: "2026中国国际农业机械展览会",
  en: "2026 China International Agricultural Machinery Exhibition",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tdk = TDK[locale] || TDK.en;
  const canonical = `${BASE_URL}/${locale}${PAGE_PATH}`;

  return generatePageMetadata("expo", locale, PAGE_PATH, {
    title: tdk.title,
    description: tdk.description,
    keywords: tdk.keywords,
    openGraph: {
      title: tdk.title,
      description: tdk.description,
      url: canonical,
      siteName: locale === "zh" ? "神雕农机" : "AgriTrade",
      locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: tdk.title,
      description: tdk.description,
    },
  });
}

export default async function TianjinExpoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tdk = TDK[locale] || TDK.en;
  const isZh = locale === "zh";

  return (
    <>
      <ExpoEventJsonLd
        event={{
          name: EVENT_NAME[locale] || EVENT_NAME.en,
          description: tdk.description,
          startDate: "2026-10-26",
          endDate: "2026-10-28",
          // 官方网址待核实 —— 核实前不输出 url，避免把本页当成官方入口
          venueName: isZh ? "国家会展中心（天津）" : "National Exhibition and Convention Center (Tianjin)",
          city: isZh ? "天津市" : "Tianjin",
          country: "CN",
          organizers: isZh
            ? ["中国农业机械流通协会", "中国农业机械工业协会"]
            : [
                "China Agricultural Machinery Distribution Association",
                "China Agricultural Machinery Industry Association",
              ],
        }}
      />
      <FaqStructuredData
        faqs={pickFaqs(TJ_FAQS, locale).map((f) => ({
          question: f.q,
          answer: f.a,
        }))}
      />
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: isZh ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: isZh ? "展会" : "Expo", url: `${BASE_URL}/${locale}/expo` },
          {
            name: EVENT_NAME[locale] || EVENT_NAME.en,
            url: `${BASE_URL}/${locale}${PAGE_PATH}`,
          },
        ]}
      />
      <TianjinLanding locale={locale} />
    </>
  );
}
