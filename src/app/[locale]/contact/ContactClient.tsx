"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { EmailLink } from "@/components/ui/email-link";

/**
 * 「联系我们」表单。
 *
 * 核心目的：给访客一条**不依赖本机邮件客户端**的联络通路。
 * 2026-11-21 实测：站内原无联系页（`/en/contact` 404），访客只能点邮箱，而 Windows 11
 * 已移除自带「邮件」应用、`mailto` 关联常常指向已卸载程序 ⇒ 点下去是空白页。
 *
 * 文案走本地 COPY 表（与 seller-contact-card 的 LABELS 同一套做法），
 * 不动 messages/*.json，也不往生成式字典里塞一屏新条目。
 */

interface Copy {
  title: string;
  subtitle: string;
  badge: string;
  cardSales: string;
  cardSalesDesc: string;
  cardSupport: string;
  cardSupportDesc: string;
  cardPartner: string;
  cardPartnerDesc: string;
  formTitle: string;
  name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
  submit: string;
  submitting: string;
  okTitle: string;
  okDesc: string;
  again: string;
  errRequired: string;
  errEmail: string;
  errFailed: string;
  privacyNote: string;
  tSales: string;
  tSupport: string;
  tPartner: string;
  tOther: string;
  /** 下拉框下方那行小字：告诉访客四个主题分别该在什么情况下选，避免乱选投错团队 */
  topicHint: string;
}

