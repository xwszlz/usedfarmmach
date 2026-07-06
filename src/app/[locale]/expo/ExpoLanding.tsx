"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Globe,
  Clock,
  TrendingUp,
  Shield,
  Bot,
  Ship,
  CheckCircle2,
  ArrowRight,
  Send,
  Loader2,
} from "lucide-react";

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
}> = {
  zh: {
    badge: "中国农机 · 走向世界",
    title: "永不落幕的农机世界展会",
    subtitle:
      "42个中国农机品牌旗舰机型365天在线展示，从东方红到大疆，从拖拉机到植保无人机，让中国制造走向全球田间。",
    cta: "立即申请参展",
    introTitle: "中国农机的世界舞台",
    introBody:
      "传统展会一年3天，错过等一年。我们将展会搬到线上，让中国农机品牌365天24小时向全球买家展示。中国品牌馆为主角，国际标杆馆为参照，品类对比厅为决策助手——三馆联动，从展示到成交的完整闭环。结合AI供需匹配、跨境交易担保和国际物流服务，让中国农机走向一带一路每一个田间。",
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
      "CAMDA二手农机分会会员推荐通道",
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
      "基础展位 ¥3,800/年（5款产品展示）",
      "优选展位 ¥9,800/年（20款产品+视频展示）",
      "旗舰展位 ¥28,800/年（不限量+VR展厅+优先推荐）",
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
  },
  en: {
    badge: "Chinese Machinery · Global Stage",
    title: "The Always-On Global Farm Machinery Expo",
    subtitle:
      "42 Chinese farm machinery brands with flagship models on display 365 days a year. From Dongfanghong to DJI, from tractors to drones — bringing Chinese manufacturing to fields worldwide.",
    cta: "Apply to Exhibit",
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
      "CAMDA Used Machinery Chapter member referral channel",
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
      "Basic ¥3,800/yr (5 products)",
      "Premium ¥9,800/yr (20 products + video)",
      "Flagship ¥28,800/yr (unlimited + VR + priority)",
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
    error: "Submission failed. Please try again or contact WhatsApp: +86 15511395016",
    selectPlaceholder: "Please select",
  },
  ru: {
    badge: "Китайская техника · Мировая сцена",
    title: "Всемирная выставка сельхозтехники без выходных",
    subtitle:
      "42 китайских бренда сельхозтехники на витрине 365 дней в году. От Dongfanghong до DJI, от тракторов до дронов — китайское производство для полей всего мира.",
    cta: "Подать заявку",
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
      "Канал рекомендаций в CAMDA",
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
      "Базовый ¥3,800/год (5 товаров)",
      "Премиум ¥9,800/год (20 товаров + видео)",
      "Флагман ¥28,800/год (без лимита + VR + приоритет)",
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
  },
  es: {
    badge: "Maquinaria China · Escenario Global",
    title: "Expo Mundial de Maquinaria Agrícola Siempre Activada",
    subtitle:
      "42 marcas chinas de maquinaria agrícola con modelos insignia en exhibición 365 días al año. De Dongfanghong a DJI, de tractores a drones: la fabricación china llega a los campos del mundo.",
    cta: "Solicitar Participación",
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
      "Canal de recomendación CAMDA",
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
      "Básico ¥3,800/año (5 productos)",
      "Premium ¥9,800/año (20 productos + video)",
      "Insignia ¥28,800/año (ilimitado + VR + prioridad)",
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
    error: "Error. Intente de nuevo o contacte WhatsApp: +86 15511395016",
    selectPlaceholder: "Seleccione",
  },
  pt: {
    badge: "Máquinas Chinesas · Palco Global",
    title: "Expo Mundial de Maquinário Agrícola Sempre Ativa",
    subtitle:
      "42 marcas chinesas de maquinário agrícola com modelos flagship em exibição 365 dias por ano. De Dongfanghong a DJI, de tratores a drones: a fabricação chinesa chega aos campos do mundo.",
    cta: "Solicitar Participação",
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
      "Canal de indicação CAMDA",
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
      "Básico ¥3,800/ano (5 produtos)",
      "Premium ¥9,800/ano (20 produtos + vídeo)",
      "Flagship ¥28,800/ano (ilimitado + VR + prioridade)",
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
  },
  ar: {
    badge: "الآلات الصينية · منصة عالمية",
    title: "المعرض العالمي الدائم للآلات الزراعية",
    subtitle:
      "42 علامة تجارية صينية للآلات الزراعية مع نماذج رئيسية معروضة 365 يوماً في السنة. من دونغفانغ هونغ إلى DJI، من الجرارات إلى الطائرات المسيرة: التصنيع الصيني يصل إلى حقول العالم.",
    cta: "تقديم طلب المشاركة",
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
      "قناة توصية CAMDA",
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
      "أساسي ¥3,800/سنة (5 منتجات)",
      "مميز ¥9,800/سنة (20 منتج + فيديو)",
      "رائد ¥28,800/سنة (غير محدود + VR + أولوية)",
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
  },
  fr: {
    badge: "Machinerie Chinoise · Scène Mondiale",
    title: "Expo Mondiale de Machinerie Agricole Toujours Active",
    subtitle:
      "42 marques chinoises de machinerie agricole avec modèles phares en exposition 365 jours par an. De Dongfanghong à DJI, des tracteurs aux drones: la fabrication chinoise atteint les champs du monde.",
    cta: "Demander à Participer",
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
      "Canal de recommandation CAMDA",
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
      "Basique ¥3,800/an (5 produits)",
      "Premium ¥9,800/an (20 produits + vidéo)",
      "Phare ¥28,800/an (illimité + VR + priorité)",
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
    error: "Échec de l'envoi. Réessayez ou contactez WhatsApp: +86 15511395016",
    selectPlaceholder: "Sélectionner",
  },
  hi: {
    badge: "चीनी मशीनरी · वैश्विक मंच",
    title: "हमेशा चालू विश्व कृषि मशीनरी एक्सपो",
    subtitle:
      "42 चीनी कृषि मशीनरी ब्रांड 365 दिनों तक फ्लैगशिप मॉडल प्रदर्शित। डोंगफांगहोंग से DJI तक, ट्रैक्टर से ड्रोन तक — चीनी निर्माण दुनिया के खेतों तक।",
    cta: "भाग लेने के लिए आवेदन करें",
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
      "CAMDA सदस्य रेफरल चैनल",
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
      "बेसिक ¥3,800/वर्ष (5 उत्पाद)",
      "प्रीमियम ¥9,800/वर्ष (20 उत्पाद + वीडियो)",
      "फ्लैगशिप ¥28,800/वर्ष (असीमित + VR + प्राथमिकता)",
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
  },
};

