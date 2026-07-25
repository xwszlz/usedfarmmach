/**
 * .cn 站 - 展会/地头展页面
 *
 * 复用现有 Expo 展会展位模块。
 * 展示国内农机展会、地头展活动信息。
 */

import { Metadata } from "next";
import { useTranslations } from "next-intl";

export const metadata: Metadata = {
  title: "农机展会与地头展 - 神雕农机",
  description: "全国农机展会、地头展活动信息，线上线下联动",
};

interface ExpoEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  type: string;
  status: string;
}

const SAMPLE_EVENTS: ExpoEvent[] = [
  {
    id: "1",
    name: "2026 河北元氏县农机地头展",
    date: "2026-09-15",
    location: "河北省石家庄市元氏县",
    type: "field",
    status: "upcoming",
  },
  {
    id: "2",
    name: "2026 中国国际农业机械展览会",
    date: "2026-10-26",
    location: "湖北省武汉市",
    type: "expo",
    status: "upcoming",
  },
  {
    id: "3",
    name: "2026 山东农机地头展（潍坊站）",
    date: "2026-08-20",
    location: "山东省潍坊市",
    type: "field",
    status: "upcoming",
  },
];

export default function CnExpoPage() {
  const t = useTranslations("cn.expo");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", { fallback: "展会与地头展" })}
        </h1>
        <p className="mt-2 text-gray-600">
          {t("subtitle", {
            fallback: "全国农机展会、地头展活动信息，线上线下联动",
          })}
        </p>
      </div>

      {/* 分类导航 */}
      <div className="flex gap-4 mb-6">
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {t("all", { fallback: "全部" })}
        </button>
        <button className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
          {t("fieldExpo", { fallback: "地头展" })}
        </button>
        <button className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
          {t("indoorExpo", { fallback: "室内展" })}
        </button>
        <button className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
          {t("online", { fallback: "线上展" })}
        </button>
      </div>

      {/* 活动列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SAMPLE_EVENTS.map((event) => (
          <div
            key={event.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="h-40 bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center">
              <span className="text-4xl">
                {event.type === "field" ? "🌾" : "🏛️"}
              </span>
            </div>
            <div className="p-4">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded mb-2">
                {event.type === "field"
                  ? t("fieldExpo", { fallback: "地头展" })
                  : t("indoorExpo", { fallback: "室内展" })}
              </span>
              <h3 className="font-semibold text-gray-900 mb-2">{event.name}</h3>
              <p className="text-sm text-gray-500 mb-1">
                📅 {event.date}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                📍 {event.location}
              </p>
              <div className="flex gap-2">
                <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors">
                  {t("viewDetails", { fallback: "查看详情" })}
                </button>
                <button className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors">
                  {t("register", { fallback: "报名参加" })}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 合规说明 */}
      <div className="mt-8 bg-yellow-50 rounded-lg border border-yellow-200 p-4">
        <p className="text-sm text-yellow-800">
          <strong>{t("note", { fallback: "说明" })}：</strong>
          {t("noteDesc", {
            fallback:
              "展会活动由平台协办或合作方组织，具体安排以活动主办方公告为准。地头展为线下实地看机活动，报名后将有专员联系。",
          })}
        </p>
      </div>
    </div>
  );
}
