"use client";

import { useState } from "react";
import { MessageCircle, X, Send, CheckCircle } from "lucide-react";

const LABELS: Record<string, {
  inquireNow: string;
  title: string;
  subtitle: string;
  productName: string;
  expectedPrice: string;
  name: string;
  phone: string;
  message: string;
  submit: string;
  success: string;
  successDesc: string;
  close: string;
  inquiryNote: string;
}> = {
  zh: {
    inquireNow: "立即询价",
    title: "在线询价",
    subtitle: "提交询价信息，卖家将尽快向您报价",
    productName: "询价产品",
    expectedPrice: "期望价格（选填，如 11-13万）",
    name: "您的姓名",
    phone: "手机号 / WhatsApp",
    message: "备注（选填，如看货时间、特殊需求）",
    submit: "提交询价",
    success: "询价提交成功！",
    successDesc: "卖家将尽快通过电话或 WhatsApp 向您报价",
    close: "关闭",
    inquiryNote: "平台仅提供信息展示，不收取交易服务费。实际价格以双方合同为准。",
  },
  en: {
    inquireNow: "Inquire Now",
    title: "Online Inquiry",
    subtitle: "Submit your inquiry, seller will send a quote shortly",
    productName: "Product",
    expectedPrice: "Expected price (optional, e.g. $15k-18k)",
    name: "Your Name",
    phone: "Phone / WhatsApp",
    message: "Notes (optional, e.g. inspection time, requirements)",
    submit: "Submit Inquiry",
    success: "Inquiry Submitted!",
    successDesc: "Seller will contact you with a quote via phone or WhatsApp",
    close: "Close",
    inquiryNote: "Platform provides information display only, no transaction fees. Final price subject to contract.",
  },
  ru: {
    inquireNow: "Запросить цену",
    title: "Онлайн-запрос",
    subtitle: "Отправьте запрос, продавец скоро пришлёт цену",
    productName: "Товар",
    expectedPrice: "Ожидаемая цена (необязательно)",
    name: "Ваше имя",
    phone: "Телефон / WhatsApp",
    message: "Примечания (необязательно)",
    submit: "Отправить запрос",
    success: "Запрос отправлен!",
    successDesc: "Продавец свяжется с вами с предложением цены",
    close: "Закрыть",
    inquiryNote: "Платформа только предоставляет информацию, без комиссий. Цена по договору.",
  },
  es: {
    inquireNow: "Consultar Precio",
    title: "Consulta en Línea",
    subtitle: "Envíe su consulta, el vendedor le cotizará pronto",
    productName: "Producto",
    expectedPrice: "Precio esperado (opcional)",
    name: "Su Nombre",
    phone: "Teléfono / WhatsApp",
    message: "Notas (opcional)",
    submit: "Enviar Consulta",
    success: "¡Consulta Enviada!",
    successDesc: "El vendedor le contactará con una cotización",
    close: "Cerrar",
    inquiryNote: "La plataforma solo muestra información, sin comisiones. Precio según contrato.",
  },
  pt: {
    inquireNow: "Consultar Preço",
    title: "Consulta Online",
    subtitle: "Envie sua consulta, o vendedor enviará uma cotação",
    productName: "Produto",
    expectedPrice: "Preço esperado (opcional)",
    name: "Seu Nome",
    phone: "Telefone / WhatsApp",
    message: "Notas (opcional)",
    submit: "Enviar Consulta",
    success: "Consulta Enviada!",
    successDesc: "O vendedor entrará em contato com uma cotação",
    close: "Fechar",
    inquiryNote: "A plataforma apenas exibe informações, sem taxas. Preço conforme contrato.",
  },
  ar: {
    inquireNow: "استفسار عن السعر",
    title: "استفسار عبر الإنترنت",
    subtitle: "أرسل استفسارك، سيرسل البائع عرض سعر قريباً",
    productName: "المنتج",
    expectedPrice: "السعر المتوقع (اختياري)",
    name: "اسمك",
    phone: "الهاتف / واتساب",
    message: "ملاحظات (اختياري)",
    submit: "إرسال الاستفسار",
    success: "تم إرسال الاستفسار!",
    successDesc: "سيتواصل البائع معك بعرض سعر",
    close: "إغلاق",
    inquiryNote: "المنصة تعرض المعلومات فقط، بدون رسوم. السعر حسب العقد.",
  },
  fr: {
    inquireNow: "Demander un Prix",
    title: "Demande en Ligne",
    subtitle: "Soumettez votre demande, le vendeur vous répondra bientôt",
    productName: "Produit",
    expectedPrice: "Prix attendu (optionnel)",
    name: "Votre Nom",
    phone: "Téléphone / WhatsApp",
    message: "Notes (optionnel)",
    submit: "Envoyer la Demande",
    success: "Demande Envoyée!",
    successDesc: "Le vendeur vous contactera avec un prix",
    close: "Fermer",
    inquiryNote: "La plateforme affiche uniquement les informations, sans frais. Prix selon contrat.",
  },
  hi: {
    inquireNow: "मूल्य पूछें",
    title: "ऑनलाइन पूछताछ",
    subtitle: "अपनी पूछताछ सबमिट करें, विक्रेता जल्द ही कीमत भेजेगा",
    productName: "उत्पाद",
    expectedPrice: "अपेक्षित मूल्य (वैकल्पिक)",
    name: "आपका नाम",
    phone: "फ़ोन / WhatsApp",
    message: "टिप्पणियाँ (वैकल्पिक)",
    submit: "पूछताछ सबमिट करें",
    success: "पूछताछ सबमिट हो गई!",
    successDesc: "विक्रेता जल्द ही आपसे कीमत के साथ संपर्क करेगा",
    close: "बंद करें",
    inquiryNote: "प्लेटफ़ॉर्म केवल जानकारी दिखाता है, कोई शुल्क नहीं। मूल्य अनुबंध के अनुसार।",
  },
};

