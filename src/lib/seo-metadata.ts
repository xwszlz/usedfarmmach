import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

const localizedMeta: Record<string, Record<string, { title: string; description: string }>> = {
  home: {
    zh: {
      title: "二手农机交易平台_跨境农机出口_全球二手农机买卖_神雕农机",
      description: "神雕农机—全球二手农机交易平台，提供CLAAS青储机、约翰迪尔拖拉机、凯斯农机等品牌二手农机买卖服务。AI智能估价、跨境套利分析、一站式物流，让农机交易更透明高效。",
    },
    en: {
      title: "Used Farm Machinery Trading Platform | Global Agri Export | AgriTrade",
      description: "AgriTrade — Global used farm machinery trading platform. CLAAS forage harvesters, John Deere tractors & more. AI valuation, cross-border arbitrage & one-stop logistics.",
    },
    ru: {
      title: "Платформа торговли подержанной сельхозтехникой | Глобальный экспорт | AgriTrade",
      description: "AgriTrade — глобальная платформа торговли подержанной сельхозтехникой. Кормоуборочные комбайны CLAAS, тракторы John Deere и многое другое. AI оценка, арбитраж и логистика.",
    },
    es: {
      title: "Plataforma de Maquinaria Agrícola Usada | Exportación Global | AgriTrade",
      description: "AgriTrade — Plataforma global de maquinaria agrícola usada. Cosechadoras CLAAS, tractores John Deere y más. Valoración IA, arbitraje transfronterizo y logística integral.",
    },
    pt: {
      title: "Plataforma de Máquinas Agrícolas Usadas | Exportação Global | AgriTrade",
      description: "AgriTrade — Plataforma global de máquinas agrícolas usadas. Colheitadeiras CLAAS, tratores John Deere e mais. Avaliação IA, arbitragem e logística integrada.",
    },
    ar: {
      title: "منصة تجارة الآلات الزراعية المستعملة | التصدير العالمي | AgriTrade",
      description: "AgriTrade — منصة عالمية لتجارة الآلات الزراعية المستعملة. حصادات CLAAS وجرارات John Deere وغيرها. تقييم بالذكاء الاصطناعي وخدمات لوجستية متكاملة.",
    },
    fr: {
      title: "Plateforme de Machines Agricoles d'Occasion | Export Mondial | AgriTrade",
      description: "AgriTrade — Plateforme mondiale de machines agricoles d'occasion. Ensileuses CLAAS, tracteurs John Deere et plus. Évaluation IA, arbitrage et logistique intégrée.",
    },
    hi: {
      title: "प्रयुक्त कृषि मशीनरी ट्रेडिंग प्लेटफॉर्म | वैश्विक निर्यात | AgriTrade",
      description: "AgriTrade — वैश्विक प्रयुक्त कृषि मशीनरी ट्रेडिंग प्लेटफॉर्म। CLAAS फोरेज हार्वेस्टर, John Deere ट्रैक्टर और अधिक। AI मूल्यांकन, आर्बिट्राज और एकीकृत लॉजिस्टिक्स।",
    },
  },
  products: {
    zh: {
      title: "二手农机设备市场_CLAAS青储机_约翰迪尔拖拉机_品牌二手农机选购_神雕农机",
      description: "浏览海量二手农机设备：CLAAS收割机、约翰迪尔拖拉机、凯斯农机、克拉斯青储机等。支持按品牌、年份、价格筛选，每日更新跨境套利排行，发现最佳投资机会。",
    },
    en: {
      title: "Used Farm Machinery Market | CLAAS, John Deere & More | AgriTrade",
      description: "Browse thousands of used farm machines: CLAAS harvesters, John Deere tractors, Case IH & more. Filter by brand, year & price. Updated daily with cross-border arbitrage rankings.",
    },
    ru: {
      title: "Рынок подержанной сельхозтехники | CLAAS, John Deere | AgriTrade",
      description: "Просмотр подержанной сельхозтехники: комбайны CLAAS, тракторы John Deere, Case IH и др. Фильтр по бренду, году и цене. Ежедневное обновление арбитражного рейтинга.",
    },
    es: {
      title: "Mercado de Maquinaria Agrícola Usada | CLAAS, John Deere | AgriTrade",
      description: "Explore maquinaria agrícola usada: cosechadoras CLAAS, tractores John Deere, Case IH y más. Filtre por marca, año y precio. Ranking de arbitraje actualizado a diario.",
    },
    pt: {
      title: "Mercado de Máquinas Agrícolas Usadas | CLAAS, John Deere | AgriTrade",
      description: "Explore máquinas agrícolas usadas: colheitadeiras CLAAS, tratores John Deere, Case IH e mais. Filtre por marca, ano e preço. Ranking de arbitragem atualizado diariamente.",
    },
    ar: {
      title: "سوق الآلات الزراعية المستعملة | CLAAS، John Deere | AgriTrade",
      description: "تصفح الآلات الزراعية المستعملة: حصادات CLAAS، جرارات John Deere، Case IH وغيرها. تصفية حسب العلامة التجارية والسنة والسعر. تحديث يومي لترتيب فرص المراجحة.",
    },
    fr: {
      title: "Marché de Machines Agricoles d'Occasion | CLAAS, John Deere | AgriTrade",
      description: "Parcourez des machines agricoles d'occasion: ensileuses CLAAS, tracteurs John Deere, Case IH et plus. Filtrez par marque, année et prix. Classement d'arbitrage mis à jour quotidiennement.",
    },
    hi: {
      title: "प्रयुक्त कृषि मशीनरी बाजार | CLAAS, John Deere | AgriTrade",
      description: "प्रयुक्त कृषि मशीनरी ब्राउज़ करें: CLAAS हार्वेस्टर, John Deere ट्रैक्टर, Case IH और अधिक। ब्रांड, वर्ष और कीमत के अनुसार फ़िल्टर करें। दैनिक आर्बिट्राज रैंकिंग अपडेट।",
    },
  },
  blog: {
    zh: {
      title: "二手农机行业资讯_跨境农机市场分析_价格指南_购买攻略_神雕农机",
      description: "二手农机行业最新动态：国际农机市场分析、二手农机价格指南、CLAAS/约翰迪尔品牌评测、跨境农机购买攻略。助您把握全球农机投资先机。",
    },
    en: {
      title: "Used Farm Machinery News | Market Analysis, Price Guides & Tips | AgriTrade",
      description: "Latest used farm machinery insights: global market analysis, price guides, brand reviews (CLAAS, John Deere), and buying tips for cross-border agricultural equipment trade.",
    },
    ru: {
      title: "Новости рынка подержанной сельхозтехники | Анализ, цены, обзоры | AgriTrade",
      description: "Актуальные новости рынка подержанной сельхозтехники: анализ мирового рынка, ценовые руководства, обзоры брендов CLAAS/John Deere, советы по покупке.",
    },
    es: {
      title: "Noticias de Maquinaria Agrícola Usada | Análisis, Guías de Precios | AgriTrade",
      description: "Últimas noticias sobre maquinaria agrícola usada: análisis de mercado, guías de precios, reseñas de CLAAS/John Deere, consejos de compra transfronteriza.",
    },
    pt: {
      title: "Notícias de Máquinas Agrícolas Usadas | Análise, Guias de Preços | AgriTrade",
      description: "Últimas notícias sobre máquinas agrícolas usadas: análise de mercado, guias de preços, avaliações CLAAS/John Deere, dicas de compra internacional.",
    },
    ar: {
      title: "أخبار الآلات الزراعية المستعملة | تحليل السوق، أدلة الأسعار | AgriTrade",
      description: "آخر أخبار الآلات الزراعية المستعملة: تحليل السوق العالمي، أدلة الأسعار، مراجعات CLAAS وJohn Deere، نصائح الشراء عبر الحدود.",
    },
    fr: {
      title: "Actualités Machines Agricoles d'Occasion | Analyse, Guides de Prix | AgriTrade",
      description: "Dernières actualités sur les machines agricoles d'occasion: analyse de marché, guides de prix, avis CLAAS/John Deere, conseils d'achat transfrontalier.",
    },
    hi: {
      title: "प्रयुक्त कृषि मशीनरी समाचार | बाजार विश्लेषण, मूल्य गाइड | AgriTrade",
      description: "नवीनतम प्रयुक्त कृषि मशीनरी जानकारी: वैश्विक बाजार विश्लेषण, मूल्य गाइड, CLAAS/John Deere ब्रांड समीक्षा, सीमा पार खरीद युक्तियाँ।",
    },
  },
  intelligence: {
    zh: {
      title: "二手农机市场情报_跨境套利数据_国际农机价格走势_神雕农机",
      description: "实时二手农机市场数据：各国农机价格对比、跨境套利机会分析、国际农机贸易趋势。每日更新情报速递，助您发现最佳买卖时机。",
    },
    en: {
      title: "Farm Machinery Market Intelligence | Arbitrage Data & Price Trends | AgriTrade",
      description: "Real-time used farm machinery market data: country price comparisons, cross-border arbitrage analysis, global trade trends. Updated daily intelligence briefings.",
    },
    ru: {
      title: "Рыночная аналитика сельхозтехники | Арбитраж, цены, тренды | AgriTrade",
      description: "Рыночные данные в реальном времени: сравнение цен по странам, анализ арбитражных возможностей, мировые торговые тренды. Ежедневные обновления.",
    },
    es: {
      title: "Inteligencia de Mercado de Maquinaria Agrícola | Arbitraje y Tendencias | AgriTrade",
      description: "Datos de mercado en tiempo real: comparación de precios por país, análisis de arbitraje, tendencias del comercio global. Informes diarios actualizados.",
    },
    pt: {
      title: "Inteligência de Mercado de Máquinas Agrícolas | Arbitragem e Tendências | AgriTrade",
      description: "Dados de mercado em tempo real: comparação de preços por país, análise de arbitragem, tendências do comércio global. Atualizações diárias.",
    },
    ar: {
      title: "استخبارات سوق الآلات الزراعية | بيانات المراجحة واتجاهات الأسعار | AgriTrade",
      description: "بيانات سوق الآلات الزراعية المستعملة في الوقت الفعلي: مقارنة الأسعار بين الدول، تحليل فرص المراجحة، اتجاهات التجارة العالمية. تحديثات يومية.",
    },
    fr: {
      title: "Veille de Marché Machines Agricoles | Données d'Arbitrage & Tendances | AgriTrade",
      description: "Données de marché en temps réel: comparaison des prix par pays, analyse d'arbitrage, tendances du commerce mondial. Briefings quotidiens mis à jour.",
    },
    hi: {
      title: "कृषि मशीनरी बाजार खुफिया | आर्बिट्राज डेटा और मूल्य रुझान | AgriTrade",
      description: "रीयल-टाइम प्रयुक्त कृषि मशीनरी बाजार डेटा: देशवार मूल्य तुलना, सीमा पार आर्बिट्राज विश्लेषण, वैश्विक व्यापार रुझान। दैनिक अपडेट।",
    },
  },
  logistics: {
    zh: {
      title: "二手农机跨境物流_国际农机运输_清关一站式服务_神雕农机",
      description: "专业二手农机跨境物流方案：整柜运输(FCL)、拼柜运输(LCL)、空运方案。代办出口报关、国际运输、目的国清关及送货上门，全程追踪。",
    },
    en: {
      title: "Cross-Border Farm Machinery Shipping | FCL, LCL & Air Freight | AgriTrade",
      description: "Professional farm machinery logistics: FCL, LCL & air freight solutions. Export customs clearance, international shipping, destination clearance & door-to-door delivery with full tracking.",
    },
    ru: {
      title: "Международная логистика сельхозтехники | FCL, LCL, авиаперевозки | AgriTrade",
      description: "Профессиональная логистика сельхозтехники: FCL, LCL и авиаперевозки. Таможенное оформление, международная доставка, доставка до двери с отслеживанием.",
    },
    es: {
      title: "Logística de Maquinaria Agrícola | Transporte FCL, LCL y Aéreo | AgriTrade",
      description: "Logística profesional de maquinaria agrícola: FCL, LCL y carga aérea. Despacho de aduanas, envío internacional y entrega puerta a puerta con seguimiento completo.",
    },
    pt: {
      title: "Logística de Máquinas Agrícolas | Transporte FCL, LCL e Aéreo | AgriTrade",
      description: "Logística profissional de máquinas agrícolas: FCL, LCL e frete aéreo. Desembaraço aduaneiro, envio internacional e entrega porta a porta com rastreamento.",
    },
    ar: {
      title: "الشحن الدولي للآلات الزراعية | FCL، LCL والشحن الجوي | AgriTrade",
      description: "خدمات لوجستية احترافية للآلات الزراعية: الشحن بالحاويات الكاملة (FCL)، الشحن الجزئي (LCL) والشحن الجوي. تخليص جمركي وشحن دولي وتسليم حتى الباب مع تتبع كامل.",
    },
    fr: {
      title: "Logistique Internationale de Machines Agricoles | FCL, LCL, Fret Aérien | AgriTrade",
      description: "Logistique professionnelle de machines agricoles: FCL, LCL et fret aérien. Dédouanement export, expédition internationale et livraison porte-à-porte avec suivi complet.",
    },
    hi: {
      title: "कृषि मशीनरी अंतर्राष्ट्रीय लॉजिस्टिक्स | FCL, LCL और एयर फ्रेट | AgriTrade",
      description: "पेशेवर कृषि मशीनरी लॉजिस्टिक्स: FCL, LCL और एयर फ्रेट समाधान। निर्यात सीमा शुल्क निकासी, अंतर्राष्ट्रीय शिपिंग और पूर्ण ट्रैकिंग के साथ डोर-टू-डोर डिलीवरी।",
    },
  },
  about: {
    zh: {
      title: "关于神雕农机_全球二手农机交易平台_跨境农机出口专家",
      description: "神雕农机—石家庄神雕农机科技有限公司旗下全球二手农机交易平台。连接中国与全球农机市场，通过AI估价、跨境套利和一站式物流，让农机交易更透明。",
    },
    en: {
      title: "About AgriTrade | Global Used Farm Machinery Trading Platform",
      description: "AgriTrade — a global used farm machinery platform by Shijiazhuang Shendiao Tech. Connecting China with global markets through AI valuation, arbitrage & logistics.",
    },
    ru: {
      title: "О компании AgriTrade | Глобальная платформа торговли сельхозтехникой",
      description: "AgriTrade — глобальная платформа подержанной сельхозтехники от Shijiazhuang Shendiao Tech. Связываем Китай с мировыми рынками через AI оценку и логистику.",
    },
    es: {
      title: "Acerca de AgriTrade | Plataforma Global de Maquinaria Agrícola Usada",
      description: "AgriTrade — plataforma global de maquinaria agrícola usada de Shijiazhuang Shendiao Tech. Conectando China con mercados globales mediante valoración IA y logística.",
    },
    pt: {
      title: "Sobre a AgriTrade | Plataforma Global de Máquinas Agrícolas Usadas",
      description: "AgriTrade — plataforma global de máquinas agrícolas usadas da Shijiazhuang Shendiao Tech. Conectando a China aos mercados globais com avaliação IA e logística.",
    },
    ar: {
      title: "حول AgriTrade | منصة عالمية لتجارة الآلات الزراعية المستعملة",
      description: "AgriTrade — منصة عالمية للآلات الزراعية المستعملة من Shijiazhuang Shendiao Tech. ربط الصين بالأسواق العالمية من خلال التقييم بالذكاء الاصطناعي والخدمات اللوجستية.",
    },
    fr: {
      title: "À propos d'AgriTrade | Plateforme Mondiale de Machines Agricoles d'Occasion",
      description: "AgriTrade — plateforme mondiale de machines agricoles d'occasion par Shijiazhuang Shendiao Tech. Connectant la Chine aux marchés mondiaux via évaluation IA et logistique.",
    },
    hi: {
      title: "AgriTrade के बारे में | वैश्विक प्रयुक्त कृषि मशीनरी ट्रेडिंग प्लेटफॉर्म",
      description: "AgriTrade — Shijiazhuang Shendiao Tech का वैश्विक प्रयुक्त कृषि मशीनरी प्लेटफॉर्म। AI मूल्यांकन, आर्बिट्राज और लॉजिस्टिक्स के माध्यम से चीन को वैश्विक बाजारों से जोड़ना।",
    },
  },
  arbitrageCalculator: {
    zh: {
      title: "二手农机跨境套利计算器_农机出口利润测算工具_神雕农机",
      description: "免费跨境套利计算器：选择农机产品，自动获取中外价格，计算运输、关税、保险成本，实时分析跨境套利机会和投资回报率。",
    },
    en: {
      title: "Farm Machinery Arbitrage Calculator | Cross-Border Profit Tool | AgriTrade",
      description: "Free cross-border arbitrage calculator: select farm machinery, get auto-filled China & international prices, calculate shipping, tariff & insurance. Real-time ROI analysis.",
    },
    ru: {
      title: "Калькулятор арбитража сельхозтехники | Инструмент расчета прибыли | AgriTrade",
      description: "Бесплатный калькулятор арбитража: выберите технику, получите цены Китая и зарубежья, рассчитайте доставку, пошлины и страховку. Анализ ROI в реальном времени.",
    },
    es: {
      title: "Calculadora de Arbitraje de Maquinaria Agrícola | Herramienta de Beneficios | AgriTrade",
      description: "Calculadora gratuita de arbitraje: seleccione maquinaria, obtenga precios de China e internacionales, calcule envío, aranceles y seguro. Análisis de ROI en tiempo real.",
    },
    pt: {
      title: "Calculadora de Arbitragem de Máquinas Agrícolas | Ferramenta de Lucro | AgriTrade",
      description: "Calculadora gratuita de arbitragem: selecione máquinas, obtenha preços da China e internacionais, calcule frete, tarifas e seguro. Análise de ROI em tempo real.",
    },
    ar: {
      title: "حاسبة مراجحة الآلات الزراعية | أداة حساب الأرباح عبر الحدود | AgriTrade",
      description: "حاسبة مراجحة مجانية: اختر الآلات الزراعية، احصل على أسعار الصين والأسواق الدولية، احسب الشحن والرسوم الجمركية والتأمين. تحليل عائد الاستثمار في الوقت الفعلي.",
    },
    fr: {
      title: "Calculateur d'Arbitrage de Machines Agricoles | Outil de Profit Transfrontalier | AgriTrade",
      description: "Calculateur d'arbitrage gratuit: sélectionnez des machines, obtenez les prix Chine et internationaux, calculez fret, droits de douane et assurance. Analyse du ROI en temps réel.",
    },
    hi: {
      title: "कृषि मशीनरी आर्बिट्राज कैलकुलेटर | सीमा पार लाभ उपकरण | AgriTrade",
      description: "मुफ्त आर्बिट्राज कैलकुलेटर: कृषि मशीनरी चुनें, चीन और अंतर्राष्ट्रीय कीमतें प्राप्त करें, शिपिंग, टैरिफ और बीमा की गणना करें। रीयल-टाइम ROI विश्लेषण।",
    },
  },
  arbitrageTop: {
    zh: {
      title: "二手农机套利榜单_跨境农机投资机会排名_每日更新_神雕农机",
      description: "实时二手农机跨境套利排行榜：基于中外价差、运输成本、关税等综合因素排名。发现高利润率跨境投资机会，每日30分钟自动更新。",
    },
    en: {
      title: "Farm Machinery Arbitrage Rankings | Cross-Border Investment Opportunities | AgriTrade",
      description: "Real-time farm machinery arbitrage rankings: ranked by price gap, shipping cost & tariff analysis. Discover high-margin cross-border opportunities. Updated every 30 minutes.",
    },
    ru: {
      title: "Рейтинг арбитража сельхозтехники | Возможности инвестиций | AgriTrade",
      description: "Рейтинг арбитража в реальном времени: ранжирование по разнице цен, стоимости доставки и пошлинам. Высокомаржинальные возможности. Обновление каждые 30 минут.",
    },
    es: {
      title: "Ranking de Arbitraje de Maquinaria Agrícola | Oportunidades de Inversión | AgriTrade",
      description: "Ranking de arbitraje en tiempo real: clasificado por diferencia de precio, envío y aranceles. Descubra oportunidades de alto margen. Actualizado cada 30 minutos.",
    },
    pt: {
      title: "Ranking de Arbitragem de Máquinas Agrícolas | Oportunidades de Investimento | AgriTrade",
      description: "Ranking de arbitragem em tempo real: classificado por diferença de preço, frete e tarifas. Descubra oportunidades de alta margem. Atualizado a cada 30 minutos.",
    },
    ar: {
      title: "ترتيب مراجحة الآلات الزراعية | فرص الاستثمار عبر الحدود | AgriTrade",
      description: "ترتيب المراجحة في الوقت الفعلي: مصنف حسب فرق السعر وتكاليف الشحن والرسوم الجمركية. اكتشف فرص الاستثمار عالية الهامش. تحديث كل 30 دقيقة.",
    },
    fr: {
      title: "Classement d'Arbitrage de Machines Agricoles | Opportunités d'Investissement | AgriTrade",
      description: "Classement d'arbitrage en temps réel: classé par écart de prix, fret et droits de douane. Découvrez des opportunités à forte marge. Mis à jour toutes les 30 minutes.",
    },
    hi: {
      title: "कृषि मशीनरी आर्बिट्राज रैंकिंग | सीमा पार निवेश अवसर | AgriTrade",
      description: "रीयल-टाइम आर्बिट्राज रैंकिंग: मूल्य अंतर, शिपिंग लागत और टैरिफ विश्लेषण द्वारा क्रमबद्ध। उच्च-मार्जिन अवसर खोजें। हर 30 मिनट में अपडेट।",
    },
  },
};

