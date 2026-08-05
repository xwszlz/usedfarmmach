import { setRequestLocale } from "next-intl/server";
import { SellerProfileClient } from "./seller-profile-client";

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <SellerProfileClient sellerId={id} locale={locale} />;
}
