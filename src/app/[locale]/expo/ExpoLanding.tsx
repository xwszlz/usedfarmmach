"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Clock,
  Globe2,
  Bot,
  ShieldCheck,
  TrendingUp,
  Ship,
  Sparkles,
} from "lucide-react";
import { isCnSite } from "@/config/site";

interface ExpoLandingProps {
  locale: string;
}

const TEXTS: Record<string, {
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  introTitle: string;
  introBody: string;
  featuresTitle: string;
  features: { icon: string; title: string; desc: string }[];
  benefitsTitle: string;
  benefits: string[];
  formTitle: string;
  formSubtitle: string;
  fields: {
    company: string;
    contact: string;
    phone: string;
    email: string;
    country: string;
    category: string;
    boothType: string;
    message: string;
  };
  boothOptions: string[];
  categoryOptions: string[];
  submit: string;
  submitting: string;
  success: string;
  error: string;
  selectPlaceholder: string;
  selfPublishCta?: string;
  selfPublishDesc?: string;
  selfPublishBtn?: string;
  videoShowcase?: string;
  showroomShowcase?: string;
  viewAll?: string;
  loading?: string;
  noData?: string;
  playsUnit?: string;
  contactAdvisor?: string;
}> = {
  zh: {
    badge: "中国农机 · 走向世界",
    title: "永不落幕的农机世界展会",
    subtitle:
      "125个品牌展位、187台中外精品农机365天在线展示，从东方红到大疆，从拖拉机到植保无人机，让中国制造走向全球田间。",
    cta: "自主发布农机",
    introTitle: "世界农机的全球舞台",
    introBody:
      "传统展会一年3天，错过等一年。我们将展会搬到线上，让全球农机品牌365天24小时向全球买家展示。全球领袖馆为旗舰，中国中坚馆为核心，新锐专业馆为补充——三馆联动，按品牌全球影响力客观分级，从展示到成交的完整闭环。结合AI供需匹配、跨境交易担保和国际物流服务，让全球农机走向每一块农田。",
    featuresTitle: "核心亮点",
    features: [
      {
        icon: "clock",
        title: "365天全年在线",
        desc: "不受展会档期限制，产品随时展示、随时更新、随时接单",
      },
      {
        icon: "globe",
        title: "全球买家触达",
        desc: "中英俄等8语种覆盖，买家来自中亚、东欧、东南亚、非洲、南美",
      },
      {
        icon: "bot",
        title: "AI供需匹配",
        desc: "智能引擎自动匹配买家需求与卖家产品，精准推送高意向询盘",
      },
      {
        icon: "shield",
        title: "交易担保",
        desc: "资金托管、验机报告、区块链溯源，跨境交易安全无忧",
      },
      {
        icon: "trending",
        title: "数据驱动",
        desc: "全球二手农机价格指数、市场情报速递，用数据赋能决策",
      },
      {
        icon: "ship",
        title: "跨境物流",
        desc: "海外仓+门到门物流方案，FOB中国港口到买家手中全程可视",
      },
    ],
    benefitsTitle: "参展权益",
    benefits: [
      "365天线上虚拟展位，产品图文+视频全天候展示",
      "AI供需匹配引擎，高意向买家询盘优先推送",
      "全球8语种产品详情页，消除语言壁垒",
      "跨境交易担保服务，资金安全有保障",
      "月度市场情报报告，掌握行业价格趋势",
      "线下地头展优先参展权，线上线下一体化",
      "中国农业机械流通协会二手农机流通分会 副会长单位（独立运营，不代表协会官方）",
      "海外仓+物流方案专属折扣",
    ],
    formTitle: "招商意向表",
    formSubtitle: "填写以下信息，我们将在24小时内与您联系",
    fields: {
      company: "公司名称",
      contact: "联系人",
      phone: "手机号",
      email: "邮箱",
      country: "所在国家/地区",
      category: "主营品类",
      boothType: "意向展位类型",
      message: "留言（选填）",
    },
    boothOptions: [
      "基础展位 ¥380/年（5款产品展示）",
      "优选展位 ¥980/年（20款产品+视频展示）",
      "旗舰展位 ¥2,880/年（不限量+VR展厅+优先推荐）",
      "暂不确定，请顾问联系我",
    ],
    categoryOptions: [
      "拖拉机",
      "青储机/牧草收割机",
      "打捆机",
      "割台/捡拾割台",
      "裹包机",
      "搂草机/摊晒机",
      "农机配件",
      "其他农机设备",
    ],
    submit: "提交申请",
    submitting: "提交中...",
    success: "提交成功！我们将在24小时内与您联系。",
    error: "提交失败，请稍后重试或直接联系 WhatsApp: +86 15511395016",
    selectPlaceholder: "请选择",
    selfPublishCta: "自主发布农机 · 免费上线",
    selfPublishDesc: "无需积分，提交即上线。把您的农机直接展示给全球买家。",
    selfPublishBtn: "自主发布农机",
    videoShowcase: "WingShow 真实作业视频精选",
    showroomShowcase: "数字展厅 · 新品精选",
    viewAll: "查看全部",
    loading: "加载中…",
    noData: "暂无内容",
    playsUnit: "次播放",
    contactAdvisor: "或联系顾问：",
  },
  en: {
    badge: "Chinese Machinery · Global Stage",
    title: "The Always-On Global Farm Machinery Expo",
    subtitle:
      "125 farm machinery brand booths on display 365 days a year. From Dongfanghong to DJI, from tractors to drones — bringing Chinese manufacturing to fields worldwide.",
    cta: "List Your Machinery",
    introTitle: "The World Stage for Chinese Farm Machinery",
    introBody:
      "Traditional expos last 3 days a year — miss it and wait another year. We bring the expo online, showcasing Chinese farm machinery brands to global buyers 24/7/365. The China Pavilion takes center stage, the Global Pavilion provides benchmarks, and the Category Comparison Hall helps buyers decide — three halls working together from display to deal. Combined with AI matching, cross-border escrow, and international logistics, we bring Chinese machinery to every field along the Belt & Road.",
    featuresTitle: "Key Highlights",
    features: [
      {
        icon: "clock",
        title: "365-Day Online",
        desc: "No expo schedule limits — display, update, and sell anytime",
      },
      {
        icon: "globe",
        title: "Global Buyer Reach",
        desc: "8 languages covering Central Asia, Eastern Europe, SE Asia, Africa, South America",
      },
      {
        icon: "bot",
        title: "AI Matching",
        desc: "Smart engine auto-matches buyer demand with seller inventory, pushing high-intent leads",
      },
      {
        icon: "shield",
        title: "Escrow Protection",
        desc: "Fund custody, inspection reports, blockchain traceability — safe cross-border deals",
      },
      {
        icon: "trending",
        title: "Data-Driven",
        desc: "Global used machinery price index, market intel reports — data empowers decisions",
      },
      {
        icon: "ship",
        title: "Cross-Border Logistics",
        desc: "Overseas warehouses + door-to-door logistics, full visibility from FOB China to buyer",
      },
    ],
    benefitsTitle: "Exhibitor Benefits",
    benefits: [
      "365-day virtual booth with photo + video product showcase",
      "AI matching engine prioritizes high-intent buyer inquiries",
      "8-language product detail pages, eliminating language barriers",
      "Cross-border escrow service for secure fund protection",
      "Monthly market intelligence reports with price trends",
      "Priority access to offline field expos — online + offline integration",
      "Vice President Unit, Used Farm Machinery Circulation Branch of China Association of Agricultural Machinery Circulation (independently operated; not an official association channel or representative)",
      "Exclusive discounts on overseas warehouse + logistics",
    ],
    formTitle: "Exhibitor Inquiry Form",
    formSubtitle: "Fill out the form below and we'll contact you within 24 hours",
    fields: {
      company: "Company Name",
      contact: "Contact Person",
      phone: "Phone Number",
      email: "Email",
      country: "Country / Region",
      category: "Main Product Category",
      boothType: "Booth Type Interest",
      message: "Message (Optional)",
    },
    boothOptions: [
      "Basic ¥380/yr (5 products)",
      "Premium ¥980/yr (20 products + video)",
      "Flagship ¥2,880/yr (unlimited + VR + priority)",
      "Not sure, please contact me",
    ],
    categoryOptions: [
      "Tractors",
      "Forage Harvesters",
      "Balers",
      "Headers / Pickup Heads",
      "Bale Wrappers",
      "Rakes / Tedders",
      "Parts",
      "Other Machinery",
    ],
    submit: "Submit Application",
    submitting: "Submitting...",
    success: "Submitted successfully! We'll contact you within 24 hours.",
    error: "Submission failed. Please try again or contact Email: jiusei0319@gmail.com",
    selectPlaceholder: "Please select",
    selfPublishCta: "List Your Machinery — Free & Live",
    selfPublishDesc: "No credits required — you are live instantly. Show your machinery to buyers worldwide.",
    selfPublishBtn: "List Your Machinery",
    videoShowcase: "WingShow Field Operation Videos",
    showroomShowcase: "Digital Showroom — New Arrivals",
    viewAll: "View All",
    loading: "Loading…",
    noData: "No content yet",
    playsUnit: "plays",
    contactAdvisor: "Or contact an advisor: ",
  },
  ru: {
    badge: "Китайская техника · Мировая сцена",
    title: "Всемирная выставка сельхозтехники без выходных",
    subtitle:
      "125 китайских бренда сельхозтехники на витрине 365 дней в году. От Dongfanghong до DJI, от тракторов до дронов — китайское производство для полей всего мира.",
    cta: "Разместить технику",
    introTitle: "Мировая сцена для китайской сельхозтехники",
    introBody:
      "Традиционные выставки длятся 3 дня в году — пропустили, ждите ещё год. Мы перенесли выставку онлайн: китайские бренды доступны покупателям 24/7/365. Китайский зал — главная сцена, Международный зал — ориентир, Зал сравнения — помощник в выборе. Три зала вместе: от показа до сделки. AI-подбор, эскроу-сервис и международная логистика довозят китайскую технику до каждого поля вдоль Шёлкового пути.",
    featuresTitle: "Ключевые преимущества",
    features: [
      {
        icon: "clock",
        title: "365 дней онлайн",
        desc: "Без ограничений по расписанию — показывайте и продавайте в любое время",
      },
      {
        icon: "globe",
        title: "Глобальный охват",
        desc: "8 языков: Центральная Азия, Восточная Европа, Юго-Восточная Азия, Африка, Южная Америка",
      },
      {
        icon: "bot",
        title: "AI-подбор",
        desc: "Умный движок сопоставляет спрос и предложение, направляя целевые лиды",
      },
      {
        icon: "shield",
        title: "Эскроу-защита",
        desc: "Хранение средств, отчёты об осмотре, блокчейн-трассировка — безопасные сделки",
      },
      {
        icon: "trending",
        title: "На основе данных",
        desc: "Глобальный индекс цен, рыночная аналитика — данные для принятия решений",
      },
      {
        icon: "ship",
        title: "Трансграничная логистика",
        desc: "Зарубежные склады + доставка от двери до двери с полным отслеживанием",
      },
    ],
    benefitsTitle: "Преимущества для участников",
    benefits: [
      "365-дневный виртуальный стенд с фото и видео",
      "AI-подбор приоритетных запросов от покупателей",
      "Страницы товаров на 8 языках",
      "Эскроу-сервис для защиты средств",
      "Ежемесячные отчёты по рыночной аналитике",
      "Приоритет на офлайн-выставках",
      "Вице-президентская единица — Vice President Unit, Used Farm Machinery Circulation Branch of China Association of Agricultural Machinery Circulation (независимая деятельность; не официальный канал ассоциации)",
      "Скидки на склады и логистику",
    ],
    formTitle: "Заявка на участие",
    formSubtitle: "Заполните форму, и мы свяжемся с вами в течение 24 часов",
    fields: {
      company: "Название компании",
      contact: "Контактное лицо",
      phone: "Телефон",
      email: "Email",
      country: "Страна / Регион",
      category: "Основная категория",
      boothType: "Тип стенда",
      message: "Сообщение (необязательно)",
    },
    boothOptions: [
      "Базовый ¥380/год (5 товаров)",
      "Премиум ¥980/год (20 товаров + видео)",
      "Флагман ¥2,880/год (без лимита + VR + приоритет)",
      "Не уверен, свяжитесь со мной",
    ],
    categoryOptions: [
      "Тракторы",
      "Кормоуборочные комбайны",
      "Пресс-подборщики",
      "Жатки",
      "Обмотчики",
      "Грабли / Ворошители",
      "Запчасти",
      "Другая техника",
    ],
    submit: "Отправить заявку",
    submitting: "Отправка...",
    success: "Заявка отправлена! Мы свяжемся с вами в течение 24 часов.",
    error: "Ошибка отправки. Повторите или напишите WhatsApp: +86 15511395016",
    selectPlaceholder: "Выберите",
    selfPublishCta: "Разместите технику — бесплатно и сразу",
    selfPublishDesc: "Без баллов — опубликовали и сразу в сети. Покажите свою технику покупателям по всему миру.",
    selfPublishBtn: "Разместить технику",
    videoShowcase: "Видео реальной работы WingShow",
    showroomShowcase: "Цифровой шоурум — новинки",
    viewAll: "Смотреть всё",
    loading: "Загрузка…",
    noData: "Пока нет материалов",
    playsUnit: "просмотров",
    contactAdvisor: "Или свяжитесь с консультантом: ",
  },
  es: {
    badge: "Maquinaria China · Escenario Global",
    title: "Expo Mundial de Maquinaria Agrícola Siempre Activada",
    subtitle:
      "125 marcas chinas de maquinaria agrícola con modelos insignia en exhibición 365 días al año. De Dongfanghong a DJI, de tractores a drones: la fabricación china llega a los campos del mundo.",
    cta: "Publicar mi maquinaria",
    introTitle: "El Escenario Mundial para la Maquinaria Agrícola China",
    introBody:
      "Las expos tradicionales duran 3 días al año. Nosotros trasladamos la expo online, exhibiendo marcas chinas a compradores globales 24/7/365. El Pabellón de China es el protagonista, el Pabellón Global es la referencia, y la Sala de Comparación ayuda a decidir. Tres pabellones juntos: de la exhibición al cierre. Con matching por IA, custodia transfronteriza y logística internacional, llevamos la maquinaria china a cada campo.",
    featuresTitle: "Características Clave",
    features: [
      { icon: "clock", title: "365 Días Online", desc: "Sin límites de horario: exhibe, actualiza y vende en cualquier momento" },
      { icon: "globe", title: "Alcance Global", desc: "8 idiomas: Asia Central, Europa del Este, Sudeste Asiático, África, Sudamérica" },
      { icon: "bot", title: "Matching IA", desc: "Motor inteligente que conecta demanda con inventario, generando leads de alta intención" },
      { icon: "shield", title: "Custodia Comercial", desc: "Custodia de fondos, informes de inspección, trazabilidad blockchain" },
      { icon: "trending", title: "Basado en Datos", desc: "Índice global de precios, informes de inteligencia de mercado" },
      { icon: "ship", title: "Logística Transfronteriza", desc: "Almacenes en el extranjero + logística puerta a puerta con visibilidad total" },
    ],
    benefitsTitle: "Beneficios del Expositor",
    benefits: [
      "Stand virtual 365 días con exhibición de fotos y video",
      "Motor de matching IA prioriza consultas de alta intención",
      "Páginas de producto en 8 idiomas",
      "Servicio de custodia transfronteriza para fondos seguros",
      "Informes mensuales de inteligencia de mercado",
      "Acceso prioritario a expos presenciales",
      "Unidad de Vicepresidencia — Vice President Unit, Used Farm Machinery Circulation Branch of China Association of Agricultural Machinery Circulation (operación independiente; no es un canal oficial de la asociación)",
      "Descuentos exclusivos en almacenes y logística",
    ],
    formTitle: "Formulario de Consulta",
    formSubtitle: "Complete el formulario y le contactaremos en 24 horas",
    fields: {
      company: "Nombre de la Empresa",
      contact: "Persona de Contacto",
      phone: "Teléfono",
      email: "Email",
      country: "País / Región",
      category: "Categoría Principal",
      boothType: "Tipo de Stand",
      message: "Mensaje (Opcional)",
    },
    boothOptions: [
      "Básico ¥380/año (5 productos)",
      "Premium ¥980/año (20 productos + video)",
      "Insignia ¥2,880/año (ilimitado + VR + prioridad)",
      "No estoy seguro, contáctenme",
    ],
    categoryOptions: [
      "Tractores",
      "Cosechadoras de Forraje",
      "Empacadoras",
      "Cabezales",
      "Envolvedoras",
      "Rastrillos / Volteadores",
      "Repuestos",
      "Otra Maquinaria",
    ],
    submit: "Enviar Solicitud",
    submitting: "Enviando...",
    success: "¡Enviado con éxito! Le contactaremos en 24 horas.",
    error: "Error. Intente de nuevo o contacte Email: jiusei0319@gmail.com",
    selectPlaceholder: "Seleccione",
    selfPublishCta: "Publica tu maquinaria — gratis y en línea",
    selfPublishDesc: "Sin créditos: publica y aparece al instante. Muestra tu maquinaria a compradores de todo el mundo.",
    selfPublishBtn: "Publicar maquinaria gratis",
    videoShowcase: "Vídeos de operación real de WingShow",
    showroomShowcase: "Showroom digital — novedades",
    viewAll: "Ver todo",
    loading: "Cargando…",
    noData: "Aún no hay contenido",
    playsUnit: "reproducciones",
    contactAdvisor: "O contacta a un asesor: ",
  },
  pt: {
    badge: "Máquinas Chinesas · Palco Global",
    title: "Expo Mundial de Maquinário Agrícola Sempre Ativa",
    subtitle:
      "125 marcas chinesas de maquinário agrícola com modelos flagship em exibição 365 dias por ano. De Dongfanghong a DJI, de tratores a drones: a fabricação chinesa chega aos campos do mundo.",
    cta: "Anunciar minha máquina",
    introTitle: "O Palco Mundial para o Maquinário Agrícola Chinês",
    introBody:
      "Feiras tradicionais duram 3 dias por ano. Nós trazemos a feira online, exibindo marcas chinesas a compradores globais 24/7/365. O Pavilhão da China é o protagonista, o Pavilhão Global é a referência, e a Sala de Comparação ajuda na decisão. Três pavilhões juntos: da exibição ao fechamento. Com matching por IA, custódia transfronteiriça e logística internacional, levamos o maquinário chinês a cada campo.",
    featuresTitle: "Destaques Principais",
    features: [
      { icon: "clock", title: "365 Dias Online", desc: "Sem limites de agenda: exiba, atualize e venda a qualquer momento" },
      { icon: "globe", title: "Alcance Global", desc: "8 idiomas: Ásia Central, Europa Oriental, Sudeste Asiático, África, América do Sul" },
      { icon: "bot", title: "Matching IA", desc: "Motor inteligente que conecta demanda com estoque, gerando leads de alta intenção" },
      { icon: "shield", title: "Custódia Comercial", desc: "Custódia de fundos, relatórios de inspeção, rastreabilidade blockchain" },
      { icon: "trending", title: "Orientado a Dados", desc: "Índice global de preços, relatórios de inteligência de mercado" },
      { icon: "ship", title: "Logística Transfronteiriça", desc: "Armazéns no exterior + logística porta a porta com visibilidade total" },
    ],
    benefitsTitle: "Benefícios do Expositor",
    benefits: [
      "Estande virtual 365 dias com exibição de fotos e vídeo",
      "Motor de matching IA prioriza consultas de alta intenção",
      "Páginas de produto em 8 idiomas",
      "Serviço de custódia transfronteiriça para fundos seguros",
      "Relatórios mensais de inteligência de mercado",
      "Acesso prioritário a feiras presenciais",
      "Unidade de Vice-Presidência — Vice President Unit, Used Farm Machinery Circulation Branch of China Association of Agricultural Machinery Circulation (operação independente; não é um canal oficial da associação)",
      "Descontos exclusivos em armazéns e logística",
    ],
    formTitle: "Formulário de Consulta",
    formSubtitle: "Preencha o formulário e entraremos em contato em 24 horas",
    fields: {
      company: "Nome da Empresa",
      contact: "Pessoa de Contato",
      phone: "Telefone",
      email: "Email",
      country: "País / Região",
      category: "Categoria Principal",
      boothType: "Tipo de Estande",
      message: "Mensagem (Opcional)",
    },
    boothOptions: [
      "Básico ¥380/ano (5 produtos)",
      "Premium ¥980/ano (20 produtos + vídeo)",
      "Flagship ¥2,880/ano (ilimitado + VR + prioridade)",
      "Não tenho certeza, entre em contato",
    ],
    categoryOptions: [
      "Tratores",
      "Colhedoras de Forragem",
      "Enfardadoras",
      "Cabeçotes",
      "Envolvedoras",
      "Ancinhos / Volteadores",
      "Peças",
      "Outros Equipamentos",
    ],
    submit: "Enviar Solicitação",
    submitting: "Enviando...",
    success: "Enviado com sucesso! Entraremos em contato em 24 horas.",
    error: "Erro. Tente novamente ou contate WhatsApp: +86 15511395016",
    selectPlaceholder: "Selecione",
    selfPublishCta: "Anuncie sua máquina — grátis e online",
    selfPublishDesc: "Sem créditos: anuncie e apareça na hora. Mostre sua máquina a compradores do mundo todo.",
    selfPublishBtn: "Anunciar máquina grátis",
    videoShowcase: "Vídeos de operação real da WingShow",
    showroomShowcase: "Showroom digital — novidades",
    viewAll: "Ver tudo",
    loading: "Carregando…",
    noData: "Sem conteúdo ainda",
    playsUnit: "reproduções",
    contactAdvisor: "Ou fale com um consultor: ",
  },
  ar: {
    badge: "الآلات الصينية · منصة عالمية",
    title: "المعرض العالمي الدائم للآلات الزراعية",
    subtitle:
      "125 علامة تجارية صينية للآلات الزراعية مع نماذج رئيسية معروضة 365 يوماً في السنة. من دونغفانغ هونغ إلى DJI، من الجرارات إلى الطائرات المسيرة: التصنيع الصيني يصل إلى حقول العالم.",
    cta: "انشر آلتك الزراعية",
    introTitle: "المنصة العالمية للآلات الزراعية الصينية",
    introBody:
      "المعارض التقليدية تستمر 3 أيام في السنة. نحن ننقل المعرض إلى الإنترنت، نعرض العلامات التجارية الصينية للمشترين العالميين 24/7/365. الجناح الصيني هو البطل الرئيسي، الجناح العالمي هو المرجع، وقاعة المقارنة تساعد في اتخاذ القرار. ثلاثة أجنحة معاً: من العرض إلى الصفقة. مع المطابقة بالذكاء الاصطناعي والحضانة المالية واللوجستيات الدولية.",
    featuresTitle: "المزايا الرئيسية",
    features: [
      { icon: "clock", title: "365 يوماً عبر الإنترنت", desc: "بدون قيود جدول: اعرض وحدّث وبِع في أي وقت" },
      { icon: "globe", title: "وصول عالمي", desc: "8 لغات: آسيا الوسطى، أوروبا الشرقية، جنوب شرق آسيا، أفريقيا، أمريكا الجنوبية" },
      { icon: "bot", title: "مطابقة بالذكاء الاصطناعي", desc: "محرك ذكي يطابق الطلب مع المخزون، يولّد عملاء محتملين عالي النية" },
      { icon: "shield", title: "حضانة تجارية", desc: "حضانة الأموال، تقارير الفحص، تتبع البلوك تشين" },
      { icon: "trending", title: "مدفوع بالبيانات", desc: "مؤشر الأسعار العالمي، تقارير استخبارات السوق" },
      { icon: "ship", title: "لوجستيات عابرة للحدود", desc: "مستودعات خارجية + لوجستيات من الباب إلى الباب" },
    ],
    benefitsTitle: "مزايا العارض",
    benefits: [
      "جناح افتراضي 365 يوماً مع عرض الصور والفيديو",
      "محرك المطابقة بالذكاء الاصطناعي يعطي الأولوية للاستفسارات عالية النية",
      "صفحات المنتج بـ 8 لغات",
      "خدمة حضانة عابرة للحدود لحماية الأموال",
      "تقارير شهرية لاستخبارات السوق",
      "وصول أولوي للمعارض الحضورية",
      "وحدة نائب الرئيس — Vice President Unit, Used Farm Machinery Circulation Branch of China Association of Agricultural Machinery Circulation (تشغيل مستقل؛ ليست قناة رسمية للجمعية)",
      "خصومات حصرية على المستودعات واللوجستيات",
    ],
    formTitle: "نموذج الاستفسار",
    formSubtitle: "املأ النموذج وسنتواصل معك خلال 24 ساعة",
    fields: {
      company: "اسم الشركة",
      contact: "شخص الاتصال",
      phone: "الهاتف",
      email: "البريد الإلكتروني",
      country: "الدولة / المنطقة",
      category: "الفئة الرئيسية",
      boothType: "نوع الجناح",
      message: "رسالة (اختياري)",
    },
    boothOptions: [
      "أساسي ¥380/سنة (5 منتجات)",
      "مميز ¥980/سنة (20 منتج + فيديو)",
      "رائد ¥2,880/سنة (غير محدود + VR + أولوية)",
      "غير متأكد، تواصل معي",
    ],
    categoryOptions: [
      "جرارات",
      "حصادات الأعلاف",
      "آلات الحزم",
      "رؤوس الحصاد",
      "آلات التغليف",
      "مجادب / ناشرات",
      "قطع غيار",
      "آلات أخرى",
    ],
    submit: "إرسال الطلب",
    submitting: "جاري الإرسال...",
    success: "تم الإرسال بنجاح! سنتواصل معك خلال 24 ساعة.",
    error: "فشل الإرسال. حاول مرة أخرى أو تواصل عبر WhatsApp: +86 15511395016",
    selectPlaceholder: "اختر",
    selfPublishCta: "انشر آلتك الزراعية — مجاناً ومباشرة",
    selfPublishDesc: "بدون نقاط: انشر لتظهر فوراً. اعرض آلتك على المشترين حول العالم.",
    selfPublishBtn: "انشر آلتك الزراعية",
    videoShowcase: "فيديوهات التشغيل الحقيقي من WingShow",
    showroomShowcase: "الصالة الرقمية — أحدث الوافدين",
    viewAll: "عرض الكل",
    loading: "جارٍ التحميل…",
    noData: "لا يوجد محتوى بعد",
    playsUnit: "مشاهدة",
    contactAdvisor: "أو تواصل مع مستشار: ",
  },
  fr: {
    badge: "Machinerie Chinoise · Scène Mondiale",
    title: "Expo Mondiale de Machinerie Agricole Toujours Active",
    subtitle:
      "125 marques chinoises de machinerie agricole avec modèles phares en exposition 365 jours par an. De Dongfanghong à DJI, des tracteurs aux drones: la fabrication chinoise atteint les champs du monde.",
    cta: "Publier ma machine",
    introTitle: "La Scène Mondiale pour la Machinerie Agricole Chinoise",
    introBody:
      "Les expos traditionnelles durent 3 jours par an. Nous transférons l'expo en ligne, présentant les marques chinoises aux acheteurs mondiaux 24/7/365. Le Pavillon Chinois est le protagoniste, le Pavillon Global est la référence, et la Salle de Comparaison aide à décider. Trois pavillons ensemble: de l'exposition à la transaction. Avec le matching IA, la séquestre transfrontalière et la logistique internationale.",
    featuresTitle: "Points Forts",
    features: [
      { icon: "clock", title: "365 Jours en Ligne", desc: "Sans limites d'horaire: exposez, mettez à jour, vendez à tout moment" },
      { icon: "globe", title: "Portée Mondiale", desc: "8 langues: Asie Centrale, Europe de l'Est, Asie du Sud-Est, Afrique, Amérique du Sud" },
      { icon: "bot", title: "Matching IA", desc: "Moteur intelligent connectant demande et stock, générant des leads qualifiés" },
      { icon: "shield", title: "Séquestre Commerciale", desc: "Custodie des fonds, rapports d'inspection, traçabilité blockchain" },
      { icon: "trending", title: "Piloté par les Données", desc: "Indice mondial des prix, rapports d'intelligence marché" },
      { icon: "ship", title: "Logistique Transfrontalière", desc: "Entrepôts à l'étranger + logistique porte à porte avec visibilité totale" },
    ],
    benefitsTitle: "Avantages de l'Exposant",
    benefits: [
      "Stand virtuel 365 jours avec exposition photos et vidéo",
      "Moteur de matching IA priorise les demandes qualifiées",
      "Pages produit en 8 langues",
      "Service de séquestre transfrontalière pour fonds sécurisés",
      "Rapports mensuels d'intelligence marché",
      "Accès prioritaire aux expos physiques",
      "Unité de vice-présidence — Vice President Unit, Used Farm Machinery Circulation Branch of China Association of Agricultural Machinery Circulation (exploitation indépendante ; pas un canal officiel de l'association)",
      "Remises exclusives sur entrepôts et logistique",
    ],
    formTitle: "Formulaire de Demande",
    formSubtitle: "Remplissez le formulaire et nous vous contacterons sous 24 heures",
    fields: {
      company: "Nom de l'Entreprise",
      contact: "Personne de Contact",
      phone: "Téléphone",
      email: "Email",
      country: "Pays / Région",
      category: "Catégorie Principale",
      boothType: "Type de Stand",
      message: "Message (Optionnel)",
    },
    boothOptions: [
      "Basique ¥380/an (5 produits)",
      "Premium ¥980/an (20 produits + vidéo)",
      "Phare ¥2,880/an (illimité + VR + priorité)",
      "Pas sûr, contactez-moi",
    ],
    categoryOptions: [
      "Tracteurs",
      "Récolteuses d'Ensilage",
      "Presse à Balles",
      "Têtes de Récolte",
      "Enrubanneuses",
      "Râteaux / Faneuses",
      "Pièces",
      "Autre Machinerie",
    ],
    submit: "Envoyer la Demande",
    submitting: "Envoi...",
    success: "Envoyé avec succès! Nous vous contacterons sous 24 heures.",
    error: "Échec de l'envoi. Réessayez ou contactez Email: jiusei0319@gmail.com",
    selectPlaceholder: "Sélectionner",
    selfPublishCta: "Publiez votre machine — gratuit et en ligne",
    selfPublishDesc: "Sans crédits : publiez et c'est en ligne. Présentez votre machine aux acheteurs du monde entier.",
    selfPublishBtn: "Publier ma machine gratuitement",
    videoShowcase: "Vidéos d'opération réelle WingShow",
    showroomShowcase: "Showroom numérique — nouveautés",
    viewAll: "Tout voir",
    loading: "Chargement…",
    noData: "Aucun contenu pour le moment",
    playsUnit: "lectures",
    contactAdvisor: "Ou contactez un conseiller : ",
  },
  hi: {
    badge: "चीनी मशीनरी · वैश्विक मंच",
    title: "हमेशा चालू विश्व कृषि मशीनरी एक्सपो",
    subtitle:
      "125 चीनी कृषि मशीनरी ब्रांड 365 दिनों तक फ्लैगशिप मॉडल प्रदर्शित। डोंगफांगहोंग से DJI तक, ट्रैक्टर से ड्रोन तक — चीनी निर्माण दुनिया के खेतों तक।",
    cta: "अपनी मशीन प्रकाशित करें",
    introTitle: "चीनी कृषि मशीनरी के लिए विश्व मंच",
    introBody:
      "पारंपरिक एक्सपो साल में 3 दिन चलते हैं। हम एक्सपो को ऑनलाइन लाते हैं, चीनी ब्रांड्स को वैश्विक खरीदारों के लिए 24/7/365 प्रदर्शित करते हैं। चाइना पविलियन मुख्य कलाकार है, ग्लोबल पविलियन संदर्भ है, और तुलना हॉल निर्णय में मदद करता है। तीन पविलियन मिलकर: प्रदर्शन से डील तक। AI मैचिंग, क्रॉस-बॉर्डर एस्क्रो और अंतरराष्ट्रीय रसद के साथ।",
    featuresTitle: "मुख्य विशेषताएं",
    features: [
      { icon: "clock", title: "365 दिन ऑनलाइन", desc: "शेड्यूल की कोई सीमा नहीं — कभी भी प्रदर्शित करें, अपडेट करें, बेचें" },
      { icon: "globe", title: "वैश्विक पहुंच", desc: "8 भाषाएं: मध्य एशिया, पूर्वी यूरोप, दक्षिण पूर्व एशिया, अफ्रीका, दक्षिण अमेरिका" },
      { icon: "bot", title: "AI मैचिंग", desc: "स्मार्ट इंजन मांग को इन्वेंट्री से जोड़ता है, उच्च-इरादा लीड्स भेजता है" },
      { icon: "shield", title: "एस्क्रो सुरक्षा", desc: "फंड कस्टडी, निरीक्षण रिपोर्ट, ब्लॉकचेन ट्रेसबिलिटी" },
      { icon: "trending", title: "डेटा-संचालित", desc: "वैश्विक मूल्य सूचकांक, बाजार खुफिया रिपोर्टें" },
      { icon: "ship", title: "क्रॉस-बॉर्डर रसद", desc: "विदेशी गोदाम + दरवाजे से दरवाजे रसद, पूर्ण दृश्यता" },
    ],
    benefitsTitle: "प्रदर्शक लाभ",
    benefits: [
      "365-दिन वर्चुअल बूथ, फोटो + वीडियो प्रदर्शन के साथ",
      "AI मैचिंग इंजन उच्च-इरादा खरीदार पूछताछ को प्राथमिकता देता है",
      "8 भाषाओं में उत्पाद विवरण पृष्ठ",
      "सुरक्षित फंड सुरक्षा के लिए क्रॉस-बॉर्डर एस्क्रो सेवा",
      "मासिक बाजार खुफिया रिपोर्टें",
      "ऑफलाइन फील्ड एक्सपो में प्राथमिकता पहुंच",
      "उपाध्यक्ष इकाई — Vice President Unit, Used Farm Machinery Circulation Branch of China Association of Agricultural Machinery Circulation (स्वतंत्र संचालन; संघ का आधिकारिक चैनल नहीं)",
      "गोदाम और रसद पर विशेष छूट",
    ],
    formTitle: "पूछताछ फॉर्म",
    formSubtitle: "फॉर्म भरें और हम 24 घंटे में संपर्क करेंगे",
    fields: {
      company: "कंपनी का नाम",
      contact: "संपर्क व्यक्ति",
      phone: "फोन नंबर",
      email: "ईमेल",
      country: "देश / क्षेत्र",
      category: "मुख्य श्रेणी",
      boothType: "बूथ प्रकार",
      message: "संदेश (वैकल्पिक)",
    },
    boothOptions: [
      "बेसिक ¥380/वर्ष (5 उत्पाद)",
      "प्रीमियम ¥980/वर्ष (20 उत्पाद + वीडियो)",
      "फ्लैगशिप ¥2,880/वर्ष (असीमित + VR + प्राथमिकता)",
      "निश्चित नहीं, मुझसे संपर्क करें",
    ],
    categoryOptions: [
      "ट्रैक्टर",
      "चारा कटाई मशीन",
      "बेलर",
      "हेडर / पिकअप हेड",
      "बेल रैपर",
      "रेक / टेडर",
      "पार्ट्स",
      "अन्य मशीनरी",
    ],
    submit: "आवेदन भेजें",
    submitting: "भेजा जा रहा है...",
    success: "सफलतापूर्वक भेजा गया! हम 24 घंटे में संपर्क करेंगे।",
    error: "भेजना विफल। पुनः प्रयास करें या WhatsApp: +86 15511395016 पर संपर्क करें",
    selectPlaceholder: "चुनें",
    selfPublishCta: "अपनी मशीन प्रकाशित करें — मुफ़्त और लाइव",
    selfPublishDesc: "क्रेडिट की ज़रूरत नहीं — प्रकाशित करें और तुरंत लाइव। अपनी मशीन विश्वभर के खरीदारों को दिखाएँ।",
    selfPublishBtn: "मुफ़्त में मशीन प्रकाशित करें",
    videoShowcase: "WingShow वास्तविक कार्य वीडियो",
    showroomShowcase: "डिजिटल शोरूम — नई आमद",
    viewAll: "सभी देखें",
    loading: "लोड हो रहा है…",
    noData: "अभी कोई सामग्री नहीं",
    playsUnit: "बार देखा गया",
    contactAdvisor: "या सलाहकार से संपर्क करें: ",
  },
};

