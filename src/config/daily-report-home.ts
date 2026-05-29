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
  date: "2026-05-25",
  title: "跨境套利日报",
  highlights: [
    { emoji: "🎪", label: "CTT莫斯科展会", value: "进行中 (5.26-29)", color: "red" },
    { emoji: "💱", label: "EUR/CNY 汇率", value: "7.91 高位稳定", color: "green" },
    { emoji: "📈", label: "Q1农机出口", value: "59.4亿美元 +28.9%", color: "blue" },
    { emoji: "🚀", label: "乌兹别克斯坦", value: "+256.77% 全球最快", color: "orange" },
  ],
  topArbitrage: [
    { rank: 1, product: "克拉斯 Jaguar 970（欧版）", price: 1630000, profit: "120万+", margin: "73.6%", productId: "cmpfohy08000tkrh5vaaw12nd" },
    { rank: 2, product: "克拉斯 Jaguar 980（美版）", price: 1430000, profit: "105万+", margin: "73.5%", productId: "cmpdknitp001v11kwskpdqx6s" },
    { rank: 3, product: "克拉斯 Jaguar 980（2015款）", price: 1300000, profit: "95万+", margin: "73.1%", productId: "cmpdknix7002h11kwupfm486g" },
  ],
  marketIntel: [
    { icon: "🇷🇺", text: "俄罗斯二手农机窗口期！新车关税大幅提升，二手农机不受限", url: "/zh/products?sort=rank" },
    { icon: "🇷🇺", text: "CTT展会5月26-29日莫斯科举行，神雕参展现场获取大量询盘", url: "/zh/arbitrage-top" },
    { icon: "🇺🇿", text: "乌兹别克斯坦全球最快增速！Q1进口增长256.77%", url: "/zh/products?sort=rank" },
  ],
  totalProducts: 59,
  totalValue: "¥1,808万",
};
