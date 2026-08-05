import { Suspense } from "react";
import BrandClaimClient from "./BrandClaimClient";

export default async function BrandClaimPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BrandClaimClient locale={locale} />
    </Suspense>
  );
}
