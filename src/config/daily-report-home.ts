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
}

export interface DailyReportArbitrage {
  rank: number;
  product: string;
  price: number;
  profit: string;
  margin: string;
  productId: string;
}

export interface DailyReportConfig {
  date: string;
  title: string;
  highlights: DailyReportHighlight[];
  topArbitrage: DailyReportArbitrage[];
  marketIntel: { icon: string; text: string }[];
  totalProducts: number;
  totalValue: string;
}

export const DAILY_REPORT_CONFIG: DailyReportConfig = {
  date: "2026-05-26",
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
    { rank: 3, product: "克拉斯 Jaguar 980", price: 1300000, profit: "95万+", margin: "73.1%", productId: "cmpdknix7002h11kwupfm486g" },
    { rank: 4, product: "克拉斯 5300RC（2022全新）", price: 950000, profit: "85万+", margin: "89.5%", productId: "cmpdknk4s008111kw3zr8aimf" },
    { rank: 5, product: "克拉斯 Jaguar 850（准新机）", price: 1190000, profit: "82万+", margin: "68.9%", productId: "cmpfohxzt000pkrh533z2mf2z" },
  ],
  marketIntel: [
    { icon: "🇷🇺", text: "俄罗斯二手农机机会窗口！新车关税提高=二手不受限" },
    { icon: "🇺🇦", text: "乌克兰溢价37%持续确认，Jaguar 960 EUR399K" },
    { icon: "🇧🇷", text: "巴西农机市场USD84.2亿→113.8亿（CAGR 6.22%）" },
    { icon: "🇰🇿", text: "中亚农机需求爆发，哈萨克斯坦替换需求旺盛" },
  ],
  totalProducts: 59,
  totalValue: "¥1,808万",
};
