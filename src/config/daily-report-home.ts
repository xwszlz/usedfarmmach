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
  date: "2026-06-02",
  highlights: [
    {
      emoji: "💱",
      labelZh: "EUR/CNY 汇率", labelEn: "EUR/CNY Rate", labelRu: "Курс EUR/CNY",
      valueZh: "7.9122 高位", valueEn: "7.9122 High", valueRu: "7.9122 высокий",
      color: "green",
    },
    {
      emoji: "💵",
      labelZh: "USD/CNY 汇率", labelEn: "USD/CNY Rate", labelRu: "Курс USD/CNY",
      valueZh: "6.8167", valueEn: "6.8167", valueRu: "6.8167",
      color: "blue",
    },
    {
      emoji: "📈",
      labelZh: "970价差率", labelEn: "970 Spread", labelRu: "Спред 970",
      valueZh: "108.2% 极大套利空间", valueEn: "108.2% Huge Arbitrage", valueRu: "108.2% большой спред",
      color: "red",
    },
    {
      emoji: "📈",
      labelZh: "980价差率", labelEn: "980 Spread", labelRu: "Спред 980",
      valueZh: "109.1% 极大套利空间", valueEn: "109.1% Huge Arbitrage", valueRu: "109.1% большой спред",
      color: "red",
    },
  ],
  topArbitrage: [
    {
      rank: 0,
      productZh: "🔥 纽荷兰 5070 小方捆（2020款）", productEn: "🔥 NH 5070 Small Baler (2020)", productRu: "🔥 NH 5070 Пресс (2020)",
      price: 34000,
      profitZh: "2万/台·12台库存", profitEn: "20K/unit·12 stock", profitRu: "20K/ед·12 склад",
      margin: "58.8%",
      productId: "cmpzm1qnu002pyllpcqe4rlll",
    },
    {
      rank: 1,
      productZh: "克拉斯 Jaguar 970（2017款）", productEn: "CLAAS Jaguar 970 (2017)", productRu: "CLAAS Jaguar 970 (2017)",
      price: 1630000,
      profitZh: "176.4万", profitEn: "1.764M", profitRu: "1.764 млн",
      margin: "108.2%",
      productId: "cmpfohy08000tkrh5vaaw12nd",
    },
    {
      rank: 2,
      productZh: "克拉斯 Jaguar 980（2016款）", productEn: "CLAAS Jaguar 980 (2016)", productRu: "CLAAS Jaguar 980 (2016)",
      price: 1430000,
      profitZh: "156.0万", profitEn: "1.560M", profitRu: "1.560 млн",
      margin: "109.1%",
      productId: "cmpdknitp001v11kwskpdqx6s",
    },
    {
      rank: 3,
      productZh: "克拉斯 Jaguar 980（2015款）", productEn: "CLAAS Jaguar 980 (2015)", productRu: "CLAAS Jaguar 980 (2015)",
      price: 1300000,
      profitZh: "95万+", profitEn: "950K+", profitRu: "950K+",
      margin: "73.1%",
      productId: "cmpdknix7002h11kwupfm486g",
    },
  ],
  marketIntel: [
    {
      icon: "🔥",
      textZh: "纽荷兰5070小方捆·12台库存爆款！¥3.4万/台，海外$7000+，利润58.8%，小方捆打捆机需求旺盛",
      textEn: "New Holland 5070 Small Square Baler·12 units! ¥34K/unit, overseas $7K+, 58.8% margin, high demand",
      textRu: "New Holland 5070 Малый тюковый пресс·12 ед! ¥34K/ед, зарубеж $7K+, 58.8% маржа, высокий спрос",
      url: "/zh/intelligence",
    },
    {
      icon: "🇷🇺",
      textZh: "目标市场（俄罗斯、东南亚、中东）买家需求优先级确认中",
      textEn: "Target markets (Russia, SE Asia, Middle East) buyer demand priorities confirmed",
      textRu: "Целевые рынки (Россия, ЮВА, Ближний Восток) приоритеты спроса подтверждены",
      url: "/zh/arbitrage-top",
    },
    {
      icon: "💶",
      textZh: "Agroline 970 EUR429,000国际报价，国内163万，套利176.4万(108.2%)",
      textEn: "Agroline 970 EUR429,000 intl quote, China 1.63M, arbitrage 1.764M (108.2%)",
      textRu: "Agroline 970 EUR429,000, Китай 1.63 млн, арбитраж 1.764 млн (108.2%)",
      url: "/zh/products/cmpfohy08000tkrh5vaaw12nd",
    },
    {
      icon: "⚠️",
      textZh: "风险提示：国际物流±20%波动、汇率±5%波动、进口政策调整风险",
      textEn: "Risk: Logistics ±20% volatility, FX ±5%, import policy adjustment risks",
      textRu: "Риски: логистика ±20%, валюта ±5%, риски изменения импортной политики",
      url: "/zh/products?sort=rank",
    },
  ],
  totalProducts: 290,
};
