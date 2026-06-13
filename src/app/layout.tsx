import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/config/site";
import "./globals.css";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "二手农机交易平台_跨境农机出口_全球二手农机买卖_神雕农机",
    template: "%s_神雕农机",
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
    canonical: `${BASE_URL}/zh`,
    languages: {
      zh: `${BASE_URL}/zh`,
      en: `${BASE_URL}/en`,
      ru: `${BASE_URL}/ru`,
      es: `${BASE_URL}/es`,
      pt: `${BASE_URL}/pt`,
      ar: `${BASE_URL}/ar`,
      fr: `${BASE_URL}/fr`,
      hi: `${BASE_URL}/hi`,
      "x-default": `${BASE_URL}/en`,
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
