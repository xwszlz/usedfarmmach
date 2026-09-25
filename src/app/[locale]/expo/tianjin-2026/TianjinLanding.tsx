"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  MapPin,
} from "lucide-react";
import { ExpoInquiryForm } from "@/components/expo/ExpoInquiryForm";
import { TJ_FAQS, pickFaqs } from "@/components/expo/expo-faqs";

/**
 * 2026 中国国际农业机械展览会（天津）· 神雕农机展™ 参展服务专题
 *
 * ⚠️ 事实边界：本届展会的场馆、规模、主办（第三家单位中文全称）、承办等字段尚无官方来源，
 * 页面内一律写「待核实」；官网与展位申报期已由官方《申报说明》核实，按官方口径写实。
 * 页面同样不出现四档价格、不出现"招展"等主办方行为动词；不宣称参展企业身份。
 */

interface TianjinTexts {
  badge: string;
  h1: string;
  sub: string;
  disclaimer: string;
  factsTitle: string;
  facts: { label: string; value: string }[];
  pending: string;
  whyTitle: string;
  why: { title: string; desc: string }[];
  offerTitle: string;
  offers: string[];
  crossTitle: string;
  crossBody: string;
  stepsTitle: string;
  steps: { title: string; desc: string }[];
  faqTitle: string;
  ctaTitle: string;
  ctaSub: string;
  secondaryCta: string;
  sourceTitle: string;
  sourceNote: string;
}

