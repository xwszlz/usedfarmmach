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
import { notFound } from "next/navigation";
import { isCnSite } from "@/config/site";

export default function CnLayout({ children }: { children: ReactNode }) {
  // 合规门禁：本路由组（询价 / 发布 / 情报 / 核验 / 政府监管看板）为 .cn 国内站专属，
  // .com 站（未备案）一律 404，避免国内专属能力在境外站暴露。
  if (!isCnSite()) {
    notFound();
  }

  return <>{children}</>;
}
