import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import AboutClient from "./AboutClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("about", locale, "/about");
}

export default function AboutPage() {
  return <AboutClient />;
}
