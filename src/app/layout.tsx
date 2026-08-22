import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/config/site";
import "./globals.css";
import { translate } from "@/lib/i18n-runtime";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: "#15803d",
};
export const metadata: Metadata = {
    metadataBase: new URL(BASE_URL),
    title: {
        default: "\u4E8C\u624B\u519C\u673A\u4EA4\u6613\u5E73\u53F0_\u8DE8\u5883\u519C\u673A\u51FA\u53E3_\u5168\u7403\u4E8C\u624B\u519C\u673A\u4E70\u5356_\u795E\u96D5\u519C\u673A",
        template: "%s_\u795E\u96D5\u519C\u673A",
    },
    description: "神雕农机—全球二手农机交易平台，提供CLAAS青储机、约翰迪尔拖拉机、凯斯农机等品牌二手农机买卖服务。AI智能估价、跨境套利分析、一站式物流，让农机交易更透明高效。",
    keywords: [
        "\u4E8C\u624B\u519C\u673A",
        "\u519C\u673A\u4EA4\u6613",
        "\u8DE8\u5883\u519C\u673A",
        "\u519C\u673A\u51FA\u53E3",
        "CLAAS\u9752\u50A8\u673A",
        "\u7EA6\u7FF0\u8FEA\u5C14\u62D6\u62C9\u673A",
        "\u514B\u62C9\u65AF\u6536\u5272\u673A",
        "\u4E8C\u624B\u519C\u673A\u4EF7\u683C",
        "\u519C\u673A\u8DE8\u5883\u5957\u5229",
        "used farm machinery",
        "agricultural equipment export",
    ],
    authors: [{ name: "石家庄神雕农机科技有限公司" }],
    creator: "\u795E\u96D5\u519C\u673A",
    publisher: "\u77F3\u5BB6\u5E84\u795E\u96D5\u519C\u673A\u79D1\u6280\u6709\u9650\u516C\u53F8",
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
        siteName: "\u795E\u96D5\u519C\u673A",
        locale: "zh_CN",
        title: "二手农机交易平台_跨境农机出口_全球二手农机买卖_神雕农机",
        description: "神雕农机—全球二手农机交易平台，提供CLAAS青储机、约翰迪尔拖拉机、凯斯农机等品牌二手农机买卖服务。",
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
export default function RootLayout({ children, }: {
    children: React.ReactNode;
}) {
    return children;
}
