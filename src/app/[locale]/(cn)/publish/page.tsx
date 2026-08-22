"use client";
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
import { useTr } from "@/lib/i18n-tr";
export const metadata: Metadata = {
    title: "发布车源 - 神雕农机",
    description: "在神雕农机发布二手农机车源，填写车况信息，快速触达国内买家",
};
export default function CnPublishPage() {
  const tr = useTr();
    const t = useTranslations("cn.publish");
    return (<div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "\u53D1\u5E03\u8F66\u6E90" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback: "\u586B\u5199\u519C\u673A\u4FE1\u606F\uFF0C\u89E6\u8FBE\u5168\u56FD\u4E70\u5BB6 \u00B7 \u589E\u503C\u4FE1\u606F\u670D\u52A1\u8D39\u900F\u660E\u516C\u5F00",
        })}
        </p>
        {siteConfig.compliance.icpNo && (<span className="inline-block mt-2 text-xs text-gray-400">{tr("ICP 备案号：")}{siteConfig.compliance.icpNo}
          </span>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 主表单区域 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本信息 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t("basicInfo", { fallback: "\u57FA\u672C\u4FE1\u606F" })}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("brand", { fallback: "\u54C1\u724C" })} *
                </label>
                <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{t("selectBrand", { fallback: "\u8BF7\u9009\u62E9\u54C1\u724C" })}</option>
                  <option value="dongfanghong">{tr("东方红 (Dongfanghong)")}</option>
                  <option value="lovol">{tr("雷沃 (Lovol)")}</option>
                  <option value="world">{tr("沃得 (World)")}</option>
                  <option value="changfa">{tr("常发 (Changfa)")}</option>
                  <option value="yoto">{tr("一拖 (YTO)")}</option>
                  <option value="zoomlion">{tr("中联重科 (Zoomlion)")}</option>
                  <option value="wuzheng">{tr("五征 (Wuzheng)")}</option>
                  <option value="shifeng">{tr("时风 (Shifeng)")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("category", { fallback: "\u54C1\u7C7B" })} *
                </label>
                <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{t("selectCategory", { fallback: "\u8BF7\u9009\u62E9\u54C1\u7C7B" })}</option>
                  <option value="tractor">{tr("拖拉机")}</option>
                  <option value="harvester">{tr("收割机")}</option>
                  <option value="planter">{tr("播种机")}</option>
                  <option value="rotary_tiller">{tr("旋耕机")}</option>
                  <option value="sprayer">{tr("喷雾机")}</option>
                  <option value="dryer">{tr("烘干机")}</option>
                  <option value="rice_transplanter">{tr("插秧机")}</option>
                  <option value="baler">{tr("打捆机")}</option>
                  <option value="feed_mixer">{tr("饲料混合机")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("modelName", { fallback: "\u578B\u53F7" })} *
                </label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={tr("如：LX2004")}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("year", { fallback: "\u51FA\u5382\u5E74\u4EFD" })} *
                </label>
                <input type="number" min="1980" max="2026" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={tr("如：2020")}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("workingHours", { fallback: "\u5DE5\u4F5C\u65F6\u957F\uFF08\u5C0F\u65F6\uFF09" })}
                </label>
                <input type="number" min="0" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={tr("如：3500")}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("priceCny", { fallback: "\u4EF7\u683C\uFF08\u5143\uFF09" })} *
                </label>
                <input type="number" min="0" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={tr("如：120000")}/>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("location", { fallback: "\u6240\u5728\u5730" })} *
                </label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={tr("如：河北省石家庄市元氏县")}/>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("description", { fallback: "\u8BBE\u5907\u63CF\u8FF0" })} *
                </label>
                <textarea rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={tr("描述设备现状、维护记录、已知问题等")}/>
              </div>
            </div>
          </section>

          {/* 车况信息卡（.cn 专属，必填） */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t("conditionCard", { fallback: "\u8F66\u51B5\u4FE1\u606F\u5361" })}
              <span className="ml-2 text-xs text-red-500 font-normal">
                * {t("required", { fallback: "\u5FC5\u586B" })}
              </span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {t("conditionCardDesc", {
            fallback: "\u63D0\u4F9B\u4EE5\u4E0B 8 \u9879\u8F66\u51B5\u786C\u6570\u636E\uFF0C\u5E2E\u52A9\u4E70\u5BB6\u5FEB\u901F\u4E86\u89E3\u8BBE\u5907\u72B6\u51B5",
        })}
            </p>
            <CnVehicleCard />
          </section>

          {/* 服务费说明 */}
          <section className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <p className="text-sm text-blue-800">
              <strong>{t("feeNote", { fallback: "\u5173\u4E8E\u8D39\u7528" })}：</strong>
              {t("feeDetail", {
            fallback: "\u672C\u7AD9\u4EC5\u6536\u53D6\u589E\u503C\u4FE1\u606F\u670D\u52A1\u8D39\uFF08\u975E\u4EA4\u6613\u8D39/\u4F63\u91D1\uFF09\u3002\u53D1\u5E03\u8F66\u6E90\u514D\u8D39\uFF0C\u589E\u503C\u670D\u52A1\uFF08AI \u4F30\u503C\u3001\u5E02\u573A\u60C5\u62A5\uFF09\u4E3A\u53EF\u9009\u4ED8\u8D39\u9879\u76EE\u3002\u62C5\u4FDD\u4EA4\u6613\u8D44\u91D1\u4EC5\u901A\u8FC7\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\u6536\u4ED8\u901A\u95ED\u73AF\uFF0C\u7F51\u7AD9\u4E0D\u78B0\u8D44\u91D1\u3002",
        })}
            </p>
          </section>

          {/* 提交按钮 */}
          <div className="flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
              {t("submit", { fallback: "\u63D0\u4EA4\u53D1\u5E03" })}
            </button>
          </div>
        </div>

        {/* 右侧提示栏 */}
        <aside className="space-y-4">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              {t("tips", { fallback: "\u53D1\u5E03\u63D0\u793A" })}
            </h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• {t("tip1", { fallback: "\u786E\u4FDD\u586B\u5199\u771F\u5B9E\u51C6\u786E\u7684\u8F66\u51B5\u4FE1\u606F" })}</li>
              <li>• {t("tip2", { fallback: "\u5EFA\u8BAE\u4E0A\u4F20\u591A\u89D2\u5EA6\u8BBE\u5907\u7167\u7247" })}</li>
              <li>• {t("tip3", { fallback: "\u6743\u5C5E\u6838\u9A8C\u540E\u53EF\u83B7\u5F97\u201C\u4FE1\u4EFB\u5356\u5BB6\u201D\u6807\u7B7E" })}</li>
              <li>• {t("tip4", { fallback: "\u8BE2\u4EF7/\u62A5\u4EF7\u91C7\u7528\u76F2\u62A5\u6A21\u5F0F\uFF0C\u4FDD\u969C\u53CC\u65B9\u9690\u79C1" })}</li>
            </ul>
          </div>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">
              {t("complianceTitle", { fallback: "\u5408\u89C4\u8BF4\u660E" })}
            </h3>
            <p className="text-sm text-yellow-800">
              {t("complianceDesc", {
            fallback: "\u672C\u5E73\u53F0\u4E25\u683C\u9075\u5B88\u56FD\u5185\u6CD5\u5F8B\u6CD5\u89C4\u3002\u6240\u6709\u4EA4\u6613\u8D44\u91D1\u4EC5\u901A\u8FC7\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\u6536\u4ED8\u901A\u95ED\u73AF\u5B8C\u6210\uFF0C\u7F51\u7AD9\u4EC5\u63D0\u4F9B\u4FE1\u606F\u5C55\u793A\u4E0E\u8BE2\u4EF7\u670D\u52A1\uFF0C\u4E0D\u89E6\u78B0\u8D44\u91D1\u3002",
        })}
            </p>
          </div>
        </aside>
      </div>
    </div>);
}
