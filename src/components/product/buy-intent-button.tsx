"use client";
import { useState } from "react";
import { MessageCircle, X, Send, CheckCircle } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
function getLABELS(tr: (s: string) => string): Record<string, {
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
}> {
  return {
    zh: {
        inquireNow: "\u7ACB\u5373\u8BE2\u4EF7",
        title: tr("在线询价"),
        subtitle: "\u63D0\u4EA4\u8BE2\u4EF7\u4FE1\u606F\uFF0C\u5356\u5BB6\u5C06\u5C3D\u5FEB\u5411\u60A8\u62A5\u4EF7",
        productName: "\u8BE2\u4EF7\u4EA7\u54C1",
        expectedPrice: "\u671F\u671B\u4EF7\u683C\uFF08\u9009\u586B\uFF0C\u5982 11-13\u4E07\uFF09",
        name: tr("您的姓名"),
        phone: "\u624B\u673A\u53F7 / WhatsApp",
        message: tr("备注（选填，如看货时间、特殊需求）"),
        submit: "\u63D0\u4EA4\u8BE2\u4EF7",
        success: "\u8BE2\u4EF7\u63D0\u4EA4\u6210\u529F\uFF01",
        successDesc: "\u5356\u5BB6\u5C06\u5C3D\u5FEB\u901A\u8FC7\u7535\u8BDD\u6216 WhatsApp \u5411\u60A8\u62A5\u4EF7",
        close: "\u5173\u95ED",
        inquiryNote: "\u5E73\u53F0\u4EC5\u63D0\u4F9B\u4FE1\u606F\u5C55\u793A\uFF0C\u4E0D\u6536\u53D6\u4EA4\u6613\u670D\u52A1\u8D39\u3002\u5B9E\u9645\u4EF7\u683C\u4EE5\u53CC\u65B9\u5408\u540C\u4E3A\u51C6\u3002",
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
        inquireNow: "\u0417\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0446\u0435\u043D\u0443",
        title: "\u041E\u043D\u043B\u0430\u0439\u043D-\u0437\u0430\u043F\u0440\u043E\u0441",
        subtitle: "\u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441, \u043F\u0440\u043E\u0434\u0430\u0432\u0435\u0446 \u0441\u043A\u043E\u0440\u043E \u043F\u0440\u0438\u0448\u043B\u0451\u0442 \u0446\u0435\u043D\u0443",
        productName: "\u0422\u043E\u0432\u0430\u0440",
        expectedPrice: "\u041E\u0436\u0438\u0434\u0430\u0435\u043C\u0430\u044F \u0446\u0435\u043D\u0430 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)",
        name: "\u0412\u0430\u0448\u0435 \u0438\u043C\u044F",
        phone: "\u0422\u0435\u043B\u0435\u0444\u043E\u043D / WhatsApp",
        message: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)",
        submit: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441",
        success: "\u0417\u0430\u043F\u0440\u043E\u0441 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D!",
        successDesc: "\u041F\u0440\u043E\u0434\u0430\u0432\u0435\u0446 \u0441\u0432\u044F\u0436\u0435\u0442\u0441\u044F \u0441 \u0432\u0430\u043C\u0438 \u0441 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435\u043C \u0446\u0435\u043D\u044B",
        close: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
        inquiryNote: "\u041F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E, \u0431\u0435\u0437 \u043A\u043E\u043C\u0438\u0441\u0441\u0438\u0439. \u0426\u0435\u043D\u0430 \u043F\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443.",
    },
    es: {
        inquireNow: "Consultar Precio",
        title: "Consulta en L\u00EDnea",
        subtitle: "Env\u00EDe su consulta, el vendedor le cotizar\u00E1 pronto",
        productName: "Producto",
        expectedPrice: "Precio esperado (opcional)",
        name: "Su Nombre",
        phone: "Tel\u00E9fono / WhatsApp",
        message: "Notas (opcional)",
        submit: "Enviar Consulta",
        success: "\u00A1Consulta Enviada!",
        successDesc: "El vendedor le contactar\u00E1 con una cotizaci\u00F3n",
        close: "Cerrar",
        inquiryNote: "La plataforma solo muestra informaci\u00F3n, sin comisiones. Precio seg\u00FAn contrato.",
    },
    pt: {
        inquireNow: "Consultar Pre\u00E7o",
        title: "Consulta Online",
        subtitle: "Envie sua consulta, o vendedor enviar\u00E1 uma cota\u00E7\u00E3o",
        productName: "Produto",
        expectedPrice: "Pre\u00E7o esperado (opcional)",
        name: "Seu Nome",
        phone: "Telefone / WhatsApp",
        message: "Notas (opcional)",
        submit: "Enviar Consulta",
        success: "Consulta Enviada!",
        successDesc: "O vendedor entrar\u00E1 em contato com uma cota\u00E7\u00E3o",
        close: "Fechar",
        inquiryNote: "A plataforma apenas exibe informa\u00E7\u00F5es, sem taxas. Pre\u00E7o conforme contrato.",
    },
    ar: {
        inquireNow: "\u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0639\u0646 \u0627\u0644\u0633\u0639\u0631",
        title: "\u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0639\u0628\u0631 \u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A",
        subtitle: "\u0623\u0631\u0633\u0644 \u0627\u0633\u062A\u0641\u0633\u0627\u0631\u0643\u060C \u0633\u064A\u0631\u0633\u0644 \u0627\u0644\u0628\u0627\u0626\u0639 \u0639\u0631\u0636 \u0633\u0639\u0631 \u0642\u0631\u064A\u0628\u0627\u064B",
        productName: "\u0627\u0644\u0645\u0646\u062A\u062C",
        expectedPrice: "\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0645\u062A\u0648\u0642\u0639 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)",
        name: "\u0627\u0633\u0645\u0643",
        phone: "\u0627\u0644\u0647\u0627\u062A\u0641 / \u0648\u0627\u062A\u0633\u0627\u0628",
        message: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)",
        submit: "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631",
        success: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631!",
        successDesc: "\u0633\u064A\u062A\u0648\u0627\u0635\u0644 \u0627\u0644\u0628\u0627\u0626\u0639 \u0645\u0639\u0643 \u0628\u0639\u0631\u0636 \u0633\u0639\u0631",
        close: "\u0625\u063A\u0644\u0627\u0642",
        inquiryNote: "\u0627\u0644\u0645\u0646\u0635\u0629 \u062A\u0639\u0631\u0636 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0641\u0642\u0637\u060C \u0628\u062F\u0648\u0646 \u0631\u0633\u0648\u0645. \u0627\u0644\u0633\u0639\u0631 \u062D\u0633\u0628 \u0627\u0644\u0639\u0642\u062F.",
    },
    fr: {
        inquireNow: "Demander un Prix",
        title: "Demande en Ligne",
        subtitle: "Soumettez votre demande, le vendeur vous r\u00E9pondra bient\u00F4t",
        productName: "Produit",
        expectedPrice: "Prix attendu (optionnel)",
        name: "Votre Nom",
        phone: "T\u00E9l\u00E9phone / WhatsApp",
        message: "Notes (optionnel)",
        submit: "Envoyer la Demande",
        success: "Demande Envoy\u00E9e!",
        successDesc: "Le vendeur vous contactera avec un prix",
        close: "Fermer",
        inquiryNote: "La plateforme affiche uniquement les informations, sans frais. Prix selon contrat.",
    },
    hi: {
        inquireNow: "\u092E\u0942\u0932\u094D\u092F \u092A\u0942\u091B\u0947\u0902",
        title: "\u0911\u0928\u0932\u093E\u0907\u0928 \u092A\u0942\u091B\u0924\u093E\u091B",
        subtitle: "\u0905\u092A\u0928\u0940 \u092A\u0942\u091B\u0924\u093E\u091B \u0938\u092C\u092E\u093F\u091F \u0915\u0930\u0947\u0902, \u0935\u093F\u0915\u094D\u0930\u0947\u0924\u093E \u091C\u0932\u094D\u0926 \u0939\u0940 \u0915\u0940\u092E\u0924 \u092D\u0947\u091C\u0947\u0917\u093E",
        productName: "\u0909\u0924\u094D\u092A\u093E\u0926",
        expectedPrice: "\u0905\u092A\u0947\u0915\u094D\u0937\u093F\u0924 \u092E\u0942\u0932\u094D\u092F (\u0935\u0948\u0915\u0932\u094D\u092A\u093F\u0915)",
        name: "\u0906\u092A\u0915\u093E \u0928\u093E\u092E",
        phone: "\u092B\u093C\u094B\u0928 / WhatsApp",
        message: "\u091F\u093F\u092A\u094D\u092A\u0923\u093F\u092F\u093E\u0901 (\u0935\u0948\u0915\u0932\u094D\u092A\u093F\u0915)",
        submit: "\u092A\u0942\u091B\u0924\u093E\u091B \u0938\u092C\u092E\u093F\u091F \u0915\u0930\u0947\u0902",
        success: "\u092A\u0942\u091B\u0924\u093E\u091B \u0938\u092C\u092E\u093F\u091F \u0939\u094B \u0917\u0908!",
        successDesc: "\u0935\u093F\u0915\u094D\u0930\u0947\u0924\u093E \u091C\u0932\u094D\u0926 \u0939\u0940 \u0906\u092A\u0938\u0947 \u0915\u0940\u092E\u0924 \u0915\u0947 \u0938\u093E\u0925 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0917\u093E",
        close: "\u092C\u0902\u0926 \u0915\u0930\u0947\u0902",
        inquiryNote: "\u092A\u094D\u0932\u0947\u091F\u092B\u093C\u0949\u0930\u094D\u092E \u0915\u0947\u0935\u0932 \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0926\u093F\u0916\u093E\u0924\u093E \u0939\u0948, \u0915\u094B\u0908 \u0936\u0941\u0932\u094D\u0915 \u0928\u0939\u0940\u0902\u0964 \u092E\u0942\u0932\u094D\u092F \u0905\u0928\u0941\u092C\u0902\u0927 \u0915\u0947 \u0905\u0928\u0941\u0938\u093E\u0930\u0964",
    },
};
}
interface BuyIntentButtonProps {
    productId: string;
    productName: string;
    locale: string;
}
export function BuyIntentButton({ productId, productName, locale }: BuyIntentButtonProps) {
  const tr = useTr();
        const [open, setOpen] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ expectedPrice: "", name: "", phone: "", message: "" });
    const l = getLABELS(tr)[locale] || getLABELS(tr).zh;
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
                    message: `[在线询价] ${productName}${form.expectedPrice ? ` | 期望价: ${form.expectedPrice}` : ""}${form.message ? " | " + form.message : ""}`,
                }),
            });
            setSubmitted(true);
        }
        catch (err) {
            console.error("Inquiry submit error:", err);
        }
        finally {
            setLoading(false);
        }
    };
    return (<>
      {/* 主按钮 — 立即询价 */}
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl active:scale-[0.98]">
        <MessageCircle className="h-5 w-5"/>
        {l.inquireNow}
      </button>

      {/* 询价弹窗 */}
      {open && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* 头部 */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">{l.title}</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400"/>
              </button>
            </div>

            {submitted ? (
            /* 成功 */
            <div className="flex flex-col items-center px-6 py-10 text-center">
                <CheckCircle className="h-16 w-16 text-green-500"/>
                <h4 className="mt-4 text-lg font-bold text-gray-900">{l.success}</h4>
                <p className="mt-1 text-sm text-gray-500">{l.successDesc}</p>
                <button onClick={() => setOpen(false)} className="mt-6 rounded-lg bg-gray-100 px-6 py-2 text-sm font-medium">
                  {l.close}
                </button>
              </div>) : (
            /* 表单 */
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                <p className="text-sm text-gray-500">{l.subtitle}</p>

                {/* 产品名（只读） */}
                <div className="rounded-lg bg-gray-50 px-4 py-2.5">
                  <span className="text-xs text-gray-400">{l.productName}</span>
                  <p className="text-sm font-medium text-gray-700">{productName}</p>
                </div>

                {/* 期望价格（选填） */}
                <input type="text" placeholder={l.expectedPrice} value={form.expectedPrice} onChange={(e) => setForm({ ...form, expectedPrice: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"/>

                <input type="text" required placeholder={l.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"/>
                <input type="text" required placeholder={l.phone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"/>
                <textarea rows={2} placeholder={l.message} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none resize-none"/>

                {/* 询价说明 */}
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {l.inquiryNote}
                </div>

                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50">
                  {loading ? (<span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>) : (<Send className="h-4 w-4"/>)}
                  {l.submit}
                </button>
              </form>)}
          </div>
        </div>)}
    </>);
}
