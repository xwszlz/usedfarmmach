import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import MembershipPricing from "./membership-pricing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("membership", locale, "/membership");
}

export default async function MembershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <MembershipPricing locale={locale} />;
}
