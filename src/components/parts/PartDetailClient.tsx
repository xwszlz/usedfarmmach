"use client";

import { translate } from "@/lib/i18n-runtime";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Wrench, ShoppingCart, CheckCircle2, Mail, Package, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getImageUrl, getDetailImageUrl } from "@/lib/image-url";
import PartsBreadcrumb from "./PartsBreadcrumb";
import PartSpecsTable from "./PartSpecsTable";
import PartCard, { type PartCardData } from "./PartCard";

export interface PartDetailData {
  id: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  nameRu: string;
  brand: string;
  oemNumber: string | null;
  price: number;
  currency: string;
  stockStatus: string;
  images: string[];
  descriptionZh: string | null;
  descriptionEn: string | null;
  descriptionRu: string | null;
  specs: Record<string, string> | null;
  isOEM: boolean;
  isAftermarket: boolean;
  dataQuality: string;
  componentGroup: { code: string; nameZh: string; nameEn: string };
  subSystem: { code: string; nameZh: string; nameEn: string };
  machineType: { code: string; nameZh: string; nameEn: string };
  compatibleMachines: {
    id: string;
    brand: string;
    model: string;
    yearRange: string | null;
    notes: string | null;
  }[];
}

interface PartDetailClientProps {
  part: PartDetailData;
  relatedParts: PartCardData[];
  locale: string;
}

const STOCK_LABELS: Record<string, { zh: string; en: string; className: string }> = {
  in_stock: { zh: "有货", en: "In Stock", className: "bg-green-100 text-green-700" },
  low_stock: { zh: "库存紧张", en: "Low Stock", className: "bg-amber-100 text-amber-700" },
  out_of_stock: { zh: "缺货", en: "Out of Stock", className: "bg-gray-100 text-gray-500" },
  preorder: { zh: "预订", en: "Pre-order", className: "bg-blue-100 text-blue-700" },
};

