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
  date: "2026-06-20",
  highlights: [
    {
      emoji: "💱",
      labelZh: "EUR/CNY 汇率", labelEn: "EUR/CNY Rate", labelRu: "Курс EUR/CNY",
      valueZh: "7.7681 尾盘反弹守7.75", valueEn: "7.7681 Bounce Held 7.75", valueRu: "7.7681 отскок удержал 7.75",
      color: "green",
    },
    {
      emoji: "💵",
      labelZh: "USD/CNY 汇率", labelEn: "USD/CNY Rate", labelRu: "Курс USD/CNY",
      valueZh: "6.7695", valueEn: "6.7695", valueRu: "6.7695",
      color: "blue",
    },
    {
      emoji: "📈",
      labelZh: "5300RC(2020)价差率", labelEn: "5300RC(2020) Spread", labelRu: "Спред 5300RC(2020)",
      valueZh: "331.1% 全品类第一", valueEn: "331.1% #1 All Categories", valueRu: "331.1% №1 во всех категориях",
      color: "red",
    },
    {
      emoji: "📈",
      labelZh: "980(2016)价差率", labelEn: "980(2016) Spread", labelRu: "Спред 980(2016)",
      valueZh: "71.2% 供给井喷", valueEn: "71.2% Supply Surge", valueRu: "71.2% всплеск предложения",
      color: "red",
    },
  ],
  topArbitrage: [
    {
      rank: 0,
      productZh: "🔥 CLAAS 5300RC（2020款）", productEn: "🔥 CLAAS 5300RC (2020)", productRu: "🔥 CLAAS 5300RC (2020)",
      price: 180000,
      profitZh: "59.6万", profitEn: "596K", profitRu: "596 тыс",
      margin: "331.1%",
      productId: "cmpdknk4s008111kw3zr8aimf",
    },
    {
      rank: 1,
      productZh: "纽荷兰 FR450（2013款·10台库存）", productEn: "NH FR450 (2013·10 in stock)", productRu: "NH FR450 (2013·10 в наличии)",
      price: 215000,
      profitZh: "21.8万", profitEn: "218K", profitRu: "218 тыс",
      margin: "101.4%",
      productId: "cmpfohy0n000xkrh5d14tvnqy",
    },
    {
      rank: 2,
      productZh: "Krone BiG Pack 1290（2020款）", productEn: "Krone BiG Pack 1290 (2020)", productRu: "Krone BiG Pack 1290 (2020)",
      price: 680000,
      profitZh: "64.6万", profitEn: "646K", profitRu: "646 тыс",
      margin: "95.0%",
      productId: "cmpfohxxe0003krh59h6galr2",
    },
    {
      rank: 3,
      productZh: "克拉斯 Jaguar 980（2016款）", productEn: "CLAAS Jaguar 980 (2016)", productRu: "CLAAS Jaguar 980 (2016)",
      price: 1430000,
      profitZh: "101.8万", profitEn: "1.018M", profitRu: "1.018 млн",
      margin: "71.2%",
      productId: "cmpdknitp001v11kwskpdqx6s",
    },
  ],
  marketIntel: [
    {
      icon: "🔥",
      textZh: "EUR/CNY周跌1.02%但尾盘反弹！7.8480→7.7681，周五从7.7600回升守7.75，下周关注ECB会议",
      textEn: "EUR/CNY -1.02% weekly but bounced! 7.8480→7.7681, Fri rebound from 7.7600 held 7.75, ECB meeting next week",
      textRu: "EUR/CNY -1.02% за неделю, но отскок! 7.8480→7.7681, пятн отскок с 7.7600 удержал 7.75, заседание ЕЦБ на след нед",
      url: "/zh/intelligence",
    },
    {
      icon: "📊",
      textZh: "980供给井喷：6→14条(+133%)创近期新高，买方议价空间历史最大！2025款€532,500→413.6万",
      textEn: "980 supply surge: 6→14 units (+133%), biggest buyer leverage ever! 2025 model €532,500→4.136M",
      textRu: "980 всплеск: 6→14 ед (+133%), макс рычаг покупателя! 2025 €532,500→4.136 млн",
      url: "/zh/arbitrage-top",
    },
    {
      icon: "💶",
      textZh: "5300RC(2020)€99,900→77.6万国际 vs 国内18万，价差59.6万(331.1%)全品类第一！周末确认车况",
      textEn: "5300RC(2020) €99,900→776K intl vs China 180K, spread 596K (331.1%) #1! Weekend confirm condition",
      textRu: "5300RC(2020) €99,900→776K заруб vs Китай 180K, спред 596K (331.1%) №1! Выходные подтвердить состояние",
      url: "/zh/products?sort=rank",
    },
    {
      icon: "⚠️",
      textZh: "风险：EUR周线偏弱关注下周一开盘；980供给增加压价风险；海运波动±20%",
      textEn: "Risk: EUR weekly weak, watch Mon open; 980 supply pressure; shipping ±20%",
      textRu: "Риски: EUR неделя слабая, следить за понед; 980 давление предложения; логистика ±20%",
      url: "/zh/products?sort=rank",
    },
  ],
  totalProducts: 85,
};
