/**
 * 市场情报速递 — 完整数据
 * 数据来源：神雕日报
 */

export interface MarketIntelItem {
  icon: string;
  text: string;
  url: string;
  region: string;
  tags: string[];
}

export const ALL_MARKET_INTEL: MarketIntelItem[] = [
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["关税新政", "窗口期"],
    text: "俄罗斯二手农机窗口期！新车关税大幅提升，二手农机不受限，市场需求旺盛，中国出口机遇期",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["展会", "CTT2026"],
    text: "CTT展会5月26-29日莫斯科举行，神雕参展进行中，现场获取大量询盘线索",
    url: "/zh/arbitrage-top",
  },
  {
    icon: "🇺🇦", region: "乌克兰", tags: ["溢价", "高回报"],
    text: "乌克兰溢价37%！Jaguar 960当地官网EUR399K，套利空间持续扩大",
    url: "/zh/arbitrage-top",
  },
  {
    icon: "🇧🇷", region: "巴西", tags: ["市场扩张", "CAGR"],
    text: "巴西农机市场持续扩张，预计从USD84.2亿增长至113.8亿（CAGR 6.22%）",
    url: "/zh/products?brand=克拉斯&sort=rank",
  },
  {
    icon: "🇰🇿", region: "哈萨克斯坦", tags: ["需求爆发", "替换升级"],
    text: "中亚需求爆发！哈萨克斯坦农机替换需求旺盛，中国二手农机性价比优势显著",
    url: "/zh/products?sort=rank&yearMin=2015",
  },
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", tags: ["增速最快", "256%"],
    text: "乌兹别克斯坦全球增速最快！Q1进口增长256.77%，成为中亚增长引擎",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🇦🇫", region: "阿富汗", tags: ["重建需求", "基础设施"],
    text: "阿富汗重建需求：道路/农业基础设施恢复带来大量工程和农机需求",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🌍", region: "非洲", tags: ["新兴市场", "性价比"],
    text: "非洲农机市场：中国二手农机性价比高，非洲进口需求上升中",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["库存盘点", "数据"],
    text: "神雕农机库存53台，总货值¥1,808万，进口机型44台占75%，国产7台",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["拖拉机", "进口需求"],
    text: "俄罗斯拖拉机进口需求持续增长，100马力以上机型最受欢迎，中国品牌份额上升",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🇧🇾", region: "白俄罗斯", tags: ["合作", "零部件"],
    text: "白俄罗斯农机零部件需求旺盛，中白工业园农机合作项目推进中",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🌏", region: "东南亚", tags: ["水稻机械", "插秧机"],
    text: "东南亚水稻机械化率提升，二手插秧机/收割机需求增加，泰国菲律宾为主力市场",
    url: "/zh/products?sort=rank",
  },
];

/** 获取情报总数 */
export function getMarketIntelCount(): number {
  return ALL_MARKET_INTEL.length;
}

/** 按地区分组 */
export function groupByRegion(items: MarketIntelItem[]): Record<string, MarketIntelItem[]> {
  const groups: Record<string, MarketIntelItem[]> = {};
  for (const item of items) {
    if (!groups[item.region]) groups[item.region] = [];
    groups[item.region].push(item);
  }
  return groups;
}
