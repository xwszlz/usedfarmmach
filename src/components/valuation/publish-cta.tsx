"use client";

import { useState } from "react";
import { translate } from "@/lib/i18n-runtime";
import { TrendingUp } from "lucide-react";

interface PublishCtaProps {
  brand?: string;
  model?: string;
  year?: number;
  horsepower?: number;
  category?: string;
  locale?: string;
}

/**
 * Post-valuation conversion CTA: hand the equipment straight to the listing
 * form with the valuation inputs pre-filled.
 *
 * Extracted from the removed paid deep-report component so the free-flowing
 * "estimate then sell" path survives without any payment UI.
 */
export function PublishCta({
  brand,
  model,
  year,
  horsepower,
  category,
  locale = "zh",
}: PublishCtaProps) {
  const [showPublishForm, setShowPublishForm] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={() => setShowPublishForm(!showPublishForm)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
      >
        <TrendingUp className="h-4 w-4" />
        {translate("估价后一键发布出售", locale)}
      </button>
      {showPublishForm && (
        <div className="mt-3 rounded-lg bg-green-50 p-3">
          <p className="mb-2 text-xs text-green-700">
            {translate("将您的农机设备信息发布到交易平台，让全球买家看到", locale)}
          </p>
          <button
            onClick={() => {
              window.location.href = `/${locale}/seller/products/new?prefill=true&brand=${encodeURIComponent(brand || "")}&model=${encodeURIComponent(model || "")}&category=${encodeURIComponent(category || "")}&year=${year || ""}&hp=${horsepower || ""}`;
            }}
            className="w-full rounded-lg bg-green-600 py-2 text-xs font-medium text-white hover:bg-green-700"
          >
            {translate("前往发布 →", locale)}
          </button>
        </div>
      )}
    </div>
  );
}
