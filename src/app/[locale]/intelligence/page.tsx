import { setRequestLocale } from "next-intl/server";
import IntelligencePageClient from "./page-client";

export default async function IntelligencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <IntelligencePageClient locale={locale} />;
}
