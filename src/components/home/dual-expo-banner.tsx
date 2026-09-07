"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, ArrowRight, Clock } from "lucide-react";
import { isCnSite } from "@/config/site";

/**
 * 首页双展宣传 / 祝贺横幅
 *
 * 文案来源：deliverables/marketing-campaign/expo-banner-copy-final-2026-09-07.md（正式稿 v1）
 * - 黑龙江展 9/19–21 哈尔滨冰雪大世界（唯一带倒计时的展）
 * - 天津展 10/26–28 国家会展中心（天津）（报名截止日期未提供，不写倒计时）
 *
 * 合规红线：
 * - 全文零「招展」，统一「诚邀入驻」
 * - 身份落款为全称「中国农业机械流通协会二手农机流通分会 副会长单位」
 * - 品牌位为「神雕农机展™」（下证前不用 ®）
 */

interface DualExpoBannerProps {
  locale: string;
}

interface ExpoCardCopy {
  /** 展名徽标（短） */
  badge: string;
  /** 主标题（桌面完整名） */
  name: string;
  /** 主标题（移动端短版） */
  nameShort: string;
  /** 副标题：展期 · 地点 */
  when: string;
  /** 规模信息（桌面显示） */
  scale: string;
  /** 补充信息（桌面显示） */
  note: string;
  /** CTA 按钮文案 */
  cta: string;
}

interface BannerCopy {
  /** 顶部祝贺小字条 */
  congrats: string;
  /** 顶部祝贺小字条（移动端短版） */
  congratsShort: string;
  /** 主标题 / 品牌位 */
  header: string;
  /** .com 全球跨境叙事补充行（仅 .com 渲染） */
  globalLine: string;
  heilongjiang: ExpoCardCopy;
  tianjin: ExpoCardCopy;
  /** 天津卡底部固定文案（无倒计时） */
  tianjinFootnote: string;
  countdown: {
    /** 报名截止前 */
    deadline: (days: number, hours: number) => string;
    /** 报名截止后、开幕前 */
    opening: (days: number, hours: number) => string;
    /** 开幕后 / 进行中 */
    open: string;
  };
  /** 底部通栏 CTA */
  ctaBar: string;
  /** 身份落款全称 */
  signoff: string;
  /** 无障碍 alt（黑龙江卡） */
  altHeilongjiang: string;
  /** 无障碍 alt（天津卡） */
  altTianjin: string;
}

