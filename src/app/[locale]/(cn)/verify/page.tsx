import { Metadata } from "next";
export const metadata: Metadata = {
    title: "权属核验 - 神雕农机",
    description: "上传农机权属证明材料，完成权属核验，获得信任标识",
};

import CnVerifyPage from "./verify-client";

export default function Page() {
  return <CnVerifyPage />;
}
