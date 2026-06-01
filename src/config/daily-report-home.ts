/**
 * 跨境套利日报首页展示数据
 * 每次日报更新时同步修改此文件
 * 数据来源：神雕日报/2025-05-26_跨境套利日报.md
 */

export interface DailyReportHighlight {
  emoji: string;
  label: string;
  value: string;
  color: "red" | "green" | "blue" | "orange";
  url?: string;
}

export interface DailyReportArbitrage {
  rank: number;
  product: string;
  price: number;
  profit: string;
  margin: string;
  productId: string;
}

export interface DailyReportIntel {
  icon: string;
  text: string;
  url: string;
}

export interface DailyReportConfig {
  date: string;
  title: string;
  highlights: DailyReportHighlight[];
  topArbitrage: DailyReportArbitrage[];
  marketIntel: DailyReportIntel[];
  totalProducts: number;
  totalValue: string;
}

export const DAILY_REPORT_CONFIG: DailyReportConfig = {
  date: "2026-06-02",
  title: "跨境套利日报",
  highlights: [
    { emoji: "💱", label: "EUR/CNY 汇率", value: "7.9122 高位", color: "green" },
    { emoji: "💵", label: "USD/CNY 汇率", value: "6.8167", color: "blue" },
    { emoji: "📈", label: "970价差率", value: "108.2% 极大套利空间", color: "red" },
    { emoji: "📈", label: "980价差率", value: "109.1% 极大套利空间", color: "red" },
  ],
  topArbitrage: [
    { rank: 1, product: "克拉斯 Jaguar 970（2017款）", price: 1630000, profit: "176.4万", margin: "108.2%", productId: "cmpfohy08000tkrh5vaaw12nd" },
    { rank: 2, product: "克拉斯 Jaguar 980（2016款）", price: 1430000, profit: "156.0万", margin: "109.1%", productId: "cmpdknitp001v11kwskpdqx6s" },
    { rank: 3, product: "克拉斯 Jaguar 980（2015款）", price: 1300000, profit: "95万+", margin: "73.1%", productId: "cmpdknix7002h11kwupfm486g" },
  ],
  marketIntel: [
    { icon: "🇷🇺", text: "目标市场（俄罗斯、东南亚、中东）买家需求优先级确认中", url: "/zh/arbitrage-top" },
    { icon: "💶", text: "Agroline 970 EUR429,000国际报价，国内163万，套利176.4万(108.2%)", url: "/zh/products/cmpfohy08000tkrh5vaaw12nd" },
    { icon: "⚠️", text: "风险提示：国际物流±20%波动、汇率±5%波动、进口政策调整风险", url: "/zh/products?sort=rank" },
  ],
  totalProducts: 290,
  totalValue: "¥待核算",
};
