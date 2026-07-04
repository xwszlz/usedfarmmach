"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface ApiKey {
  id: string;
  key: string;
  name: string;
  organization: string | null;
  scope: string;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  totalRequests: number;
  lastUsedAt: string | null;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

export default function ApiDocsClient() {
  const searchParams = useSearchParams();
  const locale = searchParams.get("locale") || "zh";
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyOrg, setNewKeyOrg] = useState("");
  const [newKeyScope, setNewKeyScope] = useState("read");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"keys" | "docs">("keys");

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("token="))
        ?.split("=")[1];
      const res = await fetch("/api/api-keys", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (e) {
      console.error("Failed to fetch API keys:", e);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("token="))
        ?.split("=")[1];
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newKeyName,
          organization: newKeyOrg || undefined,
          scope: newKeyScope,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setNewKeyName("");
        setNewKeyOrg("");
        setNewKeyScope("read");
        setShowCreateForm(false);
        fetchKeys();
      }
    } catch (e) {
      console.error("Failed to create API key:", e);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("确定要吊销这个 API Key 吗？此操作不可逆。")) return;
    try {
      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("token="))
        ?.split("=")[1];
      const res = await fetch(`/api/api-keys?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchKeys();
      }
    } catch (e) {
      console.error("Failed to revoke key:", e);
    }
  };

  const endpoints = [
    { method: "GET", path: "/api/open/products", desc: locale === "zh" ? "获取产品列表" : "Get product list", desc2: locale === "zh" ? "支持分页、品类、品牌、国家筛选" : "Supports pagination, category, brand, country filters" },
    { method: "GET", path: "/api/open/market-index", desc: locale === "zh" ? "获取价格指数" : "Get price index", desc2: locale === "zh" ? "支持按品类/品牌/区域查询，可选天数范围" : "Supports category/brand/region, optional date range" },
    { method: "GET", path: "/api/open/industry-data", desc: locale === "zh" ? "获取行业统计数据" : "Get industry statistics", desc2: locale === "zh" ? "总览统计、品类/品牌/区域分布、价格统计" : "Overview stats, category/brand/region distribution, price stats" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {locale === "zh" ? "开放 API 平台" : "Open API Platform"}
        </h1>
        <p className="text-gray-600 mb-8">
          {locale === "zh"
            ? "为政府机构、研究机构、经销商提供数据接口服务"
            : "Data API service for government, research institutions, and distributors"}
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("keys")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "keys" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {locale === "zh" ? "API Key 管理" : "API Keys"}
          </button>
          <button
            onClick={() => setActiveTab("docs")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "docs" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {locale === "zh" ? "接口文档" : "API Documentation"}
          </button>
        </div>

        {activeTab === "keys" && (
          <div>
            {/* Created key alert */}
            {createdKey && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-green-800 font-semibold mb-2">
                  {locale === "zh" ? "API Key 创建成功！请立即保存，此Key仅显示一次。" : "API Key created! Save it now — shown only once."}
                </p>
                <code className="block bg-white px-4 py-2 rounded font-mono text-sm break-all">{createdKey}</code>
                <button
                  onClick={() => setCreatedKey(null)}
                  className="mt-2 text-sm text-green-700 hover:underline"
                >
                  {locale === "zh" ? "我已保存" : "I have saved it"}
                </button>
              </div>
            )}

            {/* Create button */}
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition mb-6"
              >
                + {locale === "zh" ? "创建新 API Key" : "Create New API Key"}
              </button>
            )}

            {/* Create form */}
            {showCreateForm && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">
                  {locale === "zh" ? "创建 API Key" : "Create API Key"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {locale === "zh" ? "名称" : "Name"} *
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder={locale === "zh" ? "如：农业部数据接口" : "e.g., Ministry of Agriculture"}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {locale === "zh" ? "机构名称" : "Organization"}
                    </label>
                    <input
                      type="text"
                      value={newKeyOrg}
                      onChange={(e) => setNewKeyOrg(e.target.value)}
                      placeholder={locale === "zh" ? "如：中国农业机械协会" : "e.g., China Agricultural Machinery Association"}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {locale === "zh" ? "权限范围" : "Scope"}
                    </label>
                    <select
                      value={newKeyScope}
                      onChange={(e) => setNewKeyScope(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="read">{locale === "zh" ? "只读 (read)" : "Read only"}</option>
                      <option value="read_write">{locale === "zh" ? "读写 (read_write)" : "Read & Write"}</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                      {locale === "zh" ? "创建" : "Create"}
                    </button>
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                    >
                      {locale === "zh" ? "取消" : "Cancel"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Keys list */}
            {loading ? (
              <p className="text-gray-500">{locale === "zh" ? "加载中..." : "Loading..."}</p>
            ) : keys.length === 0 ? (
              <p className="text-gray-500">
                {locale === "zh" ? "暂无 API Key，点击上方按钮创建。" : "No API keys yet. Click the button above to create one."}
              </p>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
                  <div key={key.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{key.name}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            key.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>
                            {key.status}
                          </span>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                            {key.scope}
                          </span>
                        </div>
                        {key.organization && (
                          <p className="text-sm text-gray-500">{key.organization}</p>
                        )}
                        <code className="text-xs text-gray-600 font-mono mt-1 block">
                          {key.key.slice(0, 12)}...{key.key.slice(-4)}
                        </code>
                        <div className="text-xs text-gray-400 mt-2 flex gap-4">
                          <span>{locale === "zh" ? "请求次数" : "Requests"}: {key.totalRequests}</span>
                          <span>{locale === "zh" ? "日限额" : "Daily limit"}: {key.rateLimitPerDay}</span>
                          {key.lastUsedAt && (
                            <span>{locale === "zh" ? "最后使用" : "Last used"}: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      {key.status === "active" && (
                        <button
                          onClick={() => handleRevoke(key.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          {locale === "zh" ? "吊销" : "Revoke"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "docs" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">
              {locale === "zh" ? "接口文档" : "API Documentation"}
            </h2>
            <div className="mb-6">
              <h3 className="font-semibold mb-2">
                {locale === "zh" ? "认证方式" : "Authentication"}
              </h3>
              <p className="text-gray-600 text-sm mb-2">
                {locale === "zh"
                  ? "在请求头中添加 Authorization 字段："
                  : "Add an Authorization header to your requests:"}
              </p>
              <code className="block bg-gray-800 text-green-400 px-4 py-2 rounded font-mono text-sm">
                Authorization: Bearer sk_your_api_key_here
              </code>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-2">
                {locale === "zh" ? "速率限制" : "Rate Limits"}
              </h3>
              <p className="text-gray-600 text-sm">
                {locale === "zh"
                  ? "默认每Key每小时100次、每天1000次请求。可联系管理员调整。"
                  : "Default: 100 requests/hour, 1000 requests/day per key. Contact admin to adjust."}
              </p>
            </div>

            <h3 className="font-semibold mb-3">
              {locale === "zh" ? "可用接口" : "Available Endpoints"}
            </h3>
            <div className="space-y-4">
              {endpoints.map((ep, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 text-xs font-bold rounded">
                      {ep.method}
                    </span>
                    <code className="font-mono text-sm text-gray-900">{ep.path}</code>
                  </div>
                  <p className="text-gray-700 text-sm">{ep.desc}</p>
                  <p className="text-gray-500 text-xs mt-1">{ep.desc2}</p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="font-semibold mb-2">
                {locale === "zh" ? "示例请求" : "Example Request"}
              </h3>
              <code className="block bg-gray-800 text-green-400 px-4 py-3 rounded font-mono text-sm overflow-x-auto">
{`curl -H "Authorization: Bearer sk_xxx" \\
  "https://usedfarmmach.vercel.app/api/open/products?page=1&pageSize=5"`}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
