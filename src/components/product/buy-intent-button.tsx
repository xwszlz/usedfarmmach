"use client";

import { useState } from "react";
import { ShoppingCart, X, Send, CheckCircle } from "lucide-react";

const LABELS: Record<string, {
  buyNow: string;
  title: string;
  subtitle: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  submit: string;
  success: string;
  successDesc: string;
  close: string;
  depositHint: string;
}> = {
  zh: {
    buyNow: "我要买",
    title: "购买意向",
    subtitle: "留下联系方式，卖家将在24小时内联系您",
    name: "姓名",
    phone: "手机号/微信",
    email: "邮箱（选填）",
    message: "留言（选填）",
    submit: "提交意向",
    success: "意向提交成功！",
    successDesc: "卖家会尽快通过微信或电话与您联系",
    close: "关闭",
    depositHint: "锁定设备需支付 ¥5,000 意向金，交易未成全额退还",
  },
  en: {
    buyNow: "Buy Now",
    title: "Purchase Intent",
    subtitle: "Leave your contact, seller will reach you within 24h",
    name: "Name",
    phone: "Phone / WhatsApp",
    email: "Email (optional)",
    message: "Message (optional)",
    submit: "Submit",
    success: "Submitted!",
    successDesc: "Seller will contact you via WhatsApp or phone soon",
    close: "Close",
    depositHint: "¥5,000 deposit to reserve this machine, fully refundable if deal fails",
  },
  ru: {
    buyNow: "Купить",
    title: "Намерение покупки",
    subtitle: "Оставьте контакты, продавец свяжется в течение 24ч",
    name: "Имя",
    phone: "Телефон / WhatsApp",
    email: "Email (необязательно)",
    message: "Сообщение (необязательно)",
    submit: "Отправить",
    success: "Отправлено!",
    successDesc: "Продавец свяжется с вами в ближайшее время",
    close: "Закрыть",
    depositHint: "Депозит ¥5,000 для бронирования, возврат при отказе от сделки",
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
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
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
          email: form.email,
          message: `[购买意向] ${productName}${form.message ? " — " + form.message : ""}`,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Buy intent submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 按钮 */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:from-orange-600 hover:to-red-600 hover:shadow-xl active:scale-[0.98]"
      >
        <ShoppingCart className="h-5 w-5" />
        {l.buyNow}
      </button>

      {/* 弹窗 */}
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

                <input
                  type="text"
                  required
                  placeholder={l.name}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder={l.phone}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                />
                <input
                  type="email"
                  placeholder={l.email}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                />
                <textarea
                  rows={2}
                  placeholder={l.message}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none resize-none"
                />

                {/* 意向金提示 */}
                <div className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
                  💰 {l.depositHint}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-3 text-sm font-bold text-white transition-all hover:from-orange-600 hover:to-red-600 disabled:opacity-50"
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
