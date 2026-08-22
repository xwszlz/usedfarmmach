"use client";
import React from "react";
import type { CostBreakdown } from "@/types/arbitrage";
import { Package, FileText, Shield, DollarSign, PieChart } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
interface CostBreakdownProps {
    costs: CostBreakdown;
}
export default function CostBreakdown({ costs }: CostBreakdownProps) {
    const tr = useTr();
    const { shipping, importTax, insurance, other, totalAdditional, details } = costs;
    // 格式化货币显示
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("zh-CN", {
            style: "currency",
            currency: "CNY",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value).replace("CNY", "\u00A5");
    };
    // 计算各项成本占总附加成本的比例
    const getCostPercentage = (cost: number) => {
        if (totalAdditional === 0)
            return 0;
        return (cost / totalAdditional) * 100;
    };
    // 成本项目数据
    const costItems = [
        {
            id: "shipping",
            label: tr("运输成本"),
            value: shipping,
            icon: Package,
            color: "bg-blue-500",
            description: tr("海运、内陆运输、港口费用等"),
            breakdown: details?.shippingBreakdown,
        },
        {
            id: "importTax",
            label: tr("进口关税"),
            value: importTax,
            icon: FileText,
            color: "bg-purple-500",
            description: tr("进口关税、增值税、消费税等"),
            breakdown: details?.taxBreakdown,
        },
        {
            id: "insurance",
            label: tr("保险费用"),
            value: insurance,
            icon: Shield,
            color: "bg-green-500",
            description: tr("海运保险、运输保险、责任保险等"),
            breakdown: details?.insuranceBreakdown,
        },
        {
            id: "other",
            label: tr("其他成本"),
            value: other,
            icon: DollarSign,
            color: "bg-gray-500",
            description: tr("清关、文件、代理等杂费"),
            breakdown: null,
        },
    ];
    return (<div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900 flex items-center">
          <PieChart className="h-5 w-5 mr-2 text-gray-600"/>{tr("成本分解")}</h4>
        <div className="text-sm font-medium text-gray-900">{tr("总附加成本:")}{formatCurrency(totalAdditional)}
        </div>
      </div>

      {/* 成本分布饼图（简化版） */}
      <div className="mb-6">
        <div className="h-2 w-full flex rounded-full overflow-hidden">
          {costItems.map((item) => {
            const percentage = getCostPercentage(item.value);
            if (percentage === 0)
                return null;
            return (<div key={item.id} className={`${item.color}`} style={{ width: `${percentage}%` }} title={`${item.label}: ${percentage.toFixed(1)}%`}/>);
        })}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {costItems
            .filter(item => item.value > 0)
            .map((item) => {
            const percentage = getCostPercentage(item.value);
            return (<div key={item.id} className="flex items-center">
                  <div className={`w-3 h-3 rounded-sm ${item.color} mr-1`}/>
                  <span className="text-xs text-gray-600">
                    {item.label}: {formatCurrency(item.value)} ({percentage.toFixed(1)}%)
                  </span>
                </div>);
        })}
        </div>
      </div>

      {/* 成本明细 */}
      <div className="space-y-4">
        {costItems.map((item) => (<div key={item.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-sm ${item.color} mr-2`}/>
                <span className="font-medium text-gray-700">{item.label}</span>
                <item.icon className="h-4 w-4 ml-2 text-gray-500"/>
              </div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(item.value)}</div>
            </div>
            
            <p className="text-sm text-gray-500 mb-2">{item.description}</p>

            {/* 详细分解（如果有） */}
            {item.breakdown && (<div className="ml-5 mt-2 bg-gray-50 rounded p-3 border border-gray-200">
                <div className="text-xs font-medium text-gray-700 mb-2">{tr("详细分解:")}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap:2 sm:gap-3">
                  {Object.entries(item.breakdown).map(([key, value]) => {
                    if (key === "total" || typeof value !== "number")
                        return null;
                    // 将camelCase转换为中文
                    const labelMap: Record<string, string> = {
                        oceanFreight: "\u6D77\u8FD0\u8D39\u7528",
                        inlandTransport: "\u5185\u9646\u8FD0\u8F93",
                        portCharges: "\u6E2F\u53E3\u8D39\u7528",
                        customsClearance: "\u6E05\u5173\u8D39\u7528",
                        documentation: "\u6587\u4EF6\u8D39\u7528",
                        importDuty: "\u8FDB\u53E3\u5173\u7A0E",
                        vat: "\u589E\u503C\u7A0E",
                        exciseTax: "\u6D88\u8D39\u7A0E",
                        otherTaxes: "\u5176\u4ED6\u7A0E\u8D39",
                        marineInsurance: "\u6D77\u8FD0\u4FDD\u9669",
                        transitInsurance: "\u8FD0\u8F93\u4FDD\u9669",
                        liabilityInsurance: "\u8D23\u4EFB\u4FDD\u9669",
                        otherInsurance: "\u5176\u4ED6\u4FDD\u9669",
                    };
                    return (<div key={key} className="flex justify-between text-xs">
                        <span className="text-gray-600">{labelMap[key] || key}</span>
                        <span className="font-medium text-gray-900">{formatCurrency(value)}</span>
                      </div>);
                })}
                </div>
                
                {/* 显示总计 */}
                {"total" in item.breakdown && typeof item.breakdown.total === "number" && (<div className="flex justify-between text-xs font-medium border-t border-gray-200 mt-2 pt-2">
                    <span className="text-gray-700">{tr("小计")}</span>
                    <span className="text-gray-900">{formatCurrency(item.breakdown.total)}</span>
                  </div>)}
              </div>)}

            {/* 与总成本的比例 */}
            <div className="flex items-center mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className={`${item.color.replace("bg-", "bg-")} h-1.5 rounded-full`} style={{ width: `${getCostPercentage(item.value)}%` }}/>
              </div>
              <div className="ml-3 text-xs text-gray-500">
                {getCostPercentage(item.value).toFixed(1)}%
              </div>
            </div>
          </div>))}
      </div>

      {/* 总成本总结 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="font-medium text-gray-900">{tr("总附加成本")}</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(totalAdditional)}</div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <p>{tr("总附加成本包括运输、关税、保险和其他杂费，是套利计算中的关键成本项。")}</p>
          <p className="mt-1">{tr("降低附加成本（如批量运输、关税优化、保险选择等）可显著提高套利利润。")}</p>
        </div>
      </div>

      {/* 成本优化建议 */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"/>
          <span className="text-sm font-medium text-blue-800">{tr("成本优化建议")}</span>
        </div>
        <ul className="mt-2 space-y-1 text-xs text-blue-700">
          <li>{tr("• 考虑批量运输以降低单位运输成本")}</li>
          <li>{tr("• 研究目标国家的关税优惠政策")}</li>
          <li>{tr("• 比较不同保险方案的费率与保障范围")}</li>
          <li>{tr("• 与物流代理商谈判长期合作价格")}</li>
          <li>{tr("• 关注汇率波动，选择合适的兑换时机")}</li>
        </ul>
      </div>
    </div>);
}
