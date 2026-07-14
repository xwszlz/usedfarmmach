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
      labelZh: "9080(2009)价差率", labelEn: "9080(2009) Spread", labelRu: "Спред 9080(2009)",
      valueZh: "73.9% 青储机走量王", valueEn: "73.9% Forage Harvester Leader", valueRu: "73,9% Лидер кормоуборочных",
      color: "red",
    },
  ],
  topArbitrage: [
    {
      rank: 0,
      productZh: "克拉斯 Jaguar 970（2021款·准新机）", productEn: "CLAAS Jaguar 970 (2021·Near New)", productRu: "CLAAS Jaguar 970 (2021·Почти новый)",
      price: 1630000,
      profitZh: "86.5万", profitEn: "865K", profitRu: "865 тыс",
      margin: "53.3%",
      productId: "cmpdknimn000n11kwnxfuiuzv",
    },
    {
      rank: 1,
      productZh: "纽荷兰 9080（2009款·青储机）", productEn: "NH 9080 (2009·Forage Harvester)", productRu: "NH 9080 (2009·Кормоуборочный)",
      price: 690000,
      profitZh: "51.0万", profitEn: "510K", profitRu: "510 тыс",
      margin: "73.9%",
      productId: "cmpdknjh6004x11kwkz5gvrbo",
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
      textZh: "970系列维持多条在售 + 980(2016)143万高价差锚点 | 9080(2009)69万走量主力",
      textEn: "970 series multiple listings + 980(2016)¥1.43M high spread | 9080(2009)¥690K volume driver",
      textRu: "970 серия много объявлений + 980(2016)¥1,43M высокий спред | 9080(2009)¥690K объёмный",
      url: "/zh/arbitrage-top",
    },
    {
      icon: "💶",
      textZh: "9080(2009)73.9%青储机走量王 + 980(2016)73.5%高价差 | 7月俄线王牌绝对主力",
      textEn: "9080(2009)73.9% forage leader + 980(2016)73.5% high spread | July Russia line absolute king",
      textRu: "9080(2009)73,9% лидер кормоуборочных + 980(2016)73,5% высокий спред | Июль линия РФ абсолютный король",
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
  totalProducts: 90,
};
