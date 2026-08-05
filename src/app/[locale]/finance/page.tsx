import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import FinanceClient from "./FinanceClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("finance", locale, "/finance");
}

export default async function FinancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <FinanceClient />;
}
