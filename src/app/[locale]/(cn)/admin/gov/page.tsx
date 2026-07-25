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

export const metadata: Metadata = {
  title: "监管数据看板 - 神雕农机",
  description: "农机流通监管数据看板 - 仅供授权监管机构查看",
};

export default function CnGovDashboardPage() {
  const t = useTranslations("cn.govDashboard");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "监管数据看板" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback:
              "农机流通监管数据概览 — 仅供授权监管机构（中国农机流通协会 / 元氏县农业农村局）查看",
          })}
        </p>
        <span className="inline-block mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
          {t("restricted", { fallback: "仅限授权账号访问" })}
        </span>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">
            {t("totalListings", { fallback: "发布总量" })}
          </p>
          <p className="text-3xl font-bold text-gray-900">1,284</p>
          <p className="text-xs text-green-600 mt-1">↑ 12.5% {t("monthOverMonth", { fallback: "月环比" })}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">
            {t("verifiedCount", { fallback: "已核验" })}
          </p>
          <p className="text-3xl font-bold text-green-600">856</p>
          <p className="text-xs text-gray-500 mt-1">
            {t("verificationRate", { fallback: "核验率" })}: 66.7%
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">
            {t("inquiryCount", { fallback: "询价总量" })}
          </p>
          <p className="text-3xl font-bold text-blue-600">3,421</p>
          <p className="text-xs text-green-600 mt-1">↑ 8.3% {t("monthOverMonth", { fallback: "月环比" })}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">
            {t("guaranteeCount", { fallback: "担保交易" })}
          </p>
          <p className="text-3xl font-bold text-purple-600">187</p>
          <p className="text-xs text-green-600 mt-1">↑ 23.1% {t("monthOverMonth", { fallback: "月环比" })}</p>
        </div>
      </div>

      {/* 核验趋势图 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">
            {t("verificationTrend", { fallback: "核验趋势" })}
          </h2>
          <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-400 text-sm">
              {t("chartPlaceholder", { fallback: "核验数据趋势图（按月度）" })}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">
            {t("regionalDistribution", { fallback: "区域分布" })}
          </h2>
          <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-400 text-sm">
              {t("chartPlaceholder", { fallback: "农机来源地域分布图" })}
            </p>
          </div>
        </div>
      </div>

      {/* 详细数据表格 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {t("recentVerifications", { fallback: "近期核验记录" })}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-6 py-3 text-gray-600 font-medium">
                  {t("productName", { fallback: "设备名称" })}
                </th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">
                  {t("sellerName", { fallback: "卖家" })}
                </th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">
                  {t("status", { fallback: "核验状态" })}
                </th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">
                  {t("date", { fallback: "日期" })}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4">东方红 LX2004</td>
                <td className="px-6 py-4">元氏县农机合作社</td>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {t("verified", { fallback: "已核验" })}
                  </span>
                </td>
                <td className="px-6 py-4">2026-07-20</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4">雷沃 M704-B</td>
                <td className="px-6 py-4">个人卖家</td>
                <td className="px-6 py-4">
                  <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {t("pending", { fallback: "待核验" })}
                  </span>
                </td>
                <td className="px-6 py-4">2026-07-19</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4">沃得收割机 4LZ-8.0</td>
                <td className="px-6 py-4">河北农机经销商</td>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {t("verified", { fallback: "已核验" })}
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
          <strong>{t("dataNote", { fallback: "数据说明" })}：</strong>
          {t("dataNoteDesc", {
            fallback:
              "本看板数据仅包含 .cn 国内站数据，数据存储于阿里云 RDS 北京地域，不出境。所有用户个人信息已脱敏处理。",
          })}
        </p>
      </div>
    </div>
  );
}
