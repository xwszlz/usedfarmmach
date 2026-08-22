"use client";
import { useState, useRef, useCallback } from "react";
import { useLocale } from "next-intl";
import { Brain, Loader2, Calculator, ArrowLeft, Upload, Camera, Sparkles, TrendingUp, AlertTriangle, FileText, ChevronRight, Zap, Globe, Ship, CheckCircle2, XCircle, } from "lucide-react";
import Link from "next/link";
import { DeepReportSection } from "@/components/valuation/deep-report-section";
import AnalysisReportView from "@/components/valuation/analysis-report-view";
import { DOMESTIC_HP_REGRESSION, DOMESTIC_BRAND_PREMIUM, REGIONAL_FACTORS, SUBSIDY_TREND_FACTOR, isDomesticBrandSupported, getRegionalFactor, getSubsidyTrendFactor, } from "@/lib/valuation/brand-data";
import { useTr } from "@/lib/i18n-tr";
// ============================================================
// 常量定义
// ============================================================
type Channel = "domestic" | "international" | "export";
type Mode = "quick" | "deep";
// 国产品类
const DOMESTIC_CATEGORIES = [
    "\u8F6E\u5F0F\u62D6\u62C9\u673A",
    "\u8C37\u7269\u8054\u5408\u6536\u5272\u673A",
    "\u7389\u7C73\u6536\u83B7\u673A",
    "\u63D2\u79E7\u673A",
    "\u65CB\u8015\u673A",
    "\u5355\u7C92\u7CBE\u5BC6\u64AD\u79CD\u673A",
    "\u7A74\u64AD\u673A",
    "\u6761\u64AD\u673A",
    "\u7281",
    "\u79F8\u79C6\u7C89\u788E\u8FD8\u7530\u673A",
    "\u82B1\u751F\u6536\u83B7\u673A",
    "\u5FAE\u578B\u8015\u8018\u673A",
    "\u7530\u56ED\u7BA1\u7406\u673A",
    "\u9972\u6599\u7C89\u788E\u673A",
    "\u8F85\u52A9\u9A7E\u9A76\u7CFB\u7EDF\u8BBE\u5907",
];
// 国产品牌列表
const DOMESTIC_BRAND_LIST = [
    "\u4E1C\u65B9\u7EA2",
    "\u96F7\u6C83",
    "\u6F4D\u67F4\u96F7\u6C83",
    "\u4E2D\u8054",
    "\u9053\u4F9D\u8328\u6CD5\u5C14",
    "\u4E1C\u98CE",
    "\u5E38\u53D1",
    "\u82F1\u8F69",
    "\u6C83\u5F97",
    "\u65F6\u98CE",
    "\u608D\u6C83",
    "\u60A6\u8FBE",
    "\u4E94\u5F81",
    "\u8428\u4E01",
    "\u6CF0\u5C71",
    "\u534E\u590F",
    "\u5176\u4ED6\u56FD\u4EA7",
];
// 国际品牌
const INTL_BRAND_LIST = [
    "John Deere",
    "Kubota",
    "Case IH",
    "New Holland",
    "CLAAS",
    "Fendt",
    "Massey Ferguson",
    "Valtra",
    "\u5176\u4ED6\u56FD\u9645",
];
const INTL_BRAND_COEFFICIENTS: Record<string, number> = {
    "John Deere": 1.15,
    "Kubota": 1.1,
    "Fendt": 1.085,
    "CLAAS": 1.08,
    "Case IH": 1,
    "New Holland": 0.95,
    "Massey Ferguson": 0.92,
    "Valtra": 0.9,
    "\u5176\u4ED6\u56FD\u9645": 0.95,
};
// 国际品牌保值率
const INTL_BRAND_RETENTION: Record<string, number> = {
    "John Deere": 1.15,
    "Kubota": 1.1,
    "Fendt": 1.085,
    "CLAAS": 1.08,
    "Case IH": 1,
    "New Holland": 0.95,
    "Massey Ferguson": 0.92,
    "Valtra": 0.9,
    "\u5176\u4ED6\u56FD\u9645": 0.95,
};
// 国际折旧（按小时）
const INTL_HOURS_DEPRECIATION = [
    { hours: 0, coeff: 0.92 },
    { hours: 500, coeff: 0.92 },
    { hours: 1000, coeff: 0.82 },
    { hours: 2000, coeff: 0.62 },
    { hours: 4000, coeff: 0.4 },
    { hours: 6000, coeff: 0.25 },
    { hours: 8000, coeff: 0.15 },
];
const INTL_CONDITIONS: Record<string, number> = {
    Excellent: 1.175,
    Good: 1,
    Fair: 0.825,
    Poor: 0.625,
};
const EMISSION_DEVELOPED: Record<string, number> = {
    "Tier 4": 1,
    "Tier 4i": 1,
    "Tier 3": 0.85,
    "Tier 2": 0.7,
    "Tier 1": 0.55,
};
const EMISSION_DEVELOPING: Record<string, number> = {
    "Tier 4": 0.95,
    "Tier 4i": 0.95,
    "Tier 3": 1.05,
    "Tier 2": 1.1,
    "Tier 1": 1,
};
const INTL_REGIONS: Record<string, number> = {
    "\u5317\u7F8E": 1.1,
    "\u6B27\u6D32": 1.15,
    "\u5357\u7F8E": 0.8,
    "\u975E\u6D32": 0.7,
    "\u4E1C\u5357\u4E9A": 0.85,
    "\u4E2D\u4E9A": 0.82,
    "\u4E2D\u4E1C": 0.9,
};
const DEVELOPED_REGIONS = new Set(["\u5317\u7F8E", "\u6B27\u6D32"]);
const EXPORT_COUNTRIES: Record<string, {
    buy: number;
    sell: number;
}> = {
    "\u963F\u6839\u5EF7": { buy: 0.75, sell: 1.4 },
    "\u5C3C\u65E5\u5229\u4E9A": { buy: 0.7, sell: 1.5 },
    "\u4FC4\u7F57\u65AF": { buy: 0.85, sell: 1.25 },
    "\u6CF0\u56FD": { buy: 0.8, sell: 1.3 },
    "\u54C8\u8428\u514B\u65AF\u5766": { buy: 0.82, sell: 1.28 },
    "\u4E4C\u5179\u522B\u514B\u65AF\u5766": { buy: 0.82, sell: 1.28 },
    "\u5357\u975E": { buy: 0.75, sell: 1.35 },
    "\u80AF\u5C3C\u4E9A": { buy: 0.72, sell: 1.45 },
    "\u52A0\u7EB3": { buy: 0.72, sell: 1.45 },
    "\u5DF4\u897F": { buy: 0.78, sell: 1.35 },
    "\u8D8A\u5357": { buy: 0.8, sell: 1.32 },
    "\u83F2\u5F8B\u5BBE": { buy: 0.8, sell: 1.32 },
    "\u7F05\u7538": { buy: 0.75, sell: 1.4 },
    "\u67EC\u57D4\u5BE8": { buy: 0.75, sell: 1.4 },
    "\u5DF4\u57FA\u65AF\u5766": { buy: 0.78, sell: 1.35 },
    "\u4F0A\u6717": { buy: 0.8, sell: 1.3 },
    "\u4F0A\u62C9\u514B": { buy: 0.8, sell: 1.3 },
    "\u6C99\u7279\u963F\u62C9\u4F2F": { buy: 0.85, sell: 1.25 },
    "\u963F\u8054\u914B": { buy: 0.85, sell: 1.25 },
};
const DOMESTIC_REGIONS_LIST = [
    "\u5C71\u4E1C",
    "\u6CB3\u5317",
    "\u6CB3\u5357",
    "\u9ED1\u9F99\u6C5F",
    "\u6C5F\u897F",
    "\u6E56\u5317",
    "\u7518\u8083",
    "\u5C71\u897F",
    "\u8FBD\u5B81",
    "\u5317\u4EAC",
    "\u5929\u6D25",
    "\u4E0A\u6D77",
    "\u5E7F\u4E1C",
    "\u5E7F\u897F",
    "\u6D77\u5357",
    "\u8D35\u5DDE",
    "\u9752\u6D77",
    "\u65B0\u7586",
    "\u5317\u5927\u8352",
    "\u901A\u7528",
];
const YEAR_TRENDS: Record<number, number> = {
    2022: 0.9285,
    2023: 0.9211,
    2024: 1,
    2025: 1.0211,
};
function getCONDITIONS_CN(tr: (s: string) => string) {
  return [
    { value: "excellent", label: tr("优秀") },
    { value: "good", label: tr("良好") },
    { value: "fair", label: tr("一般") },
    { value: "poor", label: tr("较差") },
];
}
// ============================================================
// 辅助函数
// ============================================================
function formatMoney(value: number): string {
    if (value >= 10000)
        return `¥${(value / 10000).toFixed(1)}万`;
    return `¥${value.toLocaleString()}`;
}
function calcDomesticBasePrice(brand: string, horsepower: number): number {
    const regression = DOMESTIC_HP_REGRESSION[brand] || DOMESTIC_HP_REGRESSION["_default"];
    const price = regression.pricePerHP * horsepower + regression.intercept;
    return Math.max(price, 5000);
}
function calcDomesticDepreciation(yearsUsed: number): number {
    if (yearsUsed <= 0)
        return 1;
    if (yearsUsed <= 3)
        return Math.max(1 - 0.07 * yearsUsed, 0.1);
    if (yearsUsed <= 7)
        return Math.max(1 - 0.07 * 3 - 0.08 * (yearsUsed - 3), 0.1);
    if (yearsUsed <= 12)
        return Math.max(1 - 0.07 * 3 - 0.08 * 4 - 0.07 * (yearsUsed - 7), 0.1);
    return Math.max(1 - 0.07 * 3 - 0.08 * 4 - 0.07 * 5 - 0.05 * (yearsUsed - 12), 0.1);
}
function getIntlHoursCoeff(hours: number): number {
    let coeff = 0.15;
    for (const entry of INTL_HOURS_DEPRECIATION) {
        if (hours >= entry.hours)
            coeff = entry.coeff;
    }
    return coeff;
}
function calcIntlValuation(brand: string, horsepower: number, hours: number, newPrice: number, region: string, year: number, condition: string, emission: string, configAddon: number, tr: (s: string) => string): {
    value: number;
    breakdown: {
        label: string;
        value: string;
        detail: string;
    }[];
} {
    const brandCoeff = INTL_BRAND_COEFFICIENTS[brand] || 0.95;
    const retentionCoeff = INTL_BRAND_RETENTION[brand] || 0.95;
    const hoursCoeff = getIntlHoursCoeff(hours);
    const conditionCoeff = INTL_CONDITIONS[condition] || 1;
    const isDeveloped = DEVELOPED_REGIONS.has(region);
    const emissionCoeff = isDeveloped
        ? (EMISSION_DEVELOPED[emission] || 1)
        : (EMISSION_DEVELOPING[emission] || 1);
    const regionCoeff = INTL_REGIONS[region] || 0.9;
    const baseValue = newPrice * hoursCoeff * conditionCoeff * emissionCoeff + configAddon;
    const finalValue = baseValue * regionCoeff * retentionCoeff;
    const breakdown = [
        { label: tr("新机基准价"), value: formatMoney(newPrice), detail: "\u7528\u6237\u8F93\u5165" },
        { label: tr("小时折旧"), value: `×${hoursCoeff.toFixed(2)}`, detail: `${hours.toLocaleString()}h` },
        { label: tr("状况系数"), value: `×${conditionCoeff.toFixed(3)}`, detail: condition },
        { label: tr("排放系数"), value: `×${emissionCoeff.toFixed(2)}`, detail: `${emission} (${isDeveloped ? "\u53D1\u8FBE" : "\u53D1\u5C55\u4E2D"}市场)` },
        { label: tr("配置增值"), value: `+${formatMoney(configAddon)}`, detail: "\u9009\u914D\u9644\u4EF6" },
        { label: tr("区域系数"), value: `×${regionCoeff.toFixed(2)}`, detail: region },
        { label: tr("品牌保值率"), value: `×${retentionCoeff.toFixed(3)}`, detail: brand },
    ];
    return { value: Math.round(finalValue), breakdown };
}
function calcExportArbitrage(baseValue: number, targetCountry: string, shippingCost: number, tariffRate: number, tr: (s: string) => string): {
    totalCost: number;
    exportPrice: number;
    profit: number;
    profitRate: number;
    breakdown: {
        label: string;
        value: string;
    }[];
} {
    const country = EXPORT_COUNTRIES[targetCountry] || { buy: 0.8, sell: 1.3 };
    const buyPrice = Math.round(baseValue * country.buy);
    const totalCost = buyPrice + shippingCost;
    const tariff = Math.round(totalCost * tariffRate);
    const landedCost = totalCost + tariff;
    const exportPrice = Math.round(baseValue * country.sell);
    const profit = exportPrice - landedCost;
    const profitRate = (profit / landedCost) * 100;
    const breakdown = [
        { label: tr("二手机收购价"), value: formatMoney(buyPrice) },
        { label: tr("运费"), value: formatMoney(shippingCost) },
        { label: tr("关税"), value: formatMoney(tariff) },
        { label: tr("到岸总成本"), value: formatMoney(landedCost) },
        { label: tr("目标国售价"), value: formatMoney(exportPrice) },
    ];
    return { totalCost: landedCost, exportPrice, profit, profitRate, breakdown };
}
function calcConfidence(channel: Channel, brand: string, horsepower: number, hasImage: boolean, yearsUsed: number): number {
    let confidence = 60;
    if (channel === "domestic") {
        if (DOMESTIC_HP_REGRESSION[brand]) {
            confidence += 15;
            const r2 = DOMESTIC_HP_REGRESSION[brand].r2;
            confidence += Math.round(r2 * 15);
        }
        else {
            confidence += 5;
        }
        if (horsepower > 0)
            confidence += 5;
    }
    else {
        confidence += 15;
    }
    if (hasImage)
        confidence += 10;
    if (yearsUsed >= 0 && yearsUsed <= 15)
        confidence += 5;
    return Math.min(confidence, 95);
}
// ============================================================
// 置信度仪表盘 SVG
// ============================================================
function ConfidenceGauge({ value }: {
    value: number;
}) {
  const tr = useTr();
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
    const color = value >= 80 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";
    return (<div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8"/>
        <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.6s ease" }}/>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>{value}%</span>
        <span className="text-xs text-gray-400">{tr("置信度")}</span>
      </div>
    </div>);
}
// ============================================================
// AI图片识别组件
// ============================================================
interface RecognizeResult {
    brand?: string;
    category?: string;
    modelName?: string;
    horsepower?: number;
    year?: number;
    isChineseBrand?: boolean;
    confidence?: number;
    [key: string]: unknown;
}
function AIRecognizeSection({ onRecognized, channel, }: {
    onRecognized: (data: RecognizeResult) => void;
    channel: Channel;
}) {
  const tr = useTr();
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<RecognizeResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleFile = useCallback(async (file: File) => {
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUri = e.target?.result as string;
            setImagePreview(dataUri);
            doRecognize(dataUri);
        };
        reader.readAsDataURL(file);
    }, []);
    const doRecognize = async (dataUri: string) => {
        setLoading(true);
        setError("");
        setResult(null);
        try {
            const res = await fetch("/api/agents/seller-helper/recognize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageDataUris: [dataUri],
                    isChineseBrand: channel === "domestic",
                }),
            });
            const data = await res.json();
            if (data.success) {
                const recognized = data.data || data.recognized;
                setResult(recognized);
                onRecognized(recognized);
            }
            else {
                setError(data.error || "\u8BC6\u522B\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u586B\u5199\u53C2\u6570");
            }
        }
        catch {
            setError("\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u624B\u52A8\u586B\u5199\u53C2\u6570");
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-blue-600"/>
        <h3 className="text-sm font-semibold text-gray-800">{tr("AI智能识别")}</h3>
        <span className="text-xs text-gray-400">{tr("上传照片自动填写参数")}</span>
      </div>

      <div className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50" onClick={() => fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0])
        handleFile(e.dataTransfer.files[0]); }}>
        {imagePreview ? (<img src={imagePreview} alt={tr("预览")} className="mx-auto max-h-40 rounded-lg"/>) : (<>
            <Camera className="mx-auto mb-2 h-10 w-10 text-gray-400"/>
            <p className="text-sm text-gray-500">{tr("点击拍照或拖拽图片到此处")}</p>
            <p className="mt-1 text-xs text-gray-400">{tr("AI将自动识别品类、品牌和参数")}</p>
          </>)}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files?.[0])
        handleFile(e.target.files[0]); }}/>
      </div>

      {loading && (<div className="mt-3 flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600"/>
          <span className="text-sm text-gray-500">{tr("AI识别中...")}</span>
        </div>)}

      {error && (<div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          <AlertTriangle className="mr-1 inline h-3 w-3"/>
          {error}
        </div>)}

      {result && (<div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="mb-2 flex items-center gap-1 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4"/>{tr("识别成功")}{result.confidence ? `（置信度 ${Math.round(result.confidence * 100)}%）` : ""}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {result.brand && <div><span className="text-gray-400">{tr("品牌：")}</span><span className="font-medium">{result.brand}</span></div>}
            {result.category && <div><span className="text-gray-400">{tr("品类：")}</span><span className="font-medium">{result.category}</span></div>}
            {result.modelName && <div><span className="text-gray-400">{tr("型号：")}</span><span className="font-medium">{result.modelName}</span></div>}
            {result.horsepower && <div><span className="text-gray-400">{tr("马力：")}</span><span className="font-medium">{result.horsepower} HP</span></div>}
            {result.year && <div><span className="text-gray-400">{tr("年份：")}</span><span className="font-medium">{result.year}</span></div>}
            {result.isChineseBrand !== undefined && (<div><span className="text-gray-400">{tr("产地：")}</span><span className="font-medium">{result.isChineseBrand ? "\u56FD\u4EA7" : "\u8FDB\u53E3"}</span></div>)}
          </div>
          <button onClick={() => { if (result)
            onRecognized(result); }} className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700">{tr("一键填入估值参数")}</button>
        </div>)}
    </div>);
}
// ============================================================
// 深度分析报告组件
// ============================================================
function DeepAnalysisSection({ prefillData, }: {
    prefillData: {
        brand?: string;
        category?: string;
        year?: number;
        horsepower?: number;
    };
}) {
  const tr = useTr();
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [structured, setStructured] = useState<Record<string, any> | null>(null);
    const [error, setError] = useState("");
    const [locked, setLocked] = useState(false);
    const [valuationPrice, setValuationPrice] = useState<number | null>(null);
    const runDeepAnalysis = async () => {
        setLoading(true);
        setError("");
        setReport(null);
        setStructured(null);
        setLocked(false);
        setValuationPrice(null);
        try {
            const res = await fetch("/api/agents/seller-helper/deep-analysis", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brandName: prefillData.brand,
                    productName: prefillData.category ? `${prefillData.brand} ${prefillData.category}` : undefined,
                    category: prefillData.category,
                    year: prefillData.year,
                    enginePower: prefillData.horsepower ? String(prefillData.horsepower) : undefined,
                    isChineseBrand: true,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setReport(data.data?.analysis || "");
                setStructured(data.data?.structured || null);
                setValuationPrice(data.data?.valuationPrice ?? null);
                setLocked(true);
            }
            else {
                setError(data.error || "\u6DF1\u5EA6\u5206\u6790\u5931\u8D25");
            }
        }
        catch {
            setError("\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5");
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="rounded-xl border border-purple-200 bg-purple-50/30 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-600"/>
          <h3 className="text-sm font-semibold text-gray-800">{tr("深度估值报告")}</h3>
        </div>
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">¥9</span>
      </div>
      <p className="mb-3 text-xs text-gray-500">{tr("包含：六维度现状评估 · 技术参数 · 操作维修 · 估值引擎参考价 · 购买建议 · 资源文档")}</p>

      {!report && !loading && (<button onClick={runDeepAnalysis} className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 py-3 text-sm font-medium text-white transition-all hover:from-purple-700 hover:to-purple-600">
          <Sparkles className="mr-1 inline h-4 w-4"/>{tr("生成专业估值报告")}</button>)}

      {loading && (<div className="flex flex-col items-center py-8">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-purple-600"/>
          <p className="text-sm text-gray-500">{tr("AI正在生成专业报告（约30-60秒）...")}</p>
        </div>)}

      {error && (<div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>)}

      {report && (<div className="animate-in space-y-3">
          <AnalysisReportView report={report} structured={structured} isChineseBrand={true} brandName={prefillData.brand} categoryName={prefillData.category} locale="zh" locked={locked} onUnlock={() => setLocked(false)} valuationPrice={valuationPrice}/>
          <button onClick={runDeepAnalysis} className="w-full rounded-lg border border-purple-300 py-2 text-xs text-purple-600 hover:bg-purple-50">{tr("重新生成")}</button>
        </div>)}
    </div>);
}
// ============================================================
// 主页面组件
// ============================================================
export default function ValuationPage() {
    const tr = useTr();
    const locale = useLocale();
    const [mode, setMode] = useState<Mode>("quick");
    const [channel, setChannel] = useState<Channel>("domestic");
    // 国产参数
    const [dCategory, setDCategory] = useState("\u8F6E\u5F0F\u62D6\u62C9\u673A");
    const [dBrand, setDBrand] = useState("\u4E1C\u65B9\u7EA2");
    const [dHP, setDHP] = useState(120);
    const [dYears, setDYears] = useState(3);
    const [dRegion, setDRegion] = useState("\u5C71\u4E1C");
    const [dYear, setDYear] = useState(2024);
    const [dSellerPrice, setDSellerPrice] = useState("");
    // 国际参数
    const [iBrand, setIBrand] = useState("John Deere");
    const [iHP, setIHP] = useState(150);
    const [iHours, setIHours] = useState(1000);
    const [iNewPrice, setINewPrice] = useState(300000);
    const [iRegion, setIRegion] = useState("\u6B27\u6D32");
    const [iYear, setIYear] = useState(2024);
    const [iCondition, setICondition] = useState("Good");
    const [iEmission, setIEmission] = useState("Tier 4");
    const [iConfigAddon, setIConfigAddon] = useState(0);
    // 出口参数
    const [eTargetCountry, setETargetCountry] = useState("\u4FC4\u7F57\u65AF");
    const [eShipping, setEShipping] = useState(25000);
    const [eTariff, setETariff] = useState(0.15);
    // 结果
    const [result, setResult] = useState<{
        value: number;
        confidence: number;
        breakdown: {
            label: string;
            value: string;
            detail: string;
        }[];
        formula: string;
        warnings: string[];
    } | null>(null);
    const [arbitrage, setArbitrage] = useState<{
        totalCost: number;
        exportPrice: number;
        profit: number;
        profitRate: number;
        breakdown: {
            label: string;
            value: string;
        }[];
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasImage, setHasImage] = useState(false);
    // 实时预览基准价
    const previewBasePrice = channel === "domestic"
        ? calcDomesticBasePrice(dBrand, dHP)
        : iNewPrice;
    // 执行估值
    const doValuation = async () => {
        setLoading(true);
        try {
            if (channel === "domestic") {
                // 调用网站API进行完整估值
                const res = await fetch("/api/valuation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        brand: dBrand,
                        category: dCategory,
                        year: dYear - dYears,
                        workingHours: dYears * 500,
                        condition: "good",
                        enginePower: dHP,
                        priceCny: dSellerPrice ? Number(dSellerPrice) : undefined,
                        useV4: true,
                        skipImageAnalysis: !hasImage,
                    }),
                });
                const data = await res.json();
                if (data.success) {
                    const r = data.data;
                    setResult({
                        value: r.estimatedValue,
                        confidence: r.confidence || calcConfidence(channel, dBrand, dHP, hasImage, dYears),
                        breakdown: (r.details || []).map((d: {
                            factor: string;
                            impact: string;
                        }) => ({
                            label: d.factor,
                            value: d.impact,
                            detail: "",
                        })),
                        formula: `基准价(${formatMoney(previewBasePrice)}) × 折旧(${calcDomesticDepreciation(dYears).toFixed(2)}) × 地区(${getRegionalFactor(dRegion).toFixed(2)}) × 补贴趋势(${getSubsidyTrendFactor(dYear).toFixed(2)})`,
                        warnings: [],
                    });
                }
                else {
                    // API失败时用客户端计算
                    doClientCalc();
                }
            }
            else {
                // 国际/出口：客户端计算
                const { value, breakdown } = calcIntlValuation(channel === "export" ? iBrand : iBrand, iHP, iHours, iNewPrice, iRegion, iYear, iCondition, iEmission, iConfigAddon, tr);
                setResult({
                    value,
                    confidence: calcConfidence(channel, iBrand, iHP, hasImage, Math.round(iHours / 500)),
                    breakdown,
                    formula: `(${formatMoney(iNewPrice)} × ${getIntlHoursCoeff(iHours).toFixed(2)} × ${INTL_CONDITIONS[iCondition].toFixed(3)} × ${(DEVELOPED_REGIONS.has(iRegion) ? EMISSION_DEVELOPED[iEmission] : EMISSION_DEVELOPING[iEmission]).toFixed(2)} + ${formatMoney(iConfigAddon)}) × ${INTL_REGIONS[iRegion].toFixed(2)} × ${(INTL_BRAND_RETENTION[iBrand] || 0.95).toFixed(3)}`,
                    warnings: generateWarnings(),
                });
                if (channel === "export") {
                    const arb = calcExportArbitrage(value, eTargetCountry, eShipping, eTariff, tr);
                    setArbitrage(arb);
                }
            }
        }
        catch {
            doClientCalc();
        }
        finally {
            setLoading(false);
        }
    };
    const doClientCalc = () => {
        if (channel === "domestic") {
            const basePrice = calcDomesticBasePrice(dBrand, dHP);
            const depreciation = calcDomesticDepreciation(dYears);
            const regionFactor = getRegionalFactor(dRegion);
            const trendFactor = getSubsidyTrendFactor(dYear);
            const brandPremium = DOMESTIC_BRAND_PREMIUM[dBrand] || 1;
            const value = Math.round(basePrice * depreciation * regionFactor * trendFactor * brandPremium / 1.3);
            setResult({
                value,
                confidence: calcConfidence(channel, dBrand, dHP, hasImage, dYears),
                breakdown: [
                    { label: tr("新机基准价"), value: formatMoney(basePrice), detail: `${dBrand} 回归模型` },
                    { label: tr("年份折旧"), value: `×${depreciation.toFixed(2)}`, detail: `${dYears}年` },
                    { label: tr("地区修正"), value: `×${regionFactor.toFixed(2)}`, detail: dRegion },
                    { label: tr("补贴趋势"), value: `×${trendFactor.toFixed(2)}`, detail: `${dYear}年` },
                    { label: tr("品牌溢价"), value: `×${brandPremium.toFixed(2)}`, detail: dBrand },
                ],
                formula: `${formatMoney(basePrice)} × ${depreciation.toFixed(2)} × ${regionFactor.toFixed(2)} × ${trendFactor.toFixed(2)} × ${brandPremium.toFixed(2)}`,
                warnings: generateWarnings(),
            });
        }
    };
    const generateWarnings = (): string[] => {
        const warnings: string[] = [];
        if (channel === "domestic") {
            if (dYears > 10)
                warnings.push("\u673A\u9F84\u8D85\u8FC710\u5E74\uFF0C\u4F30\u503C\u4E0D\u786E\u5B9A\u6027\u589E\u5927\uFF0C\u5EFA\u8BAE\u7ED3\u5408\u5B9E\u9645\u8F66\u51B5\u5224\u65AD");
            if (!DOMESTIC_HP_REGRESSION[dBrand])
                warnings.push(`${dBrand}无专属回归模型，使用通用模型，精度可能降低`);
            if (dHP < 50)
                warnings.push("\u9A6C\u529B\u6570\u636E\u504F\u5C0F\uFF0C\u8BF7\u786E\u8BA4\u8F93\u5165\u6B63\u786E");
        }
        if (channel === "international" || channel === "export") {
            if (iHours > 6000)
                warnings.push("\u5DE5\u65F6\u6570\u8F83\u9AD8\uFF0C\u8BBE\u5907\u53EF\u80FD\u9700\u8981\u5927\u4FEE\uFF0C\u5B9E\u9645\u4EF7\u503C\u53EF\u80FD\u4F4E\u4E8E\u4F30\u503C");
            if (iEmission === "Tier 1" || iEmission === "Tier 2") {
                if (DEVELOPED_REGIONS.has(iRegion)) {
                    warnings.push("\u4F4E\u6392\u653E\u6807\u51C6\u5728\u53D1\u8FBE\u5E02\u573A\u4F1A\u663E\u8457\u6298\u4EF7\uFF0C\u8003\u8651\u51FA\u53E3\u5230\u53D1\u5C55\u4E2D\u5E02\u573A\u53EF\u80FD\u83B7\u5F97\u66F4\u9AD8\u6536\u76CA");
                }
            }
        }
        if (channel === "export") {
            const country = EXPORT_COUNTRIES[eTargetCountry];
            if (country && country.sell > 1.35) {
                warnings.push(`${eTargetCountry}售价系数较高(${country.sell})，套利空间较大`);
            }
        }
        return warnings;
    };
    const handleRecognized = (data: RecognizeResult) => {
        setHasImage(true);
        if (data.brand) {
            if (data.isChineseBrand) {
                if (DOMESTIC_BRAND_LIST.includes(data.brand))
                    setDBrand(data.brand);
            }
            else {
                if (INTL_BRAND_LIST.includes(data.brand))
                    setIBrand(data.brand);
            }
        }
        if (data.horsepower) {
            setDHP(data.horsepower);
            setIHP(data.horsepower);
        }
        if (data.year) {
            setDYear(data.year);
            setIYear(data.year);
        }
        if (data.category) {
            if (DOMESTIC_CATEGORIES.includes(data.category))
                setDCategory(data.category);
        }
        if (data.isChineseBrand !== undefined) {
            setChannel(data.isChineseBrand ? "domestic" : "international");
        }
    };
    const channelTabs: {
        key: Channel;
        label: string;
        icon: typeof Zap;
    }[] = [
        { key: "domestic", label: tr("国产估值"), icon: Zap },
        { key: "international", label: tr("国际估值"), icon: Globe },
        { key: "export", label: tr("出口估值"), icon: Ship },
    ];
    return (<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href={`/${locale}/services`} className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600">
        <ArrowLeft className="h-4 w-4"/>{tr("返回服务首页")}</Link>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 inline-flex rounded-lg bg-primary-100 p-3 text-primary-600">
          <Brain className="h-8 w-8"/>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{tr("AI智能估价")}</h1>
        <p className="mt-2 text-gray-500">{tr("AI多模态识别，覆盖国产/国际/出口三大通道")}</p>
      </div>

      {/* Mode Selector */}
      <div className="mb-6 flex gap-2 rounded-xl bg-white p-2 shadow-sm">
        <button onClick={() => setMode("quick")} className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-all ${mode === "quick" ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          <Zap className="mr-1 inline h-4 w-4"/>{tr("快速估价")}<span className="ml-1 text-xs opacity-70">{tr("免费 · 秒级")}</span>
        </button>
        <button onClick={() => setMode("deep")} className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-all ${mode === "deep" ? "bg-purple-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          <FileText className="mr-1 inline h-4 w-4"/>{tr("深度报告")}<span className="ml-1 text-xs opacity-70">{tr("¥9-29 · 30秒")}</span>
        </button>
      </div>

      {/* AI Recognition (shared) */}
      <div className="mb-6">
        <AIRecognizeSection onRecognized={handleRecognized} channel={channel}/>
      </div>

      {mode === "quick" && (<>
          {/* Channel Tabs */}
          <div className="mb-6 flex gap-2 rounded-xl bg-white p-2 shadow-sm">
            {channelTabs.map((tab) => {
                const Icon = tab.icon;
                return (<button key={tab.key} onClick={() => { setChannel(tab.key); setResult(null); setArbitrage(null); }} className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${channel === tab.key
                        ? "bg-primary-600 text-white shadow-sm"
                        : "text-gray-500 hover:bg-gray-50"}`}>
                  <Icon className="mr-1 inline h-4 w-4"/>
                  {tab.label}
                </button>);
            })}
          </div>

          {/* Domestic Form */}
          {channel === "domestic" && (<div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="border-b border-gray-100 pb-3 text-base font-semibold text-gray-800">{tr("国产农机参数")}</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("机具品类")}</label>
                  <select value={dCategory} onChange={(e) => setDCategory(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {DOMESTIC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("品牌")}</label>
                  <select value={dBrand} onChange={(e) => setDBrand(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {DOMESTIC_BRAND_LIST.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("马力 (HP)")}</label>
                  <input type="number" value={dHP} min={50} max={500} onChange={(e) => setDHP(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                  <input type="range" value={dHP} min={50} max={500} onChange={(e) => setDHP(Number(e.target.value))} className="mt-1 w-full"/>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("使用年限")}</label>
                  <input type="number" value={dYears} min={0} max={30} onChange={(e) => setDYears(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                  <input type="range" value={dYears} min={0} max={30} onChange={(e) => setDYears(Number(e.target.value))} className="mt-1 w-full"/>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("区域")}</label>
                  <select value={dRegion} onChange={(e) => setDRegion(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {DOMESTIC_REGIONS_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("购机年份")}</label>
                  <select value={dYear} onChange={(e) => setDYear(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {[2022, 2023, 2024, 2025].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("卖家报价 (可选)")}</label>
                  <input type="number" value={dSellerPrice} placeholder={tr("单位: 元")} onChange={(e) => setDSellerPrice(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                </div>
              </div>

              {/* 实时基准价预览 */}
              <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
                <span className="text-xs text-blue-600">{tr("新机基准价（")}{dBrand}{tr("回归模型）")}</span>
                <span className="text-lg font-bold text-blue-700">
                  {formatMoney(previewBasePrice)}
                </span>
              </div>

              <button onClick={doValuation} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Calculator className="h-4 w-4"/>}
                {loading ? "\u6B63\u5728\u4F30\u503C..." : "\u5F00\u59CBAI\u4F30\u4EF7"}
              </button>
            </div>)}

          {/* International Form */}
          {channel === "international" && (<div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="border-b border-gray-100 pb-3 text-base font-semibold text-gray-800">{tr("国际农机参数")}</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("品牌")}</label>
                  <select value={iBrand} onChange={(e) => setIBrand(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {INTL_BRAND_LIST.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("马力 (HP)")}</label>
                  <input type="number" value={iHP} min={50} max={500} onChange={(e) => setIHP(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                  <input type="range" value={iHP} min={50} max={500} onChange={(e) => setIHP(Number(e.target.value))} className="mt-1 w-full"/>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("使用小时数")}</label>
                  <input type="number" value={iHours} min={0} max={20000} step={100} onChange={(e) => setIHours(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                  <input type="range" value={iHours} min={0} max={20000} step={100} onChange={(e) => setIHours(Number(e.target.value))} className="mt-1 w-full"/>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("新机价格 (元)")}</label>
                  <input type="number" value={iNewPrice} min={10000} onChange={(e) => setINewPrice(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("区域")}</label>
                  <select value={iRegion} onChange={(e) => setIRegion(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {Object.keys(INTL_REGIONS).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("购机年份")}</label>
                  <select value={iYear} onChange={(e) => setIYear(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {[2022, 2023, 2024, 2025].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("状况")}</label>
                  <div className="flex gap-1">
                    {Object.keys(INTL_CONDITIONS).map((c) => (<button key={c} onClick={() => setICondition(c)} className={`flex-1 rounded-md py-2 text-xs font-medium ${iCondition === c ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                        {c}
                      </button>))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("排放标准")}</label>
                  <select value={iEmission} onChange={(e) => setIEmission(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {Object.keys(EMISSION_DEVELOPED).map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{tr("配置增值 (元)")}</label>
                  <input type="number" value={iConfigAddon} min={0} onChange={(e) => setIConfigAddon(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                </div>
              </div>

              <button onClick={doValuation} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Calculator className="h-4 w-4"/>}
                {loading ? "\u6B63\u5728\u4F30\u503C..." : "\u5F00\u59CBAI\u4F30\u4EF7"}
              </button>
            </div>)}

          {/* Export Form */}
          {channel === "export" && (<div className="space-y-4">
              {/* 复用国际参数表单 */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="border-b border-gray-100 pb-3 text-base font-semibold text-gray-800">{tr("出口农机参数")}</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{tr("品牌")}</label>
                    <select value={iBrand} onChange={(e) => setIBrand(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                      {INTL_BRAND_LIST.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{tr("马力 (HP)")}</label>
                    <input type="number" value={iHP} min={50} max={500} onChange={(e) => setIHP(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                    <input type="range" value={iHP} min={50} max={500} onChange={(e) => setIHP(Number(e.target.value))} className="mt-1 w-full"/>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{tr("使用小时数")}</label>
                    <input type="number" value={iHours} min={0} max={20000} step={100} onChange={(e) => setIHours(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                    <input type="range" value={iHours} min={0} max={20000} step={100} onChange={(e) => setIHours(Number(e.target.value))} className="mt-1 w-full"/>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{tr("新机价格 (元)")}</label>
                    <input type="number" value={iNewPrice} min={10000} onChange={(e) => setINewPrice(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{tr("目标国家")}</label>
                    <select value={eTargetCountry} onChange={(e) => setETargetCountry(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                      {Object.keys(EXPORT_COUNTRIES).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{tr("状况")}</label>
                    <div className="flex gap-1">
                      {Object.keys(INTL_CONDITIONS).map((c) => (<button key={c} onClick={() => setICondition(c)} className={`flex-1 rounded-md py-2 text-xs font-medium ${iCondition === c ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                          {c}
                        </button>))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{tr("排放标准")}</label>
                    <select value={iEmission} onChange={(e) => setIEmission(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                      {Object.keys(EMISSION_DEVELOPED).map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{tr("运费 (元)")}</label>
                    <input type="number" value={eShipping} min={0} onChange={(e) => setEShipping(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{tr("关税率")}</label>
                    <input type="number" value={eTariff} min={0} max={1} step={0.01} onChange={(e) => setETariff(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"/>
                  </div>
                </div>

                <button onClick={doValuation} disabled={loading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Ship className="h-4 w-4"/>}
                  {loading ? "\u6B63\u5728\u8BA1\u7B97..." : "\u8BA1\u7B97\u51FA\u53E3\u5957\u5229"}
                </button>
              </div>
            </div>)}

          {/* Results */}
          {result && (<div className="mt-6 space-y-4 animate-in">
              {/* Main Result */}
              <div className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <ConfidenceGauge value={result.confidence}/>
                <div className="flex-1">
                  <div className="text-sm text-gray-500">{tr("AI估值结果")}</div>
                  <div className="text-3xl font-bold text-primary-700">
                    {formatMoney(result.value)}
                  </div>
                  {dSellerPrice && channel === "domestic" && (<div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-400">{tr("卖家报价:")}</span>
                      <span className="text-sm font-medium text-gray-700">
                        {formatMoney(Number(dSellerPrice))}
                      </span>
                      {Number(dSellerPrice) > result.value && (<span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">{tr("偏高")}{Math.round(((Number(dSellerPrice) - result.value) / result.value) * 100)}%
                        </span>)}
                      {Number(dSellerPrice) <= result.value && (<span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">{tr("合理/偏低")}</span>)}
                    </div>)}
                </div>
              </div>

              {/* Calculation Breakdown */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h4 className="mb-3 text-sm font-semibold text-gray-700">{tr("计算过程")}</h4>
                <div className="space-y-2">
                  {result.breakdown.map((item, i) => (<div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-gray-500">{item.label}</span>
                        {item.detail && <span className="ml-2 text-xs text-gray-400">{item.detail}</span>}
                      </div>
                      <span className="font-medium text-gray-800">{item.value}</span>
                    </div>))}
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <div className="mb-1 text-xs font-medium text-gray-400">{tr("估值公式")}</div>
                    <div className="font-mono text-xs text-gray-600">{result.formula}</div>
                  </div>
                </div>
              </div>

              {/* Export Arbitrage */}
              {arbitrage && (<div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 p-6 text-white shadow-lg">
                  <div className="mb-1 text-sm opacity-80">{tr("出口套利分析 ·")}{eTargetCountry}</div>
                  <div className="mb-4 text-4xl font-bold tracking-tight">
                    {formatMoney(arbitrage.profit)}
                  </div>
                  <div className="mb-2 text-sm opacity-80">{tr("利润率")}<span className="font-bold">{arbitrage.profitRate.toFixed(1)}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {arbitrage.breakdown.map((item, i) => (<div key={i} className="text-center">
                        <div className="text-xs opacity-70">{item.label}</div>
                        <div className="text-sm font-semibold">{item.value}</div>
                      </div>))}
                  </div>
                </div>)}

              {/* Warnings */}
              {result.warnings.length > 0 && (<div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
                  <div className="mb-2 flex items-center gap-1 text-sm font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4"/>{tr("风险提示")}</div>
                  {result.warnings.map((w, i) => (<div key={i} className="text-xs text-amber-600">• {w}</div>))}
                </div>)}

              {/* Deep Report Section (paid, three tiers) */}
              <DeepReportSection brand={channel === "domestic" ? dBrand : iBrand} model={channel === "domestic" ? `${dBrand} ${dCategory}` : iBrand} year={channel === "domestic" ? dYear - dYears : iYear} horsepower={channel === "domestic" ? dHP : iHP} category={dCategory} valuationResult={result ? {
                    estimatedValue: result.value,
                    confidenceScore: result.confidence / 100,
                } : null} locale={locale} showPublishButton={true}/>
            </div>)}
        </>)}

      {mode === "deep" && (<DeepAnalysisSection prefillData={{
                brand: channel === "domestic" ? dBrand : iBrand,
                category: dCategory,
                year: channel === "domestic" ? dYear - dYears : iYear,
                horsepower: channel === "domestic" ? dHP : iHP,
            }}/>)}

      {/* Disclaimer */}
      <div className="mt-8 text-center text-xs leading-relaxed text-gray-400">
        <strong className="text-gray-500">{tr("免责声明：")}</strong>{tr("本估值引擎基于AI多模态识别与市场模型估算，仅供决策参考，不构成投资或交易建议。 实际成交价格受车况、市场供需、谈判等多重因素影响，可能存在偏差。")}</div>
    </div>);
}
