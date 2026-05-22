export const siteConfig = {
  name: "AgriTrade",
  nameZh: "神雕农机",
  description: "Global used farm machinery trading platform",
  descriptionZh: "全球二手农机交易平台",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ogImage: "/images/og.png",
  defaultLocale: "zh" as const,
  locales: ["zh", "en"] as const,
};

export const exchangeRate = {
  usdToCny: 7.25,
  cnyToUsd: 0.138,
};
