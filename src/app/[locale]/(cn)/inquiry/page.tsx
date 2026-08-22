import { Metadata } from "next";
export const metadata: Metadata = {
    title: "询价中心 - 神雕农机",
    description: "发起农机询价，获取卖家报价。担保交易仅通过微信小程序收付通闭环完成。",
};

import CnInquiryPage from "./inquiry-client";

export default function Page() {
  return <CnInquiryPage />;
}
