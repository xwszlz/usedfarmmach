import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, LocalBusinessStructuredData } from "@/components/seo/structured-data";
import AboutClient from "./AboutClient";
import { BrandFilmBanner } from "@/components/home/brand-film-banner";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("about", locale, "/about");
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "关于我们" : "About", url: `${BASE_URL}/${locale}/about` },
        ]}
      />
      <LocalBusinessStructuredData locale={locale} />
      <AboutClient />
      {/* 品牌影片《跨山海》30 秒版 —— 2026-10-29 由首页迁入，改为「关于我们」常驻。
          组件自带弹窗播放（preload="none"，未点击不拉 7 MB 视频），与首页原用法一致。 */}
      <BrandFilmBanner locale={locale} />
    </>
  );
}
