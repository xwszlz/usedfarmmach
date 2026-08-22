"use client";
import { useState } from "react";
import Link from "next/link";
import { X, Send, CheckCircle2, ShieldCheck } from "lucide-react";
import StandardBooth from "@/components/expo/booth-templates/StandardBooth";
import PremiumBooth from "@/components/expo/booth-templates/PremiumBooth";
import FlagshipBooth from "@/components/expo/booth-templates/FlagshipBooth";
import { DisclaimerBanner } from "@/components/expo/DisclaimerBanner";
import type { BoothData } from "@/components/expo/types";
import { useTr } from "@/lib/i18n-tr";
export default function BoothDetailClient({ booth, locale }: {
    booth: BoothData;
    locale: string;
}) {
    const tr = useTr();
    const [showInquiry, setShowInquiry] = useState(false);
    const [inquiryItemId, setInquiryItemId] = useState<string | undefined>(undefined);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const handleInquiry = (showcaseItemId?: string) => {
        setInquiryItemId(showcaseItemId);
        setSubmitted(false);
        setShowInquiry(true);
    };
    const handleSubmit = async (formData: Record<string, string>) => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/expo/inquiry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "booth_inquiry",
                    boothId: booth.id,
                    merchantId: booth.merchantId || booth.merchant?.id,
                    showcaseItemId: inquiryItemId,
                    buyerName: formData.name,
                    buyerPhone: formData.phone,
                    buyerEmail: formData.email,
                    buyerWechat: formData.wechat,
                    buyerCountry: formData.country,
                    message: formData.message,
                    intent: formData.intent || "inquiry",
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSubmitted(true);
            }
            else {
                alert(locale === "zh" ? "\u63D0\u4EA4\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" : "Submission failed, please try again");
            }
        }
        catch {
            alert(locale === "zh" ? "\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" : "Network error");
        }
        finally {
            setSubmitting(false);
        }
    };
    // Render template
    const Template = booth.template === "flagship"
        ? FlagshipBooth
        : booth.template === "premium"
            ? PremiumBooth
            : StandardBooth;
    return (<>
      <Template booth={booth} locale={locale} onInquiry={handleInquiry}/>

      {/* Disclaimer */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <DisclaimerBanner locale={locale} variant="compact"/>
      </div>

      {/* Brand Claim Floating CTA */}
      <div className="sticky bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-xs text-gray-500">
            {locale === "zh"
            ? "\u672C\u9875\u9762\u4FE1\u606F\u57FA\u4E8E\u516C\u5F00\u8D44\u6599\u6574\u7406\uFF0C\u5982\u9700\u66F4\u65B0\u8BF7\u8054\u7CFB\u6211\u4EEC"
            : "Information based on public sources. Contact us to update."}
          </p>
          <Link href={`/${locale}/expo/brand-claim?brand=${encodeURIComponent(booth.name)}&slug=${encodeURIComponent(booth.id)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-blue-700">
            <ShieldCheck className="h-4 w-4"/>
            {locale === "zh" ? "\u54C1\u724C\u65B9\u8BA4\u9886" : "Brand Claim"}
          </Link>
        </div>
      </div>

      {/* Inquiry Modal */}
      {showInquiry && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowInquiry(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {submitted ? (<div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500"/>
                <p className="text-lg font-bold text-gray-900">{locale === "zh" ? "\u63D0\u4EA4\u6210\u529F\uFF01" : "Submitted!"}</p>
                <p className="mt-2 text-sm text-gray-500">
                  {locale === "zh" ? "\u5C55\u5546\u5C06\u5C3D\u5FEB\u4E0E\u60A8\u8054\u7CFB" : "The exhibitor will contact you soon"}
                </p>
                <button onClick={() => setShowInquiry(false)} className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  {locale === "zh" ? "\u5173\u95ED" : "Close"}
                </button>
              </div>) : (<>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">
                    {locale === "zh" ? "\u5728\u7EBF\u8BE2\u76D8" : "Online Inquiry"}
                  </h3>
                  <button onClick={() => setShowInquiry(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5"/>
                  </button>
                </div>
                <InquiryForm locale={locale} onSubmit={handleSubmit} submitting={submitting}/>
              </>)}
          </div>
        </div>)}
    </>);
}
function InquiryForm({ locale, onSubmit, submitting }: {
    locale: string;
    onSubmit: (data: Record<string, string>) => void;
    submitting: boolean;
}) {
  const tr = useTr();
    const [form, setForm] = useState({
        name: "",
        phone: "",
        email: "",
        wechat: "",
        country: "",
        message: "",
        intent: "inquiry",
    });
    const labels = locale === "zh" ? {
        name: tr("您的姓名 *"),
        phone: "\u7535\u8BDD/WhatsApp *",
        email: "\u90AE\u7BB1",
        wechat: "\u5FAE\u4FE1",
        country: "\u56FD\u5BB6/\u5730\u533A",
        message: tr("留言内容 *"),
        intent: "\u610F\u5411",
        submit: "\u53D1\u9001\u8BE2\u76D8",
        purchase: "\u91C7\u8D2D\u610F\u5411",
        inquiry: "\u4FE1\u606F\u54A8\u8BE2",
        agent: "\u4EE3\u7406\u5408\u4F5C",
    } : {
        name: "Your Name *",
        phone: "Phone/WhatsApp *",
        email: "Email",
        wechat: "WeChat",
        country: "Country/Region",
        message: "Message *",
        intent: "Intent",
        submit: "Send Inquiry",
        purchase: "Purchase",
        inquiry: "Information",
        agent: "Agency",
    };
    return (<form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={labels.name} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"/>
      <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={labels.phone} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"/>
      <div className="grid grid-cols-2 gap-3">
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={labels.email} className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"/>
        <input value={form.wechat} onChange={(e) => setForm({ ...form, wechat: e.target.value })} placeholder={labels.wechat} className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"/>
      </div>
      <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder={labels.country} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"/>
      <select value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500">
        <option value="inquiry">{labels.inquiry}</option>
        <option value="purchase">{labels.purchase}</option>
        <option value="agent">{labels.agent}</option>
      </select>
      <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={labels.message} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"/>
      <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
        <Send className="h-4 w-4"/>
        {submitting ? (locale === "zh" ? "\u53D1\u9001\u4E2D..." : "Sending...") : labels.submit}
      </button>
    </form>);
}
