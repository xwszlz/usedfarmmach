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
    icon: "🇷🇺", region: "俄罗斯", tags: ["CTT", "最后一天"],
    text: "CTT展会第4天·最后一天（5月26-29日）！所有线索终极跟进，限时优惠今日24:00截止",
    url: "/zh/arbitrage-top",
  },
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["关税新政", "窗口期"],
    text: "俄罗斯二手农机窗口期持续！新车关税大幅提升，二手农机不受限",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "💶", region: "欧洲", tags: ["Agroline", "历史新高"],
    text: "Agroline 970 EUR428,400维持历史新高！中方163万 vs 欧价337万，套利174万(162%)",
    url: "/zh/products/cmpfohy08000tkrh5vaaw12nd",
  },
  {
    icon: "📊", region: "中国", tags: ["出口数据", "高景气"],
    text: "中国农机出口持续高景气：湖南+39.7%，山东青岛+27.1%，全国Q1+28.9%",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🇺🇦", region: "乌克兰", tags: ["溢价", "高回报"],
    text: "乌克兰溢价37%！Jaguar 960当地官网EUR399K，套利空间持续扩大",
    url: "/zh/arbitrage-top",
  },
  {
    icon: "🇧🇷", region: "巴西", tags: ["市场扩张", "CAGR"],
    text: "巴西农机市场持续扩张，预计从USD84.2亿增长至113.8亿（CAGR 6.22%）",
    url: "/zh/products?sort=rank",
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
    icon: "🇨🇳", region: "中国", tags: ["库存盘点", "数据"],
    text: "神雕农机库存59台，总货值¥1,808万，进口机型44台占75%，国产7台",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🌏", region: "东南亚", tags: ["水稻机械", "插秧机"],
    text: "东南亚水稻机械化率提升，二手插秧机/收割机需求增加，泰国菲律宾为主力市场",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🌍", region: "非洲", tags: ["新兴市场", "性价比"],
    text: "非洲农机市场：中国二手农机性价比高，非洲进口需求上升中，中东线主力是迪尔",
    url: "/zh/products?sort=rank",
  },
  {
    icon: "🇦🇫", region: "阿富汗", tags: ["重建需求", "基础设施"],
    text: "阿富汗重建需求：道路/农业基础设施恢复带来大量工程和农机需求",
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
