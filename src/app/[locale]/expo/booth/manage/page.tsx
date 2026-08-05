import type { Metadata } from "next";
import BoothManageClient from "./BoothManageClient";
import { generatePageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("expo", locale, "/expo/booth/manage");
}

export default async function BoothManagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <BoothManageClient locale={locale} />;
}
