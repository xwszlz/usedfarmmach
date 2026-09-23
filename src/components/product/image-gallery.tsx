"use client";

import { useState } from "react";
import { getDetailImageUrl } from "@/lib/image-url";
import type { ProductImage } from "@/types";

interface ImageGalleryProps {
  images: ProductImage[];
  alt: string;
  locale: string;
}

const LABELS: Record<string, { realShooting: string; showAll: string; showLess: string }> = {
  // P1-6：实拍承诺改为「可核验表述」（原「所有图片均为实拍」对全部机型无差别承诺，与个别机型实情不符）
  zh: { realShooting: "图片为实机拍摄，具体以实机为准。", showAll: "查看全部 {n} 张图片", showLess: "收起" },
  en: { realShooting: "Photos are of the actual machine; the physical machine prevails.", showAll: "View all {n} photos", showLess: "Show less" },
  ru: { realShooting: "Фотографии сделаны с реальной машины; приоритет имеет фактическая машина.", showAll: "Показать все {n} фото", showLess: "Свернуть" },
  es: { realShooting: "Las fotos son de la máquina real; prevalece la máquina física.", showAll: "Ver las {n} fotos", showLess: "Mostrar menos" },
  pt: { realShooting: "As fotos são da máquina real; prevalece a máquina física.", showAll: "Ver as {n} fotos", showLess: "Mostrar menos" },
  ar: { realShooting: "الصور للآلة الفعلية، والأولوية للآلة عند الفحص.", showAll: "عرض جميع الصور ({n})", showLess: "إخفاء" },
  fr: { realShooting: "Les photos sont celles de la machine réelle ; la machine physique prévaut.", showAll: "Voir les {n} photos", showLess: "Réduire" },
  hi: { realShooting: "तस्वीरें वास्तविक मशीन की हैं; अंतिम आधार वास्तविक मशीन है।", showAll: "सभी {n} तस्वीरें देखें", showLess: "कम दिखाएँ" },
};

/** 首屏渲染张数：超过此数量时才出现「查看全部」按钮（P0-3） */
const PREVIEW_COUNT = 8;

export function ImageGallery({ images, alt, locale }: ImageGalleryProps) {
  const l = LABELS[locale] || LABELS.en;
  // P0-3：默认仍只渲染前 8 张（保住首屏速度），其余可一键展开查看全部
  const [expanded, setExpanded] = useState(false);
  const hasMore = images.length > PREVIEW_COUNT;
  const displayImages = expanded ? images : images.slice(0, PREVIEW_COUNT);

  if (displayImages.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg bg-gray-100">
        <span className="text-gray-400">
          {locale === "zh" ? "暂无图片" : "No images available"}
        </span>
      </div>
    );
  }

  if (displayImages.length === 1) {
    const img = displayImages[0];
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg bg-gray-100">
          <img
            src={getDetailImageUrl(img.url)}
            alt={alt}
            className="h-96 w-full object-cover"
          />
        </div>
        {img.angleLabel && (
          <p className="text-center text-sm font-medium text-gray-600">
            {img.angleLabel}
          </p>
        )}
        <p className="text-center text-xs text-gray-400">{l.realShooting}</p>
      </div>
    );
  }

  // 2-8 images: grid layout
  const gridCols = displayImages.length <= 4
    ? "grid-cols-2"
    : displayImages.length <= 6
      ? "grid-cols-3"
      : "grid-cols-4";

  return (
    <div className="space-y-3">
      <div className={`grid ${gridCols} gap-3`}>
        {displayImages.map((image, index) => (
          <div key={image.id} className="overflow-hidden rounded-lg bg-gray-100">
            <img
              src={getDetailImageUrl(image.url)}
              alt={`${alt} - ${image.angleLabel || `${index + 1}`}`}
              className="h-48 w-full object-cover hover:scale-105 transition-transform"
              loading={index < 4 ? "eager" : "lazy"}
            />
            {image.angleLabel && (
              <p className="px-2 py-1.5 text-center text-xs font-medium text-gray-600 bg-gray-50">
                {image.angleLabel}
              </p>
            )}
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            {expanded ? l.showLess : l.showAll.replace("{n}", String(images.length))}
          </button>
        </div>
      )}
      <p className="text-center text-xs text-gray-400">{l.realShooting}</p>
    </div>
  );
}
