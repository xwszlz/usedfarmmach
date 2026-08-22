import { Metadata } from "next";
export const metadata: Metadata = {
    title: "发布车源 - 神雕农机",
    description: "在神雕农机发布二手农机车源，填写车况信息，快速触达国内买家",
};

import CnPublishPage from "./publish-client";

export default function Page() {
  return <CnPublishPage />;
}