const COPY: Record<string, Copy> = {
  zh: {
    title: "联系我们",
    subtitle: "选最省事的方式联系我们。下面的表单不需要你电脑上装任何邮件软件。",
    badge: "1 个工作日内回复",
    cardSales: "销售询盘",
    cardSalesDesc: "购机、配件、验机预约",
    cardSupport: "售后支持",
    cardSupportDesc: "账号、订单、技术问题",
    cardPartner: "商务合作",
    cardPartnerDesc: "媒体联络、目录收录",
    formTitle: "在线留言",
    name: "姓名",
    email: "邮箱",
    phone: "电话（选填）",
    topic: "咨询主题",
    message: "留言内容",
    submit: "提交",
    submitting: "提交中…",
    okTitle: "已收到",
    okDesc: "我们会在 1 个工作日内回复你。",
    again: "再发一条",
    errRequired: "请填写姓名、邮箱和留言内容",
    errEmail: "邮箱格式不正确",
    errFailed: "提交失败，请稍后再试，或直接发邮件给我们。",
    privacyNote: "你的信息只用于回复本次咨询，不会用于营销推广。",
    tSales: "购机 / 配件询价",
    tSupport: "售后 / 账号支持",
    tPartner: "商务合作 / 媒体",
    tOther: "其他",
    topicHint:
      "买机器、问配件选「购机 / 配件询价」；订单或账号出问题选「售后 / 账号支持」；拿不准选「其他」，我们会转给对应同事。",
  },
  en: {
    title: "Contact us",
    subtitle: "Pick whichever is easiest. The form below does not need any mail app on your computer.",
    badge: "Reply within 1 business day",
    cardSales: "Sales enquiry",
    cardSalesDesc: "Machines, parts, inspection booking",
    cardSupport: "Support",
    cardSupportDesc: "Account, orders, technical issues",
    cardPartner: "Partnership",
    cardPartnerDesc: "Media, directory listing",
    formTitle: "Send a message",
    name: "Name",
    email: "Email",
    phone: "Phone (optional)",
    topic: "Topic",
    message: "Message",
    submit: "Send",
    submitting: "Sending…",
    okTitle: "Received",
    okDesc: "We will reply within 1 business day.",
    again: "Send another",
    errRequired: "Name, email and message are required",
    errEmail: "That email address looks invalid",
    errFailed: "Failed to send. Please retry, or email us directly.",
    privacyNote: "Your details are used only to answer this enquiry. No marketing.",
    tSales: "Machines / parts",
    tSupport: "Support / account",
    tPartner: "Partnership / media",
    tOther: "Other",
    topicHint:
      "Buying or asking about equipment: choose “Machines / parts”. Order or account issue: “Support / account”. Not sure: “Other” — we will route it to the right team.",
  },
  ru: {
    title: "Связаться с нами",
    subtitle: "Выберите удобный способ. Форма ниже не требует почтовой программы на компьютере.",
    badge: "Ответ в течение 1 рабочего дня",
    cardSales: "Отдел продаж",
    cardSalesDesc: "Техника, запчасти, запись на осмотр",
    cardSupport: "Поддержка",
    cardSupportDesc: "Аккаунт, заказы, технические вопросы",
    cardPartner: "Сотрудничество",
    cardPartnerDesc: "СМИ, размещение в каталогах",
    formTitle: "Написать нам",
    name: "Имя",
    email: "Эл. почта",
    phone: "Телефон (необязательно)",
    topic: "Тема",
    message: "Сообщение",
    submit: "Отправить",
    submitting: "Отправка…",
    okTitle: "Получено",
    okDesc: "Мы ответим в течение 1 рабочего дня.",
    again: "Отправить ещё",
    errRequired: "Укажите имя, эл. почту и сообщение",
    errEmail: "Неверный формат эл. почты",
    errFailed: "Не удалось отправить. Повторите попытку или напишите нам напрямую.",
    privacyNote: "Данные используются только для ответа на запрос. Без рассылок.",
    tSales: "Техника / запчасти",
    tSupport: "Поддержка / аккаунт",
    tPartner: "Сотрудничество / СМИ",
    tOther: "Другое",
    topicHint:
      "Покупка техники или запчастей — «Техника / запчасти»; проблема с заказом или аккаунтом — «Поддержка / аккаунт»; не уверены — «Другое», перешлём нужному отделу.",
  },
  es: {
    title: "Contáctenos",
    subtitle: "Elija la forma más sencilla. El formulario no necesita ningún programa de correo instalado.",
    badge: "Respuesta en 1 día hábil",
    cardSales: "Consulta comercial",
    cardSalesDesc: "Máquinas, repuestos, cita de inspección",
    cardSupport: "Soporte",
    cardSupportDesc: "Cuenta, pedidos, temas técnicos",
    cardPartner: "Alianzas",
    cardPartnerDesc: "Medios, inclusión en directorios",
    formTitle: "Enviar un mensaje",
    name: "Nombre",
    email: "Correo electrónico",
    phone: "Teléfono (opcional)",
    topic: "Tema",
    message: "Mensaje",
    submit: "Enviar",
    submitting: "Enviando…",
    okTitle: "Recibido",
    okDesc: "Responderemos en 1 día hábil.",
    again: "Enviar otro",
    errRequired: "Indique nombre, correo y mensaje",
    errEmail: "El correo no es válido",
    errFailed: "No se pudo enviar. Reintente o escríbanos directamente.",
    privacyNote: "Sus datos solo se usan para responder a esta consulta. Sin publicidad.",
    tSales: "Máquinas / repuestos",
    tSupport: "Soporte / cuenta",
    tPartner: "Alianzas / medios",
    tOther: "Otro",
    topicHint:
      "Comprar o preguntar por máquinas o repuestos: «Máquinas / repuestos». Problema con un pedido o su cuenta: «Soporte / cuenta». Si no está seguro: «Otro», lo derivamos al equipo correcto.",
  },
  pt: {
    title: "Fale conosco",
    subtitle: "Escolha o caminho mais simples. O formulário não exige nenhum programa de e-mail instalado.",
    badge: "Resposta em 1 dia útil",
    cardSales: "Consulta comercial",
    cardSalesDesc: "Máquinas, peças, agendamento de vistoria",
    cardSupport: "Suporte",
    cardSupportDesc: "Conta, pedidos, questões técnicas",
    cardPartner: "Parcerias",
    cardPartnerDesc: "Mídia, inclusão em diretórios",
    formTitle: "Enviar mensagem",
    name: "Nome",
    email: "E-mail",
    phone: "Telefone (opcional)",
    topic: "Assunto",
    message: "Mensagem",
    submit: "Enviar",
    submitting: "Enviando…",
    okTitle: "Recebido",
    okDesc: "Responderemos em 1 dia útil.",
    again: "Enviar outra",
    errRequired: "Informe nome, e-mail e mensagem",
    errEmail: "E-mail inválido",
    errFailed: "Falha no envio. Tente novamente ou escreva diretamente para nós.",
    privacyNote: "Seus dados são usados apenas para responder a esta consulta. Sem marketing.",
    tSales: "Máquinas / peças",
    tSupport: "Suporte / conta",
    tPartner: "Parcerias / mídia",
    tOther: "Outro",
    topicHint:
      "Comprar ou perguntar sobre máquinas ou peças: «Máquinas / peças». Problema com pedido ou conta: «Suporte / conta». Em dúvida: «Outro», encaminhamos à equipe certa.",
  },
  fr: {
    title: "Nous contacter",
    subtitle: "Choisissez le plus simple. Le formulaire ne nécessite aucun logiciel de messagerie installé.",
    badge: "Réponse sous 1 jour ouvré",
    cardSales: "Demande commerciale",
    cardSalesDesc: "Machines, pièces, rendez-vous d'inspection",
    cardSupport: "Assistance",
    cardSupportDesc: "Compte, commandes, questions techniques",
    cardPartner: "Partenariats",
    cardPartnerDesc: "Presse, référencement d'annuaire",
    formTitle: "Envoyer un message",
    name: "Nom",
    email: "E-mail",
    phone: "Téléphone (facultatif)",
    topic: "Sujet",
    message: "Message",
    submit: "Envoyer",
    submitting: "Envoi…",
    okTitle: "Bien reçu",
    okDesc: "Nous répondrons sous 1 jour ouvré.",
    again: "Envoyer un autre",
    errRequired: "Indiquez nom, e-mail et message",
    errEmail: "Adresse e-mail invalide",
    errFailed: "Échec de l'envoi. Réessayez ou écrivez-nous directement.",
    privacyNote: "Vos données servent uniquement à répondre à cette demande. Aucun démarchage.",
    tSales: "Machines / pièces",
    tSupport: "Assistance / compte",
    tPartner: "Partenariats / presse",
    tOther: "Autre",
    topicHint:
      "Acheter ou se renseigner sur des machines ou pièces : « Machines / pièces ». Problème de commande ou de compte : « Assistance / compte ». Sans certitude : « Autre », nous transmettons au bon service.",
  },
  ar: {
    title: "اتصل بنا",
    subtitle: "اختر الطريقة الأسهل. النموذج أدناه لا يحتاج إلى أي برنامج بريد على جهازك.",
    badge: "الرد خلال يوم عمل واحد",
    cardSales: "استفسار المبيعات",
    cardSalesDesc: "الآلات، قطع الغيار، حجز الفحص",
    cardSupport: "الدعم",
    cardSupportDesc: "الحساب، الطلبات، المشكلات الفنية",
    cardPartner: "الشراكات",
    cardPartnerDesc: "الإعلام، الإدراج في الأدلة",
    formTitle: "أرسل رسالة",
    name: "الاسم",
    email: "البريد الإلكتروني",
    phone: "الهاتف (اختياري)",
    topic: "الموضوع",
    message: "الرسالة",
    submit: "إرسال",
    submitting: "جارٍ الإرسال…",
    okTitle: "تم الاستلام",
    okDesc: "سنرد خلال يوم عمل واحد.",
    again: "إرسال رسالة أخرى",
    errRequired: "يرجى إدخال الاسم والبريد والرسالة",
    errEmail: "صيغة البريد الإلكتروني غير صحيحة",
    errFailed: "فشل الإرسال. حاول مرة أخرى أو راسلنا مباشرة.",
    privacyNote: "تُستخدم بياناتك للرد على هذا الاستفسار فقط. دون أي تسويق.",
    tSales: "الآلات / قطع الغيار",
    tSupport: "الدعم / الحساب",
    tPartner: "الشراكات / الإعلام",
    tOther: "أخرى",
    topicHint:
      "للشراء أو الاستفسار عن الآلات وقطع الغيار: «الآلات / قطع الغيار». لمشكلة في طلب أو حساب: «الدعم / الحساب». إن لم تكن متأكداً: «أخرى»، وسنوجّه رسالتك إلى القسم المختص.",
  },
  hi: {
    title: "संपर्क करें",
    subtitle: "जो सबसे आसान हो वह चुनें। नीचे दिया फ़ॉर्म किसी ईमेल ऐप पर निर्भर नहीं करता।",
    badge: "1 कार्य दिवस में उत्तर",
    cardSales: "बिक्री पूछताछ",
    cardSalesDesc: "मशीनें, पुर्ज़े, निरीक्षण बुकिंग",
    cardSupport: "सहायता",
    cardSupportDesc: "खाता, ऑर्डर, तकनीकी समस्याएँ",
    cardPartner: "साझेदारी",
    cardPartnerDesc: "मीडिया, डायरेक्टरी लिस्टिंग",
    formTitle: "संदेश भेजें",
    name: "नाम",
    email: "ईमेल",
    phone: "फ़ोन (वैकल्पिक)",
    topic: "विषय",
    message: "संदेश",
    submit: "भेजें",
    submitting: "भेजा जा रहा है…",
    okTitle: "प्राप्त हुआ",
    okDesc: "हम 1 कार्य दिवस में उत्तर देंगे।",
    again: "एक और भेजें",
    errRequired: "कृपया नाम, ईमेल और संदेश भरें",
    errEmail: "ईमेल का प्रारूप ग़लत है",
    errFailed: "भेजने में विफल। पुनः प्रयास करें या सीधे हमें ईमेल करें।",
    privacyNote: "आपकी जानकारी केवल इस पूछताछ का उत्तर देने के लिए है। कोई मार्केटिंग नहीं।",
    tSales: "मशीनें / पुर्ज़े",
    tSupport: "सहायता / खाता",
    tPartner: "साझेदारी / मीडिया",
    tOther: "अन्य",
    topicHint:
      "मशीन या पुर्ज़े खरीदने/पूछने के लिए: «मशीनें / पुर्ज़े»। ऑर्डर या खाते की समस्या के लिए: «सहायता / खाता»। समझ न आए तो: «अन्य» चुनें, हम इसे सही टीम तक पहुँचा देंगे।",
  },
};

