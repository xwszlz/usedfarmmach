"use client";
/**
 * .cn 站 - 政府监管数据看板
 *
 * 面向中国农机流通协会 / 元氏县农业农村局等监管方，
 * 展示核验/备案/流通数据的综合看板。
 *
 * 权限：仅 super_admin 及授权的政府监管账号可访问。
 */
import { Metadata } from "next";
import { useTranslations } from "next-intl";
import { useTr } from "@/lib/i18n-tr";
export const metadata: Metadata = {
    title: "监管数据看板 - 神雕农机",
    description: "农机流通监管数据看板 - 仅供授权监管机构查看",
};
export default function CnGovDashboardPage() {
  const tr = useTr();
    const t = useTranslations("cn.govDashboard");
    return (<div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "\u76D1\u7BA1\u6570\u636E\u770B\u677F" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback: "\u519C\u673A\u6D41\u901A\u76D1\u7BA1\u6570\u636E\u6982\u89C8 \u2014 \u4EC5\u4F9B\u6388\u6743\u76D1\u7BA1\u673A\u6784\uFF08\u4E2D\u56FD\u519C\u673A\u6D41\u901A\u534F\u4F1A / \u5143\u6C0F\u53BF\u519C\u4E1A\u519C\u6751\u5C40\uFF09\u67E5\u770B",
        })}
        </p>
        <span className="inline-block mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
          {t("restricted", { fallback: "\u4EC5\u9650\u6388\u6743\u8D26\u53F7\u8BBF\u95EE" })}
        </span>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">
            {t("totalListings", { fallback: "\u53D1\u5E03\u603B\u91CF" })}
          </p>
          <p className="text-3xl font-bold text-gray-900">1,284</p>
          <p className="text-xs text-green-600 mt-1">↑ 12.5% {t("monthOverMonth", { fallback: "\u6708\u73AF\u6BD4" })}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">
            {t("verifiedCount", { fallback: "\u5DF2\u6838\u9A8C" })}
          </p>
          <p className="text-3xl font-bold text-green-600">856</p>
          <p className="text-xs text-gray-500 mt-1">
            {t("verificationRate", { fallback: "\u6838\u9A8C\u7387" })}: 66.7%
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">
            {t("inquiryCount", { fallback: "\u8BE2\u4EF7\u603B\u91CF" })}
          </p>
          <p className="text-3xl font-bold text-blue-600">3,421</p>
          <p className="text-xs text-green-600 mt-1">↑ 8.3% {t("monthOverMonth", { fallback: "\u6708\u73AF\u6BD4" })}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">
            {t("guaranteeCount", { fallback: "\u62C5\u4FDD\u4EA4\u6613" })}
          </p>
          <p className="text-3xl font-bold text-purple-600">187</p>
          <p className="text-xs text-green-600 mt-1">↑ 23.1% {t("monthOverMonth", { fallback: "\u6708\u73AF\u6BD4" })}</p>
        </div>
      </div>

      {/* 核验趋势图 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">
            {t("verificationTrend", { fallback: "\u6838\u9A8C\u8D8B\u52BF" })}
          </h2>
          <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-400 text-sm">
              {t("chartPlaceholder", { fallback: "\u6838\u9A8C\u6570\u636E\u8D8B\u52BF\u56FE\uFF08\u6309\u6708\u5EA6\uFF09" })}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">
            {t("regionalDistribution", { fallback: "\u533A\u57DF\u5206\u5E03" })}
          </h2>
          <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-400 text-sm">
              {t("chartPlaceholder", { fallback: "\u519C\u673A\u6765\u6E90\u5730\u57DF\u5206\u5E03\u56FE" })}
            </p>
          </div>
        </div>
      </div>

      {/* 详细数据表格 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {t("recentVerifications", { fallback: "\u8FD1\u671F\u6838\u9A8C\u8BB0\u5F55" })}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-6 py-3 text-gray-600 font-medium">
                  {t("productName", { fallback: "\u8BBE\u5907\u540D\u79F0" })}
                </th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">
                  {t("sellerName", { fallback: "\u5356\u5BB6" })}
                </th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">
                  {t("status", { fallback: "\u6838\u9A8C\u72B6\u6001" })}
                </th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">
                  {t("date", { fallback: "\u65E5\u671F" })}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4">{tr("东方红 LX2004")}</td>
                <td className="px-6 py-4">{tr("元氏县农机合作社")}</td>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {t("verified", { fallback: "\u5DF2\u6838\u9A8C" })}
                  </span>
                </td>
                <td className="px-6 py-4">2026-07-20</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4">{tr("雷沃 M704-B")}</td>
                <td className="px-6 py-4">{tr("个人卖家")}</td>
                <td className="px-6 py-4">
                  <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {t("pending", { fallback: "\u5F85\u6838\u9A8C" })}
                  </span>
                </td>
                <td className="px-6 py-4">2026-07-19</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4">{tr("沃得收割机 4LZ-8.0")}</td>
                <td className="px-6 py-4">{tr("河北农机经销商")}</td>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {t("verified", { fallback: "\u5DF2\u6838\u9A8C" })}
                  </span>
                </td>
                <td className="px-6 py-4">2026-07-18</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 合规说明 */}
      <div className="mt-6 bg-yellow-50 rounded-lg border border-yellow-200 p-4">
        <p className="text-sm text-yellow-800">
          <strong>{t("dataNote", { fallback: "\u6570\u636E\u8BF4\u660E" })}：</strong>
          {t("dataNoteDesc", {
            fallback: "\u672C\u770B\u677F\u6570\u636E\u4EC5\u5305\u542B .cn \u56FD\u5185\u7AD9\u6570\u636E\uFF0C\u6570\u636E\u5B58\u50A8\u4E8E\u963F\u91CC\u4E91 RDS \u5317\u4EAC\u5730\u57DF\uFF0C\u4E0D\u51FA\u5883\u3002\u6240\u6709\u7528\u6237\u4E2A\u4EBA\u4FE1\u606F\u5DF2\u8131\u654F\u5904\u7406\u3002",
        })}
        </p>
      </div>
    </div>);
}
