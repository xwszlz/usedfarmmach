import { setRequestLocale } from "next-intl/server";
import { PromoClient } from "./promo-client";

export default async function PromoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PromoClient locale={locale} />;
}