const TEXTS: Record<string, TianjinTexts> = {
  zh: {
    badge: "2026 展会季 · 天津站",
    h1: "2026 中国国际农业机械展览会（10月26–28日 · 天津）｜ 神雕农机展™ 参展服务专题",
    sub: "现场展位 3 天，线上展台 365 天。神雕农机为参展企业开通 8 语种线上展台（神雕云展），把展会三天的曝光延长到一整年。",
    disclaimer: "本页为神雕农机自有服务，非本届展会官方网站；展会信息以主办方公告为准。",
    factsTitle: "展会基本信息",
    facts: [
      { label: "展会时间", value: "2026年10月26日–28日" },
      { label: "举办城市", value: "天津市" },
      { label: "展馆", value: "国家会展中心（天津）" },
      {
        label: "主办单位",
        value:
          "中国农业机械流通协会 · 中国农业机械化协会 · 中国农业机械工业协会",
      },
      { label: "承办单位", value: "待核实" },
      { label: "展会规模", value: "近30万㎡ · 3000余家企业参展 · 预计20万人次专业观众" },
      { label: "展位申报", value: "官方申报期 2026-04-26 ~ 05-15（已结束）；神雕农机不代主办方受理申报" },
      { label: "官方网站", value: "camf.com.cn" },
      { label: "神雕农机身份", value: "神雕云展运营方 · 线上展台服务商（非展会主办方）" },
    ],
    pending: "待核实",
    whyTitle: "为什么还需要一个线上第二展位",
    why: [
      {
        title: "线下 3 天，线上 365 天",
        desc: "展位在 10 月 28 日撤展，询盘在 11 月才陆续到来。神雕云展线上展台全年在线，展期流量带走，展后流量还在。",
      },
      {
        title: "海外买家到不了现场，但能打开网页",
        desc: "俄语区、中亚、中东买家多数不会到场。8 语种产品页让他们在自己的语言里检索到你。",
      },
      {
        title: "展台数据自己看得见",
        desc: "浏览量、询价记录都在后台，不是一句「我们会帮你推广」，而是能自己核对的数字。",
      },
    ],
    offerTitle: "神雕农机在现场提供什么",
    offers: [
      "开通神雕云展线上展台，365 天在线，可传图片与视频",
      "8 语种产品页同步展示，覆盖俄语区、中亚、东南亚买家",
      "展台后台可查看浏览量与询价记录",
      "神雕展翼™ 真实作业视频，为展机提供可核验的工况佐证",
      "国际基准价参考：这台机器在国际市场大概值多少",
      "不要独家，不影响你现有的任何渠道",
    ],
    crossTitle: "天津场：面向全国展商的 8 语种出海窗口",
    crossBody:
      "本届展会是全国性农机展，参展企业覆盖整机、配件与服务商。神雕农机在其中承担一件事：把你在展台上的机器，翻译进 8 个语种、推给海外买家，并且在展会结束后继续在线。现场登记即可开通，展后内容由我们协助完善。",
    stepsTitle: "三步入驻",
    steps: [
      { title: "登记", desc: "现场扫码或在本页填写信息，30 秒完成建档" },
      { title: "传机器", desc: "拍照上传，AI 识别机型与年份，补 3 个字段即可" },
      { title: "上线", desc: "线上展台自动开通，8 语种页面同步上线，有人询价会通知你" },
    ],
    faqTitle: "常见问题",
    ctaTitle: "现场展位 3 天，线上展台 365 天",
    ctaSub: "填写以下信息，我们在展前与你确认线上展台开通事宜。",
    secondaryCta: "先看看线上展厅",
    sourceTitle: "信息来源与免责声明",
    sourceNote:
      "本页展会信息来自神雕农机 2026 秋季展会战役方案的记载。标注「待核实」的字段（展馆 / 承办 / 规模 / 主办单位第三家中文全称）尚未取得官方来源，正式对外前须以主办方公告为准。神雕农机独立运营线上展台服务，与展会主办方无隶属关系，亦不代表主办方。",
  },
  en: {
    badge: "2026 Expo Season · Tianjin",
    h1: "2026 China International Agricultural Machinery Exhibition (Oct 26–28 · Tianjin) | Shendiao Agri-Machinery Expo™ On-Site Service",
    sub: "An on-site booth lasts 3 days. An online booth lasts 365. Shendiao opens an 8-language online booth (Shendiao Cloud Expo) for exhibitors, extending three days of exposure across a full year.",
    disclaimer:
      "This page is a Shendiao Agri-Machinery service page, not the official expo website. Expo details are subject to the organizer's announcements.",
    factsTitle: "Expo Facts",
    facts: [
      { label: "Dates", value: "October 26–28, 2026" },
      { label: "City", value: "Tianjin, China" },
      { label: "Venue", value: "To be verified" },
      {
        label: "Organizers",
        value:
          "China Agricultural Machinery Distribution Association · China Agricultural Machinery Industry Association (a third party abbreviated CAAMM — full Chinese name to be verified)",
      },
      { label: "Executed by", value: "To be verified" },
      { label: "Scale", value: "To be verified (internal campaign estimate: approx. 3,000 exhibitors)" },
      { label: "Booth Application", value: "Official window 2026-04-26 to 05-15 (closed); Shendiao does not handle applications on the organizer's behalf" },
      { label: "Official Website", value: "camf.com.cn" },
      { label: "Shendiao's Role", value: "Operator of Shendiao Cloud Expo · online booth service provider (not the expo organizer)" },
    ],
    pending: "To be verified",
    whyTitle: "Why you need a second, online booth",
    why: [
      {
        title: "3 days on site, 365 days online",
        desc: "Your booth comes down on Oct 28; inquiries keep arriving in November. A Shendiao Cloud Expo booth keeps working long after the halls close.",
      },
      {
        title: "Overseas buyers won't fly in — but they will open a page",
        desc: "Most buyers in Russia, Central Asia and the Middle East never attend in person. 8-language product pages let them find you in their own language.",
      },
      {
        title: "You can check the numbers yourself",
        desc: "View counts and inquiry records live in your dashboard — not a vague promise of promotion, but figures you can verify.",
      },
    ],
    offerTitle: "What Shendiao offers on site",
    offers: [
      "Shendiao Cloud Expo online booth — 365 days online, photos and video supported",
      "8-language product pages reaching Russian-speaking, Central Asian and Southeast Asian buyers",
      "Booth dashboard with view counts and inquiry records",
      "Shendiao WingShow™ field-operation video as verifiable proof of working condition",
      "International benchmark pricing: what your machine is worth on the global market",
      "No exclusivity — your existing channels stay untouched",
    ],
    crossTitle: "Tianjin: an 8-language export window for exhibitors nationwide",
    crossBody:
      "This is a national-level show covering complete machines, parts and service providers. Shendiao does one thing here: translate the machines on your stand into 8 languages, push them to overseas buyers, and keep them online after the show closes. Register on site to get started; we help you complete the listing afterwards.",
    stepsTitle: "Three steps to get listed",
    steps: [
      { title: "Register", desc: "Scan the QR code at our booth or fill in this form — done in 30 seconds" },
      { title: "Add machines", desc: "Upload a photo, AI detects brand and year, fill in 3 fields" },
      { title: "Go live", desc: "Your online booth opens automatically in 8 languages; inquiries reach you directly" },
    ],
    faqTitle: "FAQ",
    ctaTitle: "An on-site booth lasts 3 days. An online booth lasts 365.",
    ctaSub: "Fill in the form and we will confirm your online booth before the expo opens.",
    secondaryCta: "Browse the online showroom first",
    sourceTitle: "Sources & Disclaimer",
    sourceNote:
      "Expo facts on this page come from Shendiao's internal 2026 autumn expo campaign records. Fields marked \"To be verified\" (venue / executor / scale / full Chinese name of the third organizer) have no official source yet and must be confirmed against the organizer's announcements before external use. Shendiao operates its online booth service independently and has no affiliation with, and does not represent, the expo organizer.",
  },
  ru: {
    badge: "Сезон выставок 2026 · Тяньцзинь",
    h1: "Китайская международная выставка сельхозтехники 2026 (26–28 октября · Тяньцзинь) | Shendiao Agri-Machinery Expo™ — сервисная страница",
    sub: "Офлайн-стенд работает 3 дня, онлайн-стенд — 365. Shendiao открывает онлайн-стенд Shendiao Cloud Expo на 8 языках для экспонентов, продлевая три выставочных дня на целый год.",
    disclaimer:
      "Это сервисная страница Shendiao, а не официальный сайт выставки. Сведения о выставке уточняйте в объявлениях организатора.",
    factsTitle: "Основные сведения",
    facts: [
      { label: "Даты", value: "26–28 октября 2026 г." },
      { label: "Город", value: "Тяньцзинь, Китай" },
      { label: "Павильон", value: "уточняется" },
      {
        label: "Организаторы",
        value:
          "Китайская ассоциация дистрибуции сельхозтехники · Китайская ассоциация сельхозмашиностроения (третья организация — CAAMM, полное китайское название уточняется)",
      },
      { label: "Исполнитель", value: "уточняется" },
      { label: "Масштаб", value: "уточняется (внутренняя оценка: ок. 3 000 экспонентов)" },
      { label: "Подача заявок на стенд", value: "официальное окно 2026-04-26 — 05-15 (закрыто); Shendiao не принимает заявки от имени организатора" },
      { label: "Официальный сайт", value: "camf.com.cn" },
      { label: "Роль Shendiao", value: "оператор Shendiao Cloud Expo · поставщик услуг онлайн-стенда (не организатор выставки)" },
    ],
    pending: "уточняется",
    whyTitle: "Зачем нужен второй, онлайн-стенд",
    why: [
      {
        title: "3 дня офлайн, 365 дней онлайн",
        desc: "Стенд разбирают 28 октября, а запросы продолжают приходить в ноябре. Онлайн-стенд Shendiao Cloud Expo работает и после закрытия павильонов.",
      },
      {
        title: "Зарубежные покупатели не приедут, но откроют страницу",
        desc: "Большинство покупателей из России, Центральной Азии и Ближнего Востока не присутствуют лично. Карточки на 8 языках позволяют им найти вас.",
      },
      {
        title: "Статистику видно самому",
        desc: "Просмотры и запросы доступны в личном кабинете — не общие обещания продвижения, а проверяемые цифры.",
      },
    ],
    offerTitle: "Что Shendiao предлагает на выставке",
    offers: [
      "Онлайн-стенд Shendiao Cloud Expo — 365 дней, фото и видео",
      "Карточки товаров на 8 языках для покупателей из России, Центральной и Юго-Восточной Азии",
      "Личный кабинет стенда: просмотры и запросы",
      "Видео реальной работы Shendiao WingShow™ — подтверждаемое состояние машины",
      "Ориентир по мировым ценам: сколько ваша машина стоит на международном рынке",
      "Без эксклюзива — ваши текущие каналы продаж не затрагиваются",
    ],
    crossTitle: "Тяньцзинь: окно экспорта на 8 языках для экспонентов со всей страны",
    crossBody:
      "Это выставка национального уровня: машины в сборе, запчасти и сервисные компании. Задача Shendiao здесь одна — перевести технику на вашем стенде на 8 языков, показать её зарубежным покупателям и оставить онлайн после закрытия. Зарегистрируйтесь на стенде, заполнение карточек поможем завершить после выставки.",
    stepsTitle: "Три шага к размещению",
    steps: [
      { title: "Регистрация", desc: "Отсканируйте код на стенде или заполните форму — около 30 секунд" },
      { title: "Машина", desc: "Загрузите фото — ИИ определит бренд и год, останется 3 поля" },
      { title: "Публикация", desc: "Стенд открывается автоматически на 8 языках, запросы приходят вам" },
    ],
    faqTitle: "Вопросы и ответы",
    ctaTitle: "Офлайн-стенд — 3 дня. Онлайн-стенд — 365 дней.",
    ctaSub: "Заполните форму, и мы подтвердим открытие онлайн-стенда до начала выставки.",
    secondaryCta: "Сначала посмотреть онлайн-шоурум",
    sourceTitle: "Источники и оговорка",
    sourceNote:
      "Сведения о выставке взяты из внутренних материалов кампании Shendiao «Осенняя выставка 2026». Поля, помеченные «уточняется» (павильон / исполнитель / масштаб / полное китайское название третьего организатора), пока не подтверждены официальным источником и должны быть сверены с объявлениями организатора перед внешним использованием. Shendiao самостоятельно управляет сервисом онлайн-стенда и не связана с организатором выставки, а также не представляет его.",
  },
  es: {
    badge: "Temporada de ferias 2026 · Tianjin",
    h1: "Exposición Internacional de Maquinaria Agrícola de China 2026 (26–28 de octubre · Tianjin) | Servicio en feria Shendiao Agri-Machinery Expo™",
    sub: "Un stand presencial dura 3 días; un stand online, 365. Shendiao abre un stand online en 8 idiomas (Shendiao Cloud Expo) para los expositores y prolonga tres días de exposición a todo un año.",
    disclaimer:
      "Esta página es un servicio propio de Shendiao Agri-Machinery, no la web oficial de la feria. Los datos de la feria están sujetos a los anuncios del organizador.",
    factsTitle: "Datos básicos de la feria",
    facts: [
      { label: "Fechas", value: "26–28 de octubre de 2026" },
      { label: "Ciudad", value: "Tianjin, China" },
      { label: "Recinto", value: "Centro Nacional de Exposiciones y Convenciones (Tianjin)" },
      {
        label: "Organizadores",
        value:
          "Asociación China de Distribución de Maquinaria Agrícola · Asociación China de Maquinaria Agrícola · Asociación China de Industria de Maquinaria Agrícola",
      },
      { label: "Organiza", value: "Por verificar" },
      { label: "Escala", value: "Cerca de 300.000 m² · más de 3.000 empresas expositoras · unos 200.000 visitantes profesionales" },
      { label: "Solicitud de stand", value: "Ventana oficial 2026-04-26 a 05-15 (cerrada); Shendiao no tramita solicitudes en nombre del organizador" },
      { label: "Web oficial", value: "camf.com.cn" },
      { label: "Rol de Shendiao", value: "Operador de Shendiao Cloud Expo · proveedor de servicio de stand online (no es el organizador de la feria)" },
    ],
    pending: "Por verificar",
    whyTitle: "Por qué necesitas un segundo stand, online",
    why: [
      {
        title: "3 días presenciales, 365 días online",
        desc: "Tu stand se desmonta el 28 de octubre, pero las consultas siguen llegando en noviembre. Un stand online de Shendiao Cloud Expo sigue trabajando cuando las salas ya están cerradas.",
      },
      {
        title: "Los compradores extranjeros no vendrán, pero sí abrirán una página",
        desc: "La mayoría de los compradores de Rusia, Asia Central y Oriente Medio no asisten en persona. Las páginas en 8 idiomas les permiten encontrarte en su propio idioma.",
      },
      {
        title: "Puedes consultar los números tú mismo",
        desc: "Las visitas y los registros de consulta están en tu panel: no es una vaga promesa de promoción, sino cifras que puedes verificar.",
      },
    ],
    offerTitle: "Qué ofrece Shendiao en la feria",
    offers: [
      "Stand online de Shendiao Cloud Expo: 365 días en línea, con fotos y vídeo",
      "Páginas de producto en 8 idiomas que llegan a compradores de Rusia, Asia Central y el Sudeste Asiático",
      "Panel del stand con visitas y registros de consulta",
      "Vídeo real de trabajo de Shendiao WingShow™ como prueba verificable del estado de la máquina",
      "Precio de referencia internacional: cuánto vale tu máquina en el mercado global",
      "Sin exclusividad: tus canales actuales no se ven afectados",
    ],
    crossTitle: "Tianjin: una ventana de exportación en 8 idiomas para expositores de todo el país",
    crossBody:
      "Esta es una feria de ámbito nacional que abarca máquinas completas, repuestos y proveedores de servicios. Shendiao hace aquí una sola cosa: traducir las máquinas de tu stand a 8 idiomas, mostrarlas a compradores extranjeros y mantenerlas en línea tras la feria. Regístrate en el stand para empezar; te ayudamos a completar la ficha después.",
    stepsTitle: "Tres pasos para publicar",
    steps: [
      { title: "Regístrate", desc: "Escanea el código QR en el stand o rellena este formulario: listo en 30 segundos" },
      { title: "Sube tus máquinas", desc: "Sube una foto; la IA detecta marca y año, solo rellenas 3 campos" },
      { title: "Publica", desc: "Tu stand online se abre automáticamente en 8 idiomas; las consultas te llegan directamente" },
    ],
    faqTitle: "Preguntas frecuentes",
    ctaTitle: "Un stand presencial dura 3 días. Un stand online, 365.",
    ctaSub: "Rellena el formulario y confirmaremos la apertura de tu stand online antes de la feria.",
    secondaryCta: "Ver primero la sala de exposiciones online",
    sourceTitle: "Fuentes y exención de responsabilidad",
    sourceNote:
      "Los datos de la feria en esta página proceden de los registros internos de la campaña «Feria de otoño 2026» de Shendiao. Los campos marcados como «Por verificar» (recinto / entidad ejecutora / escala / nombre chino completo del tercer organizador) aún no cuentan con fuente oficial y deben confirmarse con los anuncios del organizador antes de cualquier uso externo. Shendiao gestiona su servicio de stand online de forma independiente y no tiene vínculo de subordinación con el organizador de la feria, ni lo representa.",
  },
  pt: {
    badge: "Temporada de feiras 2026 · Tianjin",
    h1: "Exposição Internacional de Máquinas Agrícolas da China 2026 (26–28 de outubro · Tianjin) | Serviço em feira Shendiao Agri-Machinery Expo™",
    sub: "Um estande presencial dura 3 dias; um estande online, 365. A Shendiao abre um estande online em 8 idiomas (Shendiao Cloud Expo) para os expositores e prolonga três dias de exposição por um ano inteiro.",
    disclaimer:
      "Esta página é um serviço próprio da Shendiao Agri-Machinery, não o site oficial da feira. Os dados da feira estão sujeitos aos anúncios do organizador.",
    factsTitle: "Dados básicos da feira",
    facts: [
      { label: "Datas", value: "26–28 de outubro de 2026" },
      { label: "Cidade", value: "Tianjin, China" },
      { label: "Recinto", value: "Centro Nacional de Exposições e Convenções (Tianjin)" },
      {
        label: "Organizadores",
        value:
          "Associação Chinesa de Distribuição de Máquinas Agrícolas · Associação Chinesa de Máquinas Agrícolas · Associação Chinesa da Indústria de Máquinas Agrícolas",
      },
      { label: "Executado por", value: "A verificar" },
      { label: "Escala", value: "Cerca de 300.000 m² · mais de 3.000 empresas expositoras · cerca de 200.000 visitantes profissionais" },
      { label: "Inscrição de estande", value: "Janela oficial de 2026-04-26 a 05-15 (encerrada); a Shendiao não intermedia inscrições em nome do organizador" },
      { label: "Site oficial", value: "camf.com.cn" },
      { label: "Papel da Shendiao", value: "Operadora da Shendiao Cloud Expo · prestadora de serviço de estande online (não é a organizadora da feira)" },
    ],
    pending: "A verificar",
    whyTitle: "Por que você precisa de um segundo estande, online",
    why: [
      {
        title: "3 dias presenciais, 365 dias online",
        desc: "Seu estande é desmontado em 28 de outubro, mas as consultas continuam chegando em novembro. Um estande online Shendiao Cloud Expo continua funcionando depois que os pavilhões fecham.",
      },
      {
        title: "Compradores estrangeiros não virão, mas vão abrir uma página",
        desc: "A maioria dos compradores da Rússia, Ásia Central e Oriente Médio não comparece pessoalmente. Páginas em 8 idiomas permitem que eles encontrem você no próprio idioma.",
      },
      {
        title: "Você mesmo pode conferir os números",
        desc: "Visualizações e registros de consulta ficam no seu painel — não é uma promessa vaga de divulgação, mas números que você pode verificar.",
      },
    ],
    offerTitle: "O que a Shendiao oferece na feira",
    offers: [
      "Estande online Shendiao Cloud Expo — 365 dias no ar, com fotos e vídeo",
      "Páginas de produto em 8 idiomas alcançando compradores da Rússia, Ásia Central e Sudeste Asiático",
      "Painel do estande com visualizações e registros de consulta",
      "Vídeo real de operação Shendiao WingShow™ como comprovação verificável do estado da máquina",
      "Preço de referência internacional: quanto a sua máquina vale no mercado global",
      "Sem exclusividade — seus canais atuais permanecem intactos",
    ],
    crossTitle: "Tianjin: uma janela de exportação em 8 idiomas para expositores de todo o país",
    crossBody:
      "Esta é uma feira de âmbito nacional que abrange máquinas completas, peças e prestadores de serviços. A Shendiao faz aqui uma única coisa: traduzir as máquinas do seu estande para 8 idiomas, mostrá-las a compradores estrangeiros e mantê-las online após a feira. Cadastre-se no estande para começar; ajudamos você a completar o anúncio depois.",
    stepsTitle: "Três passos para publicar",
    steps: [
      { title: "Cadastre-se", desc: "Escaneie o QR code no estande ou preencha este formulário — pronto em 30 segundos" },
      { title: "Adicione máquinas", desc: "Envie uma foto; a IA detecta marca e ano, você preenche apenas 3 campos" },
      { title: "Publique", desc: "Seu estande online abre automaticamente em 8 idiomas; as consultas chegam direto a você" },
    ],
    faqTitle: "Perguntas frequentes",
    ctaTitle: "Um estande presencial dura 3 dias. Um estande online, 365.",
    ctaSub: "Preencha o formulário e confirmaremos a abertura do seu estande online antes da feira.",
    secondaryCta: "Ver primeiro o showroom online",
    sourceTitle: "Fontes e aviso legal",
    sourceNote:
      "Os dados da feira nesta página vêm dos registros internos da campanha «Feira de outono 2026» da Shendiao. Os campos marcados como «A verificar» (recinto / executante / escala / nome chinês completo do terceiro organizador) ainda não têm fonte oficial e devem ser confirmados com os anúncios do organizador antes de qualquer uso externo. A Shendiao opera seu serviço de estande online de forma independente e não tem vínculo de subordinação com o organizador da feira, nem o representa.",
  },
  ar: {
    badge: "موسم المعارض 2026 · تيانجين",
    h1: "المعرض الدولي الصيني للآلات الزراعية 2026 (26–28 أكتوبر · تيانجين) | خدمة المعرض Shendiao Agri-Machinery Expo™",
    sub: "الجناح الحضوري يدوم 3 أيام، أما الجناح الإلكتروني فيدوم 365 يومًا. تفتح Shendiao جناحًا إلكترونيًا بثماني لغات (Shendiao Cloud Expo) للعارضين، لتمديد ثلاثة أيام من العرض إلى عام كامل.",
    disclaimer:
      "هذه الصفحة خدمة خاصة بـ Shendiao Agri-Machinery وليست الموقع الرسمي للمعرض. تخضع بيانات المعرض لإعلانات المنظّم.",
    factsTitle: "البيانات الأساسية للمعرض",
    facts: [
      { label: "التواريخ", value: "26–28 أكتوبر 2026" },
      { label: "المدينة", value: "تيانجين، الصين" },
      { label: "المقر", value: "المركز الوطني للمعارض والمؤتمرات (تيانجين)" },
      {
        label: "المنظّمون",
        value:
          "الجمعية الصينية لتوزيع الآلات الزراعية · الجمعية الصينية للآلات الزراعية · الجمعية الصينية لصناعة الآلات الزراعية",
      },
      { label: "الجهة المنفّذة", value: "قيد التحقق" },
      { label: "الحجم", value: "نحو 300,000 م² · أكثر من 3,000 شركة عارضة · نحو 200,000 زائر متخصص" },
      { label: "طلب الجناح", value: "النافذة الرسمية 2026-04-26 إلى 05-15 (مغلقة)؛ لا تتولى Shendiao تقديم الطلبات نيابة عن المنظّم" },
      { label: "الموقع الرسمي", value: "camf.com.cn" },
      { label: "دور Shendiao", value: "مشغّل Shendiao Cloud Expo · مزوّد خدمة الأجنحة الإلكترونية (ليس منظّم المعرض)" },
    ],
    pending: "قيد التحقق",
    whyTitle: "لماذا تحتاج إلى جناح ثانٍ إلكتروني",
    why: [
      {
        title: "3 أيام حضوريًا، 365 يومًا عبر الإنترنت",
        desc: "يُفكّ جناحك في 28 أكتوبر، لكن الاستفسارات تستمر في الوصول خلال نوفمبر. يظل جناح Shendiao Cloud Expo الإلكتروني يعمل بعد إغلاق القاعات.",
      },
      {
        title: "المشترون الأجانب لن يحضروا، لكنهم سيفتحون الصفحة",
        desc: "معظم المشترين من روسيا وآسيا الوسطى والشرق الأوسط لا يحضرون شخصيًا. صفحات المنتجات بثماني لغات تمكّنهم من العثور عليك بلغتهم.",
      },
      {
        title: "يمكنك التحقق من الأرقام بنفسك",
        desc: "المشاهدات وسجلات الاستفسار متاحة في لوحة التحكم — ليست مجرد وعد غامض بالترويج، بل أرقام يمكنك التأكد منها.",
      },
    ],
    offerTitle: "ما تقدمه Shendiao في المعرض",
    offers: [
      "جناح إلكتروني Shendiao Cloud Expo — 365 يومًا عبر الإنترنت، مع دعم الصور والفيديو",
      "صفحات منتجات بثماني لغات تصل إلى مشتري روسيا وآسيا الوسطى وجنوب شرق آسيا",
      "لوحة تحكم الجناح مع المشاهدات وسجلات الاستفسار",
      "فيديو تشغيل حقيقي Shendiao WingShow™ كإثبات قابل للتحقق على حالة الماكينة",
      "السعر المرجعي الدولي: كم تساوي ماكينتك في السوق العالمية",
      "دون حصرية — لا تتأثر قنواتك الحالية",
    ],
    crossTitle: "تيانجين: نافذة تصدير بثماني لغات للعارضين من جميع أنحاء البلاد",
    crossBody:
      "هذا معرض على المستوى الوطني يشمل الآلات الكاملة وقطع الغيار ومقدمي الخدمات. تؤدي Shendiao هنا مهمة واحدة: ترجمة الآلات المعروضة في جناحك إلى ثماني لغات، وعرضها على المشترين الأجانب، وإبقاءها على الإنترنت بعد انتهاء المعرض. سجّل في الجناح للبدء؛ ونساعدك في استكمال القائمة لاحقًا.",
    stepsTitle: "ثلاث خطوات للنشر",
    steps: [
      { title: "التسجيل", desc: "امسح رمز الاستجابة السريعة في الجناح أو املأ هذا النموذج — خلال 30 ثانية" },
      { title: "إضافة الآلات", desc: "ارفع صورة، يتعرّف الذكاء الاصطناعي على العلامة والسنة، وتبقى 3 حقول فقط" },
      { title: "النشر", desc: "يُفتح جناحك الإلكتروني تلقائيًا بثماني لغات، وتصلك الاستفسارات مباشرة" },
    ],
    faqTitle: "الأسئلة الشائعة",
    ctaTitle: "الجناح الحضوري يدوم 3 أيام. الجناح الإلكتروني يدوم 365.",
    ctaSub: "املأ النموذج وسنؤكد افتتاح جناحك الإلكتروني قبل بدء المعرض.",
    secondaryCta: "تصفّح صالة العرض الإلكترونية أولًا",
    sourceTitle: "المصادر وإخلاء المسؤولية",
    sourceNote:
      "مصدر بيانات المعرض في هذه الصفحة هو السجلات الداخلية لحملة Shendiao «معرض خريف 2026». الحقول المعلّمة بـ«قيد التحقق» (المقر / الجهة المنفّذة / الحجم / الاسم الصيني الكامل للمنظّم الثالث) لا تملك بعد مصدرًا رسميًا، ويجب تأكيدها مقابل إعلانات المنظّم قبل أي استخدام خارجي. تدير Shendiao خدمة الأجنحة الإلكترونية بشكل مستقل ولا تربطها علاقة تبعية بمنظّم المعرض ولا تمثله.",
  },
  fr: {
    badge: "Saison des salons 2026 · Tianjin",
    h1: "Salon international chinois de la machinerie agricole 2026 (26–28 octobre · Tianjin) | Service sur site Shendiao Agri-Machinery Expo™",
    sub: "Un stand physique dure 3 jours, un stand en ligne 365. Shendiao ouvre un stand en ligne en 8 langues (Shendiao Cloud Expo) pour les exposants et prolonge trois jours de salon sur toute une année.",
    disclaimer:
      "Cette page est un service propre à Shendiao Agri-Machinery, et non le site officiel du salon. Les informations sur le salon sont soumises aux annonces de l'organisateur.",
    factsTitle: "Informations essentielles",
    facts: [
      { label: "Dates", value: "26–28 octobre 2026" },
      { label: "Ville", value: "Tianjin, Chine" },
      { label: "Lieu", value: "Centre national des expositions et des congrès (Tianjin)" },
      {
        label: "Organisateurs",
        value:
          "Association chinoise de distribution de machines agricoles · Association chinoise de machines agricoles · Association chinoise de l'industrie des machines agricoles",
      },
      { label: "Organisation exécutive", value: "À vérifier" },
      { label: "Envergure", value: "Près de 300 000 m² · plus de 3 000 entreprises exposantes · environ 200 000 visiteurs professionnels" },
      { label: "Demande de stand", value: "Fenêtre officielle du 2026-04-26 au 05-15 (close) ; Shendiao ne traite pas les demandes pour le compte de l'organisateur" },
      { label: "Site officiel", value: "camf.com.cn" },
      { label: "Rôle de Shendiao", value: "Opérateur de Shendiao Cloud Expo · prestataire de stand en ligne (n'est pas l'organisateur du salon)" },
    ],
    pending: "À vérifier",
    whyTitle: "Pourquoi vous avez besoin d'un second stand, en ligne",
    why: [
      {
        title: "3 jours sur place, 365 jours en ligne",
        desc: "Votre stand est démonté le 28 octobre, mais les demandes continuent d'arriver en novembre. Un stand en ligne Shendiao Cloud Expo continue de fonctionner après la fermeture des halls.",
      },
      {
        title: "Les acheteurs étrangers ne viendront pas — mais ils ouvriront une page",
        desc: "La plupart des acheteurs de Russie, d'Asie centrale et du Moyen-Orient ne se déplacent pas. Des pages produits en 8 langues leur permettent de vous trouver dans leur propre langue.",
      },
      {
        title: "Vous pouvez vérifier les chiffres vous-même",
        desc: "Vues et demandes sont disponibles dans votre tableau de bord — pas une vague promesse de promotion, mais des chiffres vérifiables.",
      },
    ],
    offerTitle: "Ce que Shendiao propose sur place",
    offers: [
      "Stand en ligne Shendiao Cloud Expo — 365 jours en ligne, photos et vidéo prises en charge",
      "Pages produits en 8 langues touchant les acheteurs de Russie, d'Asie centrale et d'Asie du Sud-Est",
      "Tableau de bord du stand avec vues et demandes",
      "Vidéo de travail réelle Shendiao WingShow™, preuve vérifiable de l'état de la machine",
      "Prix de référence international : ce que vaut votre machine sur le marché mondial",
      "Sans exclusivité — vos canaux actuels restent inchangés",
    ],
    crossTitle: "Tianjin : une fenêtre d'export en 8 langues pour les exposants de tout le pays",
    crossBody:
      "Il s'agit d'un salon national couvrant les machines complètes, les pièces et les prestataires de services. Shendiao y fait une seule chose : traduire les machines de votre stand en 8 langues, les présenter aux acheteurs étrangers et les maintenir en ligne après le salon. Inscrivez-vous sur place pour commencer ; nous vous aidons à compléter la fiche ensuite.",
    stepsTitle: "Trois étapes pour publier",
    steps: [
      { title: "Inscrivez-vous", desc: "Scannez le QR code sur le stand ou remplissez ce formulaire — 30 secondes" },
      { title: "Ajoutez vos machines", desc: "Téléchargez une photo ; l'IA détecte la marque et l'année, il ne reste que 3 champs" },
      { title: "Publiez", desc: "Votre stand en ligne s'ouvre automatiquement en 8 langues ; les demandes vous parviennent directement" },
    ],
    faqTitle: "Questions fréquentes",
    ctaTitle: "Un stand physique dure 3 jours. Un stand en ligne, 365.",
    ctaSub: "Remplissez le formulaire et nous confirmerons l'ouverture de votre stand en ligne avant le salon.",
    secondaryCta: "D'abord parcourir le showroom en ligne",
    sourceTitle: "Sources et clause de non-responsabilité",
    sourceNote:
      "Les informations sur le salon figurant sur cette page proviennent des archives internes de la campagne « Salon d'automne 2026 » de Shendiao. Les champs marqués « À vérifier » (lieu / entité exécutante / envergure / nom chinois complet du troisième organisateur) n'ont pas encore de source officielle et doivent être confirmés auprès des annonces de l'organisateur avant tout usage externe. Shendiao gère son service de stand en ligne de manière indépendante et n'a aucun lien de subordination avec l'organisateur du salon, ni ne le représente.",
  },
  hi: {
    badge: "2026 प्रदर्शनी सीज़न · तियानजिन",
    h1: "2026 चीन अंतर्राष्ट्रीय कृषि मशीनरी प्रदर्शनी (26–28 अक्टूबर · तियानजिन) | शेंडियाओ एग्री-मशीनरी एक्सपो™ स्थल सेवा",
    sub: "स्थल पर स्टॉल 3 दिन चलता है, ऑनलाइन स्टॉल 365। शेंडियाओ प्रदर्शकों के लिए 8 भाषाओं वाला ऑनलाइन स्टॉल (शेंडियाओ क्लाउड एक्सपो) खोलती है और तीन दिन के प्रदर्शन को पूरे वर्ष तक बढ़ा देती है।",
    disclaimer:
      "यह पृष्ठ शेंडियाओ एग्री-मशीनरी की अपनी सेवा है, प्रदर्शनी की आधिकारिक वेबसाइट नहीं। प्रदर्शनी की जानकारी आयोजक की घोषणाओं के अधीन है।",
    factsTitle: "प्रदर्शनी की मूल जानकारी",
    facts: [
      { label: "तिथियाँ", value: "26–28 अक्टूबर 2026" },
      { label: "शहर", value: "तियानजिन, चीन" },
      { label: "स्थल", value: "राष्ट्रीय प्रदर्शनी एवं सम्मेलन केंद्र (तियानजिन)" },
      {
        label: "आयोजक",
        value:
          "चीन कृषि मशीनरी वितरण संघ · चीन कृषि मशीनरी संघ · चीन कृषि मशीनरी उद्योग संघ",
      },
      { label: "कार्यान्वयन", value: "सत्यापन बाकी" },
      { label: "पैमाना", value: "लगभग 3,00,000 वर्ग मीटर · 3,000 से अधिक प्रदर्शक कंपनियाँ · लगभग 2,00,000 व्यावसायिक आगंतुक" },
      { label: "स्टॉल हेतु आवेदन", value: "आधिकारिक विंडो 2026-04-26 से 05-15 (बंद); शेंडियाओ आयोजक की ओर से आवेदन नहीं लेती" },
      { label: "आधिकारिक वेबसाइट", value: "camf.com.cn" },
      { label: "शेंडियाओ की भूमिका", value: "शेंडियाओ क्लाउड एक्सपो की संचालक · ऑनलाइन स्टॉल सेवा प्रदाता (प्रदर्शनी की आयोजक नहीं)" },
    ],
    pending: "सत्यापन बाकी",
    whyTitle: "आपको दूसरे, ऑनलाइन स्टॉल की आवश्यकता क्यों है",
    why: [
      {
        title: "3 दिन स्थल पर, 365 दिन ऑनलाइन",
        desc: "आपका स्टॉल 28 अक्टूबर को हट जाता है, पर पूछताछ नवंबर में भी आती रहती है। शेंडियाओ क्लाउड एक्सपो का ऑनलाइन स्टॉल हॉल बंद होने के बाद भी काम करता रहता है।",
      },
      {
        title: "विदेशी खरीदार नहीं आएँगे — पर पेज ज़रूर खोलेंगे",
        desc: "रूस, मध्य एशिया और मध्य पूर्व के अधिकांश खरीदार व्यक्तिगत रूप से नहीं आते। 8 भाषाओं वाले उत्पाद पृष्ठ उन्हें उनकी भाषा में आपको खोजने देते हैं।",
      },
      {
        title: "आप स्वयं आँकड़े देख सकते हैं",
        desc: "व्यू और पूछताछ रिकॉर्ड आपके डैशबोर्ड में रहते हैं — यह प्रचार का कोई अस्पष्ट वादा नहीं, बल्कि सत्यापन योग्य आँकड़े हैं।",
      },
    ],
    offerTitle: "शेंडियाओ स्थल पर क्या प्रदान करती है",
    offers: [
      "शेंडियाओ क्लाउड एक्सपो ऑनलाइन स्टॉल — 365 दिन ऑनलाइन, फोटो और वीडियो सहित",
      "8 भाषाओं वाले उत्पाद पृष्ठ, जो रूस, मध्य एशिया और दक्षिण-पूर्व एशिया के खरीदारों तक पहुँचते हैं",
      "स्टॉल डैशबोर्ड में व्यू और पूछताछ रिकॉर्ड",
      "शेंडियाओ विंगशो™ वास्तविक संचालन वीडियो — मशीन की स्थिति का सत्यापन योग्य प्रमाण",
      "अंतर्राष्ट्रीय संदर्भ मूल्य: वैश्विक बाज़ार में आपकी मशीन का मूल्य",
      "कोई विशेषाधिकार नहीं — आपके मौजूदा चैनल अप्रभावित रहते हैं",
    ],
    crossTitle: "तियानजिन: देश भर के प्रदर्शकों के लिए 8 भाषाओं वाली निर्यात खिड़की",
    crossBody:
      "यह राष्ट्रीय स्तर की प्रदर्शनी है जिसमें पूरी मशीनें, पुर्ज़े और सेवा प्रदाता शामिल हैं। शेंडियाओ यहाँ एक ही काम करती है: आपके स्टॉल की मशीनों को 8 भाषाओं में अनूदित करना, उन्हें विदेशी खरीदारों तक पहुँचाना और प्रदर्शनी के बाद भी ऑनलाइन बनाए रखना। शुरू करने के लिए स्टॉल पर पंजीकरण करें; लिस्टिंग पूरी करने में हम बाद में सहायता करते हैं।",
    stepsTitle: "लिस्टिंग के तीन चरण",
    steps: [
      { title: "पंजीकरण", desc: "स्टॉल पर QR कोड स्कैन करें या यह फ़ॉर्म भरें — 30 सेकंड में तैयार" },
      { title: "मशीनें जोड़ें", desc: "फोटो अपलोड करें; AI ब्रांड और वर्ष पहचान लेता है, केवल 3 फ़ील्ड भरने हैं" },
      { title: "प्रकाशित करें", desc: "आपका ऑनलाइन स्टॉल स्वतः 8 भाषाओं में खुल जाता है; पूछताछ सीधे आपको मिलती है" },
    ],
    faqTitle: "सामान्य प्रश्न",
    ctaTitle: "स्थल पर स्टॉल 3 दिन चलता है। ऑनलाइन स्टॉल 365 दिन।",
    ctaSub: "फ़ॉर्म भरें और हम प्रदर्शनी शुरू होने से पहले आपके ऑनलाइन स्टॉल की पुष्टि करेंगे।",
    secondaryCta: "पहले ऑनलाइन शोरूम देखें",
    sourceTitle: "स्रोत एवं अस्वीकरण",
    sourceNote:
      "इस पृष्ठ पर प्रदर्शनी की जानकारी शेंडियाओ के आंतरिक «2026 शरदकालीन प्रदर्शनी» अभियान अभिलेखों से ली गई है। «सत्यापन बाकी» के रूप में चिह्नित फ़ील्ड (स्थल / कार्यान्वयन संस्था / पैमाना / तीसरे आयोजक का पूरा चीनी नाम) का अभी कोई आधिकारिक स्रोत नहीं है और किसी भी बाहरी उपयोग से पहले आयोजक की घोषणाओं से पुष्टि की जानी चाहिए। शेंडियाओ अपनी ऑनलाइन स्टॉल सेवा स्वतंत्र रूप से संचालित करती है और प्रदर्शनी के आयोजक के साथ इसका कोई अधीनता संबंध नहीं है, न ही वह उसका प्रतिनिधित्व करती है।",
  },
};

