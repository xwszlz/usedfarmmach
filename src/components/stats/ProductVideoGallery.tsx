"use client";

import { useState } from "react";
import { trackView } from "@/lib/stats";
import { VideoPlayBadge } from "./VideoPlayBadge";

export interface ProductVideoItem {
  id: string;
  url: string;
  title: string | null;
  playCount: number;
}

interface ProductVideoGalleryProps {
  videos: ProductVideoItem[];
  /** 视频封面（已转换为可访问 URL） */
  posterUrl?: string;
  locale: string;
}

/**
 * 产品详情页视频区（客户端）。
 * 在 <video onPlay> 时调用 track('video', id) 自增播放量，并实时更新 VideoPlayBadge。
 * 提取为客户端组件以便挂 onPlay 事件（产品详情页本身是 Server Component）。
 */
export function ProductVideoGallery({ videos, posterUrl, locale }: ProductVideoGalleryProps) {
  const [playCounts, setPlayCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(videos.map((v) => [v.id, v.playCount]))
  );

  const handlePlay = async (id: string) => {
    const latest = await trackView("video", id);
    setPlayCounts((prev) => ({
      ...prev,
      [id]: latest !== null ? latest : (prev[id] ?? 0) + 1,
    }));
  };

  return (
    <div className="space-y-3">
      {videos.map((video, idx) => (
        <div key={video.id} className="overflow-hidden rounded-lg bg-black">
          <video
            src={video.url}
            controls
            playsInline
            crossOrigin="anonymous"
            className="h-auto w-full"
            preload="metadata"
            poster={posterUrl}
            onPlay={() => handlePlay(video.id)}
          >
            {locale === "zh"
              ? "您的浏览器不支持视频播放"
              : locale === "ru"
                ? "Ваш браузер не поддерживает воспроизведение видео"
                : "Your browser does not support video playback"}
          </video>
          <div className="flex items-center justify-between bg-gray-900 px-3 py-1.5 text-xs text-gray-300">
            <span>
              {locale === "zh" ? "视频" : "Video"} {idx + 1}/{videos.length}
              {video.title && ` — ${video.title}`}
            </span>
            <VideoPlayBadge playCount={playCounts[video.id] ?? 0} locale={locale} />
          </div>
        </div>
      ))}
    </div>
  );
}
