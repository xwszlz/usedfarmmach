/**
 * 展会专题页 FAQ 文案（服务端/客户端共用单一数据源）
 *
 * 放在独立模块的原因：需要同时喂给页面的 FAQPage 结构化数据（Server Component）
 * 和落地页的可视化 FAQ（Client Component）。若把 FAQ 写在 "use client" 模块里再导出，
 * 服务端拿到的是 client reference 而非真实数据，JSON.stringify 会失败。
 *
 * zh / en / ru 完整写；es / pt / ar / fr / hi 回落到英文。
 */

export interface ExpoFaqItem {
  q: string;
  a: string;
}

export function pickFaqs(
  map: Record<string, ExpoFaqItem[]>,
  locale: string
): ExpoFaqItem[] {
  return map[locale] || map.en;
}

export const TJ_FAQS: Record<string, ExpoFaqItem[]> = {
  zh: [
    {
      q: "神雕农机在本届展会中扮演什么角色？",
      a: "神雕农机以参展企业身份参与本届展会，为参展企业提供 8 语种线上展台与海外买家曝光服务。本页为神雕农机自有服务专题，不是展会官方网站。展会相关信息以主办方公告为准。",
    },
    {
      q: "本届展会的时间和举办城市是？",
      a: "2026 中国国际农业机械展览会于 2026 年 10 月 26 日至 28 日在国家会展中心（天津）举办。",
    },
    {
      q: "本届展会的主办单位是？",
      a: "本届展会由中国农业机械流通协会、中国农业机械化协会、中国农业机械工业协会联合主办。",
    },
    {
      q: "线上展台（神雕云展）包含哪些内容？",
      a: "包含 365 天在线的线上展台、图片与视频上传、8 语种产品页、浏览量与询价数据查看。展台可免费开通，展品数量与配套服务按你选择的档位确定。",
    },
    {
      q: "我想申报线下展位，应该找谁？",
      a: "线下展位申报与展位费用请通过展会官方渠道（camf.com.cn）办理，申报截止时间以主办方公告为准。神雕农机不代办线下展位。",
    },
  ],
  en: [
    {
      q: "What is Shendiao's role at this expo?",
      a: "Shendiao attends the expo as an exhibiting company, providing 8-language online booths and overseas buyer exposure for exhibitors. This page is a Shendiao service page, not the official expo website. Expo details are subject to the organizer's announcements.",
    },
    {
      q: "When and where is the expo held?",
      a: "The 2026 China International Agricultural Machinery Exhibition takes place October 26–28, 2026 in Tianjin. The venue is to be verified — please refer to the organizer's announcements.",
    },
    {
      q: "Who organizes this expo?",
      a: "According to available records, the expo is organized by the China Agricultural Machinery Distribution Association, the China Agricultural Machinery Industry Association and other parties (one party is abbreviated CAAMM; its full Chinese name is to be verified). The organizer's announcements are authoritative.",
    },
    {
      q: "What is included in the online booth (Shendiao Cloud Expo)?",
      a: "A 365-day online booth, photo and video upload, 8-language product pages, and access to view and inquiry statistics. The booth can be opened for free; listing volume and services depend on the tier you choose.",
    },
    {
      q: "I want to apply for an on-site booth — who should I contact?",
      a: "On-site booth applications and fees are handled by the expo organizer through official channels; both the official website and the application deadline are to be verified. Shendiao does not act as an agent for on-site booths.",
    },
  ],
  ru: [
    {
      q: "Какова роль Shendiao на этой выставке?",
      a: "Shendiao участвует как экспонент и предоставляет участникам онлайн-стенды на 8 языках и выход на зарубежных покупателей. Это сервисная страница Shendiao, а не официальный сайт выставки. Сведения о выставке уточняйте в объявлениях организатора.",
    },
    {
      q: "Когда и где проходит выставка?",
      a: "Китайская международная выставка сельхозтехники 2026 пройдёт 26–28 октября 2026 года в Тяньцзине. Конкретный павильон уточняется — сверяйтесь с объявлениями организатора.",
    },
    {
      q: "Кто организатор выставки?",
      a: "По имеющимся данным, выставку проводят Китайская ассоциация дистрибуции сельхозтехники, Китайская ассоциация сельхозмашиностроения и другие организации (одна из них обозначается как CAAMM, полное китайское название уточняется). Точный список — в объявлениях организатора.",
    },
    {
      q: "Что входит в онлайн-стенд Shendiao Cloud Expo?",
      a: "Онлайн-стенд на 365 дней, загрузка фото и видео, карточки товаров на 8 языках, статистика просмотров и запросов. Стенд открывается бесплатно; объём размещения и сервисы зависят от выбранного тарифа.",
    },
    {
      q: "Хочу оформить офлайн-стенд — к кому обращаться?",
      a: "Заявки и стоимость офлайн-стендов — через официальные каналы организатора; сайт и срок подачи уточняются. Shendiao не является агентом по продаже офлайн-стендов.",
    },
  ],
};
