/**
 * .cn 站 - 发布页面
 *
 * 复用 .com 发布逻辑，增加：
 * - 国产农机品类选择（中国品牌过滤）
 * - 车况信息卡必填（MachineryIdentity Card — 8 项硬数据）
 * - 增值信息服务费提示（非"交易费/佣金"）
 */

import { Metadata } from "next";
import { useTranslations } from "next-intl";
import { siteConfig } from "@/config/site";
import CnVehicleCard from "@/components/cn/CnVehicleCard";

export const metadata: Metadata = {
  title: "发布车源 - 神雕农机",
  description: "在神雕农机发布二手农机车源，填写车况信息，快速触达国内买家",
};

export default function CnPublishPage() {
  const t = useTranslations("cn.publish");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "发布车源" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback: "填写农机信息，触达全国买家 · 增值信息服务费透明公开",
          })}
        </p>
        {siteConfig.compliance.icpNo && (
          <span className="inline-block mt-2 text-xs text-gray-400">
            ICP 备案号：{siteConfig.compliance.icpNo}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 主表单区域 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本信息 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t("basicInfo", { fallback: "基本信息" })}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("brand", { fallback: "品牌" })} *
                </label>
                <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{t("selectBrand", { fallback: "请选择品牌" })}</option>
                  <option value="dongfanghong">东方红 (Dongfanghong)</option>
                  <option value="lovol">雷沃 (Lovol)</option>
                  <option value="world">沃得 (World)</option>
                  <option value="changfa">常发 (Changfa)</option>
                  <option value="yoto">一拖 (YTO)</option>
                  <option value="zoomlion">中联重科 (Zoomlion)</option>
                  <option value="wuzheng">五征 (Wuzheng)</option>
                  <option value="shifeng">时风 (Shifeng)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("category", { fallback: "品类" })} *
                </label>
                <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{t("selectCategory", { fallback: "请选择品类" })}</option>
                  <option value="tractor">拖拉机</option>
                  <option value="harvester">收割机</option>
                  <option value="planter">播种机</option>
                  <option value="rotary_tiller">旋耕机</option>
                  <option value="sprayer">喷雾机</option>
                  <option value="dryer">烘干机</option>
                  <option value="rice_transplanter">插秧机</option>
                  <option value="baler">打捆机</option>
                  <option value="feed_mixer">饲料混合机</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("modelName", { fallback: "型号" })} *
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：LX2004"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("year", { fallback: "出厂年份" })} *
                </label>
                <input
                  type="number"
                  min="1980"
                  max="2026"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：2020"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("workingHours", { fallback: "工作时长（小时）" })}
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：3500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("priceCny", { fallback: "价格（元）" })} *
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：120000"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("location", { fallback: "所在地" })} *
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：河北省石家庄市元氏县"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("description", { fallback: "设备描述" })} *
                </label>
                <textarea
                  rows={4}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="描述设备现状、维护记录、已知问题等"
                />
              </div>
            </div>
          </section>

          {/* 车况信息卡（.cn 专属，必填） */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t("conditionCard", { fallback: "车况信息卡" })}
              <span className="ml-2 text-xs text-red-500 font-normal">
                * {t("required", { fallback: "必填" })}
              </span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {t("conditionCardDesc", {
                fallback: "提供以下 8 项车况硬数据，帮助买家快速了解设备状况",
              })}
            </p>
            <CnVehicleCard />
          </section>

          {/* 服务费说明 */}
          <section className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <p className="text-sm text-blue-800">
              <strong>{t("feeNote", { fallback: "关于费用" })}：</strong>
              {t("feeDetail", {
                fallback:
                  "本站仅收取增值信息服务费（非交易费/佣金）。发布车源免费，增值服务（AI 估值、市场情报）为可选付费项目。担保交易资金仅通过微信小程序收付通闭环，网站不碰资金。",
              })}
            </p>
          </section>

          {/* 提交按钮 */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t("submit", { fallback: "提交发布" })}
            </button>
          </div>
        </div>

        {/* 右侧提示栏 */}
        <aside className="space-y-4">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              {t("tips", { fallback: "发布提示" })}
            </h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• {t("tip1", { fallback: "确保填写真实准确的车况信息" })}</li>
              <li>• {t("tip2", { fallback: "建议上传多角度设备照片" })}</li>
              <li>• {t("tip3", { fallback: "权属核验后可获得\u201C信任卖家\u201D标签" })}</li>
              <li>• {t("tip4", { fallback: "询价/报价采用盲报模式，保障双方隐私" })}</li>
            </ul>
          </div>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">
              {t("complianceTitle", { fallback: "合规说明" })}
            </h3>
            <p className="text-sm text-yellow-800">
              {t("complianceDesc", {
                fallback:
                  "本平台严格遵守国内法律法规。所有交易资金仅通过微信小程序收付通闭环完成，网站仅提供信息展示与询价服务，不触碰资金。",
              })}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
