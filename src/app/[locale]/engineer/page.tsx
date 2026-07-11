import type { Metadata } from "next";
import { EngineerCertClient } from "./EngineerCertClient";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("engineer", locale, "", {
    openGraph: {
      images: [{ url: `${BASE_URL}/images/og-engineer.png`, width: 1200, height: 630 }],
    },
  });
}

export default async function EngineerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          {
            name: locale === "zh" ? "AI农机工程师认证" : "AI Engineer Certification",
            url: `${BASE_URL}/${locale}/engineer`,
          },
        ]}
      />
      <EngineerCertClient locale={locale} />
    </div>
  );
}
