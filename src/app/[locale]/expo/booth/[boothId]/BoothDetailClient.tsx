"use client";

import { useState } from "react";
import { X, Send, CheckCircle2 } from "lucide-react";
import StandardBooth from "@/components/expo/booth-templates/StandardBooth";
import PremiumBooth from "@/components/expo/booth-templates/PremiumBooth";
import FlagshipBooth from "@/components/expo/booth-templates/FlagshipBooth";
import type { BoothData } from "@/components/expo/types";

export default function BoothDetailClient({ booth, locale }: { booth: BoothData; locale: string }) {
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
      } else {
        alert(locale === "zh" ? "提交失败，请稍后重试" : "Submission failed, please try again");
      }
    } catch {
      alert(locale === "zh" ? "网络错误，请稍后重试" : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Render template
  const Template = booth.template === "flagship"
    ? FlagshipBooth
    : booth.template === "premium"
    ? PremiumBooth
    : StandardBooth;

  return (
    <>
      <Template booth={booth} locale={locale} onInquiry={handleInquiry} />

      {/* Inquiry Modal */}
      {showInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowInquiry(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {submitted ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
                <p className="text-lg font-bold text-gray-900">{locale === "zh" ? "提交成功！" : "Submitted!"}</p>
                <p className="mt-2 text-sm text-gray-500">
                  {locale === "zh" ? "展商将尽快与您联系" : "The exhibitor will contact you soon"}
                </p>
                <button onClick={() => setShowInquiry(false)}
                  className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  {locale === "zh" ? "关闭" : "Close"}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">
                    {locale === "zh" ? "在线询盘" : "Online Inquiry"}
                  </h3>
                  <button onClick={() => setShowInquiry(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <InquiryForm locale={locale} onSubmit={handleSubmit} submitting={submitting} />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function InquiryForm({ locale, onSubmit, submitting }: {
  locale: string;
  onSubmit: (data: Record<string, string>) => void;
  submitting: boolean;
}) {
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
    name: "您的姓名 *",
    phone: "电话/WhatsApp *",
    email: "邮箱",
    wechat: "微信",
    country: "国家/地区",
    message: "留言内容 *",
    intent: "意向",
    submit: "发送询盘",
    purchase: "采购意向",
    inquiry: "信息咨询",
    agent: "代理合作",
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

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder={labels.name}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
      <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
        placeholder={labels.phone}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
      <div className="grid grid-cols-2 gap-3">
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder={labels.email}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
        <input value={form.wechat} onChange={(e) => setForm({ ...form, wechat: e.target.value })}
          placeholder={labels.wechat}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
      </div>
      <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
        placeholder={labels.country}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
      <select value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500">
        <option value="inquiry">{labels.inquiry}</option>
        <option value="purchase">{labels.purchase}</option>
        <option value="agent">{labels.agent}</option>
      </select>
      <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
        placeholder={labels.message} rows={3}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
      <button type="submit" disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
        <Send className="h-4 w-4" />
        {submitting ? (locale === "zh" ? "发送中..." : "Sending...") : labels.submit}
      </button>
    </form>
  );
}
