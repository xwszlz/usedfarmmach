import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { siteConfig } from "@/config/site";
import BargainsClient from "./AuctionsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("auctions", locale, "/auctions");
}

export default async function BargainsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // 服务端读取拍卖许可编号，注入客户端组件用于频道页公示（50号文要求）
  const auctionLicenseNo = siteConfig.compliance.auctionLicenseNo;
  return <BargainsClient auctionLicenseNo={auctionLicenseNo} site={siteConfig.site} />;
}
