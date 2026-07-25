/**
 * .cn 站 - 权属核验页面
 *
 * 流程：上传核验材料 → super_admin 审核 → 核验通过/拒绝
 * 复用 P1 super_admin 双层校验机制。
 */

import { Metadata } from "next";
import { useTranslations } from "next-intl";

export const metadata: Metadata = {
  title: "权属核验 - 神雕农机",
  description: "上传农机权属证明材料，完成权属核验，获得信任标识",
};

export default function CnVerifyPage() {
  const t = useTranslations("cn.verify");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "权属核验" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback: "上传核验材料，由平台审核员核实农机所有权信息，通过后获得\u201C已核验\u201D标识",
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
            {t("step1Title", { fallback: "上传材料" })}
          </h3>
          <p className="text-sm text-gray-600">
            {t("step1Desc", {
              fallback: "上传购机发票、合格证、行驶证或登记证书等权属证明文件",
            })}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
            2
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">
            {t("step2Title", { fallback: "平台核验" })}
          </h3>
          <p className="text-sm text-gray-600">
            {t("step2Desc", {
              fallback: "平台 super_admin 审核员在 1-3 个工作日内完成核验",
            })}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
            3
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">
            {t("step3Title", { fallback: "获得标识" })}
          </h3>
          <p className="text-sm text-gray-600">
            {t("step3Desc", {
              fallback: "核验通过后，设备将获得\u201C已核验\u201D徽章，增强买家信任",
            })}
          </p>
        </div>
      </div>

      {/* 核验申请表单 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
        <h2 className="text-xl font-semibold mb-6">
          {t("applyForm", { fallback: "提交核验申请" })}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("productLink", { fallback: "关联设备" })} *
            </label>
            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t("selectProduct", { fallback: "请选择要核验的设备" })}</option>
              <option value="prod_1">东方红 LX2004（2020）</option>
              <option value="prod_2">雷沃 M704-B（2022）</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("certType", { fallback: "核验类型" })} *
            </label>
            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ownership">{t("ownership", { fallback: "所有权核验" })}</option>
              <option value="identity">{t("identity", { fallback: "身份信息核验" })}</option>
              <option value="full">{t("full", { fallback: "完整核验（所有权+身份）" })}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("documents", { fallback: "证明材料" })} *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                {t("uploadHint", { fallback: "点击上传或拖拽文件到此区域" })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t("uploadFormats", { fallback: "支持 JPG、PNG、PDF，单文件不超过 10MB" })}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("notes", { fallback: "备注说明" })}
            </label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("notesPlaceholder", { fallback: "如有补充说明，请在此填写" })}
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <strong>{t("privacyNote", { fallback: "隐私说明" })}：</strong>
              {t("privacyDetail", {
                fallback:
                  "上传的材料仅用于权属核验，由 super_admin 审核员查看，核验完成后将脱敏存储。您的个人信息受严格保护。",
              })}
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {t("submit", { fallback: "提交核验申请" })}
          </button>
        </div>
      </div>
    </div>
  );
}
