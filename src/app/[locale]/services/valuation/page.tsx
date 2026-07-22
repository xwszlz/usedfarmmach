"use client";

import { useState, useRef, useCallback } from "react";
import { useLocale } from "next-intl";
import {
  Brain, Loader2, Calculator, ArrowLeft, Upload, Camera,
  Sparkles, TrendingUp, AlertTriangle, FileText, ChevronRight,
  Zap, Globe, Ship, CheckCircle2, XCircle,
} from "lucide-react";
import Link from "next/link";
import { DeepReportSection } from "@/components/valuation/deep-report-section";
import AnalysisReportView from "@/components/valuation/analysis-report-view";
import {
  DOMESTIC_HP_REGRESSION,
  DOMESTIC_BRAND_PREMIUM,
  REGIONAL_FACTORS,
  SUBSIDY_TREND_FACTOR,
  isDomesticBrandSupported,
  getRegionalFactor,
  getSubsidyTrendFactor,
} from "@/lib/valuation/brand-data";

// ============================================================
// 常量定义
// ============================================================

type Channel = "domestic" | "international" | "export";
type Mode = "quick" | "deep";

// 国产品类
const DOMESTIC_CATEGORIES = [
  "轮式拖拉机", "谷物联合收割机", "玉米收获机", "插秧机",
  "旋耕机", "单粒精密播种机", "穴播机", "条播机",
  "犁", "秸秆粉碎还田机", "花生收获机", "微型耕耘机",
  "田园管理机", "饲料粉碎机", "辅助驾驶系统设备",
];

// 国产品牌列表
const DOMESTIC_BRAND_LIST = [
  "东方红", "雷沃", "潍柴雷沃", "中联", "道依茨法尔",
  "东风", "常发", "英轩", "沃得", "时风",
  "悍沃", "悦达", "五征", "萨丁", "泰山",
  "华夏", "其他国产",
];

// 国际品牌
const INTL_BRAND_LIST = [
  "John Deere", "Kubota", "Case IH", "New Holland",
  "CLAAS", "Fendt", "Massey Ferguson", "Valtra", "其他国际",
];

const INTL_BRAND_COEFFICIENTS: Record<string, number> = {
  "John Deere": 1.15, "Kubota": 1.10, "Fendt": 1.085, "CLAAS": 1.08,
  "Case IH": 1.00, "New Holland": 0.95, "Massey Ferguson": 0.92,
  "Valtra": 0.90, "其他国际": 0.95,
};

// 国际品牌保值率
const INTL_BRAND_RETENTION: Record<string, number> = {
  "John Deere": 1.15, "Kubota": 1.10, "Fendt": 1.085, "CLAAS": 1.08,
  "Case IH": 1.00, "New Holland": 0.95, "Massey Ferguson": 0.92,
  "Valtra": 0.90, "其他国际": 0.95,
};

// 国际折旧（按小时）
const INTL_HOURS_DEPRECIATION = [
  { hours: 0, coeff: 0.92 }, { hours: 500, coeff: 0.92 },
  { hours: 1000, coeff: 0.82 }, { hours: 2000, coeff: 0.62 },
  { hours: 4000, coeff: 0.40 }, { hours: 6000, coeff: 0.25 },
  { hours: 8000, coeff: 0.15 },
];

const INTL_CONDITIONS: Record<string, number> = {
  Excellent: 1.175, Good: 1.0, Fair: 0.825, Poor: 0.625,
};

const EMISSION_DEVELOPED: Record<string, number> = {
  "Tier 4": 1.0, "Tier 4i": 1.0, "Tier 3": 0.85, "Tier 2": 0.70, "Tier 1": 0.55,
};
const EMISSION_DEVELOPING: Record<string, number> = {
  "Tier 4": 0.95, "Tier 4i": 0.95, "Tier 3": 1.05, "Tier 2": 1.10, "Tier 1": 1.0,
};

const INTL_REGIONS: Record<string, number> = {
  "北美": 1.10, "欧洲": 1.15, "南美": 0.80, "非洲": 0.70,
  "东南亚": 0.85, "中亚": 0.82, "中东": 0.90,
};

