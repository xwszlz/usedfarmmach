"use client";

import { getDetailImageUrl } from "@/lib/image-url";
import type { ProductImage } from "@/types";

interface ImageGalleryProps {
  images: ProductImage[];
  alt: string;
  locale: string;
}

const LABELS: Record<string, { realShooting: string }> = {
  zh: { realShooting: "所有图片均为实拍，以实机为准。" },
  en: { realShooting: "All pictures are real shooting, actual machine as shown." },
  ru: { realShooting: "Все фотографии реальные, соответствует фактической машине." },
  es: { realShooting: "Todas las fotos son reales, máquina real como se muestra." },
  pt: { realShooting: "Todas as fotos são reais, máquina real conforme mostrado." },
  ar: { realShooting: "جميع الصور حقيقية، الآلة الفعلية كما هو موضح." },
  fr: { realShooting: "Toutes les photos sont réelles, machine réelle comme illustrée." },
  hi: { realShooting: "सभी तस्वीरें वास्तविक हैं, वास्तविक मशीन जैसा दिखाया गया है।" },
};

export function ImageGallery({ images, alt, locale }: ImageGalleryProps) {
  const l = LABELS[locale] || LABELS.en;
  const displayImages = images.slice(0, 8);

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
      <p className="text-center text-xs text-gray-400">{l.realShooting}</p>
    </div>
  );
}
