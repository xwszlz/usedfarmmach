"use client";
import { translate } from "@/lib/i18n-runtime";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, CheckCircle2, Loader2, ArrowLeft, Building2, User, Phone, Mail, Globe, FileText, MessageSquare, } from "lucide-react";
import Link from "next/link";
import { useTr } from "@/lib/i18n-tr";
export default function BrandClaimClient({ locale }: {
    locale: string;
}) {
    const searchParams = useSearchParams();
    const brandName = searchParams.get("brand") || "";
    const brandSlug = searchParams.get("slug") || "";
    const isZh = locale === "zh";
    const tr = useTr();
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
            }
            else {
                alert(tr("提交失败，请稍后重试"));
            }
        }
        catch {
            alert(tr("网络错误"));
        }
        finally {
            setSubmitting(false);
        }
    };
    const t = (zh: string, en: string) => (isZh ? zh : en);
    if (submitted) {
        const selectedTier = (searchParams.get("tier") || "free").toLowerCase();
        const isPaid = ["pro", "flagship", "strategic"].includes(selectedTier);
        const tierPrice = selectedTier === "pro" ? "\u00A5380/\u5E74" : selectedTier === "flagship" ? "\u00A5980/\u5E74" : selectedTier === "strategic" ? "\u00A52,880/\u5E74" : "\u00A50/\u5E74";
        return (<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-12">
        <div className="max-w-2xl rounded-2xl bg-white p-8 text-center shadow-xl">
          <CheckCircle2 className="mx-auto mb-4 h-20 w-20 text-green-500"/>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            {tr("认领申请已提交！")}
          </h1>
          <p className="mb-6 text-gray-500">
            {tr("我们将在2个工作日内审核并与您联系。审核通过后，您将获得品牌页面管理权限，可上传官方素材、更新产品信息。")}
          </p>

          {/* Payment section for paid tiers */}
          {isPaid && (<div className="my-6 rounded-xl border-2 border-green-200 bg-green-50 p-6 text-left">
              <h2 className="mb-2 text-center text-xl font-bold text-green-800">
                {tr("💚 请扫码完成付款")}
              </h2>
              <p className="mb-4 text-center text-sm text-gray-700">
                {t(`您选择的版本：${tierPrice}（已打1折）。付款确认后24小时内开通自助展台。`, `Your tier: ${tierPrice}. Activated within 24 hours after payment confirmed.`)}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                  <div className="mb-2 text-sm font-medium text-green-700">{tr("💚 微信支付")}</div>
                  <img src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/payment/wechat-qr.png" alt={tr("微信支付二维码")} className="mx-auto h-40 w-40 rounded-lg border border-gray-200 object-contain p-1"/>
                  <p className="mt-2 text-xs text-gray-500">{tr("扫一扫即可付款")}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                  <div className="mb-2 text-sm font-medium text-blue-700">{tr("💙 支付宝支付")}</div>
                  <img src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/payment/alipay-qr.jpg" alt={tr("支付宝支付二维码")} className="mx-auto h-40 w-40 rounded-lg border border-gray-200 object-contain p-1"/>
                  <p className="mt-2 text-xs text-gray-500">{tr("扫一扫即可付款")}</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-xs text-gray-700">
                {tr("📌 付款后请将截图发至 932133255@qq.com 或致电 +86 18633878701，24小时内开通自助展台。")}
              </div>
            </div>)}

          {/* Free tier note */}
          {!isPaid && (<div className="my-6 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
              {tr("您选择的是免费版，审核通过后自动开通，无需付款。")}
            </div>)}

          <div className="flex justify-center gap-3">
            <Link href={`/${locale}/expo`} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">
              {tr("返回展会")}
            </Link>
            <Link href={`/${locale}/expo/booth`} className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
              {tr("查看套餐")}
            </Link>
          </div>
        </div>
      </div>);
    }
    return (<div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <Link href={`/${locale}/expo`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
            <ArrowLeft className="h-4 w-4"/>
            {tr("返回展会")}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Title */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <ShieldCheck className="h-8 w-8 text-white"/>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {tr("品牌方认领")}
          </h1>
          <p className="mt-2 text-gray-500">
            {tr("认领您的品牌页面，获得官方管理权限")}
          </p>
        </div>

        {/* Benefits */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
                icon: FileText,
                title: tr("更新信息"),
                desc: tr("修改品牌故事、产品参数"),
            },
            {
                icon: Building2,
                title: tr("上传素材"),
                desc: tr("替换AI图为官方高清图"),
            },
            {
                icon: ShieldCheck,
                title: tr("官方认证"),
                desc: t("获得\"已认领\"认证标识", "Get \"Verified\" badge"),
            },
        ].map((item, idx) => (<div key={idx} className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
              <item.icon className="mx-auto mb-2 h-8 w-8 text-blue-500"/>
              <h3 className="text-sm font-bold text-gray-900">{item.title}</h3>
              <p className="mt-1 text-xs text-gray-500">{item.desc}</p>
            </div>))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-6 shadow-lg sm:p-8">
          {/* Brand Name (pre-filled) */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Building2 className="h-4 w-4 text-gray-400"/>
              {tr("品牌名称 *")}
            </label>
            <input required type="text" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} placeholder={tr("请输入品牌名称")} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>

          {/* Contact Name */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <User className="h-4 w-4 text-gray-400"/>
              {tr("联系人姓名 *")}
            </label>
            <input required type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder={tr("请输入您的姓名")} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>

          {/* Position */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <User className="h-4 w-4 text-gray-400"/>
              {tr("职位")}
            </label>
            <input type="text" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder={tr("如：市场总监、出口部经理")} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Phone className="h-4 w-4 text-gray-400"/>
              {tr("联系电话/WhatsApp *")}
            </label>
            <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={tr("请输入手机号或WhatsApp")} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Mail className="h-4 w-4 text-gray-400"/>
              {tr("电子邮箱")}
            </label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>

          {/* Company */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Building2 className="h-4 w-4 text-gray-400"/>
              {tr("公司全称")}
            </label>
            <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder={tr("请输入公司全称")} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>

          {/* Country */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Globe className="h-4 w-4 text-gray-400"/>
              {tr("国家/地区")}
            </label>
            <input type="text" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder={tr("如：中国、美国、德国")} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>

          {/* Business License */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="h-4 w-4 text-gray-400"/>
              {tr("营业执照编号/统一社会信用代码")}
            </label>
            <input type="text" value={form.businessLicense} onChange={(e) => setForm({ ...form, businessLicense: e.target.value })} placeholder={tr("用于资质审核")} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>

          {/* Message */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <MessageSquare className="h-4 w-4 text-gray-400"/>
              {tr("补充说明")}
            </label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder={tr("可补充品牌授权情况、代理区域、合作意向等")} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>

          {/* Submit */}
          <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 font-semibold text-white shadow-lg transition hover:shadow-xl disabled:opacity-60">
            {submitting ? (<>
                <Loader2 className="h-5 w-5 animate-spin"/>
                {tr("提交中...")}
              </>) : (<>
                <ShieldCheck className="h-5 w-5"/>
                {tr("提交认领申请")}
              </>)}
          </button>

          <p className="text-center text-xs text-gray-400">
            {tr("提交后我们将在2个工作日内审核。如需加急，请联系 932133255@qq.com 或致电 +86 18633878701")}
          </p>
        </form>
      </div>
    </div>);
}
