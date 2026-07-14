import BargainDetailClient from "./AuctionDetailClient";

export default async function BargainDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  return <BargainDetailClient />;
}
