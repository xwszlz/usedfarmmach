import type { Metadata } from "next";
import { headers } from "next/headers";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { siteConfig } from "@/config/site";
import { verifyToken } from "@/lib/auth";
import BargainsClient from "./AuctionsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("auctions", locale, "/auctions");
}

/** 从请求头读取 Bearer / cookie 中的 token（与 admin/layout 同款） */
function getTokenFromHeaders(headersList: Headers) {
  const auth = headersList.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = headersList.get("cookie");
  const m = cookie?.match(/token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default async function BargainsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // 服务端读取拍卖许可编号，注入客户端组件用于频道页公示（50号文要求）
  const auctionLicenseNo = siteConfig.compliance.auctionLicenseNo;

  // 计算当前用户是否为管理员（用于渲染内部测试横幅，普通访客不可见）
  let isAdmin = false;
  try {
    const token = getTokenFromHeaders(headers());
    const payload = token ? verifyToken(token) : null;
    if (payload && (payload.role === "admin" || payload.role === "super_admin")) {
      isAdmin = true;
    }
  } catch {
    isAdmin = false;
  }

  return (
    <BargainsClient
      auctionLicenseNo={auctionLicenseNo}
      site={siteConfig.site}
      isAdmin={isAdmin}
    />
  );
}