const ICON_MAP: Record<string, React.ReactNode> = {
  clock: <Clock className="h-8 w-8 text-primary-600" />,
  globe: <Globe className="h-8 w-8 text-primary-600" />,
  bot: <Bot className="h-8 w-8 text-primary-600" />,
  shield: <Shield className="h-8 w-8 text-primary-600" />,
  trending: <TrendingUp className="h-8 w-8 text-primary-600" />,
  ship: <Ship className="h-8 w-8 text-primary-600" />,
};

export function ExpoLanding({ locale }: ExpoLandingProps) {
  const t = TEXTS[locale] || TEXTS.zh;
  const [formData, setFormData] = useState({
    company: "",
    contact: "",
    phone: "",
    email: "",
    country: "",
    category: "",
    boothType: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/expo/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, locale }),
      });
      if (!res.ok) throw new Error("submit failed");
      setStatus("success");
      setFormData({
        company: "",
        contact: "",
        phone: "",
        email: "",
        country: "",
        category: "",
        boothType: "",
        message: "",
      });
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-50 via-amber-50 to-yellow-50">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 h-40 w-40 rounded-full bg-red-300 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-60 w-60 rounded-full bg-amber-300 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 md:py-28 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-1.5 text-sm font-medium text-red-700">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {t.badge}
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            {t.title}
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-lg text-gray-600 sm:text-xl">
            {t.subtitle}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#inquiry-form">
              <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 sm:w-auto">
                {t.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <Link href={`/${locale}/expo/showroom`}>
              <Button size="lg" variant="outline" className="w-full border-red-600 text-red-700 hover:bg-red-50 sm:w-auto">
                {locale === "zh" ? "进入线上展厅" : locale === "ru" ? "Войти в шоурум" : "Enter Showroom"}
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {locale === "zh" ? "98台中外精品农机在线展示" : locale === "ru" ? "98 китайских и мировых машин" : "98 Chinese & global machines on display"}
            </div>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-3xl font-bold text-gray-900">{t.introTitle}</h2>
        <p className="text-lg leading-relaxed text-gray-600">{t.introBody}</p>
      </section>

      {/* Three Pavilions Entry */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* China Pavilion */}
            <Link
              href={`/${locale}/expo/china-brands`}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]"
            >
              <div className="absolute top-4 right-4 text-6xl opacity-20">🇨🇳</div>
              <h3 className="mb-2 text-2xl font-bold">
                {locale === "zh" ? "中国品牌馆" : locale === "ru" ? "Китайский зал" : "China Pavilion"}
              </h3>
              <p className="text-sm text-red-100">
                {locale === "zh"
                  ? "32+中国农机品牌旗舰机型，从东方红、雷沃到沃得、中联、大疆"
                  : locale === "ru"
                    ? "32+ китайских брендов: от Dongfanghong до DJI"
                    : "32+ Chinese brands: Dongfanghong, Lovol, World, Zoomlion, DJI"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {locale === "zh" ? "进入中国馆" : locale === "ru" ? "Войти" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Global Pavilion */}
            <Link
              href={`/${locale}/expo/global-brands`}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]"
            >
              <div className="absolute top-4 right-4 text-6xl opacity-20">🌍</div>
              <h3 className="mb-2 text-2xl font-bold">
                {locale === "zh" ? "国际标杆馆" : locale === "ru" ? "Международный зал" : "Global Pavilion"}
              </h3>
              <p className="text-sm text-amber-100">
                {locale === "zh"
                  ? "John Deere、CLAAS、Fendt等全球知名品牌标杆机型参照对比"
                  : locale === "ru"
                    ? "John Deere, CLAAS, Fendt — мировые эталоны"
                    : "John Deere, CLAAS, Fendt — global benchmarks for comparison"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {locale === "zh" ? "进入国际馆" : locale === "ru" ? "Войти" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Category Comparison */}
            <Link
              href={`/${locale}/expo/compare`}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]"
            >
              <div className="absolute top-4 right-4 text-6xl opacity-20">⚖️</div>
              <h3 className="mb-2 text-2xl font-bold">
                {locale === "zh" ? "品类对比厅" : locale === "ru" ? "Зал сравнения" : "Comparison Hall"}
              </h3>
              <p className="text-sm text-blue-100">
                {locale === "zh"
                  ? "同品类中外机型参数对比，价格性能一目了然"
                  : locale === "ru"
                    ? "Сравнение параметров китайских и мировых моделей"
                    : "Compare Chinese vs global models side by side"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                {locale === "zh" ? "进入对比厅" : locale === "ru" ? "Войти" : "Enter"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">{t.featuresTitle}</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => (
              <Card key={i} className="border-0 shadow-md transition-shadow hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="mb-4">{ICON_MAP[f.icon]}</div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-sm text-gray-600">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center text-3xl font-bold text-gray-900">{t.benefitsTitle}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {t.benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg bg-amber-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <span className="text-sm text-gray-700">{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="bg-gradient-to-r from-red-600 to-amber-600 py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { name: locale === "zh" ? "基础展位" : "Basic", price: "¥3,800", period: locale === "zh" ? "/年" : "/yr", desc: locale === "zh" ? "5款产品展示" : "5 products" },
              { name: locale === "zh" ? "优选展位" : "Premium", price: "¥9,800", period: locale === "zh" ? "/年" : "/yr", desc: locale === "zh" ? "20款产品+视频" : "20 products + video", highlight: true },
              { name: locale === "zh" ? "旗舰展位" : "Flagship", price: "¥28,800", period: locale === "zh" ? "/年" : "/yr", desc: locale === "zh" ? "不限量+VR+优先推荐" : "Unlimited + VR + priority" },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`rounded-xl p-6 text-center ${
                  tier.highlight ? "bg-white/20 ring-2 ring-white" : "bg-white/10"
                }`}
              >
                <h3 className="mb-2 text-lg font-semibold text-white">{tier.name}</h3>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-white">{tier.price}</span>
                  <span className="text-sm text-white/80">{tier.period}</span>
                </div>
                <p className="text-sm text-white/80">{tier.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section id="inquiry-form" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="mb-3 text-3xl font-bold text-gray-900">{t.formTitle}</h2>
          <p className="mb-8 text-gray-600">{t.formSubtitle}</p>
        </div>

        {status === "success" ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium text-green-800">{t.success}</p>
              <Button
                variant="outline"
                onClick={() => setStatus("idle")}
              >
                {locale === "zh" ? "再次提交" : "Submit Another"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.company} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="company"
                      required
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.contact} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="contact"
                      required
                      value={formData.contact}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.phone} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.email}
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.country} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="country"
                      required
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t.fields.category}
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    >
                      <option value="">{t.selectPlaceholder}</option>
                      {t.categoryOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t.fields.boothType}
                  </label>
                  <select
                    name="boothType"
                    value={formData.boothType}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">{t.selectPlaceholder}</option>
                    {t.boothOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t.fields.message}
                  </label>
                  <textarea
                    name="message"
                    rows={3}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  />
                </div>

                {status === "error" && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {t.error}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={status === "submitting"}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.submitting}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {t.submit}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Contact info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            WhatsApp: +86 15511395016 &nbsp;|&nbsp; Email: 932133255@qq.com
          </p>
        </div>
      </section>
    </div>
  );
}
