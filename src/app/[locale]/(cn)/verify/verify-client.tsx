"use client";
/**
 * .cn 站 - 权属核验页面
 *
 * 流程：上传核验材料 → super_admin 审核 → 核验通过/拒绝
 * 复用 P1 super_admin 双层校验机制。
 */
import { useTranslations } from "next-intl";
import { useTr } from "@/lib/i18n-tr";

export default function CnVerifyPage() {
  const tr = useTr();
    const t = useTranslations("cn.verify");
    return (<div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "\u6743\u5C5E\u6838\u9A8C" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback: "\u4E0A\u4F20\u6838\u9A8C\u6750\u6599\uFF0C\u7531\u5E73\u53F0\u5BA1\u6838\u5458\u6838\u5B9E\u519C\u673A\u6240\u6709\u6743\u4FE1\u606F\uFF0C\u901A\u8FC7\u540E\u83B7\u5F97\u201C\u5DF2\u6838\u9A8C\u201D\u6807\u8BC6",
        })}
        </p>
      </div>

      {/* 核验流程步骤 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
            1
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">
            {t("step1Title", { fallback: "\u4E0A\u4F20\u6750\u6599" })}
          </h3>
          <p className="text-sm text-gray-600">
            {t("step1Desc", {
            fallback: "\u4E0A\u4F20\u8D2D\u673A\u53D1\u7968\u3001\u5408\u683C\u8BC1\u3001\u884C\u9A76\u8BC1\u6216\u767B\u8BB0\u8BC1\u4E66\u7B49\u6743\u5C5E\u8BC1\u660E\u6587\u4EF6",
        })}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
            2
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">
            {t("step2Title", { fallback: "\u5E73\u53F0\u6838\u9A8C" })}
          </h3>
          <p className="text-sm text-gray-600">
            {t("step2Desc", {
            fallback: "\u5E73\u53F0 super_admin \u5BA1\u6838\u5458\u5728 1-3 \u4E2A\u5DE5\u4F5C\u65E5\u5185\u5B8C\u6210\u6838\u9A8C",
        })}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
            3
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">
            {t("step3Title", { fallback: "\u83B7\u5F97\u6807\u8BC6" })}
          </h3>
          <p className="text-sm text-gray-600">
            {t("step3Desc", {
            fallback: "\u6838\u9A8C\u901A\u8FC7\u540E\uFF0C\u8BBE\u5907\u5C06\u83B7\u5F97\u201C\u5DF2\u6838\u9A8C\u201D\u5FBD\u7AE0\uFF0C\u589E\u5F3A\u4E70\u5BB6\u4FE1\u4EFB",
        })}
          </p>
        </div>
      </div>

      {/* 核验申请表单 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
        <h2 className="text-xl font-semibold mb-6">
          {t("applyForm", { fallback: "\u63D0\u4EA4\u6838\u9A8C\u7533\u8BF7" })}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("productLink", { fallback: "\u5173\u8054\u8BBE\u5907" })} *
            </label>
            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t("selectProduct", { fallback: "\u8BF7\u9009\u62E9\u8981\u6838\u9A8C\u7684\u8BBE\u5907" })}</option>
              <option value="prod_1">{tr("东方红 LX2004（2020）")}</option>
              <option value="prod_2">{tr("雷沃 M704-B（2022）")}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("certType", { fallback: "\u6838\u9A8C\u7C7B\u578B" })} *
            </label>
            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ownership">{t("ownership", { fallback: "\u6240\u6709\u6743\u6838\u9A8C" })}</option>
              <option value="identity">{t("identity", { fallback: "\u8EAB\u4EFD\u4FE1\u606F\u6838\u9A8C" })}</option>
              <option value="full">{t("full", { fallback: "\u5B8C\u6574\u6838\u9A8C\uFF08\u6240\u6709\u6743+\u8EAB\u4EFD\uFF09" })}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("documents", { fallback: "\u8BC1\u660E\u6750\u6599" })} *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                {t("uploadHint", { fallback: "\u70B9\u51FB\u4E0A\u4F20\u6216\u62D6\u62FD\u6587\u4EF6\u5230\u6B64\u533A\u57DF" })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t("uploadFormats", { fallback: "\u652F\u6301 JPG\u3001PNG\u3001PDF\uFF0C\u5355\u6587\u4EF6\u4E0D\u8D85\u8FC7 10MB" })}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("notes", { fallback: "\u5907\u6CE8\u8BF4\u660E" })}
            </label>
            <textarea rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={t("notesPlaceholder", { fallback: "\u5982\u6709\u8865\u5145\u8BF4\u660E\uFF0C\u8BF7\u5728\u6B64\u586B\u5199" })}/>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <strong>{t("privacyNote", { fallback: "\u9690\u79C1\u8BF4\u660E" })}：</strong>
              {t("privacyDetail", {
            fallback: "\u4E0A\u4F20\u7684\u6750\u6599\u4EC5\u7528\u4E8E\u6743\u5C5E\u6838\u9A8C\uFF0C\u7531 super_admin \u5BA1\u6838\u5458\u67E5\u770B\uFF0C\u6838\u9A8C\u5B8C\u6210\u540E\u5C06\u8131\u654F\u5B58\u50A8\u3002\u60A8\u7684\u4E2A\u4EBA\u4FE1\u606F\u53D7\u4E25\u683C\u4FDD\u62A4\u3002",
        })}
            </p>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
            {t("submit", { fallback: "\u63D0\u4EA4\u6838\u9A8C\u7533\u8BF7" })}
          </button>
        </div>
      </div>
    </div>);
}
