// ───────────────────────────────────────────────
// 买家多语客服 Agent — 上下文源 (Sources)
// 从 DB 拉取产品、套利榜单、FAQ 给 LLM 做 RAG
// ───────────────────────────────────────────────

import { prisma } from "@/lib/db";
import {
  ChatContext,
  ProductContext,
  ArbitrageProductContext,
  ChatLocale,
  FAQEntry,
} from "./types";

// ── 1. 产品详情 ───────────────────────────────
export async function fetchProductContext(
  productId: string,
  locale: ChatLocale
): Promise<ProductContext | null> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      brand: { select: { nameEn: true, nameZh: true } },
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 3 },
      internationalPrices: {
        orderBy: { sourceDate: "desc" },
        take: 2,
        select: { source: true, priceForeignCny: true, currency: true, country: true },
      },
    },
  });

  if (!p) return null;

  const brandName = p.brand.nameEn;
  const arbitragePercent =
    p.internationalPrices[0]?.priceForeignCny && p.internationalPrices[0].priceForeignCny > 0
      ? Math.round(((p.priceCny - p.internationalPrices[0].priceForeignCny) / p.internationalPrices[0].priceForeignCny) * 100)
      : null;

  return {
    id: p.id,
    brand: brandName,
    modelName: p.modelName,
    year: p.year,
    workingHours: p.workingHours,
    condition: p.condition,
    priceCny: p.priceCny,
    priceUsd: p.priceUsd,
    location: p.location,
    description: locale === "zh" ? p.descriptionZh : p.descriptionEn,
    images: p.images.map((i) => i.url),
    internationalPrices: p.internationalPrices.map((ip) => ({
      source: ip.source,
      priceForeignCny: ip.priceForeignCny,
      currency: ip.currency,
      country: ip.country,
    })),
    arbitragePercent,
  };
}

