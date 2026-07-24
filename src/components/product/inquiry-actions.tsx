"use client";

import { useState } from "react";
import { MessageCircle, MessageSquare, Send, CheckCircle, X } from "lucide-react";

const LABELS: Record<string, { inquireNow: string; preSales: string; title: string; subtitle: string; name: string; phone: string; message: string; submit: string; success: string; close: string; note: string }> = {
  zh: { inquireNow: "立即询价", preSales: "售前咨询", title: "售前咨询", subtitle: "留资后卖家将主动与您联系（不进入报价谈判）", name: "您的姓名", phone: "手机号 / WhatsApp", message: "备注（选填）", submit: "提交咨询", success: "咨询已提交！", close: "关闭", note: "平台仅提供信息展示，不收取交易服务费。" },
  en: { inquireNow: "Inquire Now", preSales: "Pre-sales", title: "Pre-sales Inquiry", subtitle: "Leave your contact, the seller will reach out (no negotiation)", name: "Your Name", phone: "Phone / WhatsApp", message: "Notes (optional)", submit: "Submit", success: "Inquiry sent!", close: "Close", note: "Platform is information-only, no transaction fees." },
  ru: { inquireNow: "Запросить цену", preSales: "Консультация", title: "Предпродажная консультация", subtitle: "Оставьте контакт, продавец свяжется", name: "Ваше имя", phone: "Телефон / WhatsApp", message: "Примечания", submit: "Отправить", success: "Отправлено!", close: "Закрыть", note: "Платформа только информирует, без комиссий." },
  es: { inquireNow: "Consultar Precio", preSales: "Consulta", title: "Consulta previa", subtitle: "Deje contacto, el vendedor le contactará", name: "Su Nombre", phone: "Teléfono / WhatsApp", message: "Notas", submit: "Enviar", success: "¡Enviada!", close: "Cerrar", note: "Plataforma solo informa, sin comisiones." },
  pt: { inquireNow: "Consultar Preço", preSales: "Pré-venda", title: "Pré-venda", subtitle: "Deixe contato, o vendedor entrará em contato", name: "Seu Nome", phone: "Telefone / WhatsApp", message: "Notas", submit: "Enviar", success: "Enviada!", close: "Fechar", note: "Plataforma apenas informa, sem taxas." },
  ar: { inquireNow: "استفسار عن السعر", preSales: "استفسار مبدئي", title: "استفسار مبدئي", subtitle: "اترك بياناتك، سيتواصل البائع", name: "اسمك", phone: "الهاتف / واتساب", message: "ملاحظات", submit: "إرسال", success: "تم الإرسال!", close: "إغلاق", note: "المنصة للعرض فقط، بلا رسوم." },
  fr: { inquireNow: "Demander un Prix", preSales: "Pré-vente", title: "Pré-vente", subtitle: "Laissez un contact, le vendeur vous répondra", name: "Votre Nom", phone: "Téléphone / WhatsApp", message: "Notes", submit: "Envoyer", success: "Envoyée!", close: "Fermer", note: "Plateforme d'information, sans frais." },
  hi: { inquireNow: "मूल्य पूछें", preSales: "पूर्व-बिक्री", title: "पूर्व-बिक्री पूछताछ", subtitle: "संपर्क छोड़ें, विक्रेता संपर्क करेगा", name: "आपका नाम", phone: "फ़ोन / WhatsApp", message: "टिप्पणियाँ", submit: "भेजें", success: "भेजा गया!", close: "बंद करें", note: "प्लेटफ़ॉर्म केवल जानकारी, बिना शुल्क।" },
};

interface InquiryActionsProps {
  productId: string;
  productName: string;
  locale: string;
}

export function InquiryActions({ productId, productName, locale }: InquiryActionsProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const l = LABELS[locale] || LABELS.zh;

  const scrollToInquiry = () => {
    document.getElementById("bargain")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
          message: form.message,
        }),
      });
      setSubmitted(true);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {/* 主入口：滚动到统一询价区（Auction/Bid 谈判模型） */}
        <button
          onClick={scrollToInquiry}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl active:scale-[0.98]"
        >
          <MessageCircle className="h-5 w-5" />
          {l.inquireNow}
        </button>
      </div>

      {/* 次要入口：售前咨询（独立 Inquiry 线索通道） */}
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
      >
        <MessageSquare className="h-4 w-4" />
        {l.preSales}
      </button>

      {/* 售前咨询弹窗 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">{l.title}</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <h4 className="mt-4 text-lg font-bold text-gray-900">{l.success}</h4>
                <button onClick={() => setOpen(false)} className="mt-6 rounded-lg bg-gray-100 px-6 py-2 text-sm font-medium">
                  {l.close}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
                <p className="text-sm text-gray-500">{l.subtitle}</p>
                <input
                  required
                  placeholder={l.name}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
                <input
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
                  className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{l.note}</div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
                >
                  {loading ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="h-4 w-4" />}
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