export const ALL_LOCALES = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"] as const;
export type Locale = (typeof ALL_LOCALES)[number];

/**
 * Build locale-aware hreflang alternates for a given page path.
 * Example: buildHreflang("/products") returns:
 *   { zh: ".../zh/products", en: ".../en/products", ..., "x-default": ".../en/products" }
 */
export function buildHreflang(pagePath: string): Record<string, string> {
  const path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
  const alternates: Record<string, string> = { "x-default": `${BASE_URL}/en${path}` };
  for (const lang of ALL_LOCALES) {
    alternates[lang] = `${BASE_URL}/${lang}${path}`;
  }
  return alternates;
}

const fallbackLang = ["en", "ru", "es", "pt", "ar", "fr", "hi"];

function getMeta(
  page: keyof typeof localizedMeta,
  locale: string
): { title: string; description: string } {
  const data = localizedMeta[page];
  if (data[locale]) return data[locale];
  return data["en"];
}

export function generatePageMetadata(
  page: keyof typeof localizedMeta,
  locale: string,
  pagePath: string = "",
  overrides?: Partial<Metadata>
): Metadata {
  const meta = getMeta(page, locale);
  const path = pagePath || "";
  const localePath = locale === "zh" ? `/zh${path}` : `/${locale}${path}`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${BASE_URL}${localePath}`,
      languages: buildHreflang(path),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${BASE_URL}${localePath}`,
      siteName: locale === "zh" ? "神雕农机" : "AgriTrade",
      locale: locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
    robots: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
    ...overrides,
  };
}

export { localizedMeta, fallbackLang };
