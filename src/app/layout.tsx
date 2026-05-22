import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "神雕农机 - 全球二手农机交易平台",
  description: "神雕农机 - 全球二手农机交易平台，专注CLAAS、John Deere、New Holland等品牌二手农机出口",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
