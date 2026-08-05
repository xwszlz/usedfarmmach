/**
 * .cn 站 - 价格指数/市场情报页面
 *
 * 展示价格指数图表、市场行情分析、行业报告。
 * 增值服务（可收费）：详细情报报告、AI 市场预测。
 */

import { Metadata } from "next";
import { useTranslations } from "next-intl";
import { siteConfig } from "@/config/site";
import CnPriceIndexChart from "@/components/cn/CnPriceIndexChart";

export const metadata: Metadata = {
  title: "价格指数与市场情报 - 神雕农机",
  description: "国产二手农机价格指数、市场行情分析、行业趋势报告",
};

export default function CnIntelPage() {
  const t = useTranslations("cn.intel");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "价格指数与市场情报" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback: "基于全国交易数据生成的国产二手农机价格指数与市场分析",
          })}
        </p>
        {siteConfig.features.priceIndex && (
          <span className="inline-block mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            {t("premiumFeature", { fallback: "增值服务 · 部分报告需会员订阅" })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 主内容区 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 价格指数图表 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t("priceIndexTitle", { fallback: "国产二手农机价格指数" })}
            </h2>
            <CnPriceIndexChart />
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-600">108.5</p>
                <p className="text-xs text-gray-500">
                  {t("currentIndex", { fallback: "当前指数" })}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">+2.3%</p>
                <p className="text-xs text-gray-500">
                  {t("monthOverMonth", { fallback: "月环比" })}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-600">-1.2%</p>
                <p className="text-xs text-gray-500">
                  {t("yearOverYear", { fallback: "年同比" })}
                </p>
              </div>
            </div>
          </section>

          {/* 市场行情 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t("marketAnalysis", { fallback: "市场行情分析" })}
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">东方红 LX 系列</p>
                  <p className="text-sm text-gray-500">
                    {t("avgPrice", { fallback: "均价" })}: ¥85,000 - ¥150,000
                  </p>
                </div>
                <span className="text-sm text-green-600 font-medium">↑ 3.5%</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">雷沃 M 系列</p>
                  <p className="text-sm text-gray-500">
                    {t("avgPrice", { fallback: "均价" })}: ¥60,000 - ¥120,000
                  </p>
                </div>
                <span className="text-sm text-red-600 font-medium">↓ 1.2%</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">沃得收割机</p>
                  <p className="text-sm text-gray-500">
                    {t("avgPrice", { fallback: "均价" })}: ¥100,000 - ¥200,000
                  </p>
                </div>
                <span className="text-sm text-green-600 font-medium">↑ 5.8%</span>
              </div>
            </div>
          </section>

          {/* 行业报告 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t("industryReports", { fallback: "行业报告" })}
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    2026 年上半年中国二手拖拉机市场分析报告
                  </p>
                  <p className="text-sm text-gray-500">2026-07-01 · 15 页</p>
                </div>
                <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
                  {t("viewReport", { fallback: "查看" })}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    河北省二手农机流通白皮书（2026 版）
                  </p>
                  <p className="text-sm text-gray-500">2026-06-15 · 28 页</p>
                </div>
                <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
                  {t("viewReport", { fallback: "查看" })}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* 右侧栏 */}
        <aside className="space-y-4">
          {/* 筛选器 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              {t("filter", { fallback: "筛选条件" })}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("category", { fallback: "品类" })}
                </label>
                <select className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                  <option>{t("all", { fallback: "全部" })}</option>
                  <option>拖拉机</option>
                  <option>收割机</option>
                  <option>插秧机</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("region", { fallback: "地区" })}
                </label>
                <select className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                  <option>{t("all", { fallback: "全部" })}</option>
                  <option>河北</option>
                  <option>山东</option>
                  <option>河南</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("period", { fallback: "时间范围" })}
                </label>
                <select className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                  <option>{t("last3Months", { fallback: "近 3 个月" })}</option>
                  <option>{t("last6Months", { fallback: "近 6 个月" })}</option>
                  <option>{t("lastYear", { fallback: "近 1 年" })}</option>
                </select>
              </div>
            </div>
          </div>

          {/* 增值服务 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              {t("premiumTitle", { fallback: "增值情报服务" })}
            </h3>
            <p className="text-sm text-blue-800 mb-3">
              {t("premiumDesc", {
                fallback:
                  "订阅 AI 市场情报增值包，获取深度分析报告、价格预测与供需趋势。",
              })}
            </p>
            <p className="text-xs text-blue-600 mb-3">
              {t("premiumFee", {
                fallback: "* 此为增值信息服务费，非交易费/佣金",
              })}
            </p>
            <button className="w-full bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              {t("subscribe", { fallback: "订阅增值服务" })}
            </button>
          </div>

          {/* 合规说明 */}
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-3">
            <p className="text-xs text-yellow-800">
              <strong>{t("disclaimer", { fallback: "免责声明" })}：</strong>
              {t("disclaimerDesc", {
                fallback:
                  "价格指数仅供参考，不构成交易建议。实际成交价可能因车况、地区、交易方式等因素有所差异。",
              })}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
