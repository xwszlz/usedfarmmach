"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Building2,
  User,
  Phone,
  Mail,
  Globe,
  FileText,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

export default function BrandClaimClient({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const brandName = searchParams.get("brand") || "";
  const brandSlug = searchParams.get("slug") || "";

  const isZh = locale === "zh";

  const [form, setForm] = useState({
    brandName,
    brandSlug,
    contactName: "",
    phone: "",
    email: "",
    company: "",
    country: "",
    businessLicense: "",
    position: "",
    message: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/expo/brand-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locale }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        alert(isZh ? "提交失败，请稍后重试" : "Submission failed, please try again");
      }
    } catch {
      alert(isZh ? "网络错误" : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const t = (zh: string, en: string) => (isZh ? zh : en);

  if (submitted) {
    const selectedTier = (searchParams.get("tier") || "free").toLowerCase();
    const isPaid = ["pro", "flagship", "strategic"].includes(selectedTier);
    const tierPrice = selectedTier === "pro" ? "¥380/年" : selectedTier === "flagship" ? "¥980/年" : selectedTier === "strategic" ? "¥2,880/年" : "¥0/年";

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-12">
        <div className="max-w-2xl rounded-2xl bg-white p-8 text-center shadow-xl">
          <CheckCircle2 className="mx-auto mb-4 h-20 w-20 text-green-500" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            {t("认领申请已提交！", "Claim Submitted!")}
          </h1>
          <p className="mb-6 text-gray-500">
            {t(
              "我们将在2个工作日内审核并与您联系。审核通过后，您将获得品牌页面管理权限，可上传官方素材、更新产品信息。",
              "We will review your application within 2 business days. Once approved, you will gain brand page management access to upload official materials and update product information."
            )}
          </p>

          {/* Payment section for paid tiers */}
          {isPaid && (
            <div className="my-6 rounded-xl border-2 border-green-200 bg-green-50 p-6 text-left">
              <h2 className="mb-2 text-center text-xl font-bold text-green-800">
                {t("💚 请扫码完成付款", "💚 Please scan to pay")}
              </h2>
              <p className="mb-4 text-center text-sm text-gray-700">
                {t(
                  `您选择的版本：${tierPrice}（已打1折）。付款确认后24小时内开通自助展台。`,
                  `Your tier: ${tierPrice}. Activated within 24 hours after payment confirmed.`
                )}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                  <div className="mb-2 text-sm font-medium text-green-700">💚 微信支付</div>
                  <img
                    src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/payment/wechat-qr.png"
                    alt="微信支付二维码"
                    className="mx-auto h-40 w-40 rounded-lg border border-gray-200 object-contain p-1"
                  />
                  <p className="mt-2 text-xs text-gray-500">扫一扫即可付款</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                  <div className="mb-2 text-sm font-medium text-blue-700">💙 支付宝支付</div>
                  <img
                    src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/payment/alipay-qr.jpg"
                    alt="支付宝支付二维码"
                    className="mx-auto h-40 w-40 rounded-lg border border-gray-200 object-contain p-1"
                  />
                  <p className="mt-2 text-xs text-gray-500">扫一扫即可付款</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-xs text-gray-700">
                {t(
                  "📌 付款后请将截图发至 932133255@qq.com 或致电 +86 18633878701，24小时内开通自助展台。",
                  "📌 After payment, send screenshot to 932133255@qq.com or call +86 18633878701. Activated within 24 hours."
                )}
              </div>
            </div>
          )}

          {/* Free tier note */}
          {!isPaid && (
            <div className="my-6 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
              {t(
                "您选择的是免费版，审核通过后自动开通，无需付款。",
                "You selected the Free tier. You'll be activated automatically after review—no payment needed."
              )}
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Link
              href={`/${locale}/expo`}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              {t("返回展会", "Back to Expo")}
            </Link>
            <Link
              href={`/${locale}/expo/booth`}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              {t("查看套餐", "View Plans")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <Link
            href={`/${locale}/expo`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("返回展会", "Back to Expo")}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Title */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("品牌方认领", "Brand Claim")}
          </h1>
          <p className="mt-2 text-gray-500">
            {t(
              "认领您的品牌页面，获得官方管理权限",
              "Claim your brand page and gain official management access"
            )}
          </p>
        </div>

        {/* Benefits */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: FileText,
              title: t("更新信息", "Update Info"),
              desc: t("修改品牌故事、产品参数", "Edit brand story & specs"),
            },
            {
              icon: Building2,
              title: t("上传素材", "Upload Media"),
              desc: t("替换AI图为官方高清图", "Replace AI images with official photos"),
            },
            {
              icon: ShieldCheck,
              title: t("官方认证", "Verified Badge"),
              desc: t('获得"已认领"认证标识', 'Get "Verified" badge'),
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm"
            >
              <item.icon className="mx-auto mb-2 h-8 w-8 text-blue-500" />
              <h3 className="text-sm font-bold text-gray-900">{item.title}</h3>
              <p className="mt-1 text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl bg-white p-6 shadow-lg sm:p-8"
        >
          {/* Brand Name (pre-filled) */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Building2 className="h-4 w-4 text-gray-400" />
              {t("品牌名称 *", "Brand Name *")}
            </label>
            <input
              required
              type="text"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              placeholder={t("请输入品牌名称", "Enter brand name")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Contact Name */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <User className="h-4 w-4 text-gray-400" />
              {t("联系人姓名 *", "Contact Name *")}
            </label>
            <input
              required
              type="text"
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              placeholder={t("请输入您的姓名", "Enter your name")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Position */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <User className="h-4 w-4 text-gray-400" />
              {t("职位", "Position")}
            </label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder={t("如：市场总监、出口部经理", "e.g. Marketing Director, Export Manager")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Phone className="h-4 w-4 text-gray-400" />
              {t("联系电话/WhatsApp *", "Phone/WhatsApp *")}
            </label>
            <input
              required
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={t("请输入手机号或WhatsApp", "Enter phone or WhatsApp number")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Mail className="h-4 w-4 text-gray-400" />
              {t("电子邮箱", "Email")}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Company */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Building2 className="h-4 w-4 text-gray-400" />
              {t("公司全称", "Company Name")}
            </label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder={t("请输入公司全称", "Enter full company name")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Country */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Globe className="h-4 w-4 text-gray-400" />
              {t("国家/地区", "Country/Region")}
            </label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder={t("如：中国、美国、德国", "e.g. China, USA, Germany")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Business License */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="h-4 w-4 text-gray-400" />
              {t("营业执照编号/统一社会信用代码", "Business License No.")}
            </label>
            <input
              type="text"
              value={form.businessLicense}
              onChange={(e) => setForm({ ...form, businessLicense: e.target.value })}
              placeholder={t("用于资质审核", "For verification purposes")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Message */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              {t("补充说明", "Additional Notes")}
            </label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={4}
              placeholder={t(
                "可补充品牌授权情况、代理区域、合作意向等",
                "Brand authorization details, agency regions, cooperation intentions, etc."
              )}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 font-semibold text-white shadow-lg transition hover:shadow-xl disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("提交中...", "Submitting...")}
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5" />
                {t("提交认领申请", "Submit Claim")}
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            {t(
              "提交后我们将在2个工作日内审核。如需加急，请联系 932133255@qq.com 或致电 +86 18633878701",
              "We will review within 2 business days. For urgent requests, contact 932133255@qq.com or call +86 18633878701."
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