const DEVELOPED_REGIONS = new Set(["北美", "欧洲"]);

const EXPORT_COUNTRIES: Record<string, { buy: number; sell: number }> = {
  "阿根廷": { buy: 0.75, sell: 1.40 }, "尼日利亚": { buy: 0.70, sell: 1.50 },
  "俄罗斯": { buy: 0.85, sell: 1.25 }, "泰国": { buy: 0.80, sell: 1.30 },
  "哈萨克斯坦": { buy: 0.82, sell: 1.28 }, "乌兹别克斯坦": { buy: 0.82, sell: 1.28 },
  "南非": { buy: 0.75, sell: 1.35 }, "肯尼亚": { buy: 0.72, sell: 1.45 },
  "加纳": { buy: 0.72, sell: 1.45 }, "巴西": { buy: 0.78, sell: 1.35 },
  "越南": { buy: 0.80, sell: 1.32 }, "菲律宾": { buy: 0.80, sell: 1.32 },
  "缅甸": { buy: 0.75, sell: 1.40 }, "柬埔寨": { buy: 0.75, sell: 1.40 },
  "巴基斯坦": { buy: 0.78, sell: 1.35 }, "伊朗": { buy: 0.80, sell: 1.30 },
  "伊拉克": { buy: 0.80, sell: 1.30 }, "沙特阿拉伯": { buy: 0.85, sell: 1.25 },
  "阿联酋": { buy: 0.85, sell: 1.25 },
};

const DOMESTIC_REGIONS_LIST = [
  "山东", "河北", "河南", "黑龙江", "江西", "湖北", "甘肃",
  "山西", "辽宁", "北京", "天津", "上海", "广东", "广西",
  "海南", "贵州", "青海", "新疆", "北大荒", "通用",
];

const YEAR_TRENDS: Record<number, number> = {
  2022: 0.9285, 2023: 0.9211, 2024: 1.0, 2025: 1.0211,
};

const CONDITIONS_CN = [
  { value: "excellent", label: "优秀" },
  { value: "good", label: "良好" },
  { value: "fair", label: "一般" },
  { value: "poor", label: "较差" },
];

// ============================================================
// 辅助函数
// ============================================================

function formatMoney(value: number): string {
  if (value >= 10000) return `¥${(value / 10000).toFixed(1)}万`;
  return `¥${value.toLocaleString()}`;
}

function calcDomesticBasePrice(brand: string, horsepower: number): number {
  const regression = DOMESTIC_HP_REGRESSION[brand] || DOMESTIC_HP_REGRESSION["_default"];
  const price = regression.pricePerHP * horsepower + regression.intercept;
  return Math.max(price, 5000);
}

function calcDomesticDepreciation(yearsUsed: number): number {
  if (yearsUsed <= 0) return 1.0;
  if (yearsUsed <= 3) return Math.max(1 - 0.07 * yearsUsed, 0.1);
  if (yearsUsed <= 7) return Math.max(1 - 0.07 * 3 - 0.08 * (yearsUsed - 3), 0.1);
  if (yearsUsed <= 12) return Math.max(1 - 0.07 * 3 - 0.08 * 4 - 0.07 * (yearsUsed - 7), 0.1);
  return Math.max(1 - 0.07 * 3 - 0.08 * 4 - 0.07 * 5 - 0.05 * (yearsUsed - 12), 0.1);
}

function getIntlHoursCoeff(hours: number): number {
  let coeff = 0.15;
  for (const entry of INTL_HOURS_DEPRECIATION) {
    if (hours >= entry.hours) coeff = entry.coeff;
  }
  return coeff;
}

