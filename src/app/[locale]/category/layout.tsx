import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Used Farm Machinery Categories | AgriTrade",
  description:
    "Browse forage harvesters, balers, mowers, wrappers and more used farm machinery categories. Best prices from verified global sellers.",
};

export default function CategoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