// .com 全球叙事覆盖：仅 .com 生效，主语从"中国农机"切换为"全球农机"；
// .cn 保留中国供给端叙事（沿用 TEXTS[locale]）。两站共用母品牌名 Shendiao Agri-Machinery Expo™。
const GLOBAL_NARRATIVE: Record<
  string,
  { badge: string; title: string; subtitle: string; introTitle: string; introBody: string }
> = {
  zh: {
    badge: "全球农机博览会 · 让全球农机走向世界",
    title: "永不落幕的全球农机博览会",
    subtitle:
      "全球农机品牌 365 天在线展示，从约翰迪尔到大疆，从拖拉机到植保无人机——汇聚全球供给，服务全球买家。",
    introTitle: "全球农机的世界舞台",
    introBody:
      "传统展会一年 3 天，错过等一年。我们把展会搬到线上，让全球农机品牌 365 天 24 小时向全球买家展示。全球领袖馆为旗舰，中国中坚馆为核心供给，新锐专业馆为补充——三馆联动，按品牌全球影响力客观分级。结合 AI 供需匹配、跨境交易担保与国际物流，让全球农机走向每一块农田。",
  },
  en: {
    badge: "Global Agri-Machinery Expo — The World's Farm Machinery, Connected",
    title: "The Always-On Global Agri-Machinery Expo",
    subtitle:
      "Verified machinery brands from China and beyond, on display 365 days a year — from John Deere to DJI, from tractors to drones. A global supply meeting global buyers.",
    introTitle: "A Global Stage for the World's Farm Machinery",
    introBody:
      "Traditional expos last 3 days a year — miss it and wait another year. We bring the expo online, showcasing verified machinery brands from around the world to international buyers 24/7/365. The Global Leaders Hall is the flagship, the China Backbone Hall is the core supply mix, and the Rising Innovators Hall is the curated supplement — three halls working together, tiered objectively by global brand influence. Combined with AI matching, cross-border escrow, and international logistics, we bring the world's farm machinery to every field.",
  },
};

