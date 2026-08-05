"use client";

import { useTranslations } from "next-intl";

// 用户评价图片列表（只取6张展示）
const TESTIMONIAL_IMAGES = [
  "/images/testimonials/微信图片_2026-02-26_163746_175.jpg",
  "/images/testimonials/微信图片_2026-02-26_163807_228.png",
  "/images/testimonials/微信图片_2026-02-26_163841_602.png",
  "/images/testimonials/微信图片_2026-02-26_163857_800.png",
  "/images/testimonials/微信图片_2026-02-26_163911_854.png",
  "/images/testimonials/微信图片_2026-02-26_163929_075.png",
];

export function Testimonials({ locale }: { locale: string }) {
  const t = useTranslations("home");

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("testimonialsTitle") || "客户实拍反馈"}
          </h2>
          <p className="mt-2 text-gray-500">
            {t("testimonialsDesc") || "来自全国各地农机用户的真实使用场景"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {TESTIMONIAL_IMAGES.map((img, idx) => (
            <div
              key={idx}
              className="group overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
            >
              <div className="aspect-square overflow-hidden">
                <img
                  src={img}
                  alt={`客户实拍 ${idx + 1}`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
        {/* 更多图片 - 横向滚动 */}
        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          {[
            "/images/testimonials/微信图片_2026-02-26_163945_586.png",
            "/images/testimonials/微信图片_2026-02-26_164003_052.jpg",
            "/images/testimonials/微信图片_2026-02-26_164147_076.jpg",
            "/images/testimonials/微信图片_2026-02-26_200231_296.jpg",
            "/images/testimonials/微信图片_2026-02-26_200300_427.jpg",
            "/images/testimonials/微信图片_20260225174551_124_100.jpg",
            "/images/testimonials/微信图片_20260226211116_873_15.jpg",
          ].map((img, idx) => (
            <div
              key={`more-${idx}`}
              className="flex-shrink-0 overflow-hidden rounded-lg border bg-white shadow-sm"
            >
              <div className="h-32 w-32 overflow-hidden">
                <img
                  src={img}
                  alt={`客户实拍 ${idx + 7}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
