"use client";
/**
 * .cn 站 - 询价页面
 *
 * 与现有 bargaining 系统打通，加小程序入口码。
 * 流程：浏览车源 → 发起询价/报价（盲报模式）→ 担保意向 → 小程序收付通闭环
 */
import { useTranslations } from "next-intl";
import CnMiniProgramQr from "@/components/cn/CnMiniProgramQr";
import { useTr } from "@/lib/i18n-tr";

export default function CnInquiryPage() {
  const tr = useTr();
    const t = useTranslations("cn.inquiry");
    return (<div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "\u8BE2\u4EF7\u4E2D\u5FC3" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback: "\u5728\u795E\u96D5\u519C\u673A\u53D1\u73B0\u5FC3\u4EEA\u519C\u673A \u2192 \u53D1\u8D77\u8BE2\u4EF7 \u2192 \u5C0F\u7A0B\u5E8F\u5B8C\u6210\u62C5\u4FDD\u4EA4\u6613",
        })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 询价列表 */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold mb-4">
            {t("recentInquiries", { fallback: "\u6211\u7684\u8BE2\u4EF7" })}
          </h2>

          {/* 询价卡片示例 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{tr("东方红 LX2004 拖拉机")}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {t("seller", { fallback: "\u5356\u5BB6" })}{tr(": 河北元氏县农机合作社")}</p>
                <p className="text-sm text-gray-500">
                  {t("postedAt", { fallback: "\u53D1\u5E03\u65F6\u95F4" })}: 2026-07-20
                </p>
              </div>
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {t("statusQuoted", { fallback: "\u5DF2\u62A5\u4EF7" })}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
              <span>
                💰 {t("price", { fallback: "\u4EF7\u683C" })}: ¥120,000
              </span>
              <span>
                📍 {t("location", { fallback: "\u6240\u5728\u5730" })}{tr(": 河北石家庄")}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors">
                {t("viewQuote", { fallback: "\u67E5\u770B\u62A5\u4EF7" })}
              </button>
              <button className="text-sm bg-green-50 text-green-600 px-3 py-1.5 rounded-md hover:bg-green-100 transition-colors">
                {t("createGuarantee", { fallback: "\u53D1\u8D77\u62C5\u4FDD\u610F\u5411" })}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{tr("雷沃 M704-B 拖拉机")}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {t("seller", { fallback: "\u5356\u5BB6" })}{tr(": 个人卖家")}</p>
                <p className="text-sm text-gray-500">
                  {t("postedAt", { fallback: "\u53D1\u5E03\u65F6\u95F4" })}: 2026-07-18
                </p>
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {t("statusPending", { fallback: "\u5F85\u62A5\u4EF7" })}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
              <span>
                💰 {t("price", { fallback: "\u4EF7\u683C" })}: {t("askSeller", { fallback: "\u9762\u8BAE" })}
              </span>
              <span>
                📍 {t("location", { fallback: "\u6240\u5728\u5730" })}{tr(": 山东潍坊")}</span>
            </div>
            <div className="mt-3">
              <button className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition-colors">
                {t("sendInquiry", { fallback: "\u53D1\u8D77\u8BE2\u4EF7" })}
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-400 text-center py-8">
            {t("loadMore", { fallback: "\u52A0\u8F7D\u66F4\u591A..." })}
          </p>
        </div>

        {/* 右侧：小程序入口 + 流程说明 */}
        <aside className="space-y-6">
          {/* 小程序码 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <h3 className="font-semibold text-gray-900 mb-3">
              {t("miniProgramTitle", { fallback: "\u5C0F\u7A0B\u5E8F\u62C5\u4FDD\u4EA4\u6613" })}
            </h3>
            <div className="flex justify-center mb-3">
              <CnMiniProgramQr />
            </div>
            <p className="text-sm text-gray-600">
              {t("miniProgramDesc", {
            fallback: "\u626B\u7801\u8FDB\u5165\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\uFF0C\u5B8C\u6210\u62C5\u4FDD\u4EA4\u6613\u3002\u8D44\u91D1\u7531\u5FAE\u4FE1\u6536\u4ED8\u901A\u4FDD\u969C\uFF0C\u5E73\u53F0\u4E0D\u78B0\u8D44\u91D1\u3002",
        })}
            </p>
          </div>

          {/* 询价流程说明 */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              {t("howItWorks", { fallback: "\u8BE2\u4EF7\u6D41\u7A0B" })}
            </h3>
            <ol className="text-sm text-gray-600 space-y-3 list-decimal list-inside">
              <li>{t("step1", { fallback: "\u6D4F\u89C8\u8F66\u6E90\uFF0C\u70B9\u51FB\u201C\u53D1\u8D77\u8BE2\u4EF7\u201D" })}</li>
              <li>{t("step2", { fallback: "\u5356\u5BB6\u5728\u76F2\u62A5\u6A21\u5F0F\u4E0B\u7ED9\u51FA\u62A5\u4EF7" })}</li>
              <li>{t("step3", { fallback: "\u53CC\u65B9\u8FBE\u6210\u610F\u5411\u540E\uFF0C\u751F\u6210\u62C5\u4FDD\u4EA4\u6613\u610F\u5411" })}</li>
              <li>{t("step4", { fallback: "\u4E70\u5BB6\u626B\u7801\u8FDB\u5165\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\u5B8C\u6210\u652F\u4ED8" })}</li>
              <li>{t("step5", { fallback: "\u8D44\u91D1\u76F4\u8FDB\u5356\u5BB6\u5B50\u5546\u6237\uFF0C\u5E73\u53F0\u4E0D\u78B0\u94B1" })}</li>
            </ol>
          </div>

          {/* 合规说明 */}
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">
              {t("complianceTitle", { fallback: "\u5408\u89C4\u8BF4\u660E" })}
            </h3>
            <p className="text-sm text-yellow-800">
              {t("complianceDesc", {
            fallback: "\u672C\u5E73\u53F0\u91C7\u7528\u8BE2\u4EF7/\u62A5\u4EF7\u76F2\u62A5\u6A21\u5F0F\uFF08\u975E\u62CD\u5356\uFF09\u3002\u6240\u6709\u62C5\u4FDD\u4EA4\u6613\u8D44\u91D1\u4EC5\u901A\u8FC7\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\u6536\u4ED8\u901A\u95ED\u73AF\uFF0C\u5E73\u53F0\u4E0D\u89E6\u78B0\u4EA4\u6613\u8D44\u91D1\uFF0C\u4E0D\u6784\u6210\u4E8C\u6E05\u3002",
        })}
            </p>
          </div>
        </aside>
      </div>
    </div>);
}
