import { Metadata } from "next";
import RulesClient from "./RulesClient";
import { translate } from "@/lib/i18n-runtime";
export const metadata: Metadata = {
    title: "询价规则与合规公示 | 神雕农机",
    description: "在线询价规则、合规声明、交易保障、风险提示与常见问题",
};
export default function RulesPage() {
    return <RulesClient />;
}