// ── 2. 套利 Top 3（推荐话术）──────────────────
export async function fetchArbitrageTop3(): Promise<ArbitrageProductContext[]> {
  const rows = await prisma.arbitrageTopCache.findMany({
    where: { validUntil: { gt: new Date() } },
    orderBy: [{ rank: "asc" }],
    take: 3,
    include: {
      product: {
        include: {
          brand: { select: { nameEn: true } },
          images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.productId,
    brand: r.product.brand.nameEn,
    modelName: r.product.modelName,
    year: r.product.year,
    priceCny: r.domesticPrice,
    priceDiffPercent: r.priceDiffPercent,
    imageUrl: r.product.images[0]?.url,
  }));
}

// ── 3. 相似产品搜索（关键词匹配）──────────────
export async function searchSimilarProducts(
  keywords: string,
  locale: ChatLocale,
  limit = 3
): Promise<ArbitrageProductContext[]> {
  const safeKeywords = keywords
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .join(" & ");

  if (!safeKeywords) return [];

  const raw = await prisma.$queryRaw<Array<any>>`
    SELECT p.id, p."modelName", p.year, p."priceCny", b."nameEn" as brand, b."nameZh" as brand_zh,
           pi.url as image_url
    FROM "Product" p
    JOIN "Brand" b ON p."brandId" = b.id
    LEFT JOIN (
       SELECT "productId", url FROM "ProductImage"
       WHERE "sortOrder" = 0 OR "isPrimary" = true
       LIMIT 1
    ) pi ON pi."productId" = p.id
    WHERE (
      p."modelName" ILIKE ${"%" + keywords + "%"}
      OR b."nameEn" ILIKE ${"%" + keywords + "%"}
      OR b."nameZh" ILIKE ${"%" + keywords + "%"}
      OR p.description_zh ILIKE ${"%" + keywords + "%"}
      OR p.description_en ILIKE ${"%" + keywords + "%"}
    )
    AND p.status = 'active'
    ORDER BY p."updatedAt" DESC
    LIMIT ${limit}
  `;

  return raw.map((r) => ({
    id: r.id,
    brand: r.brand,
    modelName: r.modelName,
    year: r.year,
    priceCny: r.priceCny,
    priceDiffPercent: 0, // 实时计算较贵，先占位
    imageUrl: r.image_url,
  }));
}

// ── 4. FAQ 静态知识库（小样本，快速命中）──────
const FAQ_KNOWLEDGE: FAQEntry[] = [
  {
    questionZh: "你们支持什么付款方式？",
    questionEn: "What payment methods do you accept?",
    questionRu: "Какие способы оплаты вы принимаете?",
    answerZh:
      "买卖双方自行协商付款方式。常见方式包括人民币银行转账、美元T/T电汇、欧元SEPA/SWIFT。大额订单可协商信用证。平台不代收交易款项。",
    answerEn:
      "Buyers and sellers arrange payment directly. Common methods: CNY bank transfer, USD T/T wire, EUR SEPA/SWIFT. Large orders can use L/C. The platform does not handle transaction funds.",
    answerRu:
      "Покупатели и продавцы договариваются об оплате напрямую. Обычно: CNY банковский перевод, USD T/T, EUR SEPA/SWIFT. Для крупных заказов возможен аккредитив. Платформа не обрабатывает платежи.",
    tags: ["payment"],
  },
  {
    questionZh: "可以发运到哪些国家？",
    questionEn: "Which countries do you ship to?",
    questionRu: "В какие страны вы доставляете?",
    answerZh:
      "全球可发运。主要线路：中亚（哈萨克斯坦、乌兹别克斯坦）、东南亚（越南、印尼）、中东（阿联酋、沙特）、非洲（尼日利亚、肯尼亚）。海运整柜或滚装船。",
    answerEn:
      "Worldwide shipping. Main routes: Central Asia (Kazakhstan, Uzbekistan), Southeast Asia (Vietnam, Indonesia), Middle East (UAE, Saudi Arabia), Africa (Nigeria, Kenya). FCL or Ro-Ro.",
    answerRu:
      "Доставка по всему миру. Основные направления: Центральная Азия (Казахстан, Узбекистан), Юго-Восточная Азия (Вьетнам, Индонезия), Ближний Восток (ОАЭ, Саудовская Аравия), Африка (Нигерия, Кения). Контейнер или Ro-Ro.",
    tags: ["shipping"],
  },
  {
    questionZh: "设备有保修吗？",
    questionEn: "Is there a warranty?",
    questionRu: "Есть ли гарантия?",
    answerZh:
      "二手设备提供『30天机械质保』，核心部件（发动机、变速箱）可延保至90天。新机/翻新机提供1年原厂保修。",
    answerEn:
      "Used equipment comes with a 30-day mechanical warranty. Core parts (engine, transmission) can be extended to 90 days. New/refurbished units carry 1-year factory warranty.",
    answerRu:
      "Б/у техника с 30-дневной механической гарантией. Основные узлы (двигатель, КПП) можно продлить до 90 дней. Новые/восстановленные — 1 год заводской гарантии.",
    tags: ["warranty"],
  },
  {
    questionZh: "怎么验机？",
    questionEn: "How do I inspect the machine?",
    questionRu: "Как проверить технику?",
    answerZh:
      "支持视频验机（微信/Zoom 30分钟实时）、第三方检测报告（SGS/中联认证）、或委托当地代理现场看机。",
    answerEn:
      "We support video inspection (WeChat/Zoom 30-min live), third-party inspection reports (SGS), or on-site inspection via local agents.",
    answerRu:
      "Возможна видеоинспекция (WeChat/Zoom 30 мин), отчёт сторонней инспекции (SGS) или осмотр через местного агента.",
    tags: ["technical_spec", "warranty"],
  },
  {
    questionZh: "可以提供清关文件吗？",
    questionEn: "Can you provide customs clearance documents?",
    questionRu: "Можете предоставить документы для таможенного оформления?",
    answerZh:
      "可以。提供发票、装箱单、原产地证明、出口报关单。如需熏蒸证或COC证书，请提前说明目的国。",
    answerEn:
      "Yes. We provide invoice, packing list, certificate of origin, and export customs declaration. Fumigation or COC certificates available upon request—please specify destination country.",
    answerRu:
      "Да. Предоставляем инвойс, упаковочный лист, сертификат происхождения, экспортную декларацию. Фумигация или COC по запросу — укажите страну назначения.",
    tags: ["shipping"],
  },
  {
    questionZh: "什么是跨境套利？",
    questionEn: "What is cross-border arbitrage?",
    questionRu: "Что такое трансграничный арбитраж?",
    answerZh:
      "同一台设备在中国市场价格比国外市场低很多。例如克拉斯 Jaguar 970 国内约163万，国外约339万，价差176万（+164%）。我们帮你找到这些『低价捡漏』机会并出口到高价市场。",
    answerEn:
      "The same machine costs much less in China than abroad. E.g., CLAAS Jaguar 970 is ~1.63M CNY domestically vs ~3.39M CNY abroad—a 1.76M (+164%) gap. We help you find these 'bargain' opportunities and export to high-price markets.",
    answerRu:
      "Один и тот же агрегат в Китае стоит намного дешевле, чем за рубежом. Например, CLAAS Jaguar 970 в Китае ~1,63 млн юаней, а за рубежом ~3,39 млн — разница 1,76 млн (+164%). Мы помогаем находить такие «выгодные» предложения и экспортировать в дорогие рынки.",
    tags: ["general", "price_inquiry"],
  },
];

export function findFAQAnswer(
  query: string,
  locale: ChatLocale
): { answer: string; matchedQuestion: string } | null {
  const lower = query.toLowerCase();
  for (const entry of FAQ_KNOWLEDGE) {
    const q =
      locale === "zh"
        ? entry.questionZh
        : locale === "ru"
          ? entry.questionRu || entry.questionEn
          : entry.questionEn;
    const a =
      locale === "zh"
        ? entry.answerZh
        : locale === "ru"
          ? entry.answerRu || entry.answerEn
          : entry.answerEn;
    if (q.toLowerCase().includes(lower) || lower.includes(q.toLowerCase())) {
      return { answer: a, matchedQuestion: q };
    }
    // 标签匹配
    for (const tag of entry.tags) {
      if (lower.includes(tag)) return { answer: a, matchedQuestion: q };
    }
  }
  return null;
}

// ── 5. 品牌映射（用于快速提及品牌名）──────────
export async function fetchBrandMap(): Promise<Record<string, string>> {
  const brands = await prisma.brand.findMany({ select: { id: true, nameEn: true } });
  const map: Record<string, string> = {};
  for (const b of brands) map[b.id] = b.nameEn;
  return map;
}
