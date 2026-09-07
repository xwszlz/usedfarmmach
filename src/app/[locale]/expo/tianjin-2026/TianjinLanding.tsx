"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  MapPin,
} from "lucide-react";
import { ExpoInquiryForm } from "@/components/expo/ExpoInquiryForm";
import { TJ_FAQS, pickFaqs } from "@/components/expo/expo-faqs";

/**
 * 2026 中国国际农业机械展览会（天津）· 神雕农机展™ 参展服务专题
 *
 * ⚠️ 事实边界：本届展会的场馆、规模、主办（第三家单位中文全称）、承办、官网、
 * 申报截止在已核实资料中均无记载，页面内一律写「待核实」，不做任何推测填充。
 * 页面同样不出现四档价格、不出现"招展"等主办方行为动词。
 */

interface TianjinTexts {
  badge: string;
  h1: string;
  sub: string;
  disclaimer: string;
  factsTitle: string;
  facts: { label: string; value: string }[];
  pending: string;
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

const TEXTS: Record<string, TianjinTexts> = {
  zh: {
    badge: "2026 展会季 · 天津站",
    h1: "2026 中国国际农业机械展览会（10月26–28日 · 天津）｜ 神雕农机展™ 参展服务专题",
    sub: "现场展位 3 天，线上展台 365 天。神雕农机以参展企业身份到场，为参展企业开通 8 语种线上展台（神雕云展），把展会三天的曝光延长到一整年。",
    disclaimer: "本页为神雕农机自有服务，非本届展会官方网站；展会信息以主办方公告为准。",
    factsTitle: "展会基本信息",
    facts: [
      { label: "展会时间", value: "2026年10月26日–28日" },
      { label: "举办城市", value: "天津市" },
      { label: "展馆", value: "国家会展中心（天津）" },
      {
        label: "主办单位",
        value:
          "中国农业机械流通协会 · 中国农业机械化协会 · 中国农业机械工业协会",
      },
      { label: "承办单位", value: "待核实" },
      { label: "展会规模", value: "近30万㎡ · 3000余家企业参展 · 预计20万人次专业观众" },
      { label: "参展申报", value: "2026年4月26日启动申报（截止以主办方公告为准）" },
      { label: "官方网站", value: "camf.com.cn" },
      { label: "神雕农机身份", value: "以参展企业身份参与本届展会" },
    ],
    pending: "待核实",
    whyTitle: "为什么还需要一个线上第二展位",
    why: [
      {
        title: "线下 3 天，线上 365 天",
        desc: "展位在 10 月 28 日撤展，询盘在 11 月才陆续到来。神雕云展线上展台全年在线，展期流量带走，展后流量还在。",
      },
      {
        title: "海外买家到不了现场，但能打开网页",
        desc: "俄语区、中亚、中东买家多数不会到场。8 语种产品页让他们在自己的语言里检索到你。",
      },
      {
        title: "展台数据自己看得见",
        desc: "浏览量、询价记录都在后台，不是一句「我们会帮你推广」，而是能自己核对的数字。",
      },
    ],
    offerTitle: "神雕农机在现场提供什么",
    offers: [
      "开通神雕云展线上展台，365 天在线，可传图片与视频",
      "8 语种产品页同步展示，覆盖俄语区、中亚、东南亚买家",
      "展台后台可查看浏览量与询价记录",
      "神雕展翼™ 真实作业视频，为展机提供可核验的工况佐证",
      "国际基准价参考：这台机器在国际市场大概值多少",
      "不要独家，不影响你现有的任何渠道",
    ],
    crossTitle: "天津场：面向全国展商的 8 语种出海窗口",
    crossBody:
      "本届展会是全国性农机展，参展企业覆盖整机、配件与服务商。神雕农机在其中承担一件事：把你在展台上的机器，翻译进 8 个语种、推给海外买家，并且在展会结束后继续在线。现场登记即可开通，展后内容由我们协助完善。",
    stepsTitle: "三步入驻",
    steps: [
      { title: "登记", desc: "现场扫码或在本页填写信息，30 秒完成建档" },
      { title: "传机器", desc: "拍照上传，AI 识别机型与年份，补 3 个字段即可" },
      { title: "上线", desc: "线上展台自动开通，8 语种页面同步上线，有人询价会通知你" },
    ],
    faqTitle: "常见问题",
    nextExpo: "上一场：2026 黑龙江国际农业机械展览会（9月19–21日 · 哈尔滨）",
    ctaTitle: "现场展位 3 天，线上展台 365 天",
    ctaSub: "填写以下信息，我们在展前与你确认线上展台开通事宜。",
    secondaryCta: "先看看线上展厅",
    sourceTitle: "信息来源与免责声明",
    sourceNote:
      "本页展会信息来自神雕农机 2026 秋季双展内部战役方案的记载。标注「待核实」的字段（展馆 / 承办 / 规模 / 申报截止 / 官网 / 主办单位第三家中文全称）尚未取得官方来源，正式对外前须以主办方公告为准。神雕农机为本届参展企业，与展会主办方无隶属关系。",
  },
  en: {
    badge: "2026 Expo Season · Tianjin",
    h1: "2026 China International Agricultural Machinery Exhibition (Oct 26–28 · Tianjin) | Shendiao Agri-Machinery Expo™ On-Site Service",
    sub: "An on-site booth lasts 3 days. An online booth lasts 365. Shendiao attends as an exhibitor and opens an 8-language online booth (Shendiao Cloud Expo) for exhibitors, extending three days of exposure across a full year.",
    disclaimer:
      "This page is a Shendiao Agri-Machinery service page, not the official expo website. Expo details are subject to the organizer's announcements.",
    factsTitle: "Expo Facts",
    facts: [
      { label: "Dates", value: "October 26–28, 2026" },
      { label: "City", value: "Tianjin, China" },
      { label: "Venue", value: "To be verified" },
      {
        label: "Organizers",
        value:
          "China Agricultural Machinery Distribution Association · China Agricultural Machinery Industry Association (a third party abbreviated CAAMM — full Chinese name to be verified)",
      },
      { label: "Executed by", value: "To be verified" },
      { label: "Scale", value: "To be verified (internal campaign estimate: approx. 3,000 exhibitors)" },
      { label: "Application Deadline", value: "To be verified" },
      { label: "Official Website", value: "To be verified" },
      { label: "Shendiao's Role", value: "Participates as an exhibiting company" },
    ],
    pending: "To be verified",
    whyTitle: "Why you need a second, online booth",
    why: [
      {
        title: "3 days on site, 365 days online",
        desc: "Your booth comes down on Oct 28; inquiries keep arriving in November. A Shendiao Cloud Expo booth keeps working long after the halls close.",
      },
      {
        title: "Overseas buyers won't fly in — but they will open a page",
        desc: "Most buyers in Russia, Central Asia and the Middle East never attend in person. 8-language product pages let them find you in their own language.",
      },
      {
        title: "You can check the numbers yourself",
        desc: "View counts and inquiry records live in your dashboard — not a vague promise of promotion, but figures you can verify.",
      },
    ],
    offerTitle: "What Shendiao offers on site",
    offers: [
      "Shendiao Cloud Expo online booth — 365 days online, photos and video supported",
      "8-language product pages reaching Russian-speaking, Central Asian and Southeast Asian buyers",
      "Booth dashboard with view counts and inquiry records",
      "Shendiao WingShow™ field-operation video as verifiable proof of working condition",
      "International benchmark pricing: what your machine is worth on the global market",
      "No exclusivity — your existing channels stay untouched",
    ],
    crossTitle: "Tianjin: an 8-language export window for exhibitors nationwide",
    crossBody:
      "This is a national-level show covering complete machines, parts and service providers. Shendiao does one thing here: translate the machines on your stand into 8 languages, push them to overseas buyers, and keep them online after the show closes. Register on site to get started; we help you complete the listing afterwards.",
    stepsTitle: "Three steps to get listed",
    steps: [
      { title: "Register", desc: "Scan the QR code at our booth or fill in this form — done in 30 seconds" },
      { title: "Add machines", desc: "Upload a photo, AI detects brand and year, fill in 3 fields" },
      { title: "Go live", desc: "Your online booth opens automatically in 8 languages; inquiries reach you directly" },
    ],
    faqTitle: "FAQ",
    nextExpo:
      "Previous: 2026 Heilongjiang International Agricultural Machinery Exhibition (Sep 19–21 · Harbin)",
    ctaTitle: "An on-site booth lasts 3 days. An online booth lasts 365.",
    ctaSub: "Fill in the form and we will confirm your online booth before the expo opens.",
    secondaryCta: "Browse the online showroom first",
    sourceTitle: "Sources & Disclaimer",
    sourceNote:
      "Expo facts on this page come from Shendiao's internal 2026 autumn dual-expo campaign records. Fields marked \"To be verified\" (venue / executor / scale / application deadline / official website / full Chinese name of the third organizer) have no official source yet and must be confirmed against the organizer's announcements before external use. Shendiao attends as an exhibiting company and has no affiliation with the expo organizer.",
  },
  ru: {
    badge: "Сезон выставок 2026 · Тяньцзинь",
    h1: "Китайская международная выставка сельхозтехники 2026 (26–28 октября · Тяньцзинь) | Shendiao Agri-Machinery Expo™ — сервисная страница",
    sub: "Офлайн-стенд работает 3 дня, онлайн-стенд — 365. Shendiao участвует как экспонент и открывает онлайн-стенд Shendiao Cloud Expo на 8 языках, продлевая три выставочных дня на целый год.",
    disclaimer:
      "Это сервисная страница Shendiao, а не официальный сайт выставки. Сведения о выставке уточняйте в объявлениях организатора.",
    factsTitle: "Основные сведения",
    facts: [
      { label: "Даты", value: "26–28 октября 2026 г." },
      { label: "Город", value: "Тяньцзинь, Китай" },
      { label: "Павильон", value: "уточняется" },
      {
        label: "Организаторы",
        value:
          "Китайская ассоциация дистрибуции сельхозтехники · Китайская ассоциация сельхозмашиностроения (третья организация — CAAMM, полное китайское название уточняется)",
      },
      { label: "Исполнитель", value: "уточняется" },
      { label: "Масштаб", value: "уточняется (внутренняя оценка: ок. 3 000 экспонентов)" },
      { label: "Срок подачи заявок", value: "уточняется" },
      { label: "Официальный сайт", value: "уточняется" },
      { label: "Роль Shendiao", value: "участвует как экспонент" },
    ],
    pending: "уточняется",
    whyTitle: "Зачем нужен второй, онлайн-стенд",
    why: [
      {
        title: "3 дня офлайн, 365 дней онлайн",
        desc: "Стенд разбирают 28 октября, а запросы продолжают приходить в ноябре. Онлайн-стенд Shendiao Cloud Expo работает и после закрытия павильонов.",
      },
      {
        title: "Зарубежные покупатели не приедут, но откроют страницу",
        desc: "Большинство покупателей из России, Центральной Азии и Ближнего Востока не присутствуют лично. Карточки на 8 языках позволяют им найти вас.",
      },
      {
        title: "Статистику видно самому",
        desc: "Просмотры и запросы доступны в личном кабинете — не общие обещания продвижения, а проверяемые цифры.",
      },
    ],
    offerTitle: "Что Shendiao предлагает на выставке",
    offers: [
      "Онлайн-стенд Shendiao Cloud Expo — 365 дней, фото и видео",
      "Карточки товаров на 8 языках для покупателей из России, Центральной и Юго-Восточной Азии",
      "Личный кабинет стенда: просмотры и запросы",
      "Видео реальной работы Shendiao WingShow™ — подтверждаемое состояние машины",
      "Ориентир по мировым ценам: сколько ваша машина стоит на международном рынке",
      "Без эксклюзива — ваши текущие каналы продаж не затрагиваются",
    ],
    crossTitle: "Тяньцзинь: окно экспорта на 8 языках для экспонентов со всей страны",
    crossBody:
      "Это выставка национального уровня: машины в сборе, запчасти и сервисные компании. Задача Shendiao здесь одна — перевести технику на вашем стенде на 8 языков, показать её зарубежным покупателям и оставить онлайн после закрытия. Зарегистрируйтесь на стенде, заполнение карточек поможем завершить после выставки.",
    stepsTitle: "Три шага к размещению",
    steps: [
      { title: "Регистрация", desc: "Отсканируйте код на стенде или заполните форму — около 30 секунд" },
      { title: "Машина", desc: "Загрузите фото — ИИ определит бренд и год, останется 3 поля" },
      { title: "Публикация", desc: "Стенд открывается автоматически на 8 языках, запросы приходят вам" },
    ],
    faqTitle: "Вопросы и ответы",
    nextExpo:
      "Предыдущая: Хэйлунцзянская международная выставка сельхозтехники 2026 (19–21 сентября · Харбин)",
    ctaTitle: "Офлайн-стенд — 3 дня. Онлайн-стенд — 365 дней.",
    ctaSub: "Заполните форму, и мы подтвердим открытие онлайн-стенда до начала выставки.",
    secondaryCta: "Сначала посмотреть онлайн-шоурум",
    sourceTitle: "Источники и оговорка",
    sourceNote:
      "Сведения о выставке взяты из внутренних материалов кампании Shendiao «Осенние две выставки 2026». Поля, помеченные «уточняется» (павильон / исполнитель / масштаб / срок подачи / официальный сайт / полное китайское название третьего организатора), пока не подтверждены официальным источником и должны быть сверены с объявлениями организатора перед внешним использованием. Shendiao участвует как экспонент и не связана с организатором выставки.",
  },
};

// zh / en / ru 完整写；es / pt / ar / fr / hi 复用英文文案
function getTexts(locale: string): TianjinTexts {
  return TEXTS[locale] || TEXTS.en;
}

export function TianjinLanding({ locale }: { locale: string }) {
  const t = getTexts(locale);
  // FAQ 与页面 FAQPage 结构化数据共用一份数据源
  const faqs = pickFaqs(TJ_FAQS, locale);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero */}
      <section className="bg-gradient-to-br from-sky-700 via-blue-700 to-indigo-700 text-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-amber-300" />
            {t.badge}
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {t.h1}
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-blue-50">{t.sub}</p>
          <p className="mt-3 text-sm text-blue-200">{t.disclaimer}</p>
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

      {/* 展会基本信息 */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <Calendar className="h-6 w-6 text-blue-600" />
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
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {f.value === t.pending ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        {f.value}
                      </span>
                    ) : (
                      f.value
                    )}
                  </td>
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
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>{o}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 天津场差异化 */}
      <section className="bg-gradient-to-br from-sky-50 to-indigo-50 py-14 dark:from-gray-900 dark:to-gray-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Globe className="h-6 w-6 text-blue-600" />
            {t.crossTitle}
          </h2>
          <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">{t.crossBody}</p>
          <Link
            href={`/${locale}/expo/heilongjiang-2026`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
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
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
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
                  <span className="text-blue-600">{openFaq === i ? "−" : "+"}</span>
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
        <ExpoInquiryForm locale={locale} source="tj-2026" />
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
