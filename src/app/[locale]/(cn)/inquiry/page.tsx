/**
 * .cn 站 - 询价页面
 *
 * 与现有 bargaining 系统打通，加小程序入口码。
 * 流程：浏览车源 → 发起询价/报价（盲报模式）→ 担保意向 → 小程序收付通闭环
 */

import { Metadata } from "next";
import { useTranslations } from "next-intl";
import CnMiniProgramQr from "@/components/cn/CnMiniProgramQr";

export const metadata: Metadata = {
  title: "询价中心 - 神雕农机",
  description: "发起农机询价，获取卖家报价。担保交易仅通过微信小程序收付通闭环完成。",
};

export default function CnInquiryPage() {
  const t = useTranslations("cn.inquiry");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "询价中心" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback: "在神雕农机发现心仪农机 → 发起询价 → 小程序完成担保交易",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 询价列表 */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold mb-4">
            {t("recentInquiries", { fallback: "我的询价" })}
          </h2>

          {/* 询价卡片示例 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  东方红 LX2004 拖拉机
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {t("seller", { fallback: "卖家" })}: 河北元氏县农机合作社
                </p>
                <p className="text-sm text-gray-500">
                  {t("postedAt", { fallback: "发布时间" })}: 2026-07-20
                </p>
              </div>
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {t("statusQuoted", { fallback: "已报价" })}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
              <span>
                💰 {t("price", { fallback: "价格" })}: ¥120,000
              </span>
              <span>
                📍 {t("location", { fallback: "所在地" })}: 河北石家庄
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors">
                {t("viewQuote", { fallback: "查看报价" })}
              </button>
              <button className="text-sm bg-green-50 text-green-600 px-3 py-1.5 rounded-md hover:bg-green-100 transition-colors">
                {t("createGuarantee", { fallback: "发起担保意向" })}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  雷沃 M704-B 拖拉机
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {t("seller", { fallback: "卖家" })}: 个人卖家
                </p>
                <p className="text-sm text-gray-500">
                  {t("postedAt", { fallback: "发布时间" })}: 2026-07-18
                </p>
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {t("statusPending", { fallback: "待报价" })}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
              <span>
                💰 {t("price", { fallback: "价格" })}: {t("askSeller", { fallback: "面议" })}
              </span>
              <span>
                📍 {t("location", { fallback: "所在地" })}: 山东潍坊
              </span>
            </div>
            <div className="mt-3">
              <button className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition-colors">
                {t("sendInquiry", { fallback: "发起询价" })}
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-400 text-center py-8">
            {t("loadMore", { fallback: "加载更多..." })}
          </p>
        </div>

        {/* 右侧：小程序入口 + 流程说明 */}
        <aside className="space-y-6">
          {/* 小程序码 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <h3 className="font-semibold text-gray-900 mb-3">
              {t("miniProgramTitle", { fallback: "小程序担保交易" })}
            </h3>
            <div className="flex justify-center mb-3">
              <CnMiniProgramQr />
            </div>
            <p className="text-sm text-gray-600">
              {t("miniProgramDesc", {
                fallback: "扫码进入微信小程序，完成担保交易。资金由微信收付通保障，平台不碰资金。",
              })}
            </p>
          </div>

          {/* 询价流程说明 */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              {t("howItWorks", { fallback: "询价流程" })}
            </h3>
            <ol className="text-sm text-gray-600 space-y-3 list-decimal list-inside">
              <li>{t("step1", { fallback: "浏览车源，点击\u201C发起询价\u201D" })}</li>
              <li>{t("step2", { fallback: "卖家在盲报模式下给出报价" })}</li>
              <li>{t("step3", { fallback: "双方达成意向后，生成担保交易意向" })}</li>
              <li>{t("step4", { fallback: "买家扫码进入微信小程序完成支付" })}</li>
              <li>{t("step5", { fallback: "资金直进卖家子商户，平台不碰钱" })}</li>
            </ol>
          </div>

          {/* 合规说明 */}
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">
              {t("complianceTitle", { fallback: "合规说明" })}
            </h3>
            <p className="text-sm text-yellow-800">
              {t("complianceDesc", {
                fallback:
                  "本平台采用询价/报价盲报模式（非拍卖）。所有担保交易资金仅通过微信小程序收付通闭环，平台不触碰交易资金，不构成二清。",
              })}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
