/**
 * 跨境套利日报 TOP 产品排名
 * 数据来源：神雕日报/2026-05-26_跨境套利日报.md
 * 当日报更新时，修改此文件即可同步网站排名
 */

export interface DailyReportRankItem {
  id: string;
  rank: number;
  model: string;
  price: number;
  foreignPriceDesc: string;
  profit: string;
  margin: string;
}

export const DAILY_REPORT_RANKING: DailyReportRankItem[] = [
  // 第一梯队：超高套利（毛利 >100万）
  { id: "cmpfohy08000tkrh5vaaw12nd", rank: 1, model: "克拉斯 Jaguar 970（欧版/有户口）", price: 1630000, foreignPriceDesc: "EUR428K(337万)", profit: "174万+", margin: "79.8%" },
  { id: "cmpdknitp001v11kwskpdqx6s", rank: 2, model: "克拉斯 Jaguar 980（美版/有户口）", price: 1430000, foreignPriceDesc: "EUR378K(298万)", profit: "155万+", margin: "69.9%" },
  { id: "cmpdknix7002h11kwupfm486g", rank: 3, model: "克拉斯 Jaguar 980（2015款）", price: 1300000, foreignPriceDesc: "EUR190K~220K", profit: "95万+", margin: "73.1%" },
  // 第二梯队：高套利（毛利 50~100万）
  { id: "cmpdknk4s008111kw3zr8aimf", rank: 4, model: "克拉斯 5300RC（2022款/全新）", price: 950000, foreignPriceDesc: "EUR25万+", profit: "85万+", margin: "89.5%" },
  { id: "cmpfohxzt000pkrh533z2mf2z", rank: 5, model: "克拉斯 Jaguar 850（2020款/准新机）", price: 1190000, foreignPriceDesc: "EUR25万+", profit: "82万+", margin: "68.9%" },
  { id: "cmpfohy1v0017krh50mw2yvr6", rank: 6, model: "麦赛弗格森 MF 3404（2022款）", price: 1050000, foreignPriceDesc: "EUR13万+", profit: "50万+", margin: "47.6%" },
  // 第三梯队：稳健套利（毛利 20~50万）
  { id: "cmpfohy0n000xkrh5d14tvnqy", rank: 7, model: "纽荷兰 FR450（一口价爆款）", price: 215000, foreignPriceDesc: "EUR4万+", profit: "10万+", margin: "45%+" },
  { id: "cmpfohxzd000lkrh5fiowud3v", rank: 8, model: "约翰迪尔 JD 8400", price: 680000, foreignPriceDesc: "EUR11万+", profit: "28万+", margin: "41.4%" },
  { id: "cmpdknjh6004x11kwkz5gvrbo", rank: 9, model: "纽荷兰 9080", price: 690000, foreignPriceDesc: "EUR11万+", profit: "29万+", margin: "42.3%" },
  { id: "cmpfohxxe0003krh59h6galr2", rank: 10, model: "克罗尼 BigM 420", price: 490000, foreignPriceDesc: "EUR8万+", profit: "31万+", margin: "64.2%" },
];

/** 获取产品在日报排名中的位次（未上榜返回999） */
export function getProductRank(productId: string): number {
  const item = DAILY_REPORT_RANKING.find((p) => p.id === productId);
  return item?.rank ?? 999;
}

/** 按日报排名排序产品数组 */
export function sortByDailyRank<T extends { id: string }>(products: T[]): T[] {
  const rankMap = new Map(DAILY_REPORT_RANKING.map((item) => [item.id, item.rank]));
  return [...products].sort((a, b) => {
    const rankA = rankMap.get(a.id) ?? 999;
    const rankB = rankMap.get(b.id) ?? 999;
    return rankA - rankB;
  });
}
