import { Metadata } from "next";
import MyOffersClient from "./MyOffersClient";

export const metadata: Metadata = {
  title: "我的询价 | 神雕农机",
  description: "查看我参与的询价记录",
};

export default function MyOffersPage() {
  return <MyOffersClient />;
}
