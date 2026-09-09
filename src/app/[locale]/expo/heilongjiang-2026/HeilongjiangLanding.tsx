"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  MapPin,
} from "lucide-react";
import { ExpoInquiryForm } from "@/components/expo/ExpoInquiryForm";
import { HLJ_FAQS, pickFaqs } from "@/components/expo/expo-faqs";

/**
 * 2026 黑龙江国际农业机械展览会 · 神雕农机展™ 参展服务专题
 *
 * 展会硬事实（日期 / 场馆 / 主题 / 报名截止 / 主办 / 承办 / 规模 / 官网）均取自
 * 已核实资料，页面内不出现四档价格、不出现"招展"等主办方行为动词。
 */

interface HeilongjiangTexts {
  badge: string;
  h1: string;
  sub: string;
  disclaimer: string;
  factsTitle: string;
  facts: { label: string; value: string }[];
  whyTitle: string;
  why: { title: string; desc: string }[];
  offerTitle: string;
  offers: string[];
  crossTitle: string;
  crossBody: string;
  stepsTitle: string;
  steps: { title: string; desc: string }[];
  faqTitle: string;
  nextExpo: string;
  ctaTitle: string;
  ctaSub: string;
  secondaryCta: string;
  sourceTitle: string;
  sourceNote: string;
}

