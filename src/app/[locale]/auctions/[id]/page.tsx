import AuctionDetailClient from "./AuctionDetailClient";

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  return <AuctionDetailClient />;
}
