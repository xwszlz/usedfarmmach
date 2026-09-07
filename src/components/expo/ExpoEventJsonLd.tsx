/**
 * 展会专题页 Event（ExhibitionEvent）结构化数据
 *
 * 与 @/components/seo/structured-data 的 EventStructuredData 的区别：
 * 后者是"神雕线上博览会"的常驻 Event（organizer = 神雕农机、虚拟场馆、2024–2030），
 * 直接套用到第三方展会专题页会让 organizer 指向我们 —— 属"冒充主办方"红线。
 * 本组件按展会官方事实渲染，organizer 只填真实主办方全称，官网未核实则不输出 url。
 *
 * 用法：与 FaqStructuredData / BreadcrumbStructuredData（@/components/seo/structured-data）配合使用。
 */

export interface ExpoEventData {
  /** 展会全称 */
  name: string;
  description: string;
  /** ISO 日期，如 2026-09-19 */
  startDate: string;
  endDate: string;
  /** 展会官方网站；未核实则留空（不输出该字段） */
  url?: string;
  /** 场馆名称；未核实则留空 */
  venueName?: string;
  city: string;
  region?: string;
  country: string;
  /** 真实主办方全称列表，禁止填入神雕农机 */
  organizers: string[];
  inLanguage?: string;
}

export function ExpoEventJsonLd({ event }: { event: ExpoEventData }) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venueName || event.city,
      address: {
        "@type": "PostalAddress",
        addressLocality: event.city,
        addressRegion: event.region,
        addressCountry: event.country,
      },
    },
    organizer: event.organizers.map((name) => ({
      "@type": "Organization",
      name,
    })),
    inLanguage: event.inLanguage || "zh",
  };

  // 官网未核实不输出 url，避免把我们的页面当成官方入口
  if (event.url) {
    data.url = event.url;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
