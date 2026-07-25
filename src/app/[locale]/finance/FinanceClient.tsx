"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { useTr } from "@/lib/i18n-tr";

interface FinancialService {
  id: string;
  serviceName: string;
  serviceType: string;
  provider: string;
  providerLogo: string | null;
  interestRate: number | null;
  maxAmount: number | null;
  maxTerm: number | null;
  downPayment: number | null;
  coverage: string | null;
  premium: number | null;
  description: string | null;
  requirements: string | null;
}

const TYPE_MAP: Record<string, { zh: string; en: string; icon: string; color: string }> = {
  loan: { zh: "农机贷款", en: "Equipment Loan", icon: "💰", color: "bg-blue-50 border-blue-200" },
  insurance: { zh: "交易保险", en: "Trade Insurance", icon: "🛡️", color: "bg-green-50 border-green-200" },
  lease: { zh: "设备租赁", en: "Equipment Lease", icon: "🚜", color: "bg-orange-50 border-orange-200" },
};

export default function FinanceClient() {
  const locale = useLocale();
  const isZh = locale === "zh";
  const tr = useTr();
  const [services, setServices] = useState<FinancialService[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<FinancialService | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await fetch("/api/finance/services");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setServices(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch services:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === "all" ? services : services.filter((s) => s.serviceType === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {tr("金融保险服务")}
        </h1>
        <p className="text-gray-500 mt-1">
          {tr("农机贷款、交易保险、设备租赁 — 一站式金融服务助力交易")}
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {[
          { value: "all", label: tr("全部") },
          { value: "loan", label: tr("贷款") },
          { value: "insurance", label: tr("保险") },
          { value: "lease", label: tr("租赁") },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Service cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <p className="text-gray-400 text-lg">
            {tr("暂无金融产品")}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filtered.map((service) => {
            const typeInfo = TYPE_MAP[service.serviceType] || TYPE_MAP.loan;
            return (
              <div
                key={service.id}
                className={`rounded-xl border p-6 ${typeInfo.color}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{typeInfo.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{service.serviceName}</h3>
                      <p className="text-sm text-gray-500">{service.provider}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-white/60 rounded text-xs font-medium text-gray-600">
                    {tr(typeInfo.zh)}
                  </span>
                </div>

                {service.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{service.description}</p>
                )}

                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {service.interestRate !== null && (
                    <div className="bg-white/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{tr("年利率")}</p>
                      <p className="text-lg font-bold text-gray-900">{service.interestRate}%</p>
                    </div>
                  )}
                  {service.maxAmount !== null && (
                    <div className="bg-white/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{tr("最高额度")}</p>
                      <p className="text-lg font-bold text-gray-900">
                        ¥{(service.maxAmount / 10000).toFixed(0)}{tr("万")}
                      </p>
                    </div>
                  )}
                  {service.maxTerm !== null && (
                    <div className="bg-white/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{tr("最长期限")}</p>
                      <p className="text-lg font-bold text-gray-900">{service.maxTerm}{tr("月")}</p>
                    </div>
                  )}
                  {service.downPayment !== null && (
                    <div className="bg-white/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{tr("首付比例")}</p>
                      <p className="text-lg font-bold text-gray-900">{service.downPayment}%</p>
                    </div>
                  )}
                  {service.premium !== null && (
                    <div className="bg-white/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{tr("保费率")}</p>
                      <p className="text-lg font-bold text-gray-900">{service.premium}%</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedService(service)}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {tr("立即申请")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Application Modal */}
      {selectedService && (
        <ApplicationModal
          service={selectedService}
          isZh={isZh}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  );
}

function ApplicationModal({
  service,
  isZh,
  onClose,
}: {
  service: FinancialService;
  isZh: boolean;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const body = {
      serviceId: service.id,
      applicantName: formData.get("applicantName"),
      contactPhone: formData.get("contactPhone"),
      contactEmail: formData.get("contactEmail"),
      companyName: formData.get("companyName"),
      appliedAmount: formData.get("appliedAmount"),
      appliedTerm: formData.get("appliedTerm"),
      purpose: formData.get("purpose"),
    };
    try {
      const res = await fetch("/api/finance/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setResult(tr("申请提交成功！我们会尽快联系您。"));
      } else {
        setResult(json.error || (tr("申请失败")));
      }
    } catch {
      setResult(tr("请先登录"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {tr("申请")} — {service.serviceName}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {result ? (
          <div className="text-center py-8">
            <p className={`text-lg ${result.includes("成功") || result.includes("success") ? "text-green-600" : "text-red-600"}`}>
              {result}
            </p>
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg">
              {tr("关闭")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr("申请人姓名 *")}
              </label>
              <input name="applicantName" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr("联系电话 *")}
              </label>
              <input name="contactPhone" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr("邮箱")}
              </label>
              <input name="contactEmail" type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr("公司名称")}
              </label>
              <input name="companyName" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tr("申请金额 (元) *")}
                </label>
                <input name="appliedAmount" type="number" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tr("期限 (月)")}
                </label>
                <input name="appliedTerm" type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr("用途说明")}
              </label>
              <textarea name="purpose" rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>

            {service.requirements && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                <p className="font-medium mb-1">{tr("申请条件")}</p>
                <p className="whitespace-pre-wrap">{service.requirements}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              {submitting ? "..." : (tr("提交申请"))}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
