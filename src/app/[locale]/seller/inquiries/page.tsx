"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Mail, Phone, Building2, Clock, MessageSquare, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Inquiry {
  id: string;
  productId: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  product: {
    modelName: string;
    brand: { nameZh: string; nameEn: string };
  };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待回复", color: "bg-amber-100 text-amber-700" },
  replied: { label: "已回复", color: "bg-green-100 text-green-700" },
  closed: { label: "已关闭", color: "bg-gray-100 text-gray-600" },
};

export default function SellerInquiriesPage() {
  const t = useTranslations("common");
  const locale = useLocale();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function fetchInquiries() {
      try {
        const res = await fetch("/api/seller/inquiries");
        const json = await res.json();
        if (json.success) {
          setInquiries(json.data);
        }
      } catch (e) {
        console.error("Failed to fetch inquiries:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchInquiries();
  }, []);

  const filtered = filter === "all" 
    ? inquiries 
    : inquiries.filter(i => i.status === filter);

  const statusCounts = {
    all: inquiries.length,
    pending: inquiries.filter(i => i.status === "pending").length,
    replied: inquiries.filter(i => i.status === "replied").length,
    closed: inquiries.filter(i => i.status === "closed").length,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {locale === "zh" ? "询价管理" : "Inquiry Management"}
        </h1>
        <p className="mt-1 text-gray-500">
          {locale === "zh" ? "管理买家对您设备的询价请求" : "Manage buyer inquiries for your equipment"}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2">
        {[
          { key: "all", label: locale === "zh" ? "全部" : "All", count: statusCounts.all },
          { key: "pending", label: locale === "zh" ? "待回复" : "Pending", count: statusCounts.pending },
          { key: "replied", label: locale === "zh" ? "已回复" : "Replied", count: statusCounts.replied },
          { key: "closed", label: locale === "zh" ? "已关闭" : "Closed", count: statusCounts.closed },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
            <span className={`text-xs rounded-full px-1.5 py-0.5 ${
              filter === tab.key ? "bg-white/20" : "bg-gray-200"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Inquiries List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">
            {locale === "zh" ? "暂无询价记录" : "No inquiries yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((inquiry) => {
            const status = STATUS_MAP[inquiry.status] || STATUS_MAP.pending;
            return (
              <div
                key={inquiry.id}
                className="rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <Link
                      href={`/${locale}/products/${inquiry.productId}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {inquiry.product?.brand?.nameZh || inquiry.product?.brand?.nameEn} {inquiry.product?.modelName}
                    </Link>
                    <span className={`ml-3 text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(inquiry.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{inquiry.name}</span>
                  </div>
                  {inquiry.phone && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      {inquiry.phone}
                    </div>
                  )}
                  {inquiry.company && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      {inquiry.company}
                    </div>
                  )}
                </div>

                {inquiry.message && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-sm text-gray-600">{inquiry.message}</p>
                  </div>
                )}

                {inquiry.email && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                    <Mail className="h-3 w-3" />
                    {inquiry.email}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
