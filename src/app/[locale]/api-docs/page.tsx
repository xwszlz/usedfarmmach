import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import ApiDocsClient from "./ApiDocsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("api-docs", locale, "/api-docs");
}

export default async function ApiDocsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <ApiDocsClient />;
}
