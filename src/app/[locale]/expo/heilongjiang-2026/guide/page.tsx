import type { Metadata } from "next";
import { HljExpoGuide } from "@/components/expo/HljExpoGuide";
import { generatePageMetadata } from "@/lib/seo-metadata";
import {
  BreadcrumbStructuredData,
  FaqStructuredData,
} from "@/components/seo/structured-data";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";
const PAGE_PATH = "/expo/heilongjiang-2026/guide";

/**
 * TDK —— 截流「展会名 + 攻略/交通/住宿/代金券」长尾词。
 *
 * 为什么单独做这一页：观众约 3 万人次 vs 展商 300 家，
 * 搜「怎么去/住哪/代金券」的量是搜「展位价格」的百倍，
 * 而官方只发公众号（微信内容不对百度开放），全网几乎无网页承接 —— 直接占坑。
 */
const TDK: Record<string, { title: string; description: string; keywords: string[] }> = {
  zh: {
    title:
      "2026黑龙江农机展攻略_参展报名·观展交通住宿·代金券玩法（9/19-21 冰雪大世界）",
    description:
      "2026黑龙江国际农业机械展览会（9月19-21日·哈尔滨冰雪大世界）参展与观展完全宝典：报名流程、展位价格、物料清单、倒排时间表、交通住宿、20倍购机代金券玩法、避坑清单、常见问题。手机随时查。",
    keywords: [
      "2026黑龙江农机展",
      "黑龙江国际农业机械展览会",
      "哈尔滨冰雪大世界农机展",
      "黑龙江农机展报名",
      "黑龙江农机展展位",
      "黑龙江农机展交通",
      "黑龙江农机展住宿",
      "黑龙江农机展代金券",
      "农机展参展攻略",
      "农机展观展攻略",
    ],
  },
  en: {
    title:
      "Heilongjiang Farm Machinery Expo 2026 Guide | Sep 19-21 Harbin Ice-Snow World",
    description:
      "Complete guide to the 2026 Heilongjiang International Agricultural Machinery Exhibition (Sep 19-21, Harbin Ice-Snow World): visitor registration, transport, hotels, 20x purchase voucher, exhibitor booth prices and checklist.",
    keywords: [
      "Heilongjiang farm machinery expo 2026",
      "Harbin agricultural machinery exhibition",
      "expo visitor guide",
      "exhibitor booth price",
    ],
  },
  ru: {
    title:
      "Выставка сельхозтехники Хэйлунцзян 2026 — полный гид | 19-21 сентября, Харбин",
    description:
      "Полное руководство по Хэйлунцзянской международной выставке сельхозтехники 2026 (19–21 сентября, Харбин): регистрация, проезд, гостиницы, ваучеры на покупку, цены на стенды и чек-лист.",
    keywords: [
      "выставка сельхозтехники Хэйлунцзян 2026",
      "Харбин выставка сельхозтехники",
      "гид по выставке",
    ],
  },
};

const EVENT_NAME: Record<string, string> = {
  zh: "2026黑龙江国际农业机械展览会",
  en: "2026 Heilongjiang International Agricultural Machinery Exhibition",
};

/** FAQ 与页面内「九、常见问题」一一对应，供结构化数据与 AI 搜索引用 */
const GUIDE_FAQS = [
  {
    q: "2026 黑龙江农机展什么时候举办？在哪里？",
    a: "2026 年 9 月 19 日至 21 日，每日 8:30–16:30，在哈尔滨冰雪大世界（哈尔滨市松北区太阳大道 1458 号）举办。开幕式 9 月 19 日 10:00。",
  },
  {
    q: "参展报名什么时候截止？",
    a: "报名时间为 2026 年 6 月 22 日至 9 月 15 日。需特别注意：9 月 10 日前无搭建展商须申报用电（逾期加收 100%）；9 月 15 日前须通知拆隔板与大功率用电需求。展位以「款到日期」确认，不是报名日期。",
  },
  {
    q: "展位多少钱？",
    a: "参考黑龙江省农机展公开报价：室内标准展位 3m×3m 约 4800 元/个（角位 5800 元），3m×2m 约 3800 元，3m×1.5m 约 3000 元；室外净地 80㎡ 起、约 300 元/㎡（须特装搭建）。秋季冰雪大世界展实际价格以组委会报价为准。",
  },
  {
    q: "观众怎么报名？要门票吗？",
    a: "免费。通过官方微信公众号【黑龙江农机展】报名：展会服务 → 观众报名 → 注册登录 → 选择对应展会 → 填写姓名手机号 → 提交后生成专属入场二维码，截图保存，现场出示核验即可入场。",
  },
  {
    q: "怎么坐地铁去？",
    a: "乘坐哈尔滨地铁 2 号线至「冰雪大世界站」，从 3 号口出站步行即达。公交可乘 29 路、42 路、47 路区间。自驾导航「哈尔滨冰雪大世界」，园区周边设展会专用停车区。",
  },
  {
    q: "购机代金券怎么玩？",
    a: "组委会推出 20 倍购机代金券：现场扫码抽奖，抽 10 元抵 200 元、20 元抵 400 元、30 元抵 600 元、50 元抵 1000 元。可在任意展位无门槛使用且可叠加，抵扣金额无需展商垫付，会后凭券到大会服务处统一结算。",
  },
  {
    q: "展会规模多大？有哪些展品？",
    a: "设 300 个国际标准展位，总面积 3 万平方米，预计专业客商 3 万人次，设 A/B/C/D/E 五个室内展区及室外展区。展出各类农业机械、动力机械、植保机械、畜牧机械、农副产品加工机械、智能农机装备与农业物联网平台等。",
  },
  {
    q: "主办方和承办方是谁？",
    a: "主办：黑龙江省农业机械流通协会、黑龙江省农业机械工业协会。承办：黑龙江汇锦展览有限公司。支持：北大荒农垦集团有限公司、黑龙江省农业投资集团。指导：黑龙江省工业和信息化厅、黑龙江省农业农村厅。",
  },
];

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
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: tdk.title,
      description: tdk.description,
    },
  });
}

export default async function HljExpoGuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh";

  return (
    <>
      <FaqStructuredData
        faqs={GUIDE_FAQS.map((f) => ({ question: f.q, answer: f.a }))}
      />
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: isZh ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: isZh ? "展会" : "Expo", url: `${BASE_URL}/${locale}/expo` },
          {
            name: EVENT_NAME[locale] || EVENT_NAME.en,
            url: `${BASE_URL}/${locale}/expo/heilongjiang-2026`,
          },
          {
            name: isZh ? "参展观展宝典" : "Expo Guide",
            url: `${BASE_URL}/${locale}${PAGE_PATH}`,
          },
        ]}
      />
      <HljExpoGuide locale={locale} />
    </>
  );
}