function calcIntlValuation(
  brand: string, horsepower: number, hours: number,
  newPrice: number, region: string, year: number,
  condition: string, emission: string, configAddon: number,
): { value: number; breakdown: { label: string; value: string; detail: string }[] } {
  const brandCoeff = INTL_BRAND_COEFFICIENTS[brand] || 0.95;
  const retentionCoeff = INTL_BRAND_RETENTION[brand] || 0.95;
  const hoursCoeff = getIntlHoursCoeff(hours);
  const conditionCoeff = INTL_CONDITIONS[condition] || 1.0;
  const isDeveloped = DEVELOPED_REGIONS.has(region);
  const emissionCoeff = isDeveloped
    ? (EMISSION_DEVELOPED[emission] || 1.0)
    : (EMISSION_DEVELOPING[emission] || 1.0);
  const regionCoeff = INTL_REGIONS[region] || 0.90;

  const baseValue = newPrice * hoursCoeff * conditionCoeff * emissionCoeff + configAddon;
  const finalValue = baseValue * regionCoeff * retentionCoeff;

  const breakdown = [
    { label: "新机基准价", value: formatMoney(newPrice), detail: "用户输入" },
    { label: "小时折旧", value: `×${hoursCoeff.toFixed(2)}`, detail: `${hours.toLocaleString()}h` },
    { label: "状况系数", value: `×${conditionCoeff.toFixed(3)}`, detail: condition },
    { label: "排放系数", value: `×${emissionCoeff.toFixed(2)}`, detail: `${emission} (${isDeveloped ? "发达" : "发展中"}市场)` },
    { label: "配置增值", value: `+${formatMoney(configAddon)}`, detail: "选配附件" },
    { label: "区域系数", value: `×${regionCoeff.toFixed(2)}`, detail: region },
    { label: "品牌保值率", value: `×${retentionCoeff.toFixed(3)}`, detail: brand },
  ];

  return { value: Math.round(finalValue), breakdown };
}

function calcExportArbitrage(
  baseValue: number, targetCountry: string,
  shippingCost: number, tariffRate: number,
): {
  totalCost: number; exportPrice: number; profit: number;
  profitRate: number; breakdown: { label: string; value: string }[];
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
    { label: "二手机收购价", value: formatMoney(buyPrice) },
    { label: "运费", value: formatMoney(shippingCost) },
    { label: "关税", value: formatMoney(tariff) },
    { label: "到岸总成本", value: formatMoney(landedCost) },
    { label: "目标国售价", value: formatMoney(exportPrice) },
  ];

  return { totalCost: landedCost, exportPrice, profit, profitRate, breakdown };
}

function calcConfidence(
  channel: Channel, brand: string, horsepower: number,
  hasImage: boolean, yearsUsed: number,
): number {
  let confidence = 60;
  if (channel === "domestic") {
    if (DOMESTIC_HP_REGRESSION[brand]) {
      confidence += 15;
      const r2 = DOMESTIC_HP_REGRESSION[brand].r2;
      confidence += Math.round(r2 * 15);
    } else {
      confidence += 5;
    }
    if (horsepower > 0) confidence += 5;
  } else {
    confidence += 15;
  }
  if (hasImage) confidence += 10;
  if (yearsUsed >= 0 && yearsUsed <= 15) confidence += 5;
  return Math.min(confidence, 95);
}

// ============================================================
// 置信度仪表盘 SVG
// ============================================================