// 8 语映射：zh / en / ru 用正式稿全文；其余 5 语（西/葡/阿/法/印地）不落本地化，直接回落英文
const TEXTS: Record<string, BannerCopy> = {
  zh: {
    congrats:
      "🎉 祝贺 2026 黑龙江国际农业机械展览会、中国国际农业机械展览会 即将盛大启幕",
    congratsShort: "🎉 祝贺黑龙江农机展 9/19–21 · 中国国际农机展 10/26–28 启幕",
    header: "神雕农机展™ · 2026 展会季",
    globalLine:
      "一次上架，8 语种触达全球买家 · 海外买家 2300+ · 中东欧、中亚、东南亚、非洲、南美",
    heilongjiang: {
      badge: "黑龙江站",
      name: "2026 黑龙江国际农业机械展览会",
      nameShort: "黑龙江农机展 9/19–21",
      when: "9月19–21日 · 哈尔滨冰雪大世界",
      scale: "300 展位 · 3万㎡ · 预计 3 万人次",
      note: "俄罗斯 / 白俄罗斯 / 中亚采购团到场",
      cta: "诚邀入驻",
    },
    tianjin: {
      badge: "天津站",
      name: "2026 中国国际农业机械展览会",
      nameShort: "中国国际农机展 10/26–28",
      when: "10月26–28日 · 国家会展中心（天津）",
      scale: "近 30 万㎡ · 3000 余家参展企业 · 预计专业观众 20 万人次",
      note: "据展会官方信息",
      cta: "诚邀入驻",
    },
    tianjinFootnote: "10月26–28日，天津见",
    countdown: {
      deadline: (d, h) => `距报名截止仅剩 ${d} 天 ${h} 小时（9月15日截止）`,
      opening: (d, h) => `距开幕仅剩 ${d} 天 ${h} 小时（9月19日开幕）`,
      open: "展会已开幕 · 9月19–21日进行中",
    },
    ctaBar:
      "农机厂商、经销商诚邀入驻 —— 免费开通 365 天线上展位 · 8 语种全球推送",
    signoff:
      "中国农业机械流通协会二手农机流通分会 副会长单位 · 石家庄神雕农机科技有限公司",
    altHeilongjiang:
      "祝贺 2026 黑龙江国际农业机械展览会将于 9 月 19 日至 21 日在哈尔滨冰雪大世界举办，设 300 个国际标准展位，预计 3 万人次，并有俄罗斯、白俄罗斯及中亚采购团到场。神雕农机展诚邀农机厂商与经销商入驻平台，免费开通 365 天、8 语种全球推送的线上展位，报名将于 9 月 15 日截止。",
    altTianjin:
      "祝贺 2026 中国国际农业机械展览会将于 10 月 26 日至 28 日在国家会展中心（天津）举办，据展会官方信息，展览面积近 30 万平方米，3000 余家企业参展，预计专业观众 20 万人次。神雕农机展诚邀农机厂商与经销商入驻平台，免费开通 365 天、8 语种全球推送的线上展位。",
  },
  en: {
    congrats:
      "🎉 Congratulations to the 2026 Heilongjiang International Agricultural Machinery Expo and the 2026 China International Agricultural Machinery Exhibition (CIAME) — opening soon",
    congratsShort: "🎉 Harbin Sept 19–21 & Tianjin Oct 26–28 — opening soon",
    header: "Shendiao Agri-Machinery Expo™ · 2026 Expo Season",
    globalLine:
      "List your machines once — reach buyers worldwide in 8 languages. 2,300+ overseas buyers · Central & Eastern Europe, Central Asia, Southeast Asia, Africa, South America.",
    heilongjiang: {
      badge: "Harbin",
      name: "2026 Heilongjiang International Agricultural Machinery Expo",
      nameShort: "Harbin · Sept 19–21",
      when: "Sept 19–21 · Harbin Ice-Snow World",
      scale: "300 international booths · 30,000 m² · 30,000 expected visitors",
      note: "Buyers from Russia, Belarus & Central Asia on site",
      cta: "List with us",
    },
    tianjin: {
      badge: "Tianjin",
      name: "2026 China International Agricultural Machinery Exhibition (CIAME)",
      nameShort: "Tianjin · Oct 26–28",
      when: "Oct 26–28 · National Convention and Exhibition Center, Tianjin",
      scale:
        "Nearly 300,000 m² · 3,000+ exhibitors · 200,000 expected trade visitors",
      note: "Per official expo information",
      cta: "List with us",
    },
    tianjinFootnote: "See you in Tianjin, Oct 26–28",
    countdown: {
      deadline: (d, h) => `Registration closes in ${d}d ${h}h (Sept 15)`,
      opening: (d, h) => `Opens in ${d}d ${h}h (Sept 19)`,
      open: "Expo is live · Sept 19–21",
    },
    ctaBar:
      "Machinery makers and dealers: list with us — a 365-day online booth, free to open, pushed worldwide in 8 languages",
    signoff:
      "Vice-President Unit, Second-hand Agricultural Machinery Circulation Branch, China Agricultural Machinery Circulation Association · Shijiazhuang Shendiao Agricultural Machinery Technology Co., Ltd.",
    altHeilongjiang:
      "Congratulations to the 2026 Heilongjiang International Agricultural Machinery Expo, Sept 19–21 at Harbin Ice-Snow World: 300 international booths, 30,000 m², 30,000 expected visitors, with buyers from Russia, Belarus and Central Asia. Shendiao Agri-Machinery Expo invites machinery makers and dealers to open a free 365-day, 8-language online booth; registration closes Sept 15.",
    altTianjin:
      "Congratulations to the 2026 China International Agricultural Machinery Exhibition (CIAME), Oct 26–28 at the National Convention and Exhibition Center, Tianjin: per official expo information, nearly 300,000 m², 3,000+ exhibitors, 200,000 expected trade visitors. Shendiao Agri-Machinery Expo invites machinery makers and dealers to open a free 365-day, 8-language online booth.",
  },
  ru: {
    congrats:
      "🎉 Поздравляем с предстоящим открытием Международной выставки сельхозтехники в Хэйлунцзяне и Китайской международной выставки сельхозтехники (CIAME) — 2026!",
    congratsShort: "🎉 Харбин 19–21.09 и Тяньцзинь 26–28.10 — скоро открытие!",
    header: "Shendiao Agri-Machinery Expo™ · Сезон выставок 2026",
    globalLine:
      "Разместите технику один раз — и вас увидят покупатели по всему миру на 8 языках. Более 2 300 зарубежных покупателей · Центральная и Восточная Европа, Центральная Азия, Юго-Восточная Азия, Африка, Южная Америка.",
    heilongjiang: {
      badge: "Харбин",
      name: "Международная выставка сельхозтехники в Хэйлунцзяне — 2026",
      nameShort: "Харбин · 19–21 сентября",
      when: "19–21 сентября · Харбин, ледово-снежный парк",
      scale: "300 стендов · 30 000 м² · ожидается 30 000 посетителей",
      note: "Закупщики из России, Беларуси и Центральной Азии",
      cta: "Разместиться",
    },
    tianjin: {
      badge: "Тяньцзинь",
      name: "Китайская международная выставка сельхозтехники (CIAME) — 2026",
      nameShort: "Тяньцзинь · 26–28 октября",
      when: "26–28 октября · Национальный выставочный центр, Тяньцзинь",
      scale:
        "Около 300 000 м² · более 3 000 участников · ожидается 200 000 профессиональных посетителей",
      note: "По данным организаторов",
      cta: "Разместиться",
    },
    tianjinFootnote: "До встречи в Тяньцзине, 26–28 октября",
    countdown: {
      deadline: (d, h) =>
        `Регистрация закрывается через ${d} дн. ${h} ч (15 сентября)`,
      opening: (d, h) => `До открытия: ${d} дн. ${h} ч (19 сентября)`,
      open: "Выставка открыта · 19–21 сентября",
    },
    ctaBar:
      "Производителей и дилеров приглашаем разместиться на платформе: онлайн-стенд на 365 дней — бесплатно, продвижение на 8 языках по всему миру",
    signoff:
      "Организация — заместитель председателя Отделения оборота бывшей в употреблении сельхозтехники Китайской ассоциации оборота сельскохозяйственной техники",
    altHeilongjiang:
      "Поздравление с открытием Международной выставки сельхозтехники в Хэйлунцзяне — 2026, 19–21 сентября, Харбин: 300 стендов, 30 000 м², ожидается 30 000 посетителей, закупщики из России, Беларуси и Центральной Азии. Shendiao Agri-Machinery Expo приглашает производителей и дилеров открыть бесплатный онлайн-стенд на 365 дней на 8 языках; регистрация до 15 сентября.",
    altTianjin:
      "Поздравление с открытием Китайской международной выставки сельхозтехники (CIAME) — 2026, 26–28 октября, Тяньцзинь: по данным организаторов, около 300 000 м², более 3 000 участников, 200 000 профессиональных посетителей. Shendiao Agri-Machinery Expo приглашает производителей и дилеров открыть бесплатный онлайн-стенд на 365 дней на 8 языках.",
  },
};

