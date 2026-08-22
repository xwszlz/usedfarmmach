"use client";
/**
 * CnVehicleCard — 车况信息卡（.cn 专属）
 *
 * 8 项硬数据：品牌、型号、年份、小时数、所在地、机况描述、上次检测日期、检测报告编号
 * 用于 .cn 站发布页、设备详情页
 */
"use client";
import React from "react";
import { useTr } from "@/lib/i18n-tr";
export interface VehicleCardData {
    brand: string;
    modelName: string;
    year: number;
    workingHours: number;
    location: string;
    conditionDesc: string;
    lastInspectionDate: string;
    inspectionReportNo: string;
}
interface CnVehicleCardProps {
    data?: Partial<VehicleCardData>;
    editable?: boolean;
    onChange?: (data: Partial<VehicleCardData>) => void;
}
const DEFAULT_DATA: VehicleCardData = {
    brand: "",
    modelName: "",
    year: new Date().getFullYear(),
    workingHours: 0,
    location: "",
    conditionDesc: "",
    lastInspectionDate: "",
    inspectionReportNo: "",
};
function getFIELDS(tr: (s: string) => string): {
    key: keyof VehicleCardData;
    label: string;
    type: string;
    placeholder: string;
}[] {
  return [
    { key: "brand", label: tr("品牌"), type: "text", placeholder: tr("如：东方红") },
    { key: "modelName", label: tr("型号"), type: "text", placeholder: tr("如：LX2004") },
    { key: "year", label: tr("出厂年份"), type: "number", placeholder: tr("如：2020") },
    { key: "workingHours", label: tr("工作时长（小时）"), type: "number", placeholder: tr("如：3500") },
    { key: "location", label: tr("所在地"), type: "text", placeholder: tr("如：河北省石家庄市") },
    { key: "conditionDesc", label: tr("机况描述"), type: "textarea", placeholder: tr("如：发动机运转良好，液压系统正常，轮胎磨损约30%") },
    { key: "lastInspectionDate", label: tr("上次检测日期"), type: "date", placeholder: "" },
    { key: "inspectionReportNo", label: tr("检测报告编号"), type: "text", placeholder: tr("如：INS-2026-001234") },
];
}
export default function CnVehicleCard({ data = {}, editable = true, onChange, }: CnVehicleCardProps) {
  const tr = useTr();
        const merged = { ...DEFAULT_DATA, ...data };
    const handleChange = (key: keyof VehicleCardData, value: string | number) => {
        if (onChange) {
            onChange({ ...merged, [key]: value });
        }
    };
    return (<div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
        <h3 className="text-sm font-semibold text-blue-900">{tr("🚜 车况信息卡")}</h3>
        <p className="text-xs text-blue-600 mt-0.5">{tr("以下 8 项为平台认证车况硬数据，请如实填写")}</p>
      </div>

      {/* 数据网格 */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {getFIELDS(tr).map((field) => (<div key={field.key} className={field.key === "conditionDesc" ? "md:col-span-2" : ""}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {field.label}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              {editable ? (field.type === "textarea" ? (<textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder={field.placeholder} defaultValue={merged[field.key] as string} onChange={(e) => handleChange(field.key, e.target.value)}/>) : (<input type={field.type} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={field.placeholder} defaultValue={merged[field.key] as string | number} onChange={(e) => handleChange(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)}/>)) : (<p className="text-sm text-gray-900 py-2">
                  {merged[field.key] || "-"}
                </p>)}
            </div>))}
        </div>

        {/* 底部说明 */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">{tr("* 车况信息卡数据将展示在设备详情页，帮助买家全面了解设备状况。 请确保信息真实准确，平台有权对虚假信息进行下架处理。")}</p>
        </div>
      </div>
    </div>);
}
/** 只读模式下的简单展示组件（用于详情页） */
export function CnVehicleCardDisplay({ data }: {
    data: VehicleCardData;
}) {
  const tr = useTr();
    return (<div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
        <h3 className="text-sm font-semibold text-blue-900">{tr("🚜 车况信息卡")}</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {getFIELDS(tr).slice(0, 4).map((field) => (<div key={field.key}>
              <p className="text-xs text-gray-500">{field.label}</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {data[field.key] ?? "-"}
              </p>
            </div>))}
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
          {getFIELDS(tr).slice(4).map((field) => (<div key={field.key}>
              <p className="text-xs text-gray-500">{field.label}</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {data[field.key] ?? "-"}
              </p>
            </div>))}
        </div>
      </div>
    </div>);
}
