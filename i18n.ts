import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

const locales = ["zh", "en", "ru", "es", "pt"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) notFound();

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