const TEXTS: Record<string, HeilongjiangTexts> = {
  zh: {
    badge: "2026 展会季 · 黑龙江站",
    h1: "2026 黑龙江国际农业机械展览会（9月19–21日 · 哈尔滨冰雪大世界）｜ 神雕农机展™ 参展服务专题",
    sub: "现场展位 3 天，线上展台 365 天。神雕农机以参展企业身份到场，为展商与机主免费开通神雕云展线上展台，8 语种同步展示给全球买家。",
    disclaimer: "本页为神雕农机自有服务，非本届展会官方网站；展会信息以主办方公告为准。",
    factsTitle: "展会基本信息",
    facts: [
      { label: "展会时间", value: "2026年9月19日–21日" },
      { label: "展馆", value: "哈尔滨冰雪大世界" },
      { label: "展会主题", value: "智能农机新装备，智慧农业新发展" },
      { label: "参展报名截止", value: "2026年9月15日" },
      { label: "主办单位", value: "黑龙江省农业机械流通协会 · 黑龙江省农业机械工业协会" },
      { label: "承办单位", value: "黑龙江汇锦展览有限公司" },
      { label: "展会规模", value: "约 300 个展位 · 3 万平方米 · 预计 3 万人次" },
      { label: "官方网站", value: "www.hljnj.com.cn" },
      { label: "跨境对接", value: "重点对接俄罗斯、白俄罗斯、中亚采购团" },
      { label: "神雕农机展位", value: "已定 2 个标准展位（约 18㎡）" },
    ],
    whyTitle: "为什么还需要一个线上第二展位",
    why: [
      {
        title: "线下 3 天，线上 365 天",
        desc: "展位在 9 月 21 日撤展，买家在 10 月才想起你。神雕云展线上展台全年在线，展期流量带走，展后流量还在。",
      },
      {
        title: "全场在卖新机，我们系统性收二手机",
        desc: "本届展会以新机展示为主。神雕农机专注二手农机全球流通，现场提供重点机型登记与国际市场参考价区间。",
      },
      {
        title: "一台机器，8 个语种被看见",
        desc: "中文展品同步生成英、俄等 8 语种页面，俄语区与中亚买家在 usedfarmmach.com 直接检索到你。",
      },
    ],
    offerTitle: "神雕农机在现场提供什么",
    offers: [
      "免费开通神雕云展线上展台，365 天在线，可传图片与视频",
      "8 语种产品页同步展示，覆盖俄语区、中亚、东南亚买家",
      "展台后台可查看浏览量与询价记录，数据自己看得见",
      "神雕展翼™ 真实作业视频，为展机提供可核验的工况佐证",
      "国际基准价参考：这台机器在国际市场大概值多少",
      "不要独家，不影响你现有的任何渠道",
    ],
    crossTitle: "重点邀约：俄罗斯、白俄罗斯、中亚采购团",
    crossBody:
      "本届展会重点对接俄罗斯、白俄罗斯与中亚采购团。哈尔滨收车，远东交车——东北换代下来的进口青贮机、打捆机，正是俄罗斯远东在找的机型。现场登记后由我们对接海外买家，机器信息同步进入 8 语种站点。",
    stepsTitle: "三步入驻",
    steps: [
      { title: "登记", desc: "现场扫码或在本页填写信息，30 秒完成建档" },
      { title: "传机器", desc: "拍照上传，AI 识别机型与年份，补 3 个字段即可" },
      { title: "上线", desc: "线上展台自动开通，8 语种页面同步上线，有人询价会通知你" },
    ],
    faqTitle: "常见问题",
    nextExpo: "下一场：2026 中国国际农业机械展览会（10月26–28日 · 天津）",
    ctaTitle: "现场展位 3 天，线上展台 365 天",
    ctaSub: "填写以下信息，我们在展前与你确认线上展台开通事宜。",
    secondaryCta: "先看看线上展厅",
    sourceTitle: "信息来源与免责声明",
    sourceNote:
      "本页展会信息（时间 / 场馆 / 主题 / 报名截止 / 主办 / 承办 / 规模 / 官网）来自主办方公开信息（www.hljnj.com.cn）。如与官方公告不一致，以官方公告为准。神雕农机为本届参展企业，与展会主办方无隶属关系。",
  },
  en: {
    badge: "2026 Expo Season · Harbin",
    h1: "2026 Heilongjiang International Agricultural Machinery Exhibition (Sep 19–21 · Harbin Ice-Snow World) | Shendiao Agri-Machinery Expo™ On-Site Service",
    sub: "An on-site booth lasts 3 days. An online booth lasts 365. Shendiao attends as an exhibitor and opens a free Shendiao Cloud Expo online booth for exhibitors and machine owners — displayed to global buyers in 8 languages.",
    disclaimer:
      "This page is a Shendiao Agri-Machinery service page, not the official expo website. Expo details are subject to the organizer's announcements.",
    factsTitle: "Expo Facts",
    facts: [
      { label: "Dates", value: "September 19–21, 2026" },
      { label: "Venue", value: "Harbin Ice-Snow World, Harbin" },
      { label: "Theme", value: "Smart Machinery Equipment, Smart Agriculture Development" },
      { label: "Registration Deadline", value: "September 15, 2026" },
      {
        label: "Organizers",
        value:
          "Heilongjiang Agricultural Machinery Distribution Association · Heilongjiang Agricultural Machinery Industry Association",
      },
      { label: "Executed by", value: "Heilongjiang Huijin Exhibition Co., Ltd." },
      { label: "Scale", value: "Approx. 300 booths · 30,000 sqm · est. 30,000 visitors" },
      { label: "Official Website", value: "www.hljnj.com.cn" },
      {
        label: "Cross-border Matchmaking",
        value: "Focused on buyer delegations from Russia, Belarus and Central Asia",
      },
      { label: "Shendiao Booth", value: "2 standard booths confirmed (approx. 18 sqm)" },
    ],
    whyTitle: "Why you need a second, online booth",
    why: [
      {
        title: "3 days on site, 365 days online",
        desc: "Your booth is dismantled on Sep 21; buyers remember you in October. A Shendiao Cloud Expo booth keeps working long after the halls close.",
      },
      {
        title: "Everyone sells new — we buy used",
        desc: "The show floor is dominated by new machines. Shendiao focuses on global circulation of used machinery, offering on-site registration and international reference price ranges.",
      },
      {
        title: "One machine, seen in 8 languages",
        desc: "Chinese listings are mirrored into 8 languages, so buyers in Russia and Central Asia can find you on usedfarmmach.com.",
      },
    ],
    offerTitle: "What Shendiao offers on site",
    offers: [
      "Free Shendiao Cloud Expo online booth — 365 days online, photos and video supported",
      "8-language product pages reaching Russian-speaking, Central Asian and Southeast Asian buyers",
      "Booth dashboard with view counts and inquiry records — the data is yours to see",
      "Shendiao WingShow™ field-operation video as verifiable proof of working condition",
      "International benchmark pricing: what your machine is worth on the global market",
      "No exclusivity — your existing channels stay untouched",
    ],
    crossTitle: "Focus: buyer delegations from Russia, Belarus and Central Asia",
    crossBody:
      "This edition focuses on buyer delegations from Russia, Belarus and Central Asia. Machines bought in Harbin can be delivered in the Russian Far East — the imported forage harvesters and balers being replaced in Northeast China are exactly what the Far East is looking for. Register on site and we handle the overseas buyer matchmaking, with your machine listed across all 8 language versions.",
    stepsTitle: "Three steps to get listed",
    steps: [
      { title: "Register", desc: "Scan the QR code at our booth or fill in this form — done in 30 seconds" },
      { title: "Add machines", desc: "Upload a photo, AI detects brand and year, fill in 3 fields" },
      { title: "Go live", desc: "Your online booth opens automatically in 8 languages; inquiries reach you directly" },
    ],
    faqTitle: "FAQ",
    nextExpo: "Next: 2026 China International Agricultural Machinery Exhibition (Oct 26–28 · Tianjin)",
    ctaTitle: "An on-site booth lasts 3 days. An online booth lasts 365.",
    ctaSub: "Fill in the form and we will confirm your online booth before the expo opens.",
    secondaryCta: "Browse the online showroom first",
    sourceTitle: "Sources & Disclaimer",
    sourceNote:
      "Expo facts on this page (dates / venue / theme / deadline / organizers / executor / scale / official website) come from publicly available organizer information at www.hljnj.com.cn. In case of any discrepancy, the organizer's official announcements prevail. Shendiao attends as an exhibiting company and has no affiliation with the expo organizer.",
  },
  ru: {
    badge: "Сезон выставок 2026 · Харбин",
    h1: "2026 Хэйлунцзянская международная выставка сельхозтехники (19–21 сентября · Харбин, «Ледяной и снежный мир») | Shendiao Agri-Machinery Expo™ — сервисная страница",
    sub: "Офлайн-стенд работает 3 дня, онлайн-стенд — 365. Shendiao участвует как экспонент и бесплатно открывает онлайн-стенд Shendiao Cloud Expo для участников и владельцев техники — с показом покупателям на 8 языках.",
    disclaimer:
      "Это сервисная страница Shendiao, а не официальный сайт выставки. Сведения о выставке уточняйте в объявлениях организатора.",
    factsTitle: "Основные сведения",
    facts: [
      { label: "Даты", value: "19–21 сентября 2026 г." },
      { label: "Место", value: "Харбин, «Ледяной и снежный мир»" },
      { label: "Тема", value: "Новая техника — умное сельское хозяйство" },
      { label: "Срок регистрации", value: "до 15 сентября 2026 г." },
      {
        label: "Организаторы",
        value:
          "Ассоциация дистрибуции сельхозтехники Хэйлунцзяна · Ассоциация сельхозмашиностроения Хэйлунцзяна",
      },
      { label: "Исполнитель", value: "Выставочная компания «Хэйлунцзян Хуэйцзинь»" },
      { label: "Масштаб", value: "ок. 300 стендов · 30 000 кв. м · ок. 30 000 посетителей" },
      { label: "Официальный сайт", value: "www.hljnj.com.cn" },
      {
        label: "Международные закупки",
        value: "Делегации покупателей из России, Беларуси и Центральной Азии",
      },
      { label: "Стенд Shendiao", value: "забронировано 2 стандартных стенда (ок. 18 кв. м)" },
    ],
    whyTitle: "Зачем нужен второй, онлайн-стенд",
    why: [
      {
        title: "3 дня офлайн, 365 дней онлайн",
        desc: "Стенд разбирают 21 сентября, а покупатель вспоминает о вас в октябре. Онлайн-стенд Shendiao Cloud Expo продолжает работать и после закрытия павильонов.",
      },
      {
        title: "Все продают новую — мы работаем с б/у",
        desc: "В павильонах в основном новая техника. Shendiao специализируется на глобальном обороте б/у техники: регистрация на месте и ориентировочный ценовой диапазон по мировому рынку.",
      },
      {
        title: "Одна машина — 8 языков",
        desc: "Китайская карточка автоматически дублируется на 8 языках, и покупатели из России и Центральной Азии находят вас на usedfarmmach.com.",
      },
    ],
    offerTitle: "Что Shendiao предлагает на выставке",
    offers: [
      "Бесплатное открытие онлайн-стенда Shendiao Cloud Expo — 365 дней, фото и видео",
      "Карточки товаров на 8 языках для покупателей из России, Центральной и Юго-Восточной Азии",
      "Личный кабинет стенда: просмотры и запросы видны владельцу",
      "Видео реальной работы Shendiao WingShow™ — подтверждаемое состояние машины",
      "Ориентир по мировым ценам: сколько ваша машина стоит на международном рынке",
      "Без эксклюзива — ваши текущие каналы продаж не затрагиваются",
    ],
    crossTitle: "Особый фокус: delegations из России, Беларуси и Центральной Азии",
    crossBody:
      "В этом году особое внимание уделяется делегациям покупателей из России, Беларуси и Центральной Азии. Технику можно принять в Харбине, а передать на Дальнем Востоке: импортные кормоуборочные комбайны и пресс-подборщики, которые меняют на Северо-Востоке Китая, — именно то, что ищут на Дальнем Востоке. Зарегистрируйтесь на стенде, и мы подключим зарубежных покупателей: карточка появится сразу на всех 8 языках.",
    stepsTitle: "Три шага к размещению",
    steps: [
      { title: "Регистрация", desc: "Отсканируйте код на стенде или заполните форму — около 30 секунд" },
      { title: "Машина", desc: "Загрузите фото — ИИ определит бренд и год, останется 3 поля" },
      { title: "Публикация", desc: "Стенд открывается автоматически на 8 языках, запросы приходят вам" },
    ],
    faqTitle: "Вопросы и ответы",
    nextExpo:
      "Далее: Китайская международная выставка сельхозтехники 2026 (26–28 октября · Тяньцзинь)",
    ctaTitle: "Офлайн-стенд — 3 дня. Онлайн-стенд — 365 дней.",
    ctaSub: "Заполните форму, и мы подтвердим открытие онлайн-стенда до начала выставки.",
    secondaryCta: "Сначала посмотреть онлайн-шоурум",
    sourceTitle: "Источники и оговорка",
    sourceNote:
      "Сведения о выставке (даты / место / тема / сроки / организаторы / исполнитель / масштаб / сайт) взяты из открытой информации организатора — www.hljnj.com.cn. При расхождениях приоритет имеют официальные объявления организатора. Shendiao участвует как экспонент и не связана с организатором выставки.",
  },
};

