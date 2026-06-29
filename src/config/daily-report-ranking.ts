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
  // 🔥 头条一：CLAAS 5300RC（2020款）330.0%价差率全品类第一
  { id: "cmpdknk4s008111kw3zr8aimf", rank: 0, model: "🔥 CLAAS 5300RC（2020款）", price: 180000, foreignPriceDesc: "EU€99.9K(77.4万)", profit: "59.4万", margin: "330.0%" },
  // 🔥 头条二：纽荷兰 FR450（10台库存）104.7%走量王
  { id: "cmpfohy0n000xkrh5d14tvnqy", rank: 1, model: "🔥 纽荷兰 FR450（2013款·10台库存）", price: 215000, foreignPriceDesc: "俄市场44.0万", profit: "22.5万", margin: "104.7%" },
  // 第一梯队：超高套利（毛利>50万）
  { id: "cmpfohxxe0003krh59h6galr2", rank: 2, model: "Krone BiG Pack 1290（2020款）", price: 680000, foreignPriceDesc: "EU€170.8K(132.2万)", profit: "64.2万", margin: "94.4%" },
  { id: "cmpdknitp001v11kwskpdqx6s", rank: 3, model: "克拉斯 Jaguar 980（2016款）", price: 1430000, foreignPriceDesc: "EU€320.4K(248.1万)", profit: "105.1万", margin: "73.5%" },
  { id: "cmpdknjh6004x11kwkz5gvrbo", rank: 4, model: "纽荷兰 9080", price: 690000, foreignPriceDesc: "俄市场估120.0万", profit: "51.0万", margin: "73.9%" },
  { id: "cmpdknix7002h11kwupfm486g", rank: 5, model: "克拉斯 Jaguar 980（2015款）", price: 1300000, foreignPriceDesc: "EUR190K~220K", profit: "95万+", margin: "73.1%" },
  // 第二梯队：高套利（毛利 50~80万）
  { id: "cmpfohxzt000pkrh533z2mf2z", rank: 6, model: "克拉斯 Jaguar 850（2020款/准新机）", price: 1190000, foreignPriceDesc: "EU€186K(144.3万)", profit: "25.3万", margin: "21.3%" },
  { id: "cmpfohy1v0017krh50mw2yvr6", rank: 7, model: "麦赛弗格森 MF 3404（2022款）", price: 1050000, foreignPriceDesc: "EU€181K(140.5万)", profit: "35.5万", margin: "33.8%" },
  // 第三梯队：稳健套利（毛利 40~50万）
  { id: "cmpfohy08000tkrh5vaaw12nd", rank: 8, model: "克拉斯 Jaguar 970（2017款）", price: 1630000, foreignPriceDesc: "EU€322K(249.5万)", profit: "86.5万", margin: "53.3%" },
  { id: "cmpfohxzd000lkrh5fiowud3v", rank: 9, model: "约翰迪尔 JD 8400", price: 680000, foreignPriceDesc: "EUR11万+", profit: "28万+", margin: "41.4%" },
  { id: "cmpdknkog00b311kwql4ortgt", rank: 10, model: "Orkel DENS-X 裹包机（2019款/挪威）", price: 1050000, foreignPriceDesc: "EUR130K+(102万+)", profit: "3万+", margin: "2.9%" },
  { id: "cmpfohxxe0003krh59h6galr2", rank: 11, model: "克罗尼 BigM 420（2018款）", price: 490000, foreignPriceDesc: "EU€101K(78.3万)", profit: "29.3万", margin: "59.8%" },
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
