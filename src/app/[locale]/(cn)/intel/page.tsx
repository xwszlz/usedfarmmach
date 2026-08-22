import { Metadata } from "next";
export const metadata: Metadata = {
    title: "价格指数与市场情报 - 神雕农机",
    description: "国产二手农机价格指数、市场行情分析、行业趋势报告",
};

import CnIntelPage from "./intel-client";

export default function Page() {
  return <CnIntelPage />;
}