/**
 * .com 全球跨境叙事覆盖（正式稿 §4）：仅 .com 生效，
 * 标题行从「展会季 / 入驻」切换为「两大展会 · 一个全球舞台」；
 * .cn 保留国内入驻叙事（沿用 TEXTS[locale].header）。
 */
const GLOBAL_NARRATIVE: Record<string, { header: string; globalLine: string }> = {
  zh: {
    header: "两大展会 · 一个全球舞台",
    globalLine:
      "一次上架，8 语种触达全球买家 · 海外买家 2300+ · 中东欧、中亚、东南亚、非洲、南美",
  },
  en: {
    header: "Two major exhibitions. One global stage.",
    globalLine:
      "List your machines once — reach buyers worldwide in 8 languages. 2,300+ overseas buyers · Central & Eastern Europe, Central Asia, Southeast Asia, Africa, South America.",
  },
  ru: {
    header: "Две крупные выставки. Одна мировая площадка.",
    globalLine:
      "Разместите технику один раз — и вас увидят покупатели по всему миру на 8 языках. Более 2 300 зарубежных покупателей · Центральная и Восточная Европа, Центральная Азия, Юго-Восточная Азия, Африка, Южная Америка.",
  },
};

// 黑龙江展时间节点：优先倒计时到报名截止 9/15，过期后自动切到开展 9/19
const HL_REGISTRATION_DEADLINE = new Date("2026-09-15T23:59:59+08:00").getTime();
const HL_OPENING = new Date("2026-09-19T09:00:00+08:00").getTime();

type CountdownPhase = "deadline" | "opening" | "open";

interface CountdownState {
  phase: CountdownPhase;
  days: number;
  hours: number;
}

function computeCountdown(): CountdownState {
  const now = Date.now();
  if (now >= HL_OPENING) return { phase: "open", days: 0, hours: 0 };
  const target = now < HL_REGISTRATION_DEADLINE ? HL_REGISTRATION_DEADLINE : HL_OPENING;
  const diff = Math.max(0, target - now);
  return {
    phase: now < HL_REGISTRATION_DEADLINE ? "deadline" : "opening",
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
  };
}

