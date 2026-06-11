import { ALL_LOCALES } from "@/lib/seo-metadata";
import type { Locale } from "@/lib/seo-metadata";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

interface HreflangHeadProps {
  locale: string;
  path: string;
  xDefaultLocale?: Locale;
}

/**
 * Renders <link rel="alternate" hreflang="..."> tags for all language versions.
 * Belt-and-suspenders approach: used alongside Next.js metadata alternates.
 *
 * Example: <HreflangHead locale="zh" path="/products" />
 * Generates:
 *   <link rel="alternate" hreflang="zh" href="https://usedfarmmach.com/zh/products" />
 *   <link rel="alternate" hreflang="en" href="https://usedfarmmach.com/en/products" />
 *   ...
 *   <link rel="alternate" hreflang="x-default" href="https://usedfarmmach.com/en/products" />
 */
export function HreflangHead({ locale, path, xDefaultLocale = "en" }: HreflangHeadProps) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return (
    <>
      {ALL_LOCALES.map((lang) => (
        <link
          key={lang}
          rel="alternate"
          hrefLang={lang}
          href={`${BASE_URL}/${lang}${cleanPath}`}
        />
      ))}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${BASE_URL}/${xDefaultLocale}${cleanPath}`}
      />
    </>
  );
}

/**
 * Generates the full hreflang languages Record for Next.js metadata alternates.
 * Also includes x-default pointing to the English version.
 *
 * Example: getHreflangLanguages("/products") returns:
 *   { zh: "...", en: "...", ..., "x-default": "..." }
 */
export function getHreflangLanguages(path: string, xDefaultLocale: Locale = "en"): Record<string, string> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const languages: Record<string, string> = {};

  for (const lang of ALL_LOCALES) {
    languages[lang] = `${BASE_URL}/${lang}${cleanPath}`;
  }
  languages["x-default"] = `${BASE_URL}/${xDefaultLocale}${cleanPath}`;

  return languages;
}
