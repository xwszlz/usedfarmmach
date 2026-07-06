"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Globe,
  Clock,
  TrendingUp,
  Shield,
  Bot,
  Ship,
  CheckCircle2,
  ArrowRight,
  Send,
  Loader2,
} from "lucide-react";

interface ExpoLandingProps {
  locale: string;
}

const TEXTS: Record<string, {
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  introTitle: string;
  introBody: string;
  featuresTitle: string;
  features: { icon: string; title: string; desc: string }[];
  benefitsTitle: string;
  benefits: string[];
  formTitle: string;
  formSubtitle: string;
  fields: {
    company: string;
    contact: string;
    phone: string;
    email: string;
    country: string;
    category: string;
    boothType: string;
    message: string;
  };
  boothOptions: string[];
  categoryOptions: string[];
  submit: string;
  submitting: string;
  success: string;
  error: string;
  selectPlaceholder: string;
}> = {
  zh: {
    badge: "中国农机 · 走向世界",
    title: "永不落幕的农机世界展会",
    subtitle:
      "32+中国农机品牌旗舰机型365天在线展示，从东方红到大疆，从拖拉机到植保无人机，让中国制造走向全球田间。",
    cta: "立即申请参展",
    introTitle: "中国农机的世界舞台",
    introBody:
      "传统展会一年3天，错过等一年。我们将展会搬到线上，让中国农机品牌365天24小时向全球买家展示。中国品牌馆为主角，国际标杆馆为参照，品类对比厅为决策助手——三馆联动，从展示到成交的完整闭环。结合AI供需匹配、跨境交易担保和国际物流服务，让中国农机走向一带一路每一个田间。",
    featuresTitle: "核心亮点",
    features: [
      {
        icon: "clock",
        title: "365天全年在线",
        desc: "不受展会档期限制，产品随时展示、随时更新、随时接单",
      },
      {
        icon: "globe",
        title: "全球买家触达",
        desc: "中英俄等8语种覆盖，买家来自中亚、东欧、东南亚、非洲、南美",
      },
      {
        icon: "bot",
        title: "AI供需匹配",
        desc: "智能引擎自动匹配买家需求与卖家产品，精准推送高意向询盘",
      },
      {
        icon: "shield",
        title: "交易担保",
        desc: "资金托管、验机报告、区块链溯源，跨境交易安全无忧",
      },
      {
        icon: "trending",
        title: "数据驱动",
        desc: "全球二手农机价格指数、市场情报速递，用数据赋能决策",
      },
      {
        icon: "ship",
        title: "跨境物流",
        desc: "海外仓+门到门物流方案，FOB中国港口到买家手中全程可视",
      },
    ],
    benefitsTitle: "参展权益",
    benefits: [
      "365天线上虚拟展位，产品图文+视频全天候展示",
      "AI供需匹配引擎，高意向买家询盘优先推送",
      "全球8语种产品详情页，消除语言壁垒",
      "跨境交易担保服务，资金安全有保障",
      "月度市场情报报告，掌握行业价格趋势",
      "线下地头展优先参展权，线上线下一体化",
      "CAMDA二手农机分会会员推荐通道",
      "海外仓+物流方案专属折扣",
    ],
    formTitle: "招商意向表",
    formSubtitle: "填写以下信息，我们将在24小时内与您联系",
    fields: {
      company: "公司名称",
      contact: "联系人",
      phone: "手机号",
      email: "邮箱",
      country: "所在国家/地区",
      category: "主营品类",
      boothType: "意向展位类型",
      message: "留言（选填）",
    },
    boothOptions: [
      "基础展位 ¥3,800/年（5款产品展示）",
      "优选展位 ¥9,800/年（20款产品+视频展示）",
      "旗舰展位 ¥28,800/年（不限量+VR展厅+优先推荐）",
      "暂不确定，请顾问联系我",
    ],
    categoryOptions: [
      "拖拉机",
      "青储机/牧草收割机",
      "打捆机",
      "割台/捡拾割台",
      "裹包机",
      "搂草机/摊晒机",
      "农机配件",
      "其他农机设备",
    ],
    submit: "提交申请",
    submitting: "提交中...",
    success: "提交成功！我们将在24小时内与您联系。",
    error: "提交失败，请稍后重试或直接联系 WhatsApp: +86 15511395016",
    selectPlaceholder: "请选择",
  },
  en: {
    badge: "Chinese Machinery · Global Stage",
    title: "The Always-On Global Farm Machinery Expo",
    subtitle:
      "32+ Chinese farm machinery brands with flagship models on display 365 days a year. From Dongfanghong to DJI, from tractors to drones — bringing Chinese manufacturing to fields worldwide.",
    cta: "Apply to Exhibit",
    introTitle: "The World Stage for Chinese Farm Machinery",
    introBody:
      "Traditional expos last 3 days a year — miss it and wait another year. We bring the expo online, showcasing Chinese farm machinery brands to global buyers 24/7/365. The China Pavilion takes center stage, the Global Pavilion provides benchmarks, and the Category Comparison Hall helps buyers decide — three halls working together from display to deal. Combined with AI matching, cross-border escrow, and international logistics, we bring Chinese machinery to every field along the Belt & Road.",
    featuresTitle: "Key Highlights",
    features: [
      {
        icon: "clock",
        title: "365-Day Online",
        desc: "No expo schedule limits — display, update, and sell anytime",
      },
      {
        icon: "globe",
        title: "Global Buyer Reach",
        desc: "8 languages covering Central Asia, Eastern Europe, SE Asia, Africa, South America",
      },
      {
        icon: "bot",
        title: "AI Matching",
        desc: "Smart engine auto-matches buyer demand with seller inventory, pushing high-intent leads",
      },
      {
        icon: "shield",
        title: "Escrow Protection",
        desc: "Fund custody, inspection reports, blockchain traceability — safe cross-border deals",
      },
      {
        icon: "trending",
        title: "Data-Driven",
        desc: "Global used machinery price index, market intel reports — data empowers decisions",
      },
      {
        icon: "ship",
        title: "Cross-Border Logistics",
        desc: "Overseas warehouses + door-to-door logistics, full visibility from FOB China to buyer",
      },
    ],
    benefitsTitle: "Exhibitor Benefits",
    benefits: [
      "365-day virtual booth with photo + video product showcase",
      "AI matching engine prioritizes high-intent buyer inquiries",
      "8-language product detail pages, eliminating language barriers",
      "Cross-border escrow service for secure fund protection",
      "Monthly market intelligence reports with price trends",
      "Priority access to offline field expos — online + offline integration",
      "CAMDA Used Machinery Chapter member referral channel",
      "Exclusive discounts on overseas warehouse + logistics",
    ],
    formTitle: "Exhibitor Inquiry Form",
    formSubtitle: "Fill out the form below and we'll contact you within 24 hours",
    fields: {
      company: "Company Name",
      contact: "Contact Person",
      phone: "Phone Number",
      email: "Email",
      country: "Country / Region",
      category: "Main Product Category",
      boothType: "Booth Type Interest",
      message: "Message (Optional)",
    },
    boothOptions: [
      "Basic ¥3,800/yr (5 products)",
      "Premium ¥9,800/yr (20 products + video)",
      "Flagship ¥28,800/yr (unlimited + VR + priority)",
      "Not sure, please contact me",
    ],
    categoryOptions: [
      "Tractors",
      "Forage Harvesters",
      "Balers",
      "Headers / Pickup Heads",
      "Bale Wrappers",
      "Rakes / Tedders",
      "Parts",
      "Other Machinery",
    ],
    submit: "Submit Application",
    submitting: "Submitting...",
    success: "Submitted successfully! We'll contact you within 24 hours.",
    error: "Submission failed. Please try again or contact WhatsApp: +86 15511395016",
    selectPlaceholder: "Please select",
  },
  ru: {
    badge: "Китайская техника · Мировая сцена",
    title: "Всемирная выставка сельхозтехники без выходных",
    subtitle:
      "32+ китайских брендов сельхозтехники на витрине 365 дней в году. От Dongfanghong до DJI, от тракторов до дронов — китайское производство для полей всего мира.",
    cta: "Подать заявку",
    introTitle: "Мировая сцена для китайской сельхозтехники",
    introBody:
      "Традиционные выставки длятся 3 дня в году — пропустили, ждите ещё год. Мы перенесли выставку онлайн: китайские бренды доступны покупателям 24/7/365. Китайский зал — главная сцена, Международный зал — ориентир, Зал сравнения — помощник в выборе. Три зала вместе: от показа до сделки. AI-подбор, эскроу-сервис и международная логистика довозят китайскую технику до каждого поля вдоль Шёлкового пути.",
    featuresTitle: "Ключевые преимущества",
    features: [
      {
        icon: "clock",
        title: "365 дней онлайн",
        desc: "Без ограничений по расписанию — показывайте и продавайте в любое время",
      },
      {
        icon: "globe",
        title: "Глобальный охват",
        desc: "8 языков: Центральная Азия, Восточная Европа, Юго-Восточная Азия, Африка, Южная Америка",
      },
      {
        icon: "bot",
        title: "AI-подбор",
        desc: "Умный движок сопоставляет спрос и предложение, направляя целевые лиды",
      },
      {
        icon: "shield",
        title: "Эскроу-защита",
        desc: "Хранение средств, отчёты об осмотре, блокчейн-трассировка — безопасные сделки",
      },
      {
        icon: "trending",
        title: "На основе данных",
        desc: "Глобальный индекс цен, рыночная аналитика — данные для принятия решений",
      },
      {
        icon: "ship",
        title: "Трансграничная логистика",
        desc: "Зарубежные склады + доставка от двери до двери с полным отслеживанием",
      },
    ],
    benefitsTitle: "Преимущества для участников",
    benefits: [
      "365-дневный виртуальный стенд с фото и видео",
      "AI-подбор приоритетных запросов от покупателей",
      "Страницы товаров на 8 языках",
      "Эскроу-сервис для защиты средств",
      "Ежемесячные отчёты по рыночной аналитике",
      "Приоритет на офлайн-выставках",
      "Канал рекомендаций в CAMDA",
      "Скидки на склады и логистику",
    ],
    formTitle: "Заявка на участие",
    formSubtitle: "Заполните форму, и мы свяжемся с вами в течение 24 часов",
    fields: {
      company: "Название компании",
      contact: "Контактное лицо",
      phone: "Телефон",
      email: "Email",
      country: "Страна / Регион",
      category: "Основная категория",
      boothType: "Тип стенда",
      message: "Сообщение (необязательно)",
    },
    boothOptions: [
      "Базовый ¥3,800/год (5 товаров)",
      "Премиум ¥9,800/год (20 товаров + видео)",
      "Флагман ¥28,800/год (без лимита + VR + приоритет)",
      "Не уверен, свяжитесь со мной",
    ],
    categoryOptions: [
      "Тракторы",
      "Кормоуборочные комбайны",
      "Пресс-подборщики",
      "Жатки",
      "Обмотчики",
      "Грабли / Ворошители",
      "Запчасти",
      "Другая техника",
    ],
    submit: "Отправить заявку",
    submitting: "Отправка...",
    success: "Заявка отправлена! Мы свяжемся с вами в течение 24 часов.",
    error: "Ошибка отправки. Повторите или напишите WhatsApp: +86 15511395016",
    selectPlaceholder: "Выберите",
  },
};

