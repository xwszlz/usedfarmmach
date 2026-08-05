"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface Policy {
  id: string;
  title: string;
  policyNumber: string | null;
  region: string;
  category: string;
  machineryTypes: string | null;
  subsidyAmount: number | null;
  subsidyRatio: number | null;
  maxSubsidy: number | null;
  effectiveDate: string;
  expiryDate: string | null;
  description: string;
  requirements: string | null;
  applicationUrl: string | null;
  source: string | null;
  status: string;
}

export default function GovDataClient() {
  const searchParams = useSearchParams();
  const locale = searchParams.get("locale") || "zh";
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"policies" | "registry">("policies");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const categories = [
    { value: "purchase", label: locale === "zh" ? "购机补贴" : "Purchase Subsidy" },
    { value: "scrap", label: locale === "zh" ? "报废补贴" : "Scrap Subsidy" },
    { value: "operation", label: locale === "zh" ? "作业补贴" : "Operation Subsidy" },
    { value: "loan", label: locale === "zh" ? "贷款贴息" : "Loan Interest Subsidy" },
  ];

  useEffect(() => {
    fetchPolicies();
  }, [filterRegion, filterCategory]);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRegion) params.set("region", filterRegion);
      if (filterCategory) params.set("category", filterCategory);
      const res = await fetch(`/api/gov-data/policies?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies || []);
      }
    } catch (e) {
      console.error("Failed to fetch policies:", e);
    }
    setLoading(false);
  };

  const getCategoryLabel = (cat: string) => {
    const found = categories.find((c) => c.value === cat);
    return found ? found.label : cat;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {locale === "zh" ? "政府农机数据" : "Government Agricultural Machinery Data"}
        </h1>
        <p className="text-gray-600 mb-8">
          {locale === "zh"
            ? "农机补贴政策查询 · 设备登记信息"
            : "Subsidy policies · Equipment registration data"}
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("policies")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "policies" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {locale === "zh" ? "补贴政策" : "Subsidy Policies"}
          </button>
          <button
            onClick={() => setActiveTab("registry")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "registry" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {locale === "zh" ? "登记信息" : "Registry Data"}
          </button>
        </div>

        {activeTab === "policies" && (
          <>
            {/* Filters */}
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                placeholder={locale === "zh" ? "地区（如：河北）" : "Region (e.g., Hebei)"}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{locale === "zh" ? "全部分类" : "All categories"}</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Policies list */}
            {loading ? (
              <p className="text-gray-500">{locale === "zh" ? "加载中..." : "Loading..."}</p>
            ) : policies.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                {locale === "zh" ? "暂无政策数据" : "No policy data available"}
              </div>
            ) : (
              <div className="space-y-4">
                {policies.map((policy) => (
                  <div key={policy.id} className="bg-white rounded-lg shadow p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900 text-lg">{policy.title}</h3>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 whitespace-nowrap ml-2">
                        {getCategoryLabel(policy.category)}
                      </span>
                    </div>
                    {policy.policyNumber && (
                      <p className="text-sm text-gray-500 mb-2">{locale === "zh" ? "文号" : "Policy No."}: {policy.policyNumber}</p>
                    )}
                    <p className="text-gray-700 text-sm mb-3">{policy.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>📍 {policy.region}</span>
                      <span>📅 {new Date(policy.effectiveDate).toLocaleDateString()}</span>
                      {policy.expiryDate && (
                        <span>⏰ {locale === "zh" ? "截止" : "Until"}: {new Date(policy.expiryDate).toLocaleDateString()}</span>
                      )}
                      {policy.subsidyAmount && (
                        <span className="text-green-600 font-semibold">
                          💰 {locale === "zh" ? "补贴" : "Subsidy"}: ¥{policy.subsidyAmount.toLocaleString()}
                        </span>
                      )}
                      {policy.subsidyRatio && (
                        <span className="text-green-600 font-semibold">
                          📊 {(policy.subsidyRatio * 100).toFixed(0)}%
                        </span>
                      )}
                      {policy.maxSubsidy && (
                        <span className="text-orange-600">
                          {locale === "zh" ? "上限" : "Max"}: ¥{policy.maxSubsidy.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {policy.requirements && (
                      <div className="mt-3 pt-3 border-t text-sm text-gray-500">
                        <strong>{locale === "zh" ? "申请条件" : "Requirements"}:</strong> {policy.requirements}
                      </div>
                    )}
                    {policy.applicationUrl && (
                      <a
                        href={policy.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-3 text-blue-600 hover:underline text-sm font-medium"
                      >
                        {locale === "zh" ? "前往申请 →" : "Apply Now →"}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "registry" && (
          <RegistryDataTab locale={locale} />
        )}
      </div>
    </div>
  );
}

function RegistryDataTab({ locale }: { locale: string }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchBrand, setSearchBrand] = useState("");

  useEffect(() => {
    fetchRecords();
  }, [searchBrand]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchBrand) params.set("brand", searchBrand);
      const res = await fetch(`/api/gov-data/machinery?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (e) {
      console.error("Failed to fetch registry:", e);
    }
    setLoading(false);
  };

  return (
    <div>
      <input
        type="text"
        value={searchBrand}
        onChange={(e) => setSearchBrand(e.target.value)}
        placeholder={locale === "zh" ? "搜索品牌..." : "Search brand..."}
        className="w-full px-3 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
      />
      {loading ? (
        <p className="text-gray-500">{locale === "zh" ? "加载中..." : "Loading..."}</p>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {locale === "zh" ? "暂无登记数据" : "No registry data available"}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{locale === "zh" ? "品牌" : "Brand"}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{locale === "zh" ? "型号" : "Model"}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{locale === "zh" ? "类别" : "Category"}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{locale === "zh" ? "登记编号" : "Reg. No."}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{locale === "zh" ? "排放标准" : "Emission"}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{locale === "zh" ? "年检" : "Inspection"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{r.brandName}</td>
                  <td className="px-4 py-3 text-sm">{r.modelName}</td>
                  <td className="px-4 py-3 text-sm">{r.category}</td>
                  <td className="px-4 py-3 text-sm font-mono">{r.registrationNo || "-"}</td>
                  <td className="px-4 py-3 text-sm">{r.emissionStandard || "-"}</td>
                  <td className="px-4 py-3 text-sm">
                    {r.inspectionDate ? new Date(r.inspectionDate).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
