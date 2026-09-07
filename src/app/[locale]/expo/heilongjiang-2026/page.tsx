import type { Metadata } from "next";
import { HeilongjiangLanding } from "./HeilongjiangLanding";
import { generatePageMetadata } from "@/lib/seo-metadata";
import {
  BreadcrumbStructuredData,
  FaqStructuredData,
} from "@/components/seo/structured-data";
import { ExpoEventJsonLd } from "@/components/expo/ExpoEventJsonLd";
import { HLJ_FAQS, pickFaqs } from "@/components/expo/expo-faqs";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";
const PAGE_PATH = "/expo/heilongjiang-2026";

// ─────── TDK（截流「展会名 + 参展/入驻」搜索词）───────
const TDK: Record<string, { title: string; description: string; keywords: string[] }> = {
  zh: {
    title: "黑龙江农机展2026_9月19-21哈尔滨_展商入驻神雕农机",
    description:
      "2026黑龙江国际农业机械展览会9月19–21日在哈尔滨冰雪大世界举办，主题「智能农机新装备，智慧农业新发展」，参展报名截止9月15日。神雕农机为本届参展企业，提供365天在线的线上展台（神雕云展）与8语种全球买家曝光，现场即可免费开通。",
    keywords: [
      "黑龙江农机展",
      "2026黑龙江国际农业机械展览会",
      "哈尔滨农机展",
      "农机展参展",
      "农机展参展",
      "农机展入驻",
    ],
  },
  en: {
    title: "Heilongjiang Farm Machinery Expo 2026 | Sep 19-21 Harbin | Online Booth",
    description:
      "The 2026 Heilongjiang International Agricultural Machinery Exhibition runs Sep 19-21, 2026 at Harbin Ice-Snow World. Shendiao attends as an exhibitor and opens a free 365-day online booth (Shendiao Cloud Expo) in 8 languages for exhibitors and machine owners.",
    keywords: [
      "Heilongjiang farm machinery expo",
      "2026 Heilongjiang International Agricultural Machinery Exhibition",
      "Harbin farm machinery expo",
      "exhibit at farm machinery expo",
      "online booth for machinery exhibitors",
    ],
  },
  ru: {
    title: "Выставка сельхозтехники Хэйлунцзян 2026 | 19-21 сентября, Харбин",
    description:
      "Хэйлунцзянская международная выставка сельхозтехники 2026 пройдёт 19–21 сентября 2026 года в Харбине. Shendiao участвует как экспонент и бесплатно открывает онлайн-стенд Shendiao Cloud Expo на 365 дней и 8 языках.",
    keywords: [
      "выставка сельхозтехники Хэйлунцзян",
      "выставка сельхозтехники Харбин 2026",
      "участие в выставке сельхозтехники",
      "онлайн-стенд для экспонентов",
    ],
  },
};

// ─────── Event 结构化数据（organizer 只填真实主办方）───────
const EVENT_NAME: Record<string, string> = {
  zh: "2026黑龙江国际农业机械展览会",
  en: "2026 Heilongjiang International Agricultural Machinery Exhibition",
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

export default async function HeilongjiangExpoPage({
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
          startDate: "2026-09-19",
          endDate: "2026-09-21",
          url: "https://www.hljnj.com.cn",
          venueName: isZh ? "哈尔滨冰雪大世界" : "Harbin Ice-Snow World",
          city: isZh ? "哈尔滨市" : "Harbin",
          region: isZh ? "黑龙江省" : "Heilongjiang",
          country: "CN",
          organizers: isZh
            ? ["黑龙江省农业机械流通协会", "黑龙江省农业机械工业协会"]
            : [
                "Heilongjiang Agricultural Machinery Distribution Association",
                "Heilongjiang Agricultural Machinery Industry Association",
              ],
        }}
      />
      <FaqStructuredData
        faqs={pickFaqs(HLJ_FAQS, locale).map((f) => ({
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
      <HeilongjiangLanding locale={locale} />
    </>
  );
}
