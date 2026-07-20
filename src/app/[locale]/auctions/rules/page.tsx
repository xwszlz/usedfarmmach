import { Metadata } from "next";
import RulesClient from "./RulesClient";

export const metadata: Metadata = {
  title: "议价规则与合规公示 | 神雕农机",
  description: "在线议价规则、合规声明、交易保障、风险提示与常见问题",
};

export default function RulesPage() {
  return <RulesClient />;
}
