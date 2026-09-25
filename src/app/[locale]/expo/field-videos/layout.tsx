import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";

/**
 * 神雕展翼（Shendiao WingShow™）—— 地头展改「常年常设」后的真实作业视频入口。
 *
 * page.tsx 是 "use client"（上传 + 图墙交互），无法导出 generateMetadata，
 * 故在 layout 层补 TDK / canonical / hreflang（此前线上 <title> 直接回落成
 * 首页标题 —— SEO 上等于没有页面身份）。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("expoWingShow", locale, "/expo/field-videos");
}

export default function FieldVideosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
