"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLocale } from "next-intl";
import {
  Brain, Loader2, Calculator, ArrowLeft, Upload, Camera,
  Sparkles, TrendingUp, AlertTriangle, FileText, ChevronRight,
  Zap, Globe, Ship, CheckCircle2, XCircle,
} from "lucide-react";
import Link from "next/link";
import { PublishCta } from "@/components/valuation/publish-cta";
import AnalysisReportView from "@/components/valuation/analysis-report-view";
import ValuationReportSection from "@/components/valuation/valuation-report-section";
import ValuationResultGate, { type BlurredValuation } from "@/components/valuation/valuation-result-gate";
import {
  DOMESTIC_HP_REGRESSION,
  DOMESTIC_BRAND_PREMIUM,
  BRAND_COEFFICIENTS,
  REGIONAL_FACTORS,
  SUBSIDY_TREND_FACTOR,
  isDomesticBrandSupported,
  getRegionalFactor,
  getSubsidyTrendFactor,
} from "@/lib/valuation/brand-data";
import type { ValuationIntelligence } from "@/lib/valuation/intelligence";
import ValuationReportPro from "@/components/valuation/valuation-report-pro";

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

// 国产品牌列表：手写常用17个 + 估值引擎支持的全部品牌(DOMESTIC_BRAND_PREMIUM 键)合并去重
const DOMESTIC_BRAND_LIST = Array.from(new Set([
  "东方红", "雷沃", "潍柴雷沃", "中联", "道依茨法尔",
  "东风", "常发", "英轩", "沃得", "时风",
  "悍沃", "悦达", "五征", "萨丁", "泰山",
  "华夏", "其他国产",
  ...Object.keys(DOMESTIC_BRAND_PREMIUM),
]));

// 国际品牌列表：手写常用9个 + 估值引擎 BRAND_COEFFICIENTS 的英文键（过滤中文键和通用标签）
const INTL_BRAND_LIST = Array.from(new Set([
  "John Deere", "Kubota", "Case IH", "New Holland",
  "CLAAS", "Fendt", "Massey Ferguson", "Valtra", "其他国际",
  ...Object.keys(BRAND_COEFFICIENTS).filter(
    (b) => !/[\u4e00-\u9fa5]/.test(b) && b !== "进口" && b !== "Imported"
  ),
]));

// 国际品牌保值率/价值系数（2026-10-15 按引擎 BRAND_COEFFICIENTS 补齐 Phase B+P2 长尾；
// 上方既有 9 项为页面历史口径，保持不变以免影响存量估值——additive-only）
const INTL_BRAND_COEFFICIENTS: Record<string, number> = {
  "John Deere": 1.15, "Kubota": 1.10, "Fendt": 1.085, "CLAAS": 1.08,
  "Case IH": 1.00, "New Holland": 0.95, "Massey Ferguson": 0.92,
  "Valtra": 0.90, "其他国际": 0.95,
  // === 引擎 Phase B/P2 补齐（值取自 brand-data.ts BRAND_COEFFICIENTS）===
  "Krone": 1.25, "Orkel": 1.15, "Manitou": 1.10, "Kuhn": 1.00, "Grimme": 0.95,
  "Amazone": 1.15, "Horsch": 1.15, "Väderstad": 1.15, "Vaderstad": 1.15,
  "McHale": 1.15, "Lamborghini": 1.10, "Pöttinger": 1.10, "Pottinger": 1.10,
  "Deutz-Fahr": 1.05, "Yanmar": 0.95, "SAME": 1.00, "Hardi": 1.00, "Mahindra": 0.88,
  "Zetor": 0.90, "MTZ": 0.85, "Rostselmash": 0.88, "Sampo": 0.95, "Jacto": 0.85,
  "Iseki": 0.90, "Mitsubishi": 0.90, "BCS": 0.90, "Goldoni": 0.92, "Vermeer": 0.95,
  "Kongskilde": 0.80, "Arcusin": 0.75, "arcusln": 0.75, "IDASS": 0.70,
  // 国产英文键（本就经 INTL_BRAND_LIST 进入国际下拉，此前静默走 0.95 默认）
  "Dongfanghong": 0.65, "Mushen": 0.60, "Dexiang": 0.50, "Yingjia": 0.50, "RSM": 0.45,
};