interface ContactClientProps {
  locale: string;
  salesEmail: string;
  supportEmail: string;
  marketingEmail: string;
}

export function ContactClient({
  locale,
  salesEmail,
  supportEmail,
  marketingEmail,
}: ContactClientProps) {
  const t = COPY[locale] || COPY.en;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState("sales");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // .cn 只开通了 support：sales/marketing getter 会回退成同一个地址，
  // 这里按地址去重，避免三张卡片显示同一个邮箱。sales 相同则让 support 卡片顶上。
  const cards = [
    supportEmail === salesEmail
      ? null
      : { title: t.cardSales, desc: t.cardSalesDesc, email: salesEmail },
    { title: t.cardSupport, desc: t.cardSupportDesc, email: supportEmail },
    marketingEmail === supportEmail || marketingEmail === salesEmail
      ? null
      : { title: t.cardPartner, desc: t.cardPartnerDesc, email: marketingEmail },
  ].filter((x): x is { title: string; desc: string; email: string } => x !== null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError(t.errRequired);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError(t.errEmail);
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          topic,
          message,
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(t.errFailed);
        return;
      }
      setDone(true);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch {
      setError(t.errFailed);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
          {t.badge}
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-400">{t.subtitle}</p>

      {/* 邮箱卡片：点地址即复制，末尾小信封给装了客户端的用户走原生 mailto */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.email}
            className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
          >
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{c.title}</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{c.desc}</p>
            <div className="mt-3 text-sm">
              <EmailLink
                email={c.email}
                locale={locale}
                className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 sm:p-8">
        {done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
              {t.okTitle}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t.okDesc}</p>
            <button
              type="button"
              onClick={() => setDone(false)}
              className="mt-6 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t.again}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t.formTitle}
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.name} *
                </span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.email} *
                </span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={160}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.phone}
                </span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={40}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </label>

              {/*
                这里不用 <label> 包住整个区块：提示小字如果落在 label 内部，会被算进
                下拉框的 accessible name，读屏器每次聚焦都会把整段说明念一遍。
                改成 label[htmlFor] + id 显式关联，提示语用 aria-describedby 挂上去。
              */}
              <div className="block">
                <label
                  htmlFor="contact-topic"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t.topic}
                </label>
                <select
                  id="contact-topic"
                  aria-describedby="contact-topic-hint"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="sales">{t.tSales}</option>
                  <option value="support">{t.tSupport}</option>
                  <option value="partner">{t.tPartner}</option>
                  <option value="other">{t.tOther}</option>
                </select>
                <p
                  id="contact-topic-hint"
                  className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400"
                >
                  {t.topicHint}
                </p>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.message} *
              </span>
              <textarea
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </label>

            {/* 蜜罐：对真人隐藏，机器人会填 */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              aria-hidden="true"
              className="pointer-events-none absolute h-0 w-0 opacity-0"
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {sending ? t.submitting : t.submit}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t.privacyNote}</p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
