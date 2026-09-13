import { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || `https://${siteConfig.domains.primary}`;

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
    host: BASE_URL,
  };
}
