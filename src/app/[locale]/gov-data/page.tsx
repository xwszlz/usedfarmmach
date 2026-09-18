import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import GovDataClient from "./GovDataClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const meta = generatePageMetadata("gov-data", locale, "/gov-data");
  // 这是功能页（补贴数据查询），不是给搜索引擎索引的落地页。
  // generatePageMetadata 默认 index:true，此处显式覆盖为 noindex。
  return { ...meta, robots: { index: false, follow: false } };
}

export default async function GovDataPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // 路由语言在 URL 路径里（/en/gov-data），必须由服务端传入；
  // 客户端组件此前用 useSearchParams().get("locale") 读，永远读不到 -> 回退 "zh"。
  return <GovDataClient locale={locale} />;
}
