import { setRequestLocale } from "next-intl/server";
import { FavoritesClient } from "./favorites-client";

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FavoritesClient locale={locale} />;
}
