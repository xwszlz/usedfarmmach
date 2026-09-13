/**
 * escrow 路由布局 — 担保交易为 .cn 国内站专属
 *
 * 嵌套在 [locale] 布局之内，同时覆盖 /escrow（订单列表）与 /escrow/[id]（订单详情）。
 *
 * 合规门禁：担保交易（escrow）为 .cn 国内站专属能力，
 * .com 海外站一律 404，避免涉资金类页面在境外站暴露
 * （海外站将另行提供 Stripe 版本担保交易）。
 */

import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isCnSite } from "@/config/site";

export default function EscrowLayout({ children }: { children: ReactNode }) {
  // 合规门禁：担保交易（escrow）为 .cn 国内站专属能力，
  // .com 海外站一律 404（海外站将另行提供 Stripe 版本担保交易）。
  if (!isCnSite()) {
    notFound();
  }

  return <>{children}</>;
}
