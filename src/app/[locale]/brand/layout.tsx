import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Used Farm Machinery Brands | AgriTrade",
  description:
    "Browse top farm machinery brands — CLAAS, John Deere, Krone, New Holland and more. Compare prices and find the best deals on used equipment.",
};

export default function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
