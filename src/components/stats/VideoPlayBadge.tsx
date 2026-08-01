"use client";

import { Play } from "lucide-react";

interface VideoPlayBadgeProps {
  /** 当前播放量（由父级 onPlay 更新后传入） */
  playCount: number;
  locale?: string;
  /** 自定义展示文案前缀标签（如"地头展现场"） */
  badgeLabel?: string;
}

/**
 * 视频播放量标注（公开）。
 * 纯展示组件：播放量由父级在 onPlay 回调中通过 track 拿到最新值后传入。
 * 文案：▶ 播放 N 次
 */
export function VideoPlayBadge({ playCount, locale = "zh", badgeLabel }: VideoPlayBadgeProps) {
  const label = badgeLabel
    ? `${badgeLabel} · ${locale === "zh" ? "播放" : "Played"} ${playCount.toLocaleString()} 次`
    : locale === "zh"
      ? `▶ 播放 ${playCount.toLocaleString()} 次`
      : `▶ Played ${playCount.toLocaleString()} times`;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-medium text-white">
      <Play className="h-3 w-3" />
      {label}
    </span>
  );
}
