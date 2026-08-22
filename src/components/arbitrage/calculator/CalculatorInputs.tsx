"use client";
import React from "react";
import type { ArbitrageCalculatorParams } from "@/types/arbitrage";
import type { CurrencyCode } from "@/types/exchange-rates";
import { CALCULATOR_CONFIG } from "@/config/arbitrage";
import { DEFAULT_SHIPPING_RATE, DEFAULT_IMPORT_TAX_RATE, DEFAULT_INSURANCE_RATE } from "@/lib/arbitrage/formulas";
import { Percent, DollarSign, Package, Shield, FileText, Hash } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
interface CalculatorInputsProps {
    params: ArbitrageCalculatorParams;
    onChange: (params: ArbitrageCalculatorParams) => void;
    disabled?: boolean;
}
// 可用货币列表
const CURRENCY_OPTIONS: CurrencyCode[] = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "RUB", "INR", "BRL", "MXN"];
// 货币符号映射
const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
    CNY: "\u00A5",
    USD: "$",
    EUR: "\u20AC",
    GBP: "\u00A3",
    JPY: "\u00A5",
    AUD: "A$",
    CAD: "C$",
    CHF: "CHF",
    RUB: "\u20BD",
    INR: "\u20B9",
    BRL: "R$",
    MXN: "MX$",
    KRW: "\u20A9",
    TRY: "\u20BA",
    ZAR: "R",
};
// 货币名称映射
const CURRENCY_NAMES: Record<CurrencyCode, string> = {
    CNY: "\u4EBA\u6C11\u5E01",
    USD: "\u7F8E\u5143",
    EUR: "\u6B27\u5143",
    GBP: "\u82F1\u9551",
    JPY: "\u65E5\u5143",
    AUD: "\u6FB3\u5143",
    CAD: "\u52A0\u5143",
    CHF: "\u745E\u58EB\u6CD5\u90CE",
    RUB: "\u4FC4\u7F57\u65AF\u5362\u5E03",
    INR: "\u5370\u5EA6\u5362\u6BD4",
    BRL: "\u5DF4\u897F\u96F7\u4E9A\u5C14",
    MXN: "\u58A8\u897F\u54E5\u6BD4\u7D22",
    KRW: "\u97E9\u5143",
    TRY: "\u571F\u8033\u5176\u91CC\u62C9",
    ZAR: "\u5357\u975E\u5170\u7279",
};
export default function CalculatorInputs({ params, onChange, disabled }: CalculatorInputsProps) {
    const tr = useTr();
    const handleChange = (field: keyof ArbitrageCalculatorParams, value: any) => {
        onChange({
            ...params,
            [field]: value,
        });
    };
    const handleNumberChange = (field: keyof ArbitrageCalculatorParams, value: string) => {
        const numValue = value === "" ? undefined : parseFloat(value);
        onChange({
            ...params,
            [field]: numValue,
        });
    };
    const handlePercentageChange = (field: keyof ArbitrageCalculatorParams, value: string) => {
        const numValue = value === "" ? undefined : parseFloat(value) / 100;
        onChange({
            ...params,
            [field]: numValue,
        });
    };
    // 货币符号显示
    const getCurrencySymbol = (currency: CurrencyCode | undefined) => {
        if (!currency)
            return "\u00A5";
        return CURRENCY_SYMBOLS[currency] || currency;
    };
    // 格式化百分比显示
    const formatPercentage = (value: number | undefined) => {
        if (value === undefined)
            return "";
        return (value * 100).toFixed(1);
    };
    // 计算运输成本（如果使用百分比）
    const calculateShippingCost = () => {
        if (params.shippingCost !== undefined)
            return params.shippingCost;
        if (params.shippingCostPercentage !== undefined && params.foreignPrice !== undefined) {
            // 这里需要汇率转换，简化显示
            return "\u5F85\u8BA1\u7B97";
        }
        return "\u4F7F\u7528\u9ED8\u8BA4\u503C";
    };
    return (<div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 国内价格 */}
        <div className="space-y-2">
          <label className="flex items-center text-sm font-medium text-gray-700">
            <DollarSign className="h-4 w-4 mr-2 text-gray-500"/>{tr("国内价格 (CNY)")}</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">¥</span>
            </div>
            <input type="number" min={CALCULATOR_CONFIG.inputLimits.priceMin} max={CALCULATOR_CONFIG.inputLimits.priceMax} step={CALCULATOR_CONFIG.stepValues.price} value={params.domesticPrice || ""} onChange={(e) => handleNumberChange("domesticPrice", e.target.value)} disabled={disabled} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder={tr("输入国内价格")}/>
          </div>
          <p className="text-xs text-gray-500">{tr("设备在中国市场的销售价格")}</p>
        </div>

        {/* 国外价格 */}
        <div className="space-y-2">
          <label className="flex items-center text-sm font-medium text-gray-700">
            <DollarSign className="h-4 w-4 mr-2 text-gray-500"/>{tr("国外价格")}</label>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500">{getCurrencySymbol(params.foreignCurrency || "USD")}</span>
              </div>
              <input type="number" min={CALCULATOR_CONFIG.inputLimits.priceMin} max={CALCULATOR_CONFIG.inputLimits.priceMax} step={CALCULATOR_CONFIG.stepValues.price} value={params.foreignPrice || ""} onChange={(e) => handleNumberChange("foreignPrice", e.target.value)} disabled={disabled} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder={tr("输入国外价格")}/>
            </div>
            <div className="col-span-1">
              <select value={params.foreignCurrency || "USD"} onChange={(e) => handleChange("foreignCurrency", e.target.value as CurrencyCode)} disabled={disabled} className="w-full py-2 pl-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed">
                {CURRENCY_OPTIONS.map((currency) => (<option key={currency} value={currency}>
                    {currency}
                  </option>))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500">{tr("设备在海外市场的销售价格")}</p>
        </div>
      </div>

      {/* 成本参数 */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-700 mb-4">{tr("成本参数")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 运输成本百分比 */}
          <div className="space-y-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <Package className="h-4 w-4 mr-2 text-gray-500"/>{tr("运输成本")}</label>
            <div className="relative">
              <input type="number" min={0} max={100} step={0.1} value={formatPercentage(params.shippingCostPercentage ?? DEFAULT_SHIPPING_RATE)} onChange={(e) => handlePercentageChange("shippingCostPercentage", e.target.value)} disabled={disabled} className="w-full pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder={tr("自动使用默认值")}/>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500">%</span>
              </div>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">{tr("默认:")}{(DEFAULT_SHIPPING_RATE * 100).toFixed(0)}%</span>
              <span className="text-gray-500">{tr("占设备价格")}</span>
            </div>
          </div>

          {/* 进口关税率 */}
          <div className="space-y-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <FileText className="h-4 w-4 mr-2 text-gray-500"/>{tr("进口关税")}</label>
            <div className="relative">
              <input type="number" min={0} max={100} step={0.1} value={formatPercentage(params.importTaxRate ?? DEFAULT_IMPORT_TAX_RATE)} onChange={(e) => handlePercentageChange("importTaxRate", e.target.value)} disabled={disabled} className="w-full pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder={tr("自动使用默认值")}/>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500">%</span>
              </div>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">{tr("默认:")}{(DEFAULT_IMPORT_TAX_RATE * 100).toFixed(0)}%</span>
              <span className="text-gray-500">{tr("CIF价格税率")}</span>
            </div>
          </div>

          {/* 保险费率 */}
          <div className="space-y-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <Shield className="h-4 w-4 mr-2 text-gray-500"/>{tr("保险费用")}</label>
            <div className="relative">
              <input type="number" min={0} max={100} step={0.1} value={formatPercentage(params.insuranceRate ?? DEFAULT_INSURANCE_RATE)} onChange={(e) => handlePercentageChange("insuranceRate", e.target.value)} disabled={disabled} className="w-full pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder={tr("自动使用默认值")}/>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500">%</span>
              </div>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">{tr("默认:")}{(DEFAULT_INSURANCE_RATE * 100).toFixed(0)}%</span>
              <span className="text-gray-500">{tr("运输保险费用")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 其他参数 */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-700 mb-4">{tr("其他参数")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 其他成本 */}
          <div className="space-y-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <DollarSign className="h-4 w-4 mr-2 text-gray-500"/>{tr("其他成本 (CNY)")}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500">¥</span>
              </div>
              <input type="number" min={0} step={1000} value={params.otherCosts || ""} onChange={(e) => handleNumberChange("otherCosts", e.target.value)} disabled={disabled} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder={tr("清关、文件等杂费")}/>
            </div>
            <p className="text-xs text-gray-500">{tr("清关、文件、代理等额外杂费")}</p>
          </div>

          {/* 购买数量 */}
          <div className="space-y-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <Hash className="h-4 w-4 mr-2 text-gray-500"/>{tr("购买数量")}</label>
            <input type="number" min={CALCULATOR_CONFIG.inputLimits.quantityMin} max={CALCULATOR_CONFIG.inputLimits.quantityMax} step={CALCULATOR_CONFIG.stepValues.quantity} value={params.quantity || 1} onChange={(e) => handleNumberChange("quantity", e.target.value)} disabled={disabled} className="w-full py-2 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder={tr("购买数量")}/>
            <p className="text-xs text-gray-500">{tr("批量购买可降低单位运输成本")}</p>
          </div>
        </div>
      </div>

      {/* 高级选项 (可折叠) */}
      <div className="pt-4 border-t border-gray-200">
        <details className="group">
          <summary className="flex items-center cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            <span>{tr("高级选项")}</span>
            <svg className="ml-1 w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
          </summary>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("汇率 (1")}{params.foreignCurrency || "USD"} = ? CNY)
              </label>
              <div className="relative">
                <input type="number" min={0.001} max={1000} step={0.001} value={params.exchangeRate || ""} onChange={(e) => handleNumberChange("exchangeRate", e.target.value)} disabled={disabled} className="w-full py-2 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder={tr("自动使用实时汇率")}/>
              </div>
              <p className="text-xs text-gray-500">{tr("手动指定汇率，留空使用系统实时汇率")}</p>
            </div>

            <div className="flex items-center">
              <input type="checkbox" id="includeAnalysis" checked={params.includeAnalysis !== false} onChange={(e) => handleChange("includeAnalysis", e.target.checked)} disabled={disabled} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
              <label htmlFor="includeAnalysis" className="ml-2 text-sm text-gray-700">{tr("包含详细分析（敏感性分析、风险评估等）")}</label>
            </div>
          </div>
        </details>
      </div>
    </div>);
}