const ICON_MAP: Record<string, React.ReactNode> = {
  clock: <Clock className="h-8 w-8 text-primary-600" />,
  globe: <Globe className="h-8 w-8 text-primary-600" />,
  bot: <Bot className="h-8 w-8 text-primary-600" />,
  shield: <Shield className="h-8 w-8 text-primary-600" />,
  trending: <TrendingUp className="h-8 w-8 text-primary-600" />,
  ship: <Ship className="h-8 w-8 text-primary-600" />,
};

export function ExpoLanding({ locale }: ExpoLandingProps) {
  const t = TEXTS[locale] || TEXTS.zh;
  const [formData, setFormData] = useState({
    company: "",
    contact: "",
    phone: "",
    email: "",
    country: "",
    category: "",
    boothType: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/expo/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, locale }),
      });
      if (!res.ok) throw new Error("submit failed");
      setStatus("success");
      setFormData({
        company: "",
        contact: "",
        phone: "",
        email: "",
        country: "",
        category: "",
        boothType: "",
        message: "",
      });
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-50 via-amber-50 to-yellow-50">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 h-40 w-40 rounded-full bg-red-300 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-60 w-60 rounded-full bg-amber-300 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 md:py-28 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-1.5 text-sm font-medium text-red-700">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {t.badge}
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            {t.title}
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-lg text-gray-600 sm:text-xl">
            {t.subtitle}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#inquiry-form">
              <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 sm:w-auto">
                {t.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <Link href={`/${locale}/expo/showroom`}>
              <Button size="lg" variant="outline" className="w-full border-red-600 text-red-700 hover:bg-red-50 sm:w-auto">
                {locale === "zh" ? "进入线上展厅" : locale === "ru" ? "Войти в шоурум" : "Enter Showroom"}
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {locale === "zh" ? "45台中国精品农机在线展示" : locale === "ru" ? "45 китайских машин" : "45 Chinese machines on display"}
            </div>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-3xl font-bold text-gray-900">{t.introTitle}</h2>
        <p className="text-lg leading-relaxed text-gray-600">{t.introBody}</p>
      </section>

      {/* Three Pavilions Entry */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* China Pavilion */}
            <Link
              href={`/${locale}/expo/showroom?pavilion=china`}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]"
            >
              <div className="absolute top-4 right-4 text-6xl opacity-20">🇨🇳</div>
              <h3 className="mb-2 text-2xl font-bold">
                {locale === "zh" ? "中国品牌馆" : locale === "ru" ? "Китайский зал" : "China Pavilion"}
              </h3>
              <p className="text-sm text-red-100">
                {locale === "zh"
                  ? "32+中国农机品牌旗舰机型，从东方红、雷沃到沃得、中联、大疆"
                  : locale === "ru"
                    ? "32+ китайских брендов: от Dongfanghong до DJI"
                    : "32+ Chinese brands: Dongfanghong, Lovol, World, Zoomlion, DJI"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {locale === "zh" ? "进入中国馆" : locale === "ru" ? "Войти" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Global Pavilion */}
            <Link
              href={`/${locale}/expo/showroom?pavilion=global`}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]"
            >
              <div className="absolute top-4 right-4 text-6xl opacity-20">🌍</div>
              <h3 className="mb-2 text-2xl font-bold">
                {locale === "zh" ? "国际标杆馆" : locale === "ru" ? "Международный зал" : "Global Pavilion"}
              </h3>
              <p className="text-sm text-amber-100">
                {locale === "zh"
                  ? "John Deere、CLAAS、Fendt等全球知名品牌标杆机型参照对比"
                  : locale === "ru"
                    ? "John Deere, CLAAS, Fendt — мировые эталоны"
                    : "John Deere, CLAAS, Fendt — global benchmarks for comparison"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {locale === "zh" ? "进入国际馆" : locale === "ru" ? "Войти" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Category Comparison */}
            <Link
              href={`/${locale}/expo/showroom`}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]"
            >
              <div className="absolute top-4 right-4 text-6xl opacity-20">⚖️</div>
              <h3 className="mb-2 text-2xl font-bold">
                {locale === "zh" ? "品类对比厅" : locale === "ru" ? "Зал сравнения" : "Comparison Hall"}
              </h3>
              <p className="text-sm text-blue-100">
                {locale === "zh"
                  ? "同品类中外机型参数对比，价格性能一目了然"
                  : locale === "ru"
                    ? "Сравнение параметров китайских и мировых моделей"
                    : "Compare Chinese vs global models side by side"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {locale === "zh" ? "进入对比厅" : locale === "ru" ? "Войти" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">{t.featuresTitle}</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => (
              <Card key={i} className="border-0 shadow-md transition-shadow hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="mb-4">{ICON_MAP[f.icon]}</div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-sm text-gray-600">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center text-3xl font-bold text-gray-900">{t.benefitsTitle}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {t.benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg bg-amber-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <span className="text-sm text-gray-700">{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="bg-gradient-to-r from-red-600 to-amber-600 py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { name: locale === "zh" ? "基础展位" : "Basic", price: "¥3,800", period: locale === "zh" ? "/年" : "/yr", desc: locale === "zh" ? "5款产品展示" : "5 products" },
              { name: locale === "zh" ? "优选展位" : "Premium", price: "¥9,800", period: locale === "zh" ? "/年" : "/yr", desc: locale === "zh" ? "20款产品+视频" : "20 products + video", highlight: true },
              { name: locale === "zh" ? "旗舰展位" : "Flagship", price: "¥28,800", period: locale === "zh" ? "/年" : "/yr", desc: locale === "zh" ? "不限量+VR+优先推荐" : "Unlimited + VR + priority" },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`rounded-xl p-6 text-center ${
                  tier.highlight ? "bg-white/20 ring-2 ring-white" : "bg-white/10"
                }`}
              >
                <h3 className="mb-2 text-lg font-semibold text-white">{tier.name}</h3>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-white">{tier.price}</span>
                  <span className="text-sm text-white/80">{tier.period}</span>
                </div>
                <p className="text-sm text-white/80">{tier.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section id="inquiry-form" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="mb-3 text-3xl font-bold text-gray-900">{t.formTitle}</h2>
          <p className="mb-8 text-gray-600">{t.formSubtitle}</p>
        </div>

        {status === "success" ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium text-green-800">{t.success}</p>
              <Button
                variant="outline"
                onClick={() => setStatus("idle")}
              >
                {locale === "zh" ? "再次提交" : "Submit Another"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.company} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="company"
                      required
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.contact} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="contact"
                      required
                      value={formData.contact}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.phone} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.email}
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.country} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="country"
                      required
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.category}
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    >
                      <option value="">{t.selectPlaceholder}</option>
                      {t.categoryOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t.fields.boothType}
                  </label>
                  <select
                    name="boothType"
                    value={formData.boothType}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">{t.selectPlaceholder}</option>
                    {t.boothOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t.fields.message}
                  </label>
                  <textarea
                    name="message"
                    rows={3}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  />
                </div>

                {status === "error" && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {t.error}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={status === "submitting"}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.submitting}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {t.submit}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Contact info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            WhatsApp: +86 15511395016 &nbsp;|&nbsp; Email: 932133255@qq.com
          </p>
        </div>
      </section>
    </div>
  );
}
