"use client";

import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import ViewsAnalyticsClient from "@/app/[locale]/admin/analytics/views/ViewsAnalyticsClient";

/**
 * 卖家浏览量自视图入口。
 * 复用 admin 看板客户端（variant="seller"），API 依据登录 token 自动只返回自有数据（scope='mine'）。
 */
export default function SellerViewsAnalyticsPage() {
  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <Link
          href="/zh/seller/booth"
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          返回展位管理
        </Link>
        <h1 className="sr-only flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Store className="h-6 w-6 text-green-600" />
          我的浏览量数据
        </h1>
      </div>
      <ViewsAnalyticsClient role="seller" variant="seller" />
    </div>
  );
}