const FEATURE_ICONS: Record<string, any> = {
  clock: Clock,
  globe: Globe2,
  bot: Bot,
  shield: ShieldCheck,
  trending: TrendingUp,
  ship: Ship,
};

/** 首屏数据条（仅 zh/en 本地化，其余语种回退英文） */
const STATS_LABELS: Record<string, { brands: string; items: string; langs: string; online: string }> = {
  zh: { brands: "品牌展位", items: "在展农机", langs: "语言覆盖", online: "全年在线·天" },
  en: { brands: "Brand booths", items: "Machines on display", langs: "Languages", online: "Days online / yr" },
};

interface ExpoVideo {
  id: string;
  url?: string;
  brandName: string;
  machineType: string;
  playCount?: number;
}

export function ExpoLanding({ locale }: ExpoLandingProps) {
  const cn = isCnSite();
  const base = TEXTS[locale] || TEXTS.zh;
  const narrative = cn ? null : GLOBAL_NARRATIVE[locale] || GLOBAL_NARRATIVE.en;
  const t = narrative ? { ...base, ...narrative } : base;
  const expoTitle = cn && locale === "zh" ? "神雕农机展™——中国农机的世界舞台" : t.title;
  const isZh = locale === "zh";

  const [videos, setVideos] = useState<ExpoVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/field-videos/list")
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.success) setVideos(d.videos || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setVideosLoading(false);
      });
    fetch("/api/expo/showroom?itemType=new&limit=8")
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d?.items)) setItems(d.items);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setItemsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // ── 站点主题：.cn 中国供给叙事（暖色） / .com 全球叙事（国际色） ──
  const S = cn
    ? {
        heroBg: "bg-gradient-to-br from-red-50 via-amber-50 to-yellow-50",
        blob1: "bg-red-300",
        blob2: "bg-amber-300",
        badge: "bg-red-100 text-red-700",
        dot: "bg-red-500",
        cta: "bg-red-600 hover:bg-red-700",
        ctaOutline: "border-red-600 text-red-700 hover:bg-red-50",
        accentText: "text-red-600",
        accentBg: "bg-red-600",
        softBg: "bg-red-50",
      }
    : {
        heroBg: "bg-gradient-to-br from-slate-50 via-sky-50 to-emerald-50",
        blob1: "bg-sky-300",
        blob2: "bg-emerald-300",
        badge: "bg-emerald-100 text-emerald-700",
        dot: "bg-emerald-500",
        cta: "bg-emerald-600 hover:bg-emerald-700",
        ctaOutline: "border-emerald-600 text-emerald-700 hover:bg-emerald-50",
        accentText: "text-emerald-600",
        accentBg: "bg-emerald-600",
        softBg: "bg-emerald-50",
      };

  const statLabels = STATS_LABELS[locale] || STATS_LABELS.en;
  const stats = [
    { n: "125", l: statLabels.brands },
    { n: "187", l: statLabels.items },
    { n: "8", l: statLabels.langs },
    { n: "365", l: statLabels.online },
  ];

  // 视频封面：用阿里云 OSS 截图接口从视频生成封面图（t=1000ms）
  const posterOf = (url?: string) =>
    url ? `${url}${url.includes("?") ? "&" : "?"}x-oss-process=video/snapshot,t_1000,f_jpg,w_800` : undefined;

  return (
    <div className="min-h-screen bg-white">
      {/* ===== Hero ===== */}
      <section className={`relative overflow-hidden ${S.heroBg}`}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.14]">
          <div className={`absolute -top-10 left-1/4 h-56 w-56 rounded-full blur-3xl ${S.blob1}`} />
          <div className={`absolute bottom-0 right-1/4 h-72 w-72 rounded-full blur-3xl ${S.blob2}`} />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-14 text-center sm:px-6 md:pt-28 lg:px-8">
          <div className={`mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${S.badge}`}>
            <span className={`flex h-2 w-2 animate-pulse rounded-full ${S.dot}`} />
            {t.badge}
          </div>
          <h1 className="mx-auto mb-6 max-w-4xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            {expoTitle}
          </h1>
          <p className="mx-auto mb-9 max-w-3xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            {t.subtitle}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={`/${locale}/seller/products/new`}>
              <Button size="lg" className={`w-full text-white sm:w-auto ${S.cta}`}>
                {t.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/${locale}/expo/showroom`}>
              <Button size="lg" variant="outline" className={`w-full bg-white/60 sm:w-auto ${S.ctaOutline}`}>
                {isZh ? "进入线上展厅" : locale === "ru" ? "Войти в шоурум" : "Enter Showroom"}
              </Button>
            </Link>
          </div>

          {/* Stat strip */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.l} className="rounded-2xl border border-white/70 bg-white/70 px-4 py-5 backdrop-blur">
                <div className={`text-3xl font-extrabold ${S.accentText}`}>{s.n}</div>
                <div className="mt-1 text-xs font-medium text-gray-500">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Introduction ===== */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="mb-5 text-3xl font-bold text-gray-900">{t.introTitle}</h2>
        <p className="text-lg leading-relaxed text-gray-600">{t.introBody}</p>
      </section>

      {/* ===== Three Pavilions Entry (value-tiered, not nationality-based) ===== */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Global Leaders Hall */}
            <Link
              href={`/${locale}/expo/global-brands`}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]"
            >
              <div className="absolute top-4 right-4 text-6xl opacity-20">🏆</div>
              <h3 className="mb-2 text-2xl font-bold">
                {isZh ? "全球领袖馆" : locale === "ru" ? "Зал мировых лидеров" : "Global Leaders Hall"}
              </h3>
              <p className="text-sm text-red-100">
                {isZh
                  ? "12+全球农机巨头：John Deere、CLAAS、Fendt、久保田、科罗尼——全球行业NO.1品牌标志机型"
                  : locale === "ru"
                    ? "12+ ведущих мировых брендов: John Deere, CLAAS, Fendt, Kubota, Krone"
                    : "12+ global giants: John Deere, CLAAS, Fendt, Kubota, Krone"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {isZh ? "进入领袖馆" : locale === "ru" ? "Войти" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* China Backbone Hall */}
            <Link
              href={`/${locale}/expo/china-brands`}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]"
            >
              <div className="absolute top-4 right-4 text-6xl opacity-20">🏭</div>
              <h3 className="mb-2 text-2xl font-bold">
                {isZh ? "中国中坚馆" : locale === "ru" ? "Зал отраслевых лидеров" : "China Backbone Hall"}
              </h3>
              <p className="text-sm text-amber-100">
                {isZh
                  ? "东方红YTO、雷沃、沃得、中联、马恒达等行业腰部品牌，对标全球的强者"
                  : locale === "ru"
                    ? "YTO, Lovol, World, Zoomlion, Mahindra — крупные региональные игроки"
                    : "YTO, Lovol, World, Zoomlion, Mahindra — proven China-based suppliers"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {isZh ? "进入中坚馆" : locale === "ru" ? "Войти" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Rising Innovators Hall */}
            <Link
              href={`/${locale}/expo/showroom?pavilion=rising_specialty`}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]"
            >
              <div className="absolute top-4 right-4 text-6xl opacity-20">🚀</div>
              <h3 className="mb-2 text-2xl font-bold">
                {isZh ? "新锐专业馆" : locale === "ru" ? "Зал новых брендов" : "Rising Innovators Hall"}
              </h3>
              <p className="text-sm text-blue-100">
                {isZh
                  ? "大疆农业、极飞科技、专业细分品牌、新锐国货——按品类精挑细选"
                  : locale === "ru"
                    ? "DJI, XAG, профильные бренды и нишевые игроки"
                    : "DJI, XAG, specialty brands & niche players"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {isZh ? "进入新锐馆" : locale === "ru" ? "Войти" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Key Highlights ===== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">{t.featuresTitle}</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map((f) => {
            const Icon = FEATURE_ICONS[f.icon] || Sparkles;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-white ${S.accentBg}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== A. WingShow field-operation videos (cover image + playable) ===== */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{t.videoShowcase}</h2>
              <p className="mt-2 text-sm text-gray-500">
                {isZh
                  ? "真机下地实拍 · 为每一台展机提供可核验的工况证据 · 持续更新"
                  : "Real field-operation footage — verifiable proof for every machine, updated continuously"}
              </p>
            </div>
            <Link
              href={`/${locale}/expo/field-videos`}
              className={`shrink-0 text-sm font-medium hover:underline ${S.accentText}`}
            >
              {t.viewAll} <ArrowRight className="ml-1 inline h-4 w-4" />
            </Link>
          </div>
          {videosLoading ? (
            <p className="text-gray-500">{t.loading}</p>
          ) : videos.length === 0 ? (
            <p className="text-gray-500">{t.noData}</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.slice(0, 6).map((v) => (
                <div
                  key={v.id}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-xl"
                >
                  <div className="relative aspect-video bg-gray-900">
                    <video
                      src={v.url}
                      controls
                      preload="metadata"
                      playsInline
                      poster={posterOf(v.url)}
                      className="h-full w-full object-cover"
                    />
                    <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-xs text-white">
                      {v.playCount ?? 0} {t.playsUnit}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-1 font-semibold text-gray-900">{v.brandName}</p>
                    <p className="mt-1 text-sm text-gray-500">{v.machineType}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== B. Digital showroom showcase ===== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-3xl font-bold text-gray-900">{t.showroomShowcase}</h2>
          <Link href={`/${locale}/expo/showroom`} className={`text-sm font-medium hover:underline ${S.accentText}`}>
            {t.viewAll} <ArrowRight className="ml-1 inline h-4 w-4" />
          </Link>
        </div>
        {itemsLoading ? (
          <p className="text-gray-500">{t.loading}</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500">{t.noData}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.slice(0, 8).map((it) => (
              <Link
                key={it.id}
                href={`/${locale}/expo/showroom/${it.id}`}
                className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-lg"
              >
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-gray-100">
                  {it.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.coverImage}
                      alt={`${it.brand || ""} ${it.model || ""}`.trim() || it.deviceType || ""}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-4xl">🚜</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-medium text-gray-900">
                    {`${it.brand || ""} ${it.model || ""}`.trim() || it.deviceType}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ===== Closing CTA ===== */}
      <section className={`${S.softBg} py-16`}>
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-3 text-3xl font-bold text-gray-900">{t.selfPublishCta}</h2>
          <p className="mx-auto mb-8 max-w-2xl text-gray-600">{t.selfPublishDesc}</p>
          <Link href={`/${locale}/seller/products/new`}>
            <Button size="lg" className={`text-white ${S.cta}`}>
              {t.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-8 text-sm text-gray-500">
            {t.contactAdvisor}
            <a href="mailto:jiusei0319@gmail.com" className={`hover:underline ${S.accentText}`}>
              jiusei0319@gmail.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
