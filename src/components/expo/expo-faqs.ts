/**
 * 展会专题页 FAQ 文案（服务端/客户端共用单一数据源）
 *
 * 放在独立模块的原因：需要同时喂给页面的 FAQPage 结构化数据（Server Component）
 * 和落地页的可视化 FAQ（Client Component）。若把 FAQ 写在 "use client" 模块里再导出，
 * 服务端拿到的是 client reference 而非真实数据，JSON.stringify 会失败。
 *
 * 天津场（TJ_FAQS）已实现全部 8 语种（zh/en/ru/es/pt/ar/fr/hi）。
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
      a: "神雕农机为参展企业提供 8 语种线上展台与海外买家曝光服务，是神雕云展的运营方；我们不是展会主办方，也不是本届参展企业。本页为神雕农机自有服务专题，不是展会官方网站。展会相关信息以主办方公告为准。",
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
      a: "线下展位申报与展位费用请通过展会官方渠道（camf.com.cn）办理；官方申报期为 2026-04-26 ~ 05-15，现已结束。神雕农机不代办线下展位。",
    },
  ],
  en: [
    {
      q: "What is Shendiao's role at this expo?",
      a: "Shendiao provides 8-language online booths and overseas buyer exposure for exhibitors, and operates Shendiao Cloud Expo. We are neither the expo organizer nor an exhibiting company at this expo. This page is a Shendiao service page, not the official expo website. Expo details are subject to the organizer's announcements.",
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
      a: "On-site booth applications and fees are handled by the expo organizer through official channels (camf.com.cn); the official application window was 2026-04-26 to 05-15 and is now closed. Shendiao does not act as an agent for on-site booths.",
    },
  ],
  ru: [
    {
      q: "Какова роль Shendiao на этой выставке?",
      a: "Shendiao предоставляет участникам онлайн-стенды на 8 языках и выход на зарубежных покупателей и является оператором Shendiao Cloud Expo. Мы не организатор выставки и не являемся экспонентом. Это сервисная страница Shendiao, а не официальный сайт выставки. Сведения о выставке уточняйте в объявлениях организатора.",
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
      a: "Заявки и стоимость офлайн-стендов — через официальные каналы организатора (camf.com.cn); официальное окно подачи 2026-04-26 — 05-15 закрыто. Shendiao не является агентом по продаже офлайн-стендов.",
    },
  ],
  es: [
    {
      q: "¿Cuál es el papel de Shendiao en esta feria?",
      a: "Shendiao ofrece a los expositores stands online en 8 idiomas y visibilidad ante compradores extranjeros, y opera Shendiao Cloud Expo. No somos el organizador de la feria ni una empresa expositora en esta edición. Esta página es un servicio propio de Shendiao, no la web oficial de la feria. Los datos de la feria están sujetos a los anuncios del organizador.",
    },
    {
      q: "¿Cuándo y dónde se celebra la feria?",
      a: "La Exposición Internacional de Maquinaria Agrícola de China 2026 se celebra del 26 al 28 de octubre de 2026 en Tianjin. El recinto concreto está por verificar; consulte los anuncios del organizador.",
    },
    {
      q: "¿Quién organiza esta feria?",
      a: "Según los registros disponibles, la feria está organizada por la Asociación China de Distribución de Maquinaria Agrícola, la Asociación China de Industria de Maquinaria Agrícola y otras entidades (una de ellas abreviada CAAMM, cuyo nombre chino completo está por verificar). Los anuncios del organizador son la fuente autorizada.",
    },
    {
      q: "¿Qué incluye el stand online (Shendiao Cloud Expo)?",
      a: "Un stand online de 365 días, carga de fotos y vídeo, páginas de producto en 8 idiomas y acceso a las estadísticas de visitas y consultas. El stand puede abrirse gratis; el volumen de publicaciones y los servicios dependen del plan que elija.",
    },
    {
      q: "Quiero solicitar un stand presencial, ¿con quién debo contactar?",
      a: "Las solicitudes y tarifas de stands presenciales las gestiona el organizador a través de canales oficiales (camf.com.cn); la ventana oficial de solicitud fue del 2026-04-26 al 05-15 y ya está cerrada. Shendiao no actúa como agente para stands presenciales.",
    },
  ],
  pt: [
    {
      q: "Qual é o papel da Shendiao nesta feira?",
      a: "A Shendiao oferece aos expositores estandes online em 8 idiomas e visibilidade junto a compradores estrangeiros, e opera a Shendiao Cloud Expo. Não somos a organizadora da feira nem uma empresa expositora nesta edição. Esta página é um serviço próprio da Shendiao, não o site oficial da feira. Os dados da feira estão sujeitos aos anúncios do organizador.",
    },
    {
      q: "Quando e onde acontece a feira?",
      a: "A Exposição Internacional de Máquinas Agrícolas da China 2026 acontece de 26 a 28 de outubro de 2026 em Tianjin. O recinto específico está a verificar — consulte os anúncios do organizador.",
    },
    {
      q: "Quem organiza esta feira?",
      a: "Segundo os registros disponíveis, a feira é organizada pela Associação Chinesa de Distribuição de Máquinas Agrícolas, pela Associação Chinesa da Indústria de Máquinas Agrícolas e por outras entidades (uma delas abreviada CAAMM, cujo nome chinês completo está a verificar). Os anúncios do organizador são a fonte autorizada.",
    },
    {
      q: "O que está incluído no estande online (Shendiao Cloud Expo)?",
      a: "Um estande online de 365 dias, upload de fotos e vídeos, páginas de produto em 8 idiomas e acesso às estatísticas de visualizações e consultas. O estande pode ser aberto gratuitamente; o volume de anúncios e os serviços dependem do plano escolhido.",
    },
    {
      q: "Quero solicitar um estande presencial — com quem devo falar?",
      a: "As solicitações e taxas de estandes presenciais são tratadas pelo organizador por canais oficiais (camf.com.cn); a janela oficial de inscrição foi de 2026-04-26 a 05-15 e agora está encerrada. A Shendiao não atua como agente de estandes presenciais.",
    },
  ],
  ar: [
    {
      q: "ما هو دور Shendiao في هذا المعرض؟",
      a: "توفّر Shendiao للعارضين أجنحة إلكترونية بثماني لغات ووصولًا إلى المشترين الأجانب، وهي مشغّلة Shendiao Cloud Expo. نحن لسنا منظّم المعرض ولا شركة عارضة في هذه النسخة. هذه الصفحة خدمة خاصة بـ Shendiao وليست الموقع الرسمي للمعرض. تخضع بيانات المعرض لإعلانات المنظّم.",
    },
    {
      q: "متى وأين يُقام المعرض؟",
      a: "يُقام المعرض الدولي الصيني للآلات الزراعية 2026 في الفترة من 26 إلى 28 أكتوبر 2026 في تيانجين. المقر المحدّد قيد التحقق — يُرجى الرجوع إلى إعلانات المنظّم.",
    },
    {
      q: "من ينظّم هذا المعرض؟",
      a: "وفقًا للسجلات المتاحة، ينظّم المعرض الجمعية الصينية لتوزيع الآلات الزراعية والجمعية الصينية لصناعة الآلات الزراعية وجهات أخرى (إحداها يُشار إليها بـ CAAMM واسمها الصيني الكامل قيد التحقق). إعلانات المنظّم هي المصدر المعتمد.",
    },
    {
      q: "ماذا يشمل الجناح الإلكتروني (Shendiao Cloud Expo)؟",
      a: "جناح إلكتروني لمدة 365 يومًا، ورفع الصور والفيديو، وصفحات منتجات بثماني لغات، والاطلاع على إحصاءات المشاهدات والاستفسارات. يمكن فتح الجناح مجانًا؛ ويعتمد حجم الإدراج والخدمات على الباقة التي تختارها.",
    },
    {
      q: "أرغب في التقديم على جناح حضوري — بمن أتواصل؟",
      a: "تُدار طلبات ورسوم الأجنحة الحضورية من قِبل المنظّم عبر القنوات الرسمية (camf.com.cn)؛ وكانت نافذة التقديم الرسمية من 2026-04-26 إلى 05-15 وقد أُغلقت الآن. لا تعمل Shendiao كوسيط للأجنحة الحضورية.",
    },
  ],
  fr: [
    {
      q: "Quel est le rôle de Shendiao à ce salon ?",
      a: "Shendiao propose aux exposants des stands en ligne en 8 langues ainsi qu'une visibilité auprès des acheteurs étrangers, et exploite Shendiao Cloud Expo. Nous ne sommes ni l'organisateur du salon, ni une entreprise exposante de cette édition. Cette page est un service propre à Shendiao, et non le site officiel du salon. Les informations sur le salon sont soumises aux annonces de l'organisateur.",
    },
    {
      q: "Quand et où se tient le salon ?",
      a: "Le Salon international chinois de la machinerie agricole 2026 se tient du 26 au 28 octobre 2026 à Tianjin. Le lieu précis reste à vérifier — consultez les annonces de l'organisateur.",
    },
    {
      q: "Qui organise ce salon ?",
      a: "Selon les informations disponibles, le salon est organisé par l'Association chinoise de distribution de machines agricoles, l'Association chinoise de l'industrie des machines agricoles et d'autres entités (l'une étant abrégée CAAMM, dont le nom chinois complet reste à vérifier). Les annonces de l'organisateur font foi.",
    },
    {
      q: "Que comprend le stand en ligne (Shendiao Cloud Expo) ?",
      a: "Un stand en ligne de 365 jours, l'envoi de photos et de vidéos, des pages produits en 8 langues et l'accès aux statistiques de vues et de demandes. Le stand peut être ouvert gratuitement ; le volume de publications et les services dépendent de la formule choisie.",
    },
    {
      q: "Je souhaite demander un stand physique — à qui m'adresser ?",
      a: "Les demandes et tarifs des stands physiques sont traités par l'organisateur via les canaux officiels (camf.com.cn) ; la fenêtre officielle de candidature allait du 2026-04-26 au 05-15 et est désormais close. Shendiao n'agit pas comme intermédiaire pour les stands physiques.",
    },
  ],
  hi: [
    {
      q: "इस प्रदर्शनी में शेंडियाओ की भूमिका क्या है?",
      a: "शेंडियाओ प्रदर्शकों को 8 भाषाओं वाले ऑनलाइन स्टॉल तथा विदेशी खरीदारों तक पहुँच प्रदान करती है और शेंडियाओ क्लाउड एक्सपो का संचालन करती है। हम न प्रदर्शनी के आयोजक हैं, न इस संस्करण में प्रदर्शक कंपनी। यह पृष्ठ शेंडियाओ की अपनी सेवा है, प्रदर्शनी की आधिकारिक वेबसाइट नहीं। प्रदर्शनी की जानकारी आयोजक की घोषणाओं के अधीन है।",
    },
    {
      q: "प्रदर्शनी कब और कहाँ आयोजित होती है?",
      a: "2026 चीन अंतर्राष्ट्रीय कृषि मशीनरी प्रदर्शनी 26–28 अक्टूबर 2026 को तियानजिन में आयोजित होगी। विशिष्ट स्थल सत्यापन बाकी है — आयोजक की घोषणाएँ देखें।",
    },
    {
      q: "इस प्रदर्शनी का आयोजक कौन है?",
      a: "उपलब्ध अभिलेखों के अनुसार, इस प्रदर्शनी का आयोजन चीन कृषि मशीनरी वितरण संघ, चीन कृषि मशीनरी उद्योग संघ तथा अन्य संस्थाएँ करती हैं (इनमें एक का संक्षिप्त नाम CAAMM है, जिसका पूरा चीनी नाम सत्यापन बाकी है)। आयोजक की घोषणाएँ ही प्रामाणिक स्रोत हैं।",
    },
    {
      q: "ऑनलाइन स्टॉल (शेंडियाओ क्लाउड एक्सपो) में क्या शामिल है?",
      a: "365 दिन का ऑनलाइन स्टॉल, फोटो और वीडियो अपलोड, 8 भाषाओं वाले उत्पाद पृष्ठ, तथा व्यू और पूछताछ के आँकड़े देखने की सुविधा। स्टॉल निःशुल्क खोला जा सकता है; लिस्टिंग की संख्या और सेवाएँ आपके चुने हुए प्लान पर निर्भर करती हैं।",
    },
    {
      q: "मैं स्थल पर स्टॉल हेतु आवेदन करना चाहता हूँ — किससे संपर्क करूँ?",
      a: "स्थल पर स्टॉल के आवेदन और शुल्क आयोजक द्वारा आधिकारिक चैनलों (camf.com.cn) से संभाले जाते हैं; आधिकारिक आवेदन विंडो 2026-04-26 से 05-15 थी और अब बंद हो चुकी है। शेंडियाओ स्थल पर स्टॉल के लिए एजेंट के रूप में कार्य नहीं करती।",
    },
  ],
};
