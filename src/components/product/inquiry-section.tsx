"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import BargainSection from "@/components/bargain/bargain-section";

interface InquirySectionProps {
  productId: string;
  sellerId: string;
  locale: string;
  productName: string;
  askingPrice?: number | null;
}

/**
 * 阶段0（统一模型/单一入口）包装组件：
 * - 挂载时调用 /api/auctions/ensure 自动开通（或复用）该产品的询价会话
 * - 渲染统一的 BargainSection（Auction/Bid 谈判模型）
 * 所有产品通用，消除「立即询价按钮 + 在线询价栏目」双入口并行的问题。
 */
export default function InquirySection({ productId, sellerId, locale, productName }: InquirySectionProps) {
  const localeHook = useLocale();
  const isZh = (localeHook || locale) === "zh";
  const [auctionId, setAuctionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    let active = true;
    async function ensure() {
      try {
        const res = await fetch("/api/auctions/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ productId }),
        });
        const json = await res.json();
        if (json.success && json.data?.id) {
          if (active) setAuctionId(json.data.id);
        } else if (res.status === 401) {
          if (active) setNeedLogin(true);
        }
      } catch {
        /* noop */
      } finally {
        if (active) setLoading(false);
      }
    }
    ensure();
    return () => {
      active = false;
    };
  }, [productId]);

  if (loading) {
    return (
      <div className="mt-6 flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (needLogin) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-6 text-center">
        <p className="text-sm text-gray-500">
          {isZh ? "登录后即可发起在线询价与报价" : "Sign in to start an online inquiry"}
        </p>
        <Link
          href={`/${locale}/auth/login`}
          className="mt-3 inline-block rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {isZh ? "登录" : "Sign in"}
        </Link>
      </div>
    );
  }

  if (!auctionId) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg font-bold text-gray-900">
          {isZh ? "在线询价" : "Price Inquiry"}
        </span>
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {isZh ? "询价中" : "Active"}
        </span>
      </div>
      <BargainSection auctionId={auctionId} locale={locale} sellerId={sellerId} />
    </div>
  );
}
