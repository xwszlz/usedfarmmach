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
  date: "2026-05-29",
  title: "跨境套利日报",
  highlights: [
    { emoji: "🎪", label: "CTT莫斯科展会", value: "最后一天！(5.26-29)", color: "red", url: "/zh/arbitrage-top" },
    { emoji: "💱", label: "EUR/CNY 汇率", value: "7.88 高位企稳", color: "green" },
    { emoji: "📈", label: "970国际价", value: "EUR428K 历史新高", color: "blue" },
    { emoji: "🚀", label: "湖南农机出口", value: "+39.7% 持续高景气", color: "orange" },
  ],
  topArbitrage: [
    { rank: 1, product: "克拉斯 Jaguar 970（欧版）", price: 1630000, profit: "174万+", margin: "79.8%", productId: "cmpfohy08000tkrh5vaaw12nd" },
    { rank: 2, product: "克拉斯 Jaguar 980（美版）", price: 1430000, profit: "155万+", margin: "69.9%", productId: "cmpdknitp001v11kwskpdqx6s" },
    { rank: 3, product: "克拉斯 Jaguar 980（2015款）", price: 1300000, profit: "95万+", margin: "73.1%", productId: "cmpdknix7002h11kwupfm486g" },
  ],
  marketIntel: [
    { icon: "🇷🇺", text: "CTT展会今天第4天·最后一天！所有线索终极跟进，限时优惠今日24:00截止", url: "/zh/arbitrage-top" },
    { icon: "💶", text: "Agroline 970 EUR428,400维持历史新高！我方报价163万，套利174万(162%)", url: "/zh/products/cmpfohy08000tkrh5vaaw12nd" },
    { icon: "📊", text: "中国农机出口持续高景气：湖南+39.7%，山东青岛+27.1%", url: "/zh/products?sort=rank" },
  ],
  totalProducts: 59,
  totalValue: "¥1,808万",
};
