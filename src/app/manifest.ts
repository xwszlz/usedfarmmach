import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "神雕农机 | AgriTrade - Global Used Farm Machinery Platform",
    short_name: "AgriTrade",
    description:
      "Global used farm machinery trading platform. AI valuation, cross-border arbitrage, one-stop logistics.",
    start_url: "/zh",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#15803d",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/icon",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["business", "shopping", "agriculture"],
    lang: "zh-CN",
    dir: "ltr",
  };
}