interface BuyIntentButtonProps {
  productId: string;
  productName: string;
  locale: string;
}

export function BuyIntentButton({ productId, productName, locale }: BuyIntentButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ expectedPrice: "", name: "", phone: "", message: "" });
  const l = LABELS[locale] || LABELS.zh;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setLoading(true);
    try {
      await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          name: form.name,
          phone: form.phone,
          message: `[在线询价] ${productName}${form.expectedPrice ? ` | 期望价: ${form.expectedPrice}` : ""}${form.message ? " | " + form.message : ""}`,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Inquiry submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 主按钮 — 立即询价 */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl active:scale-[0.98]"
      >
        <MessageCircle className="h-5 w-5" />
        {l.inquireNow}
      </button>

      {/* 询价弹窗 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">{l.title}</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {submitted ? (
              /* 成功 */
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <h4 className="mt-4 text-lg font-bold text-gray-900">{l.success}</h4>
                <p className="mt-1 text-sm text-gray-500">{l.successDesc}</p>
                <button onClick={() => setOpen(false)} className="mt-6 rounded-lg bg-gray-100 px-6 py-2 text-sm font-medium">
                  {l.close}
                </button>
              </div>
            ) : (
              /* 表单 */
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                <p className="text-sm text-gray-500">{l.subtitle}</p>

                {/* 产品名（只读） */}
                <div className="rounded-lg bg-gray-50 px-4 py-2.5">
                  <span className="text-xs text-gray-400">{l.productName}</span>
                  <p className="text-sm font-medium text-gray-700">{productName}</p>
                </div>

                {/* 期望价格（选填） */}
                <input
                  type="text"
                  placeholder={l.expectedPrice}
                  value={form.expectedPrice}
                  onChange={(e) => setForm({ ...form, expectedPrice: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />

                <input
                  type="text"
                  required
                  placeholder={l.name}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder={l.phone}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
                <textarea
                  rows={2}
                  placeholder={l.message}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none resize-none"
                />

                {/* 询价说明 */}
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {l.inquiryNote}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {l.submit}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
