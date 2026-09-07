"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, Send } from "lucide-react";

/**
 * 展会专题页通用入驻/参展意向表单
 *
 * 复用 ExpoLanding 的提交接口 POST /api/expo/inquiry（字段：company / contact /
 * phone / email / country / category / boothType / message / locale），不新增接口、不重复造轮子。
 *
 * 与 ExpoLanding 内嵌表单的两点差异：
 * 1. 档位选项不含任何价格（四档价格正在校正，价格一律不进页面）
 * 2. 增加 source 归因字段，随 message 一并进入管理员通知邮件
 */

type FormTexts = {
  fields: {
    company: string;
    contact: string;
    phone: string;
    email: string;
    country: string;
    category: string;
    boothType: string;
    message: string;
  };
  boothOptions: string[];
  categoryOptions: string[];
  submit: string;
  submitting: string;
  success: string;
  error: string;
  selectPlaceholder: string;
  contactNote: string;
};

const TEXTS: Record<string, FormTexts> = {
  zh: {
    fields: {
      company: "公司名称",
      contact: "联系人",
      phone: "手机号",
      email: "邮箱",
      country: "所在国家/地区",
      category: "主营品类",
      boothType: "意向展台类型",
      message: "留言（选填）",
    },
    boothOptions: [
      "线上展台 · 免费开通（365天在线）",
      "付费档位 · 请顾问与我联系",
      "暂不确定，请顾问联系我",
    ],
    categoryOptions: [
      "拖拉机",
      "青储机/牧草收割机",
      "打捆机",
      "割台/捡拾割台",
      "裹包机",
      "搂草机/摊晒机",
      "农机配件",
      "其他农机设备",
    ],
    submit: "提交入驻申请",
    submitting: "提交中...",
    success: "提交成功！我们将在24小时内与您联系。",
    error: "提交失败，请稍后重试或直接联系 jiusei0319@gmail.com",
    selectPlaceholder: "请选择",
    contactNote: "Email: jiusei0319@gmail.com",
  },
  en: {
    fields: {
      company: "Company Name",
      contact: "Contact Person",
      phone: "Phone Number",
      email: "Email",
      country: "Country / Region",
      category: "Main Product Category",
      boothType: "Booth Type Interest",
      message: "Message (Optional)",
    },
    boothOptions: [
      "Online booth · Free (365 days online)",
      "Paid tier · Please have an advisor contact me",
      "Not sure, please contact me",
    ],
    categoryOptions: [
      "Tractors",
      "Forage Harvesters",
      "Balers",
      "Headers / Pickup Heads",
      "Bale Wrappers",
      "Rakes / Tedders",
      "Parts",
      "Other Machinery",
    ],
    submit: "Submit Application",
    submitting: "Submitting...",
    success: "Submitted successfully! We'll contact you within 24 hours.",
    error: "Submission failed. Please try again or contact jiusei0319@gmail.com",
    selectPlaceholder: "Please select",
    contactNote: "Email: jiusei0319@gmail.com",
  },
  ru: {
    fields: {
      company: "Название компании",
      contact: "Контактное лицо",
      phone: "Телефон",
      email: "Email",
      country: "Страна / Регион",
      category: "Основная категория",
      boothType: "Тип стенда",
      message: "Сообщение (необязательно)",
    },
    boothOptions: [
      "Онлайн-стенд · Бесплатно (365 дней онлайн)",
      "Платный тариф · Свяжитесь со мной",
      "Не уверен, свяжитесь со мной",
    ],
    categoryOptions: [
      "Тракторы",
      "Кормоуборочные комбайны",
      "Пресс-подборщики",
      "Жатки",
      "Обмотчики",
      "Грабли / Ворошители",
      "Запчасти",
      "Другая техника",
    ],
    submit: "Отправить заявку",
    submitting: "Отправка...",
    success: "Заявка отправлена! Мы свяжемся с вами в течение 24 часов.",
    error: "Ошибка отправки. Повторите или напишите на jiusei0319@gmail.com",
    selectPlaceholder: "Выберите",
    contactNote: "Email: jiusei0319@gmail.com",
  },
};

// zh / en / ru 完整写；es / pt / ar / fr / hi 复用英文文案
export function getFormTexts(locale: string): FormTexts {
  return TEXTS[locale] || TEXTS.en;
}

interface ExpoInquiryFormProps {
  locale: string;
  /** 展会归因标识，例如 "hlj-2026"，随表单写入管理员通知邮件 */
  source: string;
}

export function ExpoInquiryForm({ locale, source }: ExpoInquiryFormProps) {
  const t = getFormTexts(locale);

  const [formData, setFormData] = useState({
    company: "",
    contact: "",
    phone: "",
    email: "",
    country: "",
    category: "",
    boothType: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/expo/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          // 渠道归因写进 message，确保管理员邮件里能看到来源
          message: `[${source}] ${formData.message}`.trim(),
          source,
          locale,
        }),
      });
      if (!res.ok) throw new Error("submit failed");
      setStatus("success");
      setFormData({
        company: "",
        contact: "",
        phone: "",
        email: "",
        country: "",
        category: "",
        boothType: "",
        message: "",
      });
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <p className="text-lg font-medium text-green-800">{t.success}</p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="rounded-lg border border-green-300 bg-white px-5 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
          >
            {locale === "zh" ? "再次提交" : "Submit Another"}
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t.fields.company}
              </label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t.fields.contact} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="contact"
                required
                value={formData.contact}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t.fields.phone} <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t.fields.email}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t.fields.country} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="country"
                required
                value={formData.country}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t.fields.category}
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              >
                <option value="">{t.selectPlaceholder}</option>
                {t.categoryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t.fields.boothType}
            </label>
            <select
              name="boothType"
              value={formData.boothType}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
            >
              <option value="">{t.selectPlaceholder}</option>
              {t.boothOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t.fields.message}
            </label>
            <textarea
              name="message"
              rows={3}
              value={formData.message}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
            />
          </div>

          {status === "error" && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{t.error}</div>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="flex w-full items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
          >
            {status === "submitting" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.submitting}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t.submit}
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">{t.contactNote}</p>
      </CardContent>
    </Card>
  );
}
