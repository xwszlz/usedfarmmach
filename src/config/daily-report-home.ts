/**
 * 跨境套利日报首页展示数据（多语言版本）
 * 每次日报更新时同步修改此文件
 */
export interface DailyReportHighlight {
  emoji: string;
  labelZh: string;
  labelEn: string;
  labelRu: string;
  valueZh: string;
  valueEn: string;
  valueRu: string;
  color: "red" | "green" | "blue" | "orange";
  url?: string;
}

export interface DailyReportArbitrage {
  rank: number;
  productZh: string;
  productEn: string;
  productRu: string;
  price: number;
  profitZh: string;
  profitEn: string;
  profitRu: string;
  margin: string;
  productId: string;
}

export interface DailyReportIntel {
  icon: string;
  textZh: string;
  textEn: string;
  textRu: string;
  url: string;
}

export interface DailyReportConfig {
  date: string;
  highlights: DailyReportHighlight[];
  topArbitrage: DailyReportArbitrage[];
  marketIntel: DailyReportIntel[];
  totalProducts: number;
}

// 按语言提取数据的辅助函数
export function getLocalizedData(locale: string) {
  const d = DAILY_REPORT_CONFIG;
  return {
    date: d.date,
    highlights: d.highlights.map(h => ({
      emoji: h.emoji,
      label: locale === 'en' ? h.labelEn : locale === 'ru' ? h.labelRu : h.labelZh,
      value: locale === 'en' ? h.valueEn : locale === 'ru' ? h.valueRu : h.valueZh,
      color: h.color,
    })),
    topArbitrage: d.topArbitrage.map(a => ({
      rank: a.rank,
      product: locale === 'en' ? a.productEn : locale === 'ru' ? a.productRu : a.productZh,
      price: a.price,
      profit: locale === 'en' ? a.profitEn : locale === 'ru' ? a.profitRu : a.profitZh,
      margin: a.margin,
      productId: a.productId,
    })),
    marketIntel: d.marketIntel.map(m => ({
      icon: m.icon,
      text: locale === 'en' ? m.textEn : locale === 'ru' ? m.textRu : m.textZh,
      url: m.url.replace('/zh/', `/${locale}/`),
    })),
    totalProducts: d.totalProducts,
  };
}

export const DAILY_REPORT_CONFIG: DailyReportConfig = {
  date: "2026-07-02",
  highlights: [
    {
      emoji: "💱",
      labelZh: "EUR/CNY 汇率", labelEn: "EUR/CNY Rate", labelRu: "Курс EUR/CNY",
      valueZh: "7.741 6月收官企稳", valueEn: "7.741 June close stable", valueRu: "7.741 закрытие июня стабильно",
      color: "green",
    },
    {
      emoji: "💵",
      labelZh: "USD/CNY 汇率", labelEn: "USD/CNY Rate", labelRu: "Курс USD/CNY",
      valueZh: "6.80 美元窄幅持稳", valueEn: "6.80 USD narrow stable", valueRu: "6.80 USD узкий стабильный",
      color: "blue",
    },
    {
      emoji: "🔥",
      labelZh: "EUR/RUB 汇率", labelEn: "EUR/RUB Rate", labelRu: "Курс EUR/RUB",
      valueZh: "87.403 高位持稳+5.52%月累计", valueEn: "87.403 High +5.52% Monthly", valueRu: "87.403 высокий +5,52% за месяц",
      color: "red",
    },
    {
      emoji: "📈",
      labelZh: "FR450(2013)价差率", labelEn: "FR450(2013) Spread", labelRu: "Спред FR450(2013)",
      valueZh: "104.7% 全品类第一", valueEn: "104.7% #1 All Categories", valueRu: "104,7% №1 во всех категориях",
      color: "red",
    },
  ],
  topArbitrage: [
    {
      rank: 0,
      productZh: "纽荷兰 FR450（2013款·10台库存）", productEn: "NH FR450 (2013·10 in stock)", productRu: "NH FR450 (2013·10 в наличии)",
      price: 215000,
      profitZh: "22.5万", profitEn: "225K", profitRu: "225 тыс",
      margin: "104.7%",
      productId: "cmpfohy0n000xkrh5d14tvnqy",
    },
    {
      rank: 1,
      productZh: "Krone BiG Pack 1290（2020款）", productEn: "Krone BiG Pack 1290 (2020)", productRu: "Krone BiG Pack 1290 (2020)",
      price: 680000,
      profitZh: "64.2万", profitEn: "642K", profitRu: "642 тыс",
      margin: "94.4%",
      productId: "cmpfohxxe0003krh59h6galr2",
    },
    {
      rank: 2,
      productZh: "克拉斯 Jaguar 980（2016款）", productEn: "CLAAS Jaguar 980 (2016)", productRu: "CLAAS Jaguar 980 (2016)",
      price: 1430000,
      profitZh: "105.1万", profitEn: "1.051M", profitRu: "1.051 млн",
      margin: "73.5%",
      productId: "cmpdknitp001v11kwskpdqx6s",
    },
  ],
  marketIntel: [
    {
      icon: "🔥",
      textZh: "7月开局第2天：EUR/CNY 7.741持稳 + EUR/RUB 87.403高位 = 俄线历史级黄金窗口延续！7/9-11 AGRO展倒计时7天",
      textEn: "July Day 2: EUR/CNY 7.741 stable + EUR/RUB 87.403 high = historic Russia window continues! AGRO Expo T-7 days",
      textRu: "Июль день 2: EUR/CNY 7,741 стабильно + EUR/RUB 87,403 высокий = историческое окно РФ продолжается! AGRO Expo T-7 дней",
      url: "/zh/intelligence",
    },
    {
      icon: "📊",
      textZh: "970系列维持29条在售 + 🆕970(2018)178.5万中端锚点 + 980(2019)196.3万中端锚点 | FR450×10台7月冲量",
      textEn: "970 series 29 listings stable + 🆕970(2018)¥1.785M + 980(2019)¥1.963M mid-hour anchors | FR450×10 Jul push",
      textRu: "970 серия 29 объяв стабильно + 🆕970(2018)¥1,785M + 980(2019)¥1,963M якоря | FR450×10 июль продажа",
      url: "/zh/arbitrage-top",
    },
    {
      icon: "💶",
      textZh: "FR450(2013)104.7%全品类第一 + Kuhn 890大方捆337.5%新入榜 | 7月俄线王牌绝对主力",
      textEn: "FR450(2013)104.7% #1 + Kuhn 890 337.5% new entry | July Russia line absolute king",
      textRu: "FR450(2013)104,7% №1 + Kuhn 890 337,5% новый | Июль линия РФ абсолютный король",
      url: "/zh/products?sort=rank",
    },
    {
      icon: "⚠️",
      textZh: "风险：AGRO 2026基辅展倒计时7天急需备货；ECB 7/22-23+CBR 7/25议息；EU第21轮制裁草案7月落地",
      textEn: "Risk: AGRO 2026 Kyiv expo T-7 days urgent prep; ECB 7/22-23 + CBR 7/25 rate decisions; EU 21st sanctions Jul",
      textRu: "Риски: AGRO 2026 Киев T-7 дней срочная подготовка; ЕЦБ 22-23.07 + ЦБР 25.07 ставки; 21-й пакет санкций ЕС июль",
      url: "/zh/products?sort=rank",
    },
  ],
  totalProducts: 84,
};
