"use client";

import { useState } from "react";
import { ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";

interface DisclaimerBannerProps {
  locale?: string;
  variant?: "full" | "compact" | "badge";
}

/**
 * Disclaimer banner component for the virtual expo.
 * - "full": Expandable disclaimer section (for footer or dedicated page)
 * - "compact": Single-line notice with tooltip
 * - "badge": Small "AI Generated" badge for product/brand pages
 */
export function DisclaimerBanner({ locale = "zh", variant = "full" }: DisclaimerBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const isZh = locale === "zh";

  if (variant === "badge") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        <ShieldAlert className="h-3 w-3" />
        {isZh ? "AI生成内容" : "AI Generated"}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          {isZh
            ? "本页图片及信息均为AI生成/基于公开资料整理，不代表品牌官方立场。"
            : "Images and information on this page are AI-generated/based on public sources and do not represent official brand positions."}
        </span>
      </div>
    );
  }

  // Full variant - expandable
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          <span className="text-sm font-semibold text-gray-700">
            {isZh ? "免责声明" : "Disclaimer"}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-gray-200 px-5 py-4">
          <p className="text-xs leading-relaxed text-gray-500">
            {isZh
              ? '本网站"世界农机数字展会"为信息展示平台，所展示的品牌名称、产品信息及图片均为基于公开资料的AI生成内容，不代表品牌官方立场，不构成任何商业授权或代理关系。所有产品图片均为AI生成的艺术渲染图，非真实产品照片。品牌Logo为示意性标识，非官方注册商标。如品牌方对本平台展示内容有异议，或希望认领并更新展示信息，请联系：expo@usedfarmmach.com。本平台将在收到通知后48小时内处理相关请求。'
              : 'This website "World Agricultural Machinery Digital Expo" is an information display platform. Brand names, product information, and images displayed are AI-generated content based on public sources and do not represent official brand positions, nor constitute any commercial authorization or agency relationship. All product images are AI-generated artistic renderings, not real product photos. Brand logos are indicative marks, not official registered trademarks. If a brand has objections to the displayed content or wishes to claim and update its information, please contact: expo@usedfarmmach.com. We will process relevant requests within 48 hours of receipt.'}
          </p>
          <a
            href={`/${locale}/expo/brand-claim`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            {isZh ? "品牌方认领入口 →" : "Brand Claim Portal →"}
          </a>
        </div>
      )}
    </div>
  );
}
