/**
 * CnCertificateBadge — 权属核验徽章（.cn 专属）
 *
 * 展示权属核验状态：已核验 / 待核验 / 未核验
 * 用于设备详情页、搜索结果页、卖家信息页
 */

"use client";

import React from "react";

export type CertificateStatus = "verified" | "pending" | "unverified";

interface CnCertificateBadgeProps {
  status: CertificateStatus;
  verifiedAt?: string;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}

const STATUS_CONFIG: Record<
  CertificateStatus,
  { label: string; bgClass: string; textClass: string; icon: string }
> = {
  verified: {
    label: "已核验",
    bgClass: "bg-green-50 border-green-200",
    textClass: "text-green-700",
    icon: "✓",
  },
  pending: {
    label: "核验中",
    bgClass: "bg-yellow-50 border-yellow-200",
    textClass: "text-yellow-700",
    icon: "⏳",
  },
  unverified: {
    label: "未核验",
    bgClass: "bg-gray-50 border-gray-200",
    textClass: "text-gray-500",
    icon: "○",
  },
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

export default function CnCertificateBadge({
  status,
  verifiedAt,
  onClick,
  size = "md",
}: CnCertificateBadgeProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium
        transition-colors cursor-default
        ${cfg.bgClass} ${cfg.textClass} ${SIZE_CLASSES[size]}
        ${onClick ? "cursor-pointer hover:opacity-80" : ""}
      `}
      title={
        status === "verified" && verifiedAt
          ? `核验通过时间：${verifiedAt}`
          : undefined
      }
    >
      <span className="flex-shrink-0">{cfg.icon}</span>
      <span>{cfg.label}</span>
      {status === "verified" && verifiedAt && size !== "sm" && (
        <span className="text-xs opacity-60 ml-1">{verifiedAt}</span>
      )}
    </button>
  );
}

/**
 * 信任卖家标识（扩展徽章，配合核验使用）
 */
export function CnTrustBadge({
  isVerified,
}: {
  isVerified: boolean;
}) {
  if (!isVerified) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span>信任卖家</span>
    </span>
  );
}
