"use client";
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
import { useTr } from "@/lib/i18n-tr";
export const metadata: Metadata = {
    title: "价格指数与市场情报 - 神雕农机",
    description: "国产二手农机价格指数、市场行情分析、行业趋势报告",
};
export default function CnIntelPage() {
  const tr = useTr();
    const t = useTranslations("cn.intel");
    return (<div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "\u4EF7\u683C\u6307\u6570\u4E0E\u5E02\u573A\u60C5\u62A5" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback: "\u57FA\u4E8E\u5168\u56FD\u4EA4\u6613\u6570\u636E\u751F\u6210\u7684\u56FD\u4EA7\u4E8C\u624B\u519C\u673A\u4EF7\u683C\u6307\u6570\u4E0E\u5E02\u573A\u5206\u6790",
        })}
        </p>
        {siteConfig.features.priceIndex && (<span className="inline-block mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            {t("premiumFeature", { fallback: "\u589E\u503C\u670D\u52A1 \u00B7 \u90E8\u5206\u62A5\u544A\u9700\u4F1A\u5458\u8BA2\u9605" })}
          </span>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 主内容区 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 价格指数图表 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t("priceIndexTitle", { fallback: "\u56FD\u4EA7\u4E8C\u624B\u519C\u673A\u4EF7\u683C\u6307\u6570" })}
            </h2>
            <CnPriceIndexChart />
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-600">108.5</p>
                <p className="text-xs text-gray-500">
                  {t("currentIndex", { fallback: "\u5F53\u524D\u6307\u6570" })}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">+2.3%</p>
                <p className="text-xs text-gray-500">
                  {t("monthOverMonth", { fallback: "\u6708\u73AF\u6BD4" })}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-600">-1.2%</p>
                <p className="text-xs text-gray-500">
                  {t("yearOverYear", { fallback: "\u5E74\u540C\u6BD4" })}
                </p>
              </div>
            </div>
          </section>

          {/* 市场行情 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t("marketAnalysis", { fallback: "\u5E02\u573A\u884C\u60C5\u5206\u6790" })}
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{tr("东方红 LX 系列")}</p>
                  <p className="text-sm text-gray-500">
                    {t("avgPrice", { fallback: "\u5747\u4EF7" })}: ¥85,000 - ¥150,000
                  </p>
                </div>
                <span className="text-sm text-green-600 font-medium">↑ 3.5%</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{tr("雷沃 M 系列")}</p>
                  <p className="text-sm text-gray-500">
                    {t("avgPrice", { fallback: "\u5747\u4EF7" })}: ¥60,000 - ¥120,000
                  </p>
                </div>
                <span className="text-sm text-red-600 font-medium">↓ 1.2%</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{tr("沃得收割机")}</p>
                  <p className="text-sm text-gray-500">
                    {t("avgPrice", { fallback: "\u5747\u4EF7" })}: ¥100,000 - ¥200,000
                  </p>
                </div>
                <span className="text-sm text-green-600 font-medium">↑ 5.8%</span>
              </div>
            </div>
          </section>

          {/* 行业报告 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t("industryReports", { fallback: "\u884C\u4E1A\u62A5\u544A" })}
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{tr("2026 年上半年中国二手拖拉机市场分析报告")}</p>
                  <p className="text-sm text-gray-500">{tr("2026-07-01 · 15 页")}</p>
                </div>
                <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
                  {t("viewReport", { fallback: "\u67E5\u770B" })}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{tr("河北省二手农机流通白皮书（2026 版）")}</p>
                  <p className="text-sm text-gray-500">{tr("2026-06-15 · 28 页")}</p>
                </div>
                <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
                  {t("viewReport", { fallback: "\u67E5\u770B" })}
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
              {t("filter", { fallback: "\u7B5B\u9009\u6761\u4EF6" })}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("category", { fallback: "\u54C1\u7C7B" })}
                </label>
                <select className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                  <option>{t("all", { fallback: "\u5168\u90E8" })}</option>
                  <option>{tr("拖拉机")}</option>
                  <option>{tr("收割机")}</option>
                  <option>{tr("插秧机")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("region", { fallback: "\u5730\u533A" })}
                </label>
                <select className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                  <option>{t("all", { fallback: "\u5168\u90E8" })}</option>
                  <option>{tr("河北")}</option>
                  <option>{tr("山东")}</option>
                  <option>{tr("河南")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("period", { fallback: "\u65F6\u95F4\u8303\u56F4" })}
                </label>
                <select className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                  <option>{t("last3Months", { fallback: "\u8FD1 3 \u4E2A\u6708" })}</option>
                  <option>{t("last6Months", { fallback: "\u8FD1 6 \u4E2A\u6708" })}</option>
                  <option>{t("lastYear", { fallback: "\u8FD1 1 \u5E74" })}</option>
                </select>
              </div>
            </div>
          </div>

          {/* 增值服务 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              {t("premiumTitle", { fallback: "\u589E\u503C\u60C5\u62A5\u670D\u52A1" })}
            </h3>
            <p className="text-sm text-blue-800 mb-3">
              {t("premiumDesc", {
            fallback: "\u8BA2\u9605 AI \u5E02\u573A\u60C5\u62A5\u589E\u503C\u5305\uFF0C\u83B7\u53D6\u6DF1\u5EA6\u5206\u6790\u62A5\u544A\u3001\u4EF7\u683C\u9884\u6D4B\u4E0E\u4F9B\u9700\u8D8B\u52BF\u3002",
        })}
            </p>
            <p className="text-xs text-blue-600 mb-3">
              {t("premiumFee", {
            fallback: "* \u6B64\u4E3A\u589E\u503C\u4FE1\u606F\u670D\u52A1\u8D39\uFF0C\u975E\u4EA4\u6613\u8D39/\u4F63\u91D1",
        })}
            </p>
            <button className="w-full bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              {t("subscribe", { fallback: "\u8BA2\u9605\u589E\u503C\u670D\u52A1" })}
            </button>
          </div>

          {/* 合规说明 */}
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-3">
            <p className="text-xs text-yellow-800">
              <strong>{t("disclaimer", { fallback: "\u514D\u8D23\u58F0\u660E" })}：</strong>
              {t("disclaimerDesc", {
            fallback: "\u4EF7\u683C\u6307\u6570\u4EC5\u4F9B\u53C2\u8003\uFF0C\u4E0D\u6784\u6210\u4EA4\u6613\u5EFA\u8BAE\u3002\u5B9E\u9645\u6210\u4EA4\u4EF7\u53EF\u80FD\u56E0\u8F66\u51B5\u3001\u5730\u533A\u3001\u4EA4\u6613\u65B9\u5F0F\u7B49\u56E0\u7D20\u6709\u6240\u5DEE\u5F02\u3002",
        })}
            </p>
          </div>
        </aside>
      </div>
    </div>);
}
