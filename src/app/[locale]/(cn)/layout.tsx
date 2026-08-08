/**
 * (cn) route-group 布局 — .cn 国内站专属
 *
 * 嵌套在 [locale] 布局之内，为所有 .cn 路由做结构包裹。
 *
 * 注意：.cn 站的 ICP 备案号（CnFooter）现由主布局 Footer
 * （src/components/layout/footer.tsx）统一渲染，此处不再重复渲染，
 * 以免出现两个备案页脚。本布局仅做 <>{children}</> 结构包裹。
 */

import type { ReactNode } from "react";

export default function CnLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