// zh / en / ru / es / pt / ar / fr / hi 全语种完整实现
function getTexts(locale: string): TianjinTexts {
  return TEXTS[locale] || TEXTS.en;
}

export function TianjinLanding({ locale }: { locale: string }) {
  const t = getTexts(locale);
  // FAQ 与页面 FAQPage 结构化数据共用一份数据源
  const faqs = pickFaqs(TJ_FAQS, locale);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  // 阿拉伯语右起排版（与 dual-expo-banner / recruitment-banner 的既有做法一致）
  const isRTL = locale === "ar";

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero */}
      <section className="bg-gradient-to-br from-sky-700 via-blue-700 to-indigo-700 text-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-amber-300" />
            {t.badge}
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {t.h1}
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-blue-50">{t.sub}</p>
          <p className="mt-3 text-sm text-blue-200">{t.disclaimer}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#expo-inquiry-form"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-6 py-3 font-semibold text-amber-900 shadow-lg transition hover:bg-amber-300"
            >
              {locale === "zh" ? "申请开通线上展台" : locale === "ru" ? "Открыть онлайн-стенд" : "Open my online booth"}
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href={`/${locale}/expo/showroom`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 px-6 py-3 font-semibold backdrop-blur-sm transition hover:bg-white/20"
            >
              {t.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      {/* 展会基本信息 */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <Calendar className="h-6 w-6 text-blue-600" />
          {t.factsTitle}
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {t.facts.map((f) => (
                <tr key={f.label} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <th className="w-48 shrink-0 bg-gray-50 px-4 py-3 font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {f.label}
                  </th>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {f.value === t.pending ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        {f.value}
                      </span>
                    ) : (
                      f.value
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 为什么需要线上第二展位 */}
      <section className="bg-gray-50 py-14 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">{t.whyTitle}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {t.why.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950"
              >
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 神雕提供什么 */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">{t.offerTitle}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {t.offers.map((o) => (
            <li
              key={o}
              className="flex items-start gap-2 rounded-lg border border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>{o}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 天津场差异化 */}
      <section className="bg-gradient-to-br from-sky-50 to-indigo-50 py-14 dark:from-gray-900 dark:to-gray-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Globe className="h-6 w-6 text-blue-600" />
            {t.crossTitle}
          </h2>
          <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">{t.crossBody}</p>
        </div>
      </section>

      {/* 三步入驻 */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">{t.stepsTitle}</h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {t.steps.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-xl border border-gray-200 p-6 dark:border-gray-800"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {i + 1}
              </div>
              <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{s.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-14 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">{t.faqTitle}</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={faq.q}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white"
                >
                  <span>{faq.q}</span>
                  <span className="text-blue-600">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <p className="border-t border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-400">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + 表单 */}
      <section id="expo-inquiry-form" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">{t.ctaTitle}</h2>
          <p className="mb-8 text-gray-600 dark:text-gray-400">{t.ctaSub}</p>
        </div>
        <ExpoInquiryForm locale={locale} source="tj-2026" />
      </section>

      {/* 信息来源与免责声明 */}
      <section className="border-t border-gray-200 py-10 dark:border-gray-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Clock className="h-4 w-4 text-gray-400" />
            {t.sourceTitle}
          </h2>
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t.sourceNote}</p>
          <p className="mt-4 flex items-center gap-1 text-xs text-gray-400">
            <MapPin className="h-3 w-3" />
            石家庄神雕农机科技有限公司
          </p>
        </div>
      </section>
    </div>
  );
}
