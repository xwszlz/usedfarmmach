/**
 * (cn) route-group 布局 — .cn 国内站专属
 *
 * 嵌套在 [locale] 布局之内，为所有 .cn 路由包裹全局备案页脚 CnFooter。
 * 仅 .cn 站使用（该布局仅由 SITE=cn 构建 / 路由命中）。
 *
 * 注意：本布局不读取任何 secrets，仅做结构包裹 + 渲染页脚。
 */

import type { ReactNode } from "react";
import { CnFooter } from "@/components/cn/CnFooter";

export default function CnLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <CnFooter />
    </>
  );
}