export default function PartDetailClient({ part, relatedParts, locale }: PartDetailClientProps) {
  const isZh = locale === "zh";
  const stockInfo = STOCK_LABELS[part.stockStatus] || STOCK_LABELS.in_stock;
  const partName = isZh ? part.nameZh : (part.nameEn || part.nameZh);
  const partDesc = isZh ? part.descriptionZh : (part.descriptionEn || part.descriptionZh);

  // Inquiry form state
  const [inquiryForm, setInquiryForm] = useState({
    name: "",
    phone: "",
    email: "",
    quantity: "1",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryForm.name || !inquiryForm.phone) return;

    setSubmitting(true);
    setSubmitError(false);
    try {
      const res = await fetch("/api/parts/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partId: part.id,
          partName: partName,
          partSku: part.sku,
          name: inquiryForm.name,
          phone: inquiryForm.phone,
          email: inquiryForm.email,
          quantity: parseInt(inquiryForm.quantity) || 1,
          message: inquiryForm.message,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSubmitSuccess(true);
          setInquiryForm({ name: "", phone: "", email: "", quantity: "1", message: "" });
        } else {
          setSubmitError(true);
        }
      } else {
        setSubmitError(true);
      }
    } catch (err) {
      console.error("Inquiry submit error:", err);
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <PartsBreadcrumb
          locale={locale}
          machineTypeName={isZh ? part.machineType.nameZh : part.machineType.nameEn}
          subSystemName={isZh ? part.subSystem.nameZh : part.subSystem.nameEn}
          componentGroupName={isZh ? part.componentGroup.nameZh : part.componentGroup.nameEn}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left: Image */}
          <div>
            <Card className="overflow-hidden">
              <div className="aspect-square bg-gray-100 relative">
                {part.images && part.images.length > 0 ? (
                  <img
                    src={getDetailImageUrl(part.images[0])}
                    alt={partName}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100">
                    <Wrench className="h-24 w-24 text-gray-300" />
                  </div>
                )}
                {part.isOEM && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-blue-600 text-white shadow-md">OEM</Badge>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Info */}
          <div>
            {/* Brand */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold text-orange-600 uppercase tracking-wide">
                {part.brand}
              </span>
              {part.oemNumber && (
                <Badge variant="secondary" className="text-xs font-mono">
                  OEM: {part.oemNumber}
                </Badge>
              )}
            </div>

            {/* Name */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{partName}</h1>
            <p className="text-sm text-gray-400 font-mono mb-4">SKU: {part.sku}</p>

            {/* Stock + Price */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <Badge className={`text-sm ${stockInfo.className}`}>
                  {isZh ? stockInfo.zh : stockInfo.en}
                </Badge>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Package className="h-3.5 w-3.5" />
                  <span>{translate("数据质量: ", locale)}</span>
                  <span className="font-medium text-green-600">
                    {part.dataQuality === "verified" ? (translate("已验证", locale)) : part.dataQuality}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-orange-600">
                  ¥{part.price.toLocaleString()}
                </span>
                <span className="text-sm text-gray-400">{part.currency}</span>
              </div>
            </div>

            {/* Quick info */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-400 mb-1">{translate("整机品类", locale)}</p>
                <p className="text-sm font-medium text-gray-700">
                  {isZh ? part.machineType.nameZh : part.machineType.nameEn}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-400 mb-1">{translate("子系统", locale)}</p>
                <p className="text-sm font-medium text-gray-700">
                  {isZh ? part.subSystem.nameZh : part.subSystem.nameEn}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-400 mb-1">{translate("部件组", locale)}</p>
                <p className="text-sm font-medium text-gray-700">
                  {isZh ? part.componentGroup.nameZh : part.componentGroup.nameEn}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-400 mb-1">{translate("配件类型", locale)}</p>
                <p className="text-sm font-medium text-gray-700">
                  {part.isOEM ? (translate("原厂件", locale)) : (translate("品牌件", locale))}
                </p>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex gap-3 mb-6">
              <a
                href="#inquiry-form"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg"
              >
                <ShoppingCart className="h-5 w-5" />
                {translate("立即询价", locale)}
              </a>
              <Link
                href={`/${locale}/parts`}
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-medium py-3.5 px-6 rounded-xl border border-gray-200 transition-colors"
              >
                {translate("返回列表", locale)}
              </Link>
            </div>

            {/* Description */}
            {partDesc && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  {translate("产品描述", locale)}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">{partDesc}</p>
              </div>
            )}
          </div>
        </div>

        {/* Specs table */}
        {part.specs && Object.keys(part.specs).length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-600" />
              {translate("技术参数", locale)}
            </h2>
            <PartSpecsTable specs={part.specs} locale={locale} />
          </div>
        )}

        {/* Compatible machines */}
        {part.compatibleMachines && part.compatibleMachines.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              {translate("兼容机型", locale)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {part.compatibleMachines.map((cm) => (
                <div
                  key={cm.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {cm.brand} {cm.model}
                    </p>
                    {cm.yearRange && (
                      <p className="text-xs text-gray-400">
                        {translate("年份: ", locale)}
                        {cm.yearRange}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inquiry form */}
        <div id="inquiry-form" className="mb-12">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-red-500 p-6 text-white">
              <h2 className="text-xl font-bold mb-1">
                {translate("询价表单", locale)}
              </h2>
              <p className="text-white/80 text-sm">
                {translate("填写以下信息，我们将在24小时内联系您", locale)}
              </p>
            </div>
            <CardContent className="p-6">
              {submitSuccess ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {translate("询价提交成功！", locale)}
                  </h3>
                  <p className="text-gray-500">
                    {translate("我们将在24小时内联系您，请保持电话畅通", locale)}
                  </p>
                  <button
                    onClick={() => setSubmitSuccess(false)}
                    className="mt-4 text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {translate("继续询价", locale)}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {translate("姓名 *", locale)}
                    </label>
                    <Input
                      type="text"
                      required
                      value={inquiryForm.name}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                      placeholder={translate("请输入您的姓名", locale)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {translate("电话 *", locale)}
                    </label>
                    <Input
                      type="tel"
                      required
                      value={inquiryForm.phone}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                      placeholder={translate("请输入联系电话", locale)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {translate("邮箱", locale)}
                    </label>
                    <Input
                      type="email"
                      value={inquiryForm.email}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                      placeholder={translate("请输入邮箱（选填）", locale)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {translate("需求数量", locale)}
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={inquiryForm.quantity}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, quantity: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {translate("备注", locale)}
                    </label>
                    <textarea
                      value={inquiryForm.message}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                      placeholder={translate("请输入您的需求描述（选填）", locale)}
                      rows={3}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  {submitError && (
                    <div className="md:col-span-2 text-sm text-red-500">
                      {translate("提交失败，请稍后重试或直接联系我们", locale)}
                    </div>
                  )}
                  <div className="md:col-span-2 flex flex-wrap items-center gap-4">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl transition-colors shadow-lg"
                    >
                      {submitting
                        ? (translate("提交中...", locale))
                        : (translate("提交询价", locale))}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <a href="mailto:jiusei0319@gmail.com" className="flex items-center gap-1 hover:text-orange-600">
                        <Mail className="h-4 w-4" />
                        jiusei0319@gmail.com
                      </a>
                    </div>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Related parts */}
        {relatedParts && relatedParts.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              {translate("相关配件", locale)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {relatedParts.map((rp) => (
                <PartCard key={rp.id} part={rp} locale={locale} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
