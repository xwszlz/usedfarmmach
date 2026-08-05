import type { Metadata } from "next";
import { FieldExpoPreview } from "./FieldExpoPreview";
import { generatePageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("expo", locale, "/expo/28th-field-expo-2026");
}

export default async function FieldExpoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <FieldExpoPreview locale={locale} />;
}
