import { Metadata } from "next";
export const metadata: Metadata = {
    title: "监管数据看板 - 神雕农机",
    description: "农机流通监管数据看板 - 仅供授权监管机构查看",
};

import CnGovDashboardPage from "./gov-client";

export default function Page() {
  return <CnGovDashboardPage />;
}