// 国际品牌保值率
const INTL_BRAND_RETENTION: Record<string, number> = {
  "John Deere": 1.15, "Kubota": 1.10, "Fendt": 1.085, "CLAAS": 1.08,
  "Case IH": 1.00, "New Holland": 0.95, "Massey Ferguson": 0.92,
  "Valtra": 0.90, "其他国际": 0.95,
  // === 引擎 Phase B/P2 补齐（值同上表，未补齐前这些品牌静默走 0.95 默认）===
  "Krone": 1.25, "Orkel": 1.15, "Manitou": 1.10, "Kuhn": 1.00, "Grimme": 0.95,
  "Amazone": 1.15, "Horsch": 1.15, "Väderstad": 1.15, "Vaderstad": 1.15,
  "McHale": 1.15, "Lamborghini": 1.10, "Pöttinger": 1.10, "Pottinger": 1.10,
  "Deutz-Fahr": 1.05, "Yanmar": 0.95, "SAME": 1.00, "Hardi": 1.00, "Mahindra": 0.88,
  "Zetor": 0.90, "MTZ": 0.85, "Rostselmash": 0.88, "Sampo": 0.95, "Jacto": 0.85,
  "Iseki": 0.90, "Mitsubishi": 0.90, "BCS": 0.90, "Goldoni": 0.92, "Vermeer": 0.95,
  "Kongskilde": 0.80, "Arcusin": 0.75, "arcusln": 0.75, "IDASS": 0.70,
  "Dongfanghong": 0.65, "Mushen": 0.60, "Dexiang": 0.50, "Yingjia": 0.50, "RSM": 0.45,
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

// 国产品况系数（与 brand-data.ts 的 CONDITION_FACTORS 对齐：excellent/good/fair/poor）
const DOMESTIC_CONDITIONS: { key: string; label: string }[] = [
  { key: "excellent", label: "优秀" },
  { key: "good", label: "良好" },
  { key: "fair", label: "一般" },
  { key: "poor", label: "较差" },
];

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

// 出口目标国 buy/sell 系数（2026-10-15 扩至六大区域全覆盖 58 国；
// buy=相对中国基准价的当地收购折扣，sell=当地售价溢价；既有 19 国数值不变——additive-only）
const EXPORT_COUNTRIES: Record<string, { buy: number; sell: number }> = {
  // ── 中东欧与巴尔干（欧盟/候选国，农机需求旺、当地旧机价格低）──
  "波兰": { buy: 0.72, sell: 1.15 }, "罗马尼亚": { buy: 0.70, sell: 1.18 },
  "匈牙利": { buy: 0.70, sell: 1.15 }, "捷克": { buy: 0.72, sell: 1.12 },
  "塞尔维亚": { buy: 0.68, sell: 1.20 }, "保加利亚": { buy: 0.68, sell: 1.18 },
  "克罗地亚": { buy: 0.72, sell: 1.12 }, "立陶宛": { buy: 0.70, sell: 1.15 },
  "斯洛伐克": { buy: 0.70, sell: 1.12 }, "波黑": { buy: 0.65, sell: 1.22 },
  "北马其顿": { buy: 0.65, sell: 1.22 }, "希腊": { buy: 0.70, sell: 1.15 },
  // ── 俄语区与中亚 ──
  "俄罗斯": { buy: 0.85, sell: 1.25 }, "哈萨克斯坦": { buy: 0.82, sell: 1.28 },
  "乌兹别克斯坦": { buy: 0.82, sell: 1.28 }, "乌克兰": { buy: 0.55, sell: 1.30 },
  "白俄罗斯": { buy: 0.60, sell: 1.22 }, "吉尔吉斯斯坦": { buy: 0.80, sell: 1.28 },
  "格鲁吉亚": { buy: 0.72, sell: 1.28 }, "摩尔多瓦": { buy: 0.62, sell: 1.25 },
  // ── 南美 ──
  "阿根廷": { buy: 0.75, sell: 1.40 }, "巴西": { buy: 0.78, sell: 1.35 },
  "智利": { buy: 0.78, sell: 1.30 }, "乌拉圭": { buy: 0.75, sell: 1.35 },
  "巴拉圭": { buy: 0.72, sell: 1.38 }, "哥伦比亚": { buy: 0.72, sell: 1.35 },
  "秘鲁": { buy: 0.72, sell: 1.35 },
  // ── 非洲 ──
  "尼日利亚": { buy: 0.70, sell: 1.50 }, "南非": { buy: 0.75, sell: 1.35 },
  "肯尼亚": { buy: 0.72, sell: 1.45 }, "加纳": { buy: 0.72, sell: 1.45 },
  "埃及": { buy: 0.72, sell: 1.35 }, "埃塞俄比亚": { buy: 0.68, sell: 1.45 },
  "坦桑尼亚": { buy: 0.70, sell: 1.42 }, "赞比亚": { buy: 0.70, sell: 1.42 },
  "摩洛哥": { buy: 0.72, sell: 1.32 }, "塞内加尔": { buy: 0.70, sell: 1.42 },
  "安哥拉": { buy: 0.72, sell: 1.40 }, "莫桑比克": { buy: 0.70, sell: 1.42 },
  // ── 东南亚与南亚 ──
  "泰国": { buy: 0.80, sell: 1.30 }, "越南": { buy: 0.80, sell: 1.32 },
  "菲律宾": { buy: 0.80, sell: 1.32 }, "缅甸": { buy: 0.75, sell: 1.40 },
  "柬埔寨": { buy: 0.75, sell: 1.40 }, "印度尼西亚": { buy: 0.78, sell: 1.30 },
  "马来西亚": { buy: 0.80, sell: 1.25 }, "老挝": { buy: 0.75, sell: 1.35 },
  "孟加拉国": { buy: 0.75, sell: 1.32 },
  // ── 中东 ──
  "巴基斯坦": { buy: 0.78, sell: 1.35 }, "伊朗": { buy: 0.80, sell: 1.30 },
  "伊拉克": { buy: 0.80, sell: 1.30 }, "沙特阿拉伯": { buy: 0.85, sell: 1.25 },
  "阿联酋": { buy: 0.85, sell: 1.25 }, "土耳其": { buy: 0.75, sell: 1.25 },
  "以色列": { buy: 0.82, sell: 1.22 }, "约旦": { buy: 0.78, sell: 1.28 },
  "卡塔尔": { buy: 0.82, sell: 1.25 }, "科威特": { buy: 0.82, sell: 1.25 },
};

// 出口国家下拉分组（与 EXPORT_COUNTRIES 键一一对应，供 optgroup 渲染）
const EXPORT_REGION_GROUPS: { region: string; countries: string[] }[] = [
  { region: "中东欧与巴尔干", countries: ["波兰", "罗马尼亚", "匈牙利", "捷克", "塞尔维亚", "保加利亚", "克罗地亚", "立陶宛", "斯洛伐克", "波黑", "北马其顿", "希腊"] },
  { region: "俄语区与中亚", countries: ["俄罗斯", "哈萨克斯坦", "乌兹别克斯坦", "乌克兰", "白俄罗斯", "吉尔吉斯斯坦", "格鲁吉亚", "摩尔多瓦"] },
  { region: "南美", countries: ["阿根廷", "巴西", "智利", "乌拉圭", "巴拉圭", "哥伦比亚", "秘鲁"] },
  { region: "非洲", countries: ["尼日利亚", "南非", "肯尼亚", "加纳", "埃及", "埃塞俄比亚", "坦桑尼亚", "赞比亚", "摩洛哥", "塞内加尔", "安哥拉", "莫桑比克"] },
  { region: "东南亚与南亚", countries: ["泰国", "越南", "菲律宾", "缅甸", "柬埔寨", "印度尼西亚", "马来西亚", "老挝", "孟加拉国"] },
  { region: "中东", countries: ["巴基斯坦", "伊朗", "伊拉克", "沙特阿拉伯", "阿联酋", "土耳其", "以色列", "约旦", "卡塔尔", "科威特"] },
];

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
  onImagesChange,
  channel,
}: {
  onRecognized: (data: RecognizeResult) => void;
  onImagesChange?: (images: string[]) => void;
  channel: Channel;
}) {
  const MAX_IMAGES = 5;
  const locale = useLocale();
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecognizeResult | null>(null);
  // AI 智能识别已强制登录：needLogin = 静默探测到游客；loginUrl = 登录引导入口
  const [needLogin, setNeedLogin] = useState(false);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const LOGIN_TIP = "请先登录后再使用 AI 智能识别";

  // 静默探测登录态：只有服务端明确返回「未登录」才拦截，
  // 网络异常/未知响应一律放行（仍会由 401 兜底引导），避免误伤已登录用户。
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (!cancelled && res.status === 401) setNeedLogin(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 前端压缩：手机原图 base64 后易超 Vercel 4.5MB 请求体上限，压到长边1280px JPEG
  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_EDGE = 1280;
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setError("");
    // 游客：上传前就给登录引导，不必等压缩+识别跑完才报错
    if (needLogin) {
      setError(LOGIN_TIP);
      setLoginUrl(`/${locale}/auth/login?redirect=${encodeURIComponent(`/${locale}/services/valuation`)}`);
      return;
    }
    const compressed: string[] = [];
    for (const file of list) {
      if (imagePreviews.length + compressed.length >= MAX_IMAGES) break;
      try {
        compressed.push(await compressImage(file));
      } catch {
        // 单张压缩失败跳过，不阻塞其他图
      }
    }
    if (compressed.length === 0) {
      setError("图片处理失败，请换一张试试");
      return;
    }
    const next = [...imagePreviews, ...compressed].slice(0, MAX_IMAGES);
    setImagePreviews(next);
    onImagesChange?.(next); // 同步给父级（深度报告复用同一批图片）
    // 自动识别当前全部图片
    doRecognize(next);
  }, [imagePreviews, needLogin, locale]);

  const removeImage = (idx: number) => {
    const next = imagePreviews.filter((_, i) => i !== idx);
    setImagePreviews(next);
    onImagesChange?.(next);
    if (next.length > 0 && !needLogin) doRecognize(next);
    else if (next.length === 0) { setResult(null); setError(""); }
  };

  const doRecognize = async (dataUris: string[]) => {
    if (dataUris.length === 0) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/agents/seller-helper/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUris: dataUris,
          isChineseBrand: channel === "domestic",
        }),
      });
      const data = await res.json();
      // 强制登录：后端未登录返回 401 / LOGIN_REQUIRED → 明确提示 + 登录入口
      if (res.status === 401 || data.code === "LOGIN_REQUIRED") {
        setNeedLogin(true);
        setError(LOGIN_TIP);
        setLoginUrl(data.loginUrl || `/${locale}/auth/login?redirect=${encodeURIComponent(`/${locale}/services/valuation`)}`);
        return;
      }
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
        <span className="text-xs text-gray-400">上传3-5张照片自动填写参数</span>
      </div>

      {needLogin && !result && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-white p-3 text-xs text-gray-700">
          <span>AI智能识别需登录后使用（按实际消耗计费）。</span>
          <Link
            href={`/${locale}/auth/login?redirect=${encodeURIComponent(`/${locale}/services/valuation`)}`}
            className="rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
          >
            登录后使用
          </Link>
          <Link href={`/${locale}/auth/register`} className="text-blue-600 underline hover:text-blue-700">
            还没有账号？免费注册
          </Link>
          <span className="text-gray-400">未登录也可手动填写下方参数估值。</span>
        </div>
      )}

      {imagePreviews.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {imagePreviews.map((src, idx) => (
            <div key={idx} className="group relative">
              <img src={src} alt={`照片${idx + 1}`} className="h-20 w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800/80 text-xs text-white hover:bg-red-600"
                aria-label="删除图片"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files); }}
      >
        {imagePreviews.length === 0 && (
          <>
            <Camera className="mx-auto mb-2 h-10 w-10 text-gray-400" />
            <p className="text-sm text-gray-500">点击拍照或拖拽图片到此处（可多选）</p>
            <p className="mt-1 text-xs text-gray-400">建议3-5张：铭牌、整机、驾驶室、轮胎底盘，AI识别更准</p>
          </>
        )}
        {imagePreviews.length > 0 && imagePreviews.length < MAX_IMAGES && (
          <p className="text-xs text-blue-500">继续点击可追加照片（{imagePreviews.length}/{MAX_IMAGES}）</p>
        )}
        {imagePreviews.length >= MAX_IMAGES && (
          <p className="text-xs text-gray-400">已达{MAX_IMAGES}张上限，删除后可再添加</p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = ""; // 允许重复选择同一文件
          }}
        />
      </div>

      {loading && (
        <div className="mt-3 flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-sm text-gray-500">AI识别中（{imagePreviews.length}张照片，约10-20秒）...</span>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          {error}
          {loginUrl && (
            <Link
              href={loginUrl}
              className="ml-2 inline-block rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
            >
              立即登录
            </Link>
          )}
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
            onClick={() => {
              if (result) onRecognized(result);
              document.getElementById("valuation-form-anchor")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            参数已自动填入 · 点击查看下方表单 ↓
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
  images = [],
}: {
  prefillData: { brand?: string; category?: string; year?: number; horsepower?: number };
  images?: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [structured, setStructured] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  // 本次深度分析的 token 计费摘要（API 返回 pointsCharged / creditsBalance）
  const [consumption, setConsumption] = useState<{ points: number; balance?: number } | null>(null);
  const locale = useLocale();

  const runDeepAnalysis = async () => {
    setLoading(true);
    setError("");
    setReport(null);
    setStructured(null);
    setLocked(false);
    setInsufficientCredits(false);
    setConsumption(null);
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
          // 复用上方 AI 识别区已上传的图片（压缩后的 dataURI），报告可结合照片分析
          imageDataUris: images.slice(0, 3),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReport(data.data?.analysis || "");
        setStructured(data.data?.structured || null);
        setLocked(true);
        // token 计费可见化：本次按 LLM 真实用量 ×2 扣的积分与扣后余额
        if (typeof data.data?.pointsCharged === "number") {
          setConsumption({ points: data.data.pointsCharged, balance: data.data?.creditsBalance });
        }
      } else {
        if (data.code === "INSUFFICIENT_CREDITS") setInsufficientCredits(true);
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
          <h3 className="text-sm font-semibold text-gray-800">AI 深度分析报告</h3>
        </div>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        包含：六维度现状评估 · 技术参数 · 操作维修 · 车况评估 · 购买建议 · 资源文档（按大模型 token 消耗 ×2 计费）
      </p>

      {!report && !loading && (
        <>
          <button
            onClick={runDeepAnalysis}
            disabled={images.length === 0}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 py-3 text-sm font-medium text-white transition-all hover:from-purple-700 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="mr-1 inline h-4 w-4" />
            AI深度分析
          </button>
          {images.length === 0 ? (
            <p className="mt-2 text-xs text-amber-600">
              请先在上方「AI智能识别」上传至少一张机器照片——报告会直接复用这批照片，无需重复上传
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-400">
              将结合你上传的 {Math.min(images.length, 3)} 张照片生成报告
            </p>
          )}
        </>
      )}

      {loading && (
        <div className="flex flex-col items-center py-8">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm text-gray-500">AI正在生成深度分析报告（约30-60秒）...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
          {(insufficientCredits || error.includes("积分不足")) && (
            <a
              href={`/${locale}/credits`}
              className="ml-2 inline-block rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700"
            >
              去充值
            </a>
          )}
        </div>
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
          />
          {/* token 计费可见化：本次消耗 / 剩余积分 + 充值入口 */}
          {consumption && (
            <div className="flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-700">
              <span>
                本次消耗 <b className="text-sm">{consumption.points}</b> 积分（按大模型 token 实际用量 ×2 计费）
                {consumption.balance != null && <> · 剩余 <b>{consumption.balance}</b> 积分</>}
              </span>
              <a href={`/${locale}/credits`} className="font-medium underline">积分中心</a>
            </div>
          )}
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
  const [dModel, setDModel] = useState("");
  const [dHP, setDHP] = useState(120);
  const [dYears, setDYears] = useState(3);
  const [dHours, setDHours] = useState(1500);
  const [dCondition, setDCondition] = useState("good");
  const [dRegion, setDRegion] = useState("山东");
  const [dYear, setDYear] = useState(2024);
  const [dSellerPrice, setDSellerPrice] = useState("");

  // 识别填入成功提示
  const [prefillTip, setPrefillTip] = useState("");
  // AI 识别区已上传的图片（压缩 dataURI），深度报告复用
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  // 识别到品牌库未收录品牌（如"铁牛"）时动态加入下拉选项；估值走通用兜底模型
  const [extraDBrands, setExtraDBrands] = useState<string[]>([]);
  const [extraIBrands, setExtraIBrands] = useState<string[]>([]);

  // 国际参数
  const [iBrand, setIBrand] = useState("John Deere");
  const [iModel, setIModel] = useState("");
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
    channelPrices?: Record<string, number>;
  } | null>(null);

  // 顶真实交易情报（/api/valuation 返回，服务端按 品牌/品类/型号/省份 切片）
  const [intel, setIntel] = useState<ValuationIntelligence | null>(null);

  const [arbitrage, setArbitrage] = useState<{
    totalCost: number; exportPrice: number; profit: number;
    profitRate: number; breakdown: { label: string; value: string }[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [hasImage, setHasImage] = useState(false);

  // ── P0 留资引擎：游客模糊区间结果 / 429 限流 / 解锁成功状态 ──
  const [gateData, setGateData] = useState<BlurredValuation | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  // 本次估值的 token 计费摘要（/api/valuation 的 billing 字段；无 LLM 用量时为 null）
  const [valuationBilling, setValuationBilling] = useState<{
    points: number; balance?: number;
  } | null>(null);

  // 实时预览基准价
  const previewBasePrice = channel === "domestic"
    ? calcDomesticBasePrice(dBrand, dHP)
    : iNewPrice;

  // 执行估值
  const doValuation = async () => {
    setLoading(true);
    setValuationBilling(null);
    try {
      if (channel === "domestic") {
        // 调用网站API进行完整估值
        // 注意：workingHours 只传用户真实工时，缺失即传 undefined。
        // 「缺工时按品类年均强度合成」已下沉到估值引擎 calcCombinedDepreciation（唯一真源），
        // 组件层不得再做任何工时推算，否则会与产品页 API 路径产生两套口径。
        const res = await fetch("/api/valuation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: dBrand,
            category: dCategory,
            year: dYear - dYears,
            workingHours: dHours && dHours > 0 ? dHours : undefined,
            condition: dCondition,
            enginePower: dHP,
            priceCny: dSellerPrice ? Number(dSellerPrice) : undefined,
            region: dRegion,
            useV4: true,
            skipImageAnalysis: !hasImage,
          }),
        });

        // ── P0 留资引擎：游客 429（每日限 3 次已用完）→ 渲染留资引导 ──
        if (res.status === 429) {
          setLimitReached(true);
          setGateData(null);
          setResult(null);
          return;
        }

        // body 只能读一次：先取出再分支，避免二次 res.json() 报
        // "body stream already read" 导致结果区卡死。
        const data = await res.json().catch(() => null);

        if (!data) {
          doClientCalc();
          return;
        }
        if (data.success) {
          // ── P0 留资引擎：游客模糊区间结果 → 渲染解锁卡片 ──
          if (data.blurred === true) {
            const r = data.data;
            setGateData({
              priceLow: r.priceLow,
              priceHigh: r.priceHigh,
              priceMid: r.priceMid,
              confidence: r.confidence,
            });
            setLimitReached(false);
            setIntel(data.intelligence ?? null);
            setResult(null);
            return;
          }

          // 登录用户（blurred: false）：照旧展示精确结果
          setGateData(null);
          setLimitReached(false);
          const r = data.data;
          setIntel(data.intelligence ?? null);
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
            channelPrices: (r as { channelPrices?: Record<string, number> }).channelPrices,
          });
          // token 计费可见化：本次估值按 LLM 真实用量扣了多少积分（无 LLM 用量时后端不返回）
          const billing = (data as { billing?: { points?: number; balance?: number } }).billing;
          if (billing && typeof billing.points === "number" && billing.points > 0) {
            setValuationBilling({ points: billing.points, balance: billing.balance });
          }
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

  // ── P0 留资引擎：解锁成功 → 服务端返回的精确估值映射为页面结果视图 ──
  const handleUnlocked = (precise: Record<string, unknown>) => {
    const r = precise as {
      estimatedValue?: number;
      confidenceScore?: number;
      details?: { label?: string; value?: string; description?: string }[];
      analysis?: string;
    };
    setResult({
      value: r.estimatedValue ?? 0,
      confidence: r.confidenceScore != null ? Math.round(r.confidenceScore * 100) : 80,
      breakdown: (r.details || []).map((d) => ({
        label: d.label ?? "",
        value: d.value ?? "",
        detail: d.description ?? "",
      })),
      formula: r.analysis || "",
      warnings: [],
      channelPrices: (precise as { channelPrices?: Record<string, number> }).channelPrices,
    });
    setGateData(null);
    setLimitReached(false);
    setUnlocked(true);
  };

  // 品类别名：AI 识别结果 → 表单标准名
  const CATEGORY_ALIASES: Record<string, string> = {
    "大型大马力拖拉机": "轮式拖拉机", "大马力拖拉机": "轮式拖拉机",
    "拖拉机": "轮式拖拉机", "轮拖": "轮式拖拉机",
    "收割机": "谷物联合收割机", "谷物收割机": "谷物联合收割机",
    "小麦收割机": "谷物联合收割机", "水稻收割机": "谷物联合收割机",
    "玉米机": "玉米收获机", "玉米收割机": "玉米收获机",
    "青储机": "青储机", "青饲料收获机": "青储机", "青贮收获机": "青储机",
    "青贮机": "青储机", "青贮饲料收获机": "青储机",
    "播种机": "单粒精密播种机", "免耕播种机": "单粒精密播种机",
    "打捆机": "打捆机", "旋耕播种机": "旋耕机",
    "微耕机": "微型耕耘机", "秸秆还田机": "秸秆粉碎还田机",
  };

  // 从型号推断马力：国产拖拉机型号惯例(如 TTQ2004/LX2204/RD1804)→ 数字÷10
  const inferHPFromModel = (modelName: string): number | null => {
    if (!modelName) return null;
    const m = modelName.replace(/\s/g, "").match(/(\d{3,4})/);
    if (!m) return null;
    const hp = Math.round(parseInt(m[1], 10) / 10);
    return hp >= 20 && hp <= 500 ? hp : null;
  };

  // ── P0 留资引擎：当前表单的估值参数（unlock 接口用于服务端重算精确值）──
  const getValuationParams = (): Record<string, unknown> => ({
    brand: dBrand,
    category: dCategory,
    year: dYear - dYears,
    workingHours: dHours || dYears * 500,
    condition: dCondition,
    enginePower: dHP,
    priceCny: dSellerPrice ? Number(dSellerPrice) : undefined,
  });

  const handleRecognized = (data: RecognizeResult) => {
    setHasImage(true);
    let filled = 0;
    let brandSkipped = "";

    if (data.brand) {
      const brand = String(data.brand).trim();
      if (data.isChineseBrand === false) {
        // 国际：先精确匹配，再查中文别名（克拉斯→CLAAS 等）
        if (INTL_BRAND_LIST.includes(brand)) { setIBrand(brand); filled++; }
        else {
          const aliasEntry = Object.entries(BRAND_COEFFICIENTS).find(
            ([zh]) => zh === brand
          );
          if (aliasEntry) {
            const enKey = aliasEntry[0];
            // 中文键对应的英文键（同系数里找英文名），或直接放英文别名表
            const zh2en: Record<string, string> = {
              "克拉斯": "CLAAS", "约翰迪尔": "John Deere", "芬特": "Fendt",
              "纽荷兰": "New Holland", "凯斯": "Case IH", "库恩": "Kuhn",
              "麦赛弗格森": "Massey Ferguson", "久保田": "Kubota",
            };
            const mapped = zh2en[enKey] ?? zh2en[brand];
            if (mapped && INTL_BRAND_LIST.includes(mapped)) { setIBrand(mapped); filled++; }
            else {
              // 品牌库未收录：仍按识别结果显示（动态加入下拉），估值走通用兜底模型
              setExtraIBrands((prev) => (prev.includes(brand) ? prev : [...prev, brand]));
              setIBrand(brand); filled++;
              brandSkipped = brand;
            }
          } else {
            setExtraIBrands((prev) => (prev.includes(brand) ? prev : [...prev, brand]));
            setIBrand(brand); filled++;
            brandSkipped = brand;
          }
        }
      } else if (DOMESTIC_BRAND_LIST.includes(brand)) {
        setDBrand(brand); filled++;
      } else {
        // 品牌库未收录（如"铁牛"）：仍按识别结果显示，估值走通用兜底模型
        setExtraDBrands((prev) => (prev.includes(brand) ? prev : [...prev, brand]));
        setDBrand(brand); filled++;
        brandSkipped = brand;
      }
    }

    if (data.modelName) {
      const model = String(data.modelName).trim();
      setDModel(model);
      setIModel(model);
      filled++;
    }

    // 马力：优先识别结果，否则从型号推断（TTQ2004→200HP）
    const hp = data.horsepower
      ? Number(data.horsepower)
      : inferHPFromModel(String(data.modelName || ""));
    if (hp && hp >= 20 && hp <= 500) {
      setDHP(hp);
      setIHP(hp);
      filled++;
    }

    if (data.year && data.year >= 2000 && data.year <= 2026) {
      setDYear(data.year);
      setIYear(data.year);
      // 使用年限联动：今年 - 购机年份
      setDYears(Math.min(30, Math.max(0, 2026 - data.year)));
      filled++;
    }

    if (data.category) {
      const cat = String(data.category).trim();
      const mapped = CATEGORY_ALIASES[cat] ?? cat;
      if (DOMESTIC_CATEGORIES.includes(mapped)) { setDCategory(mapped); filled++; }
    }

    if (data.isChineseBrand !== undefined) {
      setChannel(data.isChineseBrand ? "domestic" : "international");
    }

    if (filled > 0 || brandSkipped) {
      const okPart = filled > 0 ? `✅ 已自动填入下方表单（${filled} 项）` : "";
      const warnPart = brandSkipped
        ? `⚠️ 识别品牌「${brandSkipped}」不在估值品牌库，已按通用回归模型估值，建议核对铭牌`
        : "";
      setPrefillTip([okPart, warnPart].filter(Boolean).join("；"));
      setTimeout(() => setPrefillTip(""), 8000);
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
          <span className="ml-1 text-xs opacity-70">AI估值 · 按量计费</span>
        </button>
        <button
          onClick={() => setMode("deep")}
          className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-all ${
            mode === "deep" ? "bg-purple-600 text-white" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <FileText className="mr-1 inline h-4 w-4" />
          深度报告
          <span className="ml-1 text-xs opacity-70">AI深度分析 · 按量计费</span>
        </button>
      </div>

      {/* AI Recognition (shared) */}
      <div className="mb-6">
        <AIRecognizeSection onRecognized={handleRecognized} onImagesChange={setUploadedImages} channel={channel} />
      </div>

      {prefillTip && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {prefillTip}
        </div>
      )}

      {mode === "quick" && (
        <>
          {/* Channel Tabs */}
          <div className="mb-6 flex gap-2 rounded-xl bg-white p-2 shadow-sm">
            {channelTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setChannel(tab.key); setResult(null); setArbitrage(null); setGateData(null); setLimitReached(false); setValuationBilling(null); }}
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
            <div id="valuation-form-anchor" className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
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
                    {[...DOMESTIC_BRAND_LIST, ...extraDBrands].map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">型号 (可选)</label>
                  <input
                    type="text" value={dModel} placeholder="如 TTQ2004 / LX1604"
                    onChange={(e) => setDModel(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
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
                  <label className="mb-1 block text-xs font-medium text-gray-600">使用小时数</label>
                  <input
                    type="number" value={dHours} min={0} max={20000} step={50}
                    onChange={(e) => setDHours(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  <input
                    type="range" value={dHours} min={0} max={20000} step={50}
                    onChange={(e) => setDHours(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">车况</label>
                  <div className="flex gap-1">
                    {DOMESTIC_CONDITIONS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setDCondition(c.key)}
                        className={`flex-1 rounded-md py-2 text-xs font-medium ${
                          dCondition === c.key ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
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
                  新机基准价（{DOMESTIC_HP_REGRESSION[dBrand] ? `${dBrand} 回归模型` : `${dBrand} · 通用回归模型`}）
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
                    {[...INTL_BRAND_LIST, ...extraIBrands].map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">型号 (可选)</label>
                  <input
                    type="text" value={iModel} placeholder="如 8R 410 / CX 8.90"
                    onChange={(e) => setIModel(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
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
                      {[...INTL_BRAND_LIST, ...extraIBrands].map((b) => <option key={b} value={b}>{b}</option>)}
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
                      {EXPORT_REGION_GROUPS.map((g) => (
                        <optgroup key={g.region} label={g.region}>
                          {g.countries.map((c) => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                      ))}
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

          {/* ── P0 留资引擎：游客模糊区间结果（交邮箱解锁精确值）── */}
          {!result && gateData && (
            <div className="mt-6 animate-in">
              <ValuationResultGate
                blurred={gateData}
                valuationParams={getValuationParams()}
                onUnlocked={handleUnlocked}
                variant="gate"
              />
            </div>
          )}

          {/* ── P0 留资引擎：游客 429 限流引导 ── */}
          {!result && !gateData && limitReached && (
            <div className="mt-6 animate-in">
              <ValuationResultGate
                valuationParams={getValuationParams()}
                onUnlocked={handleUnlocked}
                variant="limit"
              />
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

              {/* ── P0 留资引擎：解锁成功后，一键发布出售提升为结果卡片下方第一按钮位 ── */}
              {unlocked && (
                <a
                  href={`/${locale}/seller/products/new?prefill=true&brand=${encodeURIComponent(dBrand)}&model=${encodeURIComponent(`${dBrand} ${dCategory}`)}&category=${encodeURIComponent(dCategory)}&year=${dYear - dYears}&hp=${dHP}`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700"
                >
                  <TrendingUp className="h-4 w-4" />
                  估价后一键发布出售 →
                </a>
              )}

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
                  {/* token 计费可见化：本次估值按 LLM 真实用量 ×2 扣的积分（无 LLM 用量时不展示） */}
                  {valuationBilling && (
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <span>
                        本次消耗 <b className="text-sm">{valuationBilling.points}</b> 积分（按大模型 token 实际用量 ×2 计费）
                        {valuationBilling.balance != null && <> · 剩余 <b>{valuationBilling.balance}</b> 积分</>}
                      </span>
                      <a href={`/${locale}/credits`} className="font-medium underline">积分中心</a>
                    </div>
                  )}
                </div>
              </div>

              {/* ── AI 估值报告：随本次估值自动生成（估值 API 已按大模型 token ×2 计费）── */}
              <ValuationReportSection
                channel={channel}
                meta={{
                  brand: channel === "domestic" ? dBrand : iBrand,
                  category: dCategory,
                  modelName: channel === "domestic" ? dModel : iModel,
                  modelYear: channel === "domestic" ? dYear - dYears : iYear,
                  ageYears: channel === "domestic" ? dYears : undefined,
                  horsepower: channel === "domestic" ? dHP : iHP,
                  hours: channel === "domestic" ? (dHours && dHours > 0 ? dHours : undefined) : iHours,
                  region: channel === "domestic" ? dRegion : iRegion,
                  condition: channel === "domestic" ? "良好" : iCondition,
                  emission: channel !== "domestic" ? iEmission : undefined,
                  newBasePrice: previewBasePrice,
                  sellerPrice: channel === "domestic" && dSellerPrice ? Number(dSellerPrice) : null,
                  isChineseBrand: channel === "domestic",
                }}
                result={result}
                intelligence={intel}
              />

              {/* ── 顶级数据报告：基于 866 万条真实补贴交易，recharts 8 大模块 ── */}
              <ValuationReportPro
                channel={channel}
                meta={{
                  brand: channel === "domestic" ? dBrand : iBrand,
                  category: dCategory,
                  modelName: channel === "domestic" ? dModel : iModel,
                  modelYear: channel === "domestic" ? dYear - dYears : iYear,
                  ageYears: channel === "domestic" ? dYears : undefined,
                  horsepower: channel === "domestic" ? dHP : iHP,
                  hours: channel === "domestic" ? (dHours && dHours > 0 ? dHours : undefined) : iHours,
                  region: channel === "domestic" ? dRegion : iRegion,
                  condition: channel === "domestic" ? "良好" : iCondition,
                  emission: channel !== "domestic" ? iEmission : undefined,
                  newBasePrice: previewBasePrice,
                  sellerPrice: channel === "domestic" && dSellerPrice ? Number(dSellerPrice) : null,
                  isChineseBrand: channel === "domestic",
                }}
                result={result}
                intelligence={intel}
                locale={locale}
              />

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

              {/* 估价后一键发布出售（转化入口，免费） */}
              <PublishCta
                brand={channel === "domestic" ? dBrand : iBrand}
                model={channel === "domestic" ? `${dBrand} ${dCategory}` : iBrand}
                year={channel === "domestic" ? dYear - dYears : iYear}
                horsepower={channel === "domestic" ? dHP : iHP}
                category={dCategory}
                locale={locale}
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
          images={uploadedImages}
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
