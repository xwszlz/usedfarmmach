import { siteConfig } from "@/config/site";
import { SITE_ORIGIN } from "@/lib/site-url";

const BASE_URL = SITE_ORIGIN;

/** x-default 指向站点默认语言（.com=en / .cn=zh），真相源 = siteConfig */
const DEFAULT_LOCALE = siteConfig.defaultLocale;

interface HreflangHeadProps {
  locale: string;
  path: string;
  xDefaultLocale?: string;
}

/**
 * Renders <link rel="alternate" hreflang="..."> tags for all language versions.
 * Belt-and-suspenders approach: used alongside Next.js metadata alternates.
 *
 * Example: <HreflangHead locale="zh" path="/products" />
 * Generates:
 *   <link rel="alternate" hreflang="zh" href="${BASE_URL}/zh/products" />
 *   <link rel="alternate" hreflang="en" href="${BASE_URL}/en/products" />
 *   ...
 *   <link rel="alternate" hreflang="x-default" href="${BASE_URL}/en/products" />
 */
export function HreflangHead({ locale, path, xDefaultLocale = DEFAULT_LOCALE }: HreflangHeadProps) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return (
    <>
      {siteConfig.locales.map((lang) => (
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
export function getHreflangLanguages(path: string, xDefaultLocale: string = DEFAULT_LOCALE): Record<string, string> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const languages: Record<string, string> = {};

  for (const lang of siteConfig.locales) {
    languages[lang] = `${BASE_URL}/${lang}${cleanPath}`;
  }
  languages["x-default"] = `${BASE_URL}/${xDefaultLocale}${cleanPath}`;

  return languages;
}
