"use client";

interface RecruitmentBannerProps {
  locale: string;
}

export function RecruitmentBanner({ locale }: RecruitmentBannerProps) {
  return (
    <section className="relative w-full overflow-hidden">
      <img
        src="/images/banner/banner-v15.webp"
        alt="神雕农机 连接全球二手农机交易"
        className="h-auto w-full object-cover"
      />
    </section>
  );
}
