import { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { SITE_ORIGIN } from "@/lib/site-url";

const BASE_URL = SITE_ORIGIN;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/auth/", "/_next/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    // robots 的 host 指令要求「纯主机名」（不带协议）
    host: siteConfig.domains.canonical,
  };
}
