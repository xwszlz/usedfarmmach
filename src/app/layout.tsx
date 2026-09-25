import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/config/site";
import { SITE_ORIGIN } from "@/lib/site-url";
import "./globals.css";

const BASE_URL = SITE_ORIGIN;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#15803d",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  // ⚠️ 2026-09-18 修复 title 品牌重复：
  //   原为 template: "%s_神雕农机"，但全站子页面 TDK 结尾**多数已自带**「_神雕农机」，
  //   被 template 再追加一次 → 线上出现「..._神雕农机_神雕农机」；
  //   英文/俄文等 locale 页 TDK 结尾是「| AgriTrade」，更会被强接中文品牌 →「AgriTrade_神雕农机」。
  //   现改为纯透传 "%s"：品牌统一由各页面自身 TDK 负责（zh 侧 21 处均已自带）。
  //   注：template 不可省略 —— Next 的 DefaultTemplateString 要求 default 与 template 同时存在。
  title: {
    default: "二手农机交易平台_跨境农机出口_全球二手农机买卖_神雕农机",
    template: "%s",
  },
  description:
    "神雕农机—全球二手农机交易平台，提供CLAAS青储机、约翰迪尔拖拉机、凯斯农机等品牌二手农机买卖服务。AI智能估价、跨境套利分析、一站式物流，让农机交易更透明高效。",
  keywords: [
    "二手农机", "农机交易", "跨境农机", "农机出口", "CLAAS青储机",
    "约翰迪尔拖拉机", "克拉斯收割机", "二手农机价格", "农机跨境套利",
    "used farm machinery", "agricultural equipment export",
  ],
  authors: [{ name: "石家庄神雕农机科技有限公司" }],
  creator: "神雕农机",
  publisher: "石家庄神雕农机科技有限公司",
  alternates: {
    canonical: `${BASE_URL}/${siteConfig.defaultLocale}`,
    // ⚠️ 由 siteConfig.locales 生成，不要硬编码 8 语：
    //    .cn 站只有 zh/en，硬编码会让 .cn 声明 6 个实测 404 的语言版本。
    languages: {
      ...Object.fromEntries(
        siteConfig.locales.map((l) => [l, `${BASE_URL}/${l}`])
      ),
      "x-default": `${BASE_URL}/${siteConfig.defaultLocale}`,
    },
  },
  openGraph: {
    type: "website",
    siteName: "神雕农机",
    locale: "zh_CN",
    title: "二手农机交易平台_跨境农机出口_全球二手农机买卖_神雕农机",
    description:
      "神雕农机—全球二手农机交易平台，提供CLAAS青储机、约翰迪尔拖拉机、凯斯农机等品牌二手农机买卖服务。",
    url: `${BASE_URL}/zh`,
    images: [
      {
        url: `${BASE_URL}/images/og.png`,
        width: 1200,
        height: 630,
        alt: "神雕农机 - 全球二手农机交易平台",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "神雕农机 - 全球二手农机交易平台",
    description: "连接中国与全球农机市场，AI估价+跨境套利+一站式物流",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "神雕农机",
    statusBarStyle: "default",
  },
  verification: {
    other: {
      "baidu-site-verification": "codeva-zsOnKgvGxK",
      "msvalidate.01": "54632BE95342693D306EFC1F62CEE943",
      "360-site-verification": "014106963e5d6f3486dd8f8247b59834",
    },
  },
  robots: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
    "max-video-preview": -1,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
