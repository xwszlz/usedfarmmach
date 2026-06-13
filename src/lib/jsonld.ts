/**
 * JSON-LD Structured Data Generators
 * Generates Schema.org compliant JSON-LD for all page types.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

// ─────── Organization ───────

export function generateOrganizationJsonLd(locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: locale === "zh" ? "石家庄神雕科技有限公司" : "Shijiazhuang Shendiao Technology Co., Ltd.",
    alternateName: locale === "zh" ? "神雕农机" : "AgriTrade",
    url: `${BASE_URL}/${locale}`,
    logo: `${BASE_URL}/images/logo.png`,
    description:
      locale === "zh"
        ? "全球二手农机交易平台，连接中国与全球农机市场，提供AI智能估价、跨境套利分析和一站式物流服务。"
        : "Global used farm machinery trading platform connecting China with global markets. AI valuation, cross-border arbitrage & one-stop logistics.",
    address: {
      "@type": "PostalAddress",
      addressLocality: locale === "zh" ? "石家庄市" : "Shijiazhuang",
      addressRegion: locale === "zh" ? "河北省" : "Hebei",
      streetAddress: "元氏县马村乡廖村",
      addressCountry: "CN",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+86-18633878701",
      contactType: "customer service",
      availableLanguage: ["Chinese", "English", "Russian", "Spanish", "Portuguese", "Arabic", "French", "Hindi"],
    },
    sameAs: ["https://usedfarmmach.com"],
  };
}

// ─────── WebSite + SearchAction ───────

export function generateWebSiteJsonLd(locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: locale === "zh" ? "神雕农机" : "AgriTrade",
    alternateName: "Used Farm Machinery Trading Platform",
    url: `${BASE_URL}/${locale}`,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/${locale}/products?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ─────── BreadcrumbList ───────

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateBreadcrumbJsonLd(locale: string, items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ─────── Product ───────

interface ProductData {
  id: string;
  name: string;
  brand: string;
  category: string;
  year: number;
  description: string;
  priceCny: number;
  condition: string;
  location: string;
  workingHours?: number;
  imageUrl: string;
  locale: string;
}

export function generateProductJsonLd(product: ProductData) {
  const locale = product.locale;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.imageUrl,
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    category: product.category,
    productionDate: String(product.year),
    offers: {
      "@type": "Offer",
      price: product.priceCny,
      priceCurrency: "CNY",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: locale === "zh" ? "神雕农机" : "AgriTrade",
      },
    },
    ...(product.condition !== "fair" && product.condition !== "poor"
      ? {}
      : {
          itemCondition: {
            "@type": "UsedCondition",
            name: product.condition === "fair" ? "一般" : "较差",
          },
        }),
    ...(product.workingHours
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            name: locale === "zh" ? "工作时长" : "Working Hours",
            value: product.workingHours,
            unitText: locale === "zh" ? "小时" : "HRS",
          },
        }
      : {}),
    ...(product.location
      ? {
          offers: {
            "@type": "Offer",
            price: product.priceCny,
            priceCurrency: "CNY",
            availability: "https://schema.org/InStock",
            availableAtOrFrom: {
              "@type": "Place",
              address: {
                "@type": "PostalAddress",
                addressLocality: product.location,
              },
            },
            seller: {
              "@type": "Organization",
              name: locale === "zh" ? "神雕农机" : "AgriTrade",
            },
          },
        }
      : {}),
  };
}

// ─────── ItemList ───────

interface ListItem {
  id: string;
  name: string;
  url: string;
  imageUrl?: string;
  priceCny?: number;
  brand?: string;
}

export function generateItemListJsonLd(locale: string, items: ListItem[], listName?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName || (locale === "zh" ? "设备列表" : "Product List"),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => {
      const element: any = {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: item.name,
          url: item.url,
        },
      };
      if (item.imageUrl) element.item.image = item.imageUrl;
      if (item.priceCny) {
        element.item.offers = {
          "@type": "Offer",
          price: item.priceCny,
          priceCurrency: "CNY",
          availability: "https://schema.org/InStock",
        };
      }
      if (item.brand) element.item.brand = { "@type": "Brand", name: item.brand };
      return element;
    }),
  };
}

// ─────── Article / BlogPosting ───────

interface ArticleData {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  imageUrl?: string;
  author?: string;
  keywords?: string[];
}

export function generateArticleJsonLd(article: ArticleData) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    url: article.url,
    datePublished: article.datePublished,
    ...(article.dateModified ? { dateModified: article.dateModified } : {}),
    ...(article.imageUrl ? { image: article.imageUrl } : {}),
    author: {
      "@type": "Organization",
      name: article.author || "AgriTrade",
    },
    publisher: {
      "@type": "Organization",
      name: "AgriTrade",
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/images/logo.png`,
      },
    },
    ...(article.keywords && article.keywords.length > 0
      ? { keywords: article.keywords.join(", ") }
      : {}),
    inLanguage: "zh,en,ru,es,pt,ar,fr,hi",
  };
}

// ─────── FAQ ───────

interface FaqItem {
  question: string;
  answer: string;
}

export function generateFaqJsonLd(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// ─────── LocalBusiness ───────

export function generateLocalBusinessJsonLd(locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: locale === "zh" ? "石家庄神雕科技有限公司" : "Shijiazhuang Shendiao Technology Co., Ltd.",
    alternateName: locale === "zh" ? "神雕农机" : "AgriTrade",
    url: `${BASE_URL}/${locale}`,
    logo: `${BASE_URL}/images/logo.png`,
    description:
      locale === "zh"
        ? "全球二手农机交易平台，专注跨境农机出口、AI智能估价和一站式物流服务"
        : "Global used farm machinery trading platform specializing in cross-border export, AI valuation & logistics",
    address: {
      "@type": "PostalAddress",
      streetAddress: "元氏县马村乡廖村",
      addressLocality: locale === "zh" ? "石家庄市" : "Shijiazhuang",
      addressRegion: locale === "zh" ? "河北省" : "Hebei",
      addressCountry: "CN",
    },
    telephone: "+86-18633878701",
    openingHours: "Mo-Fr 09:00-18:00",
    areaServed: [
      { "@type": "Country", name: "China" },
      { "@type": "Country", name: "Russia" },
      { "@type": "Country", name: "Kazakhstan" },
      { "@type": "Country", name: "Brazil" },
      { "@type": "Country", name: "Nigeria" },
    ],
    priceRange: "$$",
  };
}

// ─────── HowTo ───────

interface HowToStep {
  name: string;
  text: string;
  image?: string;
}

export function generateHowToJsonLd(name: string, description: string, steps: HowToStep[]) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    step: steps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.name,
      text: step.text,
      ...(step.image ? { image: step.image } : {}),
    })),
  };
}