// zh / en / ru 完整写；es / pt / ar / fr / hi 复用英文文案
function getTexts(locale: string): HeilongjiangTexts {
  return TEXTS[locale] || TEXTS.en;
}

export function HeilongjiangLanding({ locale }: { locale: string }) {
  const t = getTexts(locale);
  // FAQ 与页面 FAQPage 结构化数据共用一份数据源
  const faqs = pickFaqs(HLJ_FAQS, locale);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-700 via-green-600 to-emerald-600 text-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-amber-300" />
            {t.badge}
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {t.h1}
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-green-50">{t.sub}</p>
          <p className="mt-3 text-sm text-green-200">{t.disclaimer}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#expo-inquiry-form"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-6 py-3 font-semibold text-amber-900 shadow-lg transition hover:bg-amber-300"
            >
              {locale === "zh" ? "申请开通线上展台" : locale === "ru" ? "Открыть онлайн-стенд" : "Open my online booth"}
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href={`/${locale}/expo/showroom`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 px-6 py-3 font-semibold backdrop-blur-sm transition hover:bg-white/20"
            >
              {t.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      {/* 参展观展宝典入口 —— 通用攻略页，承接「怎么去/住哪/代金券」长尾搜索 */}
      <section className="border-b border-gray-200 bg-amber-50 dark:border-gray-800 dark:bg-amber-950/20">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="font-bold text-gray-900 dark:text-white">
                  {locale === "zh"
                    ? "参展 & 观展完全宝典（免费，同行也能用）"
                    : locale === "ru"
                    ? "Полное руководство участника и посетителя"
                    : "Complete Exhibitor & Visitor Guide"}
                </div>
                <div className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  {locale === "zh"
                    ? "报名流程 · 展位选择 · 物料清单 · 交通住宿 · 20倍代金券玩法 · 避坑清单。手机随时查，不用到现场领资料。"
                    : locale === "ru"
                    ? "Регистрация, стенды, чек-лист, проезд, ваучеры, подводные камни."
                    : "Registration, booths, checklist, transport, vouchers, pitfalls."}
                </div>
              </div>
            </div>
            <Link
              href={`/${locale}/expo/heilongjiang-2026/guide`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-white shadow transition hover:bg-amber-600"
            >
              {locale === "zh" ? "查看完整宝典" : locale === "ru" ? "Открыть гайд" : "Open the guide"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 展会基本信息 */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <Calendar className="h-6 w-6 text-green-600" />
          {t.factsTitle}
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {t.facts.map((f) => (
                <tr key={f.label} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <th className="w-48 shrink-0 bg-gray-50 px-4 py-3 font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {f.label}
                  </th>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 为什么需要线上第二展位 */}
      <section className="bg-gray-50 py-14 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">{t.whyTitle}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {t.why.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950"
              >
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 神雕提供什么 */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">{t.offerTitle}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {t.offers.map((o) => (
            <li
              key={o}
              className="flex items-start gap-2 rounded-lg border border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <span>{o}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 俄白中亚采购团 */}
      <section className="bg-gradient-to-br from-amber-50 to-orange-50 py-14 dark:from-gray-900 dark:to-gray-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Globe className="h-6 w-6 text-amber-600" />
            {t.crossTitle}
          </h2>
          <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">{t.crossBody}</p>
          <Link
            href={`/${locale}/expo/tianjin-2026`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            {t.nextExpo}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 三步入驻 */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">{t.stepsTitle}</h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {t.steps.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-xl border border-gray-200 p-6 dark:border-gray-800"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                {i + 1}
              </div>
              <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{s.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-14 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">{t.faqTitle}</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={faq.q}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white"
                >
                  <span>{faq.q}</span>
                  <span className="text-green-600">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <p className="border-t border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-400">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + 表单 */}
      <section id="expo-inquiry-form" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">{t.ctaTitle}</h2>
          <p className="mb-8 text-gray-600 dark:text-gray-400">{t.ctaSub}</p>
        </div>
        <ExpoInquiryForm locale={locale} source="hlj-2026" />
      </section>

      {/* 信息来源与免责声明 */}
      <section className="border-t border-gray-200 py-10 dark:border-gray-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Clock className="h-4 w-4 text-gray-400" />
            {t.sourceTitle}
          </h2>
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t.sourceNote}</p>
          <p className="mt-4 flex items-center gap-1 text-xs text-gray-400">
            <MapPin className="h-3 w-3" />
            石家庄神雕农机科技有限公司
          </p>
        </div>
      </section>
    </div>
  );
}