function ConfidenceGauge({ value }: { value: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>{value}%</span>
        <span className="text-xs text-gray-400">置信度</span>
      </div>
    </div>
  );
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

function AIRecognizeSection({
  onRecognized,
  channel,
}: {
  onRecognized: (data: RecognizeResult) => void;
  channel: Channel;
}) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecognizeResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
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
      } else {
        setError(data.error || "识别失败，请手动填写参数");
      }
    } catch {
      setError("网络错误，请手动填写参数");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-800">AI智能识别</h3>
        <span className="text-xs text-gray-400">上传照片自动填写参数</span>
      </div>

      <div
        className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
      >
        {imagePreview ? (
          <img src={imagePreview} alt="预览" className="mx-auto max-h-40 rounded-lg" />
        ) : (
          <>
            <Camera className="mx-auto mb-2 h-10 w-10 text-gray-400" />
            <p className="text-sm text-gray-500">点击拍照或拖拽图片到此处</p>
            <p className="mt-1 text-xs text-gray-400">AI将自动识别品类、品牌和参数</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
      </div>

      {loading && (
        <div className="mt-3 flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-sm text-gray-500">AI识别中...</span>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="mb-2 flex items-center gap-1 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            识别成功 {result.confidence ? `（置信度 ${Math.round(result.confidence * 100)}%）` : ""}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {result.brand && <div><span className="text-gray-400">品牌：</span><span className="font-medium">{result.brand}</span></div>}
            {result.category && <div><span className="text-gray-400">品类：</span><span className="font-medium">{result.category}</span></div>}
            {result.modelName && <div><span className="text-gray-400">型号：</span><span className="font-medium">{result.modelName}</span></div>}
            {result.horsepower && <div><span className="text-gray-400">马力：</span><span className="font-medium">{result.horsepower} HP</span></div>}
            {result.year && <div><span className="text-gray-400">年份：</span><span className="font-medium">{result.year}</span></div>}
            {result.isChineseBrand !== undefined && (
              <div><span className="text-gray-400">产地：</span><span className="font-medium">{result.isChineseBrand ? "国产" : "进口"}</span></div>
            )}
          </div>
          <button
            onClick={() => { if (result) onRecognized(result); }}
            className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            一键填入估值参数
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 深度分析报告组件
// ============================================================

function DeepAnalysisSection({
  prefillData,
}: {
  prefillData: { brand?: string; category?: string; year?: number; horsepower?: number };
}) {
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
          productName: prefillData.category,
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
      } else {
        setError(data.error || "深度分析失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-600" />
          <h3 className="text-sm font-semibold text-gray-800">深度估值报告</h3>
        </div>
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">¥9</span>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        包含：六维度现状评估 · 技术参数 · 操作维修 · 估值引擎参考价 · 购买建议 · 资源文档
      </p>

      {!report && !loading && (
        <button
          onClick={runDeepAnalysis}
          className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 py-3 text-sm font-medium text-white transition-all hover:from-purple-700 hover:to-purple-600"
        >
          <Sparkles className="mr-1 inline h-4 w-4" />
          生成专业估值报告
        </button>
      )}

      {loading && (
        <div className="flex flex-col items-center py-8">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm text-gray-500">AI正在生成专业报告（约30-60秒）...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {report && (
        <div className="animate-in space-y-3">
          <AnalysisReportView
            report={report}
            structured={structured}
            isChineseBrand={true}
            brandName={prefillData.brand}
            categoryName={prefillData.category}
            locale="zh"
            locked={locked}
            onUnlock={() => setLocked(false)}
            valuationPrice={valuationPrice}
          />
          <button
            onClick={runDeepAnalysis}
            className="w-full rounded-lg border border-purple-300 py-2 text-xs text-purple-600 hover:bg-purple-50"
          >
            重新生成
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 主页面组件
// ============================================================

export default function ValuationPage() {
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>("quick");
  const [channel, setChannel] = useState<Channel>("domestic");

  // 国产参数
  const [dCategory, setDCategory] = useState("轮式拖拉机");
  const [dBrand, setDBrand] = useState("东方红");
  const [dHP, setDHP] = useState(120);
  const [dYears, setDYears] = useState(3);
  const [dRegion, setDRegion] = useState("山东");
  const [dYear, setDYear] = useState(2024);
  const [dSellerPrice, setDSellerPrice] = useState("");

  // 国际参数
  const [iBrand, setIBrand] = useState("John Deere");
  const [iHP, setIHP] = useState(150);
  const [iHours, setIHours] = useState(1000);
  const [iNewPrice, setINewPrice] = useState(300000);
  const [iRegion, setIRegion] = useState("欧洲");
  const [iYear, setIYear] = useState(2024);
  const [iCondition, setICondition] = useState("Good");
  const [iEmission, setIEmission] = useState("Tier 4");
  const [iConfigAddon, setIConfigAddon] = useState(0);

  // 出口参数
  const [eTargetCountry, setETargetCountry] = useState("俄罗斯");
  const [eShipping, setEShipping] = useState(25000);
  const [eTariff, setETariff] = useState(0.15);

  // 结果
  const [result, setResult] = useState<{
    value: number;
    confidence: number;
    breakdown: { label: string; value: string; detail: string }[];
    formula: string;
    warnings: string[];
  } | null>(null);

  const [arbitrage, setArbitrage] = useState<{
    totalCost: number; exportPrice: number; profit: number;
    profitRate: number; breakdown: { label: string; value: string }[];
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
            breakdown: (r.details || []).map((d: { factor: string; impact: string }) => ({
              label: d.factor,
              value: d.impact,
              detail: "",
            })),
            formula: `基准价(${formatMoney(previewBasePrice)}) × 折旧(${calcDomesticDepreciation(dYears).toFixed(2)}) × 地区(${getRegionalFactor(dRegion).toFixed(2)}) × 补贴趋势(${getSubsidyTrendFactor(dYear).toFixed(2)})`,
            warnings: [],
          });
        } else {
          // API失败时用客户端计算
          doClientCalc();
        }
      } else {
        // 国际/出口：客户端计算
        const { value, breakdown } = calcIntlValuation(
          channel === "export" ? iBrand : iBrand,
          iHP, iHours, iNewPrice, iRegion, iYear, iCondition, iEmission, iConfigAddon,
        );
        setResult({
          value,
          confidence: calcConfidence(channel, iBrand, iHP, hasImage, Math.round(iHours / 500)),
          breakdown,
          formula: `(${formatMoney(iNewPrice)} × ${getIntlHoursCoeff(iHours).toFixed(2)} × ${INTL_CONDITIONS[iCondition].toFixed(3)} × ${(DEVELOPED_REGIONS.has(iRegion) ? EMISSION_DEVELOPED[iEmission] : EMISSION_DEVELOPING[iEmission]).toFixed(2)} + ${formatMoney(iConfigAddon)}) × ${INTL_REGIONS[iRegion].toFixed(2)} × ${(INTL_BRAND_RETENTION[iBrand] || 0.95).toFixed(3)}`,
          warnings: generateWarnings(),
        });

        if (channel === "export") {
          const arb = calcExportArbitrage(value, eTargetCountry, eShipping, eTariff);
          setArbitrage(arb);
        }
      }
    } catch {
      doClientCalc();
    } finally {
      setLoading(false);
    }
  };

  const doClientCalc = () => {
    if (channel === "domestic") {
      const basePrice = calcDomesticBasePrice(dBrand, dHP);
      const depreciation = calcDomesticDepreciation(dYears);
      const regionFactor = getRegionalFactor(dRegion);
      const trendFactor = getSubsidyTrendFactor(dYear);
      const brandPremium = DOMESTIC_BRAND_PREMIUM[dBrand] || 1.0;
      const value = Math.round(basePrice * depreciation * regionFactor * trendFactor * brandPremium / 1.3);

      setResult({
        value,
        confidence: calcConfidence(channel, dBrand, dHP, hasImage, dYears),
        breakdown: [
          { label: "新机基准价", value: formatMoney(basePrice), detail: `${dBrand} 回归模型` },
          { label: "年份折旧", value: `×${depreciation.toFixed(2)}`, detail: `${dYears}年` },
          { label: "地区修正", value: `×${regionFactor.toFixed(2)}`, detail: dRegion },
          { label: "补贴趋势", value: `×${trendFactor.toFixed(2)}`, detail: `${dYear}年` },
          { label: "品牌溢价", value: `×${brandPremium.toFixed(2)}`, detail: dBrand },
        ],
        formula: `${formatMoney(basePrice)} × ${depreciation.toFixed(2)} × ${regionFactor.toFixed(2)} × ${trendFactor.toFixed(2)} × ${brandPremium.toFixed(2)}`,
        warnings: generateWarnings(),
      });
    }
  };

  const generateWarnings = (): string[] => {
    const warnings: string[] = [];
    if (channel === "domestic") {
      if (dYears > 10) warnings.push("机龄超过10年，估值不确定性增大，建议结合实际车况判断");
      if (!DOMESTIC_HP_REGRESSION[dBrand]) warnings.push(`${dBrand}无专属回归模型，使用通用模型，精度可能降低`);
      if (dHP < 50) warnings.push("马力数据偏小，请确认输入正确");
    }
    if (channel === "international" || channel === "export") {
      if (iHours > 6000) warnings.push("工时数较高，设备可能需要大修，实际价值可能低于估值");
      if (iEmission === "Tier 1" || iEmission === "Tier 2") {
        if (DEVELOPED_REGIONS.has(iRegion)) {
          warnings.push("低排放标准在发达市场会显著折价，考虑出口到发展中市场可能获得更高收益");
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
        if (DOMESTIC_BRAND_LIST.includes(data.brand)) setDBrand(data.brand);
      } else {
        if (INTL_BRAND_LIST.includes(data.brand)) setIBrand(data.brand);
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
      if (DOMESTIC_CATEGORIES.includes(data.category)) setDCategory(data.category);
    }
    if (data.isChineseBrand !== undefined) {
      setChannel(data.isChineseBrand ? "domestic" : "international");
    }
  };

  const channelTabs: { key: Channel; label: string; icon: typeof Zap }[] = [
    { key: "domestic", label: "国产估值", icon: Zap },
    { key: "international", label: "国际估值", icon: Globe },
    { key: "export", label: "出口估值", icon: Ship },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href={`/${locale}/services`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        返回服务首页
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 inline-flex rounded-lg bg-primary-100 p-3 text-primary-600">
          <Brain className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">AI智能估价</h1>
        <p className="mt-2 text-gray-500">
          AI多模态识别，覆盖国产/国际/出口三大通道
        </p>
      </div>

      {/* Mode Selector */}
      <div className="mb-6 flex gap-2 rounded-xl bg-white p-2 shadow-sm">
        <button
          onClick={() => setMode("quick")}
          className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-all ${
            mode === "quick" ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Zap className="mr-1 inline h-4 w-4" />
          快速估价
          <span className="ml-1 text-xs opacity-70">免费 · 秒级</span>
        </button>
        <button
          onClick={() => setMode("deep")}
          className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-all ${
            mode === "deep" ? "bg-purple-600 text-white" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <FileText className="mr-1 inline h-4 w-4" />
          深度报告
          <span className="ml-1 text-xs opacity-70">¥9-29 · 30秒</span>
        </button>
      </div>

      {/* AI Recognition (shared) */}
      <div className="mb-6">
        <AIRecognizeSection onRecognized={handleRecognized} channel={channel} />
      </div>

      {mode === "quick" && (
        <>
          {/* Channel Tabs */}
          <div className="mb-6 flex gap-2 rounded-xl bg-white p-2 shadow-sm">
            {channelTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setChannel(tab.key); setResult(null); setArbitrage(null); }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                    channel === tab.key
                      ? "bg-primary-600 text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="mr-1 inline h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Domestic Form */}
          {channel === "domestic" && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="border-b border-gray-100 pb-3 text-base font-semibold text-gray-800">
                国产农机参数
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">机具品类</label>
                  <select
                    value={dCategory} onChange={(e) => setDCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    {DOMESTIC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">品牌</label>
                  <select
                    value={dBrand} onChange={(e) => setDBrand(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    {DOMESTIC_BRAND_LIST.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">马力 (HP)</label>
                  <input
                    type="number" value={dHP} min={50} max={500}
                    onChange={(e) => setDHP(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  <input
                    type="range" value={dHP} min={50} max={500}
                    onChange={(e) => setDHP(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">使用年限</label>
                  <input
                    type="number" value={dYears} min={0} max={30}
                    onChange={(e) => setDYears(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  <input
                    type="range" value={dYears} min={0} max={30}
                    onChange={(e) => setDYears(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">区域</label>
                  <select
                    value={dRegion} onChange={(e) => setDRegion(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    {DOMESTIC_REGIONS_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">购机年份</label>
                  <select
                    value={dYear} onChange={(e) => setDYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    {[2022, 2023, 2024, 2025].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">卖家报价 (可选)</label>
                  <input
                    type="number" value={dSellerPrice} placeholder="单位: 元"
                    onChange={(e) => setDSellerPrice(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 实时基准价预览 */}
              <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
                <span className="text-xs text-blue-600">
                  新机基准价（{dBrand} 回归模型）
                </span>
                <span className="text-lg font-bold text-blue-700">
                  {formatMoney(previewBasePrice)}
                </span>
              </div>

              <button
                onClick={doValuation}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                {loading ? "正在估值..." : "开始AI估价"}
              </button>
            </div>
          )}

          {/* International Form */}
          {channel === "international" && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="border-b border-gray-100 pb-3 text-base font-semibold text-gray-800">
                国际农机参数
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">品牌</label>
                  <select
                    value={iBrand} onChange={(e) => setIBrand(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    {INTL_BRAND_LIST.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">马力 (HP)</label>
                  <input type="number" value={iHP} min={50} max={500}
                    onChange={(e) => setIHP(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                  <input type="range" value={iHP} min={50} max={500}
                    onChange={(e) => setIHP(Number(e.target.value))}
                    className="mt-1 w-full" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">使用小时数</label>
                  <input type="number" value={iHours} min={0} max={20000} step={100}
                    onChange={(e) => setIHours(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                  <input type="range" value={iHours} min={0} max={20000} step={100}
                    onChange={(e) => setIHours(Number(e.target.value))}
                    className="mt-1 w-full" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">新机价格 (元)</label>
                  <input type="number" value={iNewPrice} min={10000}
                    onChange={(e) => setINewPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">区域</label>
                  <select value={iRegion} onChange={(e) => setIRegion(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {Object.keys(INTL_REGIONS).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">购机年份</label>
                  <select value={iYear} onChange={(e) => setIYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {[2022, 2023, 2024, 2025].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">状况</label>
                  <div className="flex gap-1">
                    {Object.keys(INTL_CONDITIONS).map((c) => (
                      <button key={c} onClick={() => setICondition(c)}
                        className={`flex-1 rounded-md py-2 text-xs font-medium ${
                          iCondition === c ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"
                        }`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">排放标准</label>
                  <select value={iEmission} onChange={(e) => setIEmission(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                    {Object.keys(EMISSION_DEVELOPED).map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">配置增值 (元)</label>
                  <input type="number" value={iConfigAddon} min={0}
                    onChange={(e) => setIConfigAddon(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                </div>
              </div>

              <button
                onClick={doValuation}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                {loading ? "正在估值..." : "开始AI估价"}
              </button>
            </div>
          )}

          {/* Export Form */}
          {channel === "export" && (
            <div className="space-y-4">
              {/* 复用国际参数表单 */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="border-b border-gray-100 pb-3 text-base font-semibold text-gray-800">
                  出口农机参数
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">品牌</label>
                    <select value={iBrand} onChange={(e) => setIBrand(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                      {INTL_BRAND_LIST.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">马力 (HP)</label>
                    <input type="number" value={iHP} min={50} max={500}
                      onChange={(e) => setIHP(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                    <input type="range" value={iHP} min={50} max={500}
                      onChange={(e) => setIHP(Number(e.target.value))}
                      className="mt-1 w-full" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">使用小时数</label>
                    <input type="number" value={iHours} min={0} max={20000} step={100}
                      onChange={(e) => setIHours(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                    <input type="range" value={iHours} min={0} max={20000} step={100}
                      onChange={(e) => setIHours(Number(e.target.value))}
                      className="mt-1 w-full" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">新机价格 (元)</label>
                    <input type="number" value={iNewPrice} min={10000}
                      onChange={(e) => setINewPrice(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">目标国家</label>
                    <select value={eTargetCountry} onChange={(e) => setETargetCountry(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                      {Object.keys(EXPORT_COUNTRIES).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">状况</label>
                    <div className="flex gap-1">
                      {Object.keys(INTL_CONDITIONS).map((c) => (
                        <button key={c} onClick={() => setICondition(c)}
                          className={`flex-1 rounded-md py-2 text-xs font-medium ${
                            iCondition === c ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"
                          }`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">排放标准</label>
                    <select value={iEmission} onChange={(e) => setIEmission(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                      {Object.keys(EMISSION_DEVELOPED).map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">运费 (元)</label>
                    <input type="number" value={eShipping} min={0}
                      onChange={(e) => setEShipping(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">关税率</label>
                    <input type="number" value={eTariff} min={0} max={1} step={0.01}
                      onChange={(e) => setETariff(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                  </div>
                </div>

                <button
                  onClick={doValuation}
                  disabled={loading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ship className="h-4 w-4" />}
                  {loading ? "正在计算..." : "计算出口套利"}
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-6 space-y-4 animate-in">
              {/* Main Result */}
              <div className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <ConfidenceGauge value={result.confidence} />
                <div className="flex-1">
                  <div className="text-sm text-gray-500">AI估值结果</div>
                  <div className="text-3xl font-bold text-primary-700">
                    {formatMoney(result.value)}
                  </div>
                  {dSellerPrice && channel === "domestic" && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-400">卖家报价:</span>
                      <span className="text-sm font-medium text-gray-700">
                        {formatMoney(Number(dSellerPrice))}
                      </span>
                      {Number(dSellerPrice) > result.value && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                          偏高 {Math.round(((Number(dSellerPrice) - result.value) / result.value) * 100)}%
                        </span>
                      )}
                      {Number(dSellerPrice) <= result.value && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                          合理/偏低
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Calculation Breakdown */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h4 className="mb-3 text-sm font-semibold text-gray-700">计算过程</h4>
                <div className="space-y-2">
                  {result.breakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-gray-500">{item.label}</span>
                        {item.detail && <span className="ml-2 text-xs text-gray-400">{item.detail}</span>}
                      </div>
                      <span className="font-medium text-gray-800">{item.value}</span>
                    </div>
                  ))}
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <div className="mb-1 text-xs font-medium text-gray-400">估值公式</div>
                    <div className="font-mono text-xs text-gray-600">{result.formula}</div>
                  </div>
                </div>
              </div>

              {/* Export Arbitrage */}
              {arbitrage && (
                <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 p-6 text-white shadow-lg">
                  <div className="mb-1 text-sm opacity-80">出口套利分析 · {eTargetCountry}</div>
                  <div className="mb-4 text-4xl font-bold tracking-tight">
                    {formatMoney(arbitrage.profit)}
                  </div>
                  <div className="mb-2 text-sm opacity-80">
                    利润率 <span className="font-bold">{arbitrage.profitRate.toFixed(1)}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {arbitrage.breakdown.map((item, i) => (
                      <div key={i} className="text-center">
                        <div className="text-xs opacity-70">{item.label}</div>
                        <div className="text-sm font-semibold">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
                  <div className="mb-2 flex items-center gap-1 text-sm font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    风险提示
                  </div>
                  {result.warnings.map((w, i) => (
                    <div key={i} className="text-xs text-amber-600">• {w}</div>
                  ))}
                </div>
              )}

              {/* Deep Report Section (paid, three tiers) */}
              <DeepReportSection
                brand={channel === "domestic" ? dBrand : iBrand}
                model={channel === "domestic" ? `${dBrand} ${dCategory}` : iBrand}
                year={channel === "domestic" ? dYear - dYears : iYear}
                horsepower={channel === "domestic" ? dHP : iHP}
                category={dCategory}
                valuationResult={result ? {
                  estimatedValue: result.value,
                  confidenceScore: result.confidence / 100,
                } : null}
                locale={locale}
                showPublishButton={true}
              />
            </div>
          )}
        </>
      )}

      {mode === "deep" && (
        <DeepAnalysisSection
          prefillData={{
            brand: channel === "domestic" ? dBrand : iBrand,
            category: dCategory,
            year: channel === "domestic" ? dYear - dYears : iYear,
            horsepower: channel === "domestic" ? dHP : iHP,
          }}
        />
      )}

      {/* Disclaimer */}
      <div className="mt-8 text-center text-xs leading-relaxed text-gray-400">
        <strong className="text-gray-500">免责声明：</strong>
        本估值引擎基于AI多模态识别与市场模型估算，仅供决策参考，不构成投资或交易建议。
        实际成交价格受车况、市场供需、谈判等多重因素影响，可能存在偏差。
      </div>
    </div>
  );
}