export function DualExpoBanner({ locale }: DualExpoBannerProps) {
  const isCn = isCnSite();
  const isRTL = locale === "ar";

  // 其余 5 语（西/葡/阿/法/印地）一律回落英文，不做机翻上线
  const base = TEXTS[locale] || TEXTS.en;
  const narrative = isCn ? null : GLOBAL_NARRATIVE[locale] || GLOBAL_NARRATIVE.en;
  const t = narrative ? { ...base, ...narrative } : base;

  // 倒计时在挂载后计算，避免服务端/客户端首帧不一致
  const [countdown, setCountdown] = useState<CountdownState | null>(null);

  useEffect(() => {
    setCountdown(computeCountdown());
    const id = setInterval(() => setCountdown(computeCountdown()), 60000);
    return () => clearInterval(id);
  }, []);

  const countdownText = !countdown
    ? null
    : countdown.phase === "deadline"
      ? t.countdown.deadline(countdown.days, countdown.hours)
      : countdown.phase === "opening"
        ? t.countdown.opening(countdown.days, countdown.hours)
        : t.countdown.open;

  const domain = isCn ? "usedfarmmach.cn" : "usedfarmmach.com";

  const cards = [
    {
      key: "heilongjiang",
      href: `/${locale}/expo/heilongjiang-2026`,
      copy: t.heilongjiang,
      alt: t.altHeilongjiang,
      footnote: countdownText,
      showCountdown: true,
    },
    {
      key: "tianjin",
      href: `/${locale}/expo/tianjin-2026`,
      copy: t.tianjin,
      alt: t.altTianjin,
      // 天津展报名截止日期未提供，按正式稿 §7-B 不做倒计时
      footnote: t.tianjinFootnote,
      showCountdown: false,
    },
  ];

  return (
    <section
      dir={isRTL ? "rtl" : "ltr"}
      aria-label={t.header}
      className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500"
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        {/* 顶部「祝贺」小字条 */}
        <p className="text-center text-[11px] font-medium leading-snug text-red-50 sm:text-sm">
          <span className="sm:hidden">{t.congratsShort}</span>
          <span className="hidden sm:inline">{t.congrats}</span>
        </p>

        {/* 主标题 / 品牌位 */}
        <h2 className="mt-1.5 text-center text-base font-bold tracking-tight text-white sm:text-xl lg:text-2xl">
          {t.header}
        </h2>
        {!isCn && (
          <p className="mx-auto mt-1 max-w-4xl text-center text-[11px] leading-snug text-red-50 sm:text-sm">
            {t.globalLine}
          </p>
        )}

        {/* 两展卡片：黑龙江在前，天津在后 */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:mt-4">
          {cards.map((card) => (
            <Link
              key={card.key}
              href={card.href}
              aria-label={card.alt}
              className="group rounded-xl bg-white/10 p-3 ring-1 ring-white/20 backdrop-blur transition-all hover:bg-white/20 hover:ring-white/40 sm:p-4"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white sm:text-xs">
                  {card.copy.badge}
                </span>
                <span className="truncate text-[11px] text-red-50 sm:text-xs">
                  {card.copy.when}
                </span>
              </div>

              <h3 className="mt-2 text-sm font-bold leading-snug text-white sm:text-lg">
                <span className="sm:hidden">{card.copy.nameShort}</span>
                <span className="hidden sm:inline">{card.copy.name}</span>
              </h3>

              <div className="mt-1 hidden items-start gap-1.5 text-xs text-red-50 sm:flex">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{card.copy.scale}</span>
              </div>
              <p className="mt-1 hidden text-xs text-red-100/90 sm:block">
                {card.copy.note}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 pt-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 sm:text-sm">
                  {card.showCountdown ? (
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {card.footnote}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow transition group-hover:bg-amber-50 sm:text-sm">
                  {card.copy.cta}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* 底部通栏 CTA */}
        <div className="mt-3 rounded-lg bg-black/15 px-3 py-2 text-center text-[11px] font-medium leading-snug text-white sm:text-sm">
          {t.ctaBar}
        </div>

        {/* 身份落款（全称，不得简写） */}
        <p className="mt-2 text-center text-[10px] leading-snug text-red-100/80 sm:text-xs">
          {t.signoff} · {domain}
        </p>
      </div>
    </section>
  );
}
