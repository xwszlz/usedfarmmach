"use client";
import { useState } from "react";
import { MessageCircle, MessageSquare, Send, CheckCircle, X } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
function getLABELS(tr: (s: string) => string): Record<string, {
    inquireNow: string;
    preSales: string;
    title: string;
    subtitle: string;
    name: string;
    phone: string;
    message: string;
    submit: string;
    success: string;
    close: string;
    note: string;
}> {
  return {
    zh: { inquireNow: "\u7ACB\u5373\u8BE2\u4EF7", preSales: "\u552E\u524D\u54A8\u8BE2", title: tr("售前咨询"), subtitle: "\u7559\u8D44\u540E\u5356\u5BB6\u5C06\u4E3B\u52A8\u4E0E\u60A8\u8054\u7CFB\uFF08\u4E0D\u8FDB\u5165\u62A5\u4EF7\u8C08\u5224\uFF09", name: tr("您的姓名"), phone: "\u624B\u673A\u53F7 / WhatsApp", message: tr("备注（选填）"), submit: "\u63D0\u4EA4\u54A8\u8BE2", success: "\u54A8\u8BE2\u5DF2\u63D0\u4EA4\uFF01", close: "\u5173\u95ED", note: "\u5E73\u53F0\u4EC5\u63D0\u4F9B\u4FE1\u606F\u5C55\u793A\uFF0C\u4E0D\u6536\u53D6\u4EA4\u6613\u670D\u52A1\u8D39\u3002" },
    en: { inquireNow: "Inquire Now", preSales: "Pre-sales", title: "Pre-sales Inquiry", subtitle: "Leave your contact, the seller will reach out (no negotiation)", name: "Your Name", phone: "Phone / WhatsApp", message: "Notes (optional)", submit: "Submit", success: "Inquiry sent!", close: "Close", note: "Platform is information-only, no transaction fees." },
    ru: { inquireNow: "\u0417\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0446\u0435\u043D\u0443", preSales: "\u041A\u043E\u043D\u0441\u0443\u043B\u044C\u0442\u0430\u0446\u0438\u044F", title: "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0434\u0430\u0436\u043D\u0430\u044F \u043A\u043E\u043D\u0441\u0443\u043B\u044C\u0442\u0430\u0446\u0438\u044F", subtitle: "\u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043A\u043E\u043D\u0442\u0430\u043A\u0442, \u043F\u0440\u043E\u0434\u0430\u0432\u0435\u0446 \u0441\u0432\u044F\u0436\u0435\u0442\u0441\u044F", name: "\u0412\u0430\u0448\u0435 \u0438\u043C\u044F", phone: "\u0422\u0435\u043B\u0435\u0444\u043E\u043D / WhatsApp", message: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F", submit: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C", success: "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E!", close: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", note: "\u041F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u043D\u0444\u043E\u0440\u043C\u0438\u0440\u0443\u0435\u0442, \u0431\u0435\u0437 \u043A\u043E\u043C\u0438\u0441\u0441\u0438\u0439." },
    es: { inquireNow: "Consultar Precio", preSales: "Consulta", title: "Consulta previa", subtitle: "Deje contacto, el vendedor le contactar\u00E1", name: "Su Nombre", phone: "Tel\u00E9fono / WhatsApp", message: "Notas", submit: "Enviar", success: "\u00A1Enviada!", close: "Cerrar", note: "Plataforma solo informa, sin comisiones." },
    pt: { inquireNow: "Consultar Pre\u00E7o", preSales: "Pr\u00E9-venda", title: "Pr\u00E9-venda", subtitle: "Deixe contato, o vendedor entrar\u00E1 em contato", name: "Seu Nome", phone: "Telefone / WhatsApp", message: "Notas", submit: "Enviar", success: "Enviada!", close: "Fechar", note: "Plataforma apenas informa, sem taxas." },
    ar: { inquireNow: "\u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0639\u0646 \u0627\u0644\u0633\u0639\u0631", preSales: "\u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0645\u0628\u062F\u0626\u064A", title: "\u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0645\u0628\u062F\u0626\u064A", subtitle: "\u0627\u062A\u0631\u0643 \u0628\u064A\u0627\u0646\u0627\u062A\u0643\u060C \u0633\u064A\u062A\u0648\u0627\u0635\u0644 \u0627\u0644\u0628\u0627\u0626\u0639", name: "\u0627\u0633\u0645\u0643", phone: "\u0627\u0644\u0647\u0627\u062A\u0641 / \u0648\u0627\u062A\u0633\u0627\u0628", message: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A", submit: "\u0625\u0631\u0633\u0627\u0644", success: "\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644!", close: "\u0625\u063A\u0644\u0627\u0642", note: "\u0627\u0644\u0645\u0646\u0635\u0629 \u0644\u0644\u0639\u0631\u0636 \u0641\u0642\u0637\u060C \u0628\u0644\u0627 \u0631\u0633\u0648\u0645." },
    fr: { inquireNow: "Demander un Prix", preSales: "Pr\u00E9-vente", title: "Pr\u00E9-vente", subtitle: "Laissez un contact, le vendeur vous r\u00E9pondra", name: "Votre Nom", phone: "T\u00E9l\u00E9phone / WhatsApp", message: "Notes", submit: "Envoyer", success: "Envoy\u00E9e!", close: "Fermer", note: "Plateforme d'information, sans frais." },
    hi: { inquireNow: "\u092E\u0942\u0932\u094D\u092F \u092A\u0942\u091B\u0947\u0902", preSales: "\u092A\u0942\u0930\u094D\u0935-\u092C\u093F\u0915\u094D\u0930\u0940", title: "\u092A\u0942\u0930\u094D\u0935-\u092C\u093F\u0915\u094D\u0930\u0940 \u092A\u0942\u091B\u0924\u093E\u091B", subtitle: "\u0938\u0902\u092A\u0930\u094D\u0915 \u091B\u094B\u0921\u093C\u0947\u0902, \u0935\u093F\u0915\u094D\u0930\u0947\u0924\u093E \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0917\u093E", name: "\u0906\u092A\u0915\u093E \u0928\u093E\u092E", phone: "\u092B\u093C\u094B\u0928 / WhatsApp", message: "\u091F\u093F\u092A\u094D\u092A\u0923\u093F\u092F\u093E\u0901", submit: "\u092D\u0947\u091C\u0947\u0902", success: "\u092D\u0947\u091C\u093E \u0917\u092F\u093E!", close: "\u092C\u0902\u0926 \u0915\u0930\u0947\u0902", note: "\u092A\u094D\u0932\u0947\u091F\u092B\u093C\u0949\u0930\u094D\u092E \u0915\u0947\u0935\u0932 \u091C\u093E\u0928\u0915\u093E\u0930\u0940, \u092C\u093F\u0928\u093E \u0936\u0941\u0932\u094D\u0915\u0964" },
};
}
interface InquiryActionsProps {
    productId: string;
    productName: string;
    locale: string;
}
export function InquiryActions({ productId, productName, locale }: InquiryActionsProps) {
  const tr = useTr();
        const [open, setOpen] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ name: "", phone: "", message: "" });
    const l = getLABELS(tr)[locale] || getLABELS(tr).zh;
    const scrollToInquiry = () => {
        document.getElementById("bargain")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.phone)
            return;
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
        }
        catch {
            /* noop */
        }
        finally {
            setLoading(false);
        }
    };
    return (<>
      <div className="flex items-center gap-3">
        {/* 主入口：滚动到统一询价区（Auction/Bid 谈判模型） */}
        <button onClick={scrollToInquiry} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl active:scale-[0.98]">
          <MessageCircle className="h-5 w-5"/>
          {l.inquireNow}
        </button>
      </div>

      {/* 次要入口：售前咨询（独立 Inquiry 线索通道） */}
      <button onClick={() => setOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
        <MessageSquare className="h-4 w-4"/>
        {l.preSales}
      </button>

      {/* 售前咨询弹窗 */}
      {open && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">{l.title}</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400"/>
              </button>
            </div>

            {submitted ? (<div className="flex flex-col items-center px-6 py-10 text-center">
                <CheckCircle className="h-16 w-16 text-green-500"/>
                <h4 className="mt-4 text-lg font-bold text-gray-900">{l.success}</h4>
                <button onClick={() => setOpen(false)} className="mt-6 rounded-lg bg-gray-100 px-6 py-2 text-sm font-medium">
                  {l.close}
                </button>
              </div>) : (<form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
                <p className="text-sm text-gray-500">{l.subtitle}</p>
                <input required placeholder={l.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"/>
                <input required placeholder={l.phone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"/>
                <textarea rows={2} placeholder={l.message} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"/>
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{l.note}</div>
                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50">
                  {loading ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/> : <Send className="h-4 w-4"/>}
                  {l.submit}
                </button>
              </form>)}
          </div>
        </div>)}
    </>);
}
