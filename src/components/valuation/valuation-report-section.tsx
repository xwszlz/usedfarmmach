"use client";

/**
 * AI 估值报告 — 快速估值完成后自动生成的配套报告（免费、即时、客户端渲染）。
 *
 * 设计要点：
 * - 每次 doValuation 出结果即挂载，无需额外点击/付费；
 * - 下载 HTML 与打印均从数据驱动重新生成独立样式（不再拷贝带 Tailwind 的
 *   innerHTML —— 那是深度分析报告下载后表头重复/样式丢失的根因）；
 * - 内容：核心结论 → 估值参数 → 计算过程 → 公式 → 补贴价格走势(国产) →
 *   风险提示 → 免责声明。
 */

import { useMemo, useState } from "react";
import { Printer, Download, Copy, Check, FileText, BarChart3 } from "lucide-react";
import { formatValuationMoney } from "@/lib/valuation/formulas";
import { getSubsidyPriceHistory, type SubsidyYearDatum } from "@/lib/valuation/brand-data";
import type { ValuationIntelligence } from "@/lib/valuation/intelligence";

export interface ValuationReportMeta {
  brand: string;
  category?: string;
  modelName?: string;
  modelYear?: number;
  ageYears?: number;
  horsepower?: number;
  hours?: number;
  region: string;
  condition?: string;
  emission?: string;
  newBasePrice?: number;
  sellerPrice?: number | null;
  isChineseBrand: boolean;
}

export interface ValuationReportResult {
  value: number;
  confidence: number;
  breakdown: { label: string; value: string; detail?: string }[];
  formula: string;
  warnings: string[];
}

interface ValuationReportSectionProps {
  channel: "domestic" | "international" | "export";
  meta: ValuationReportMeta;
  result: ValuationReportResult;
  intelligence?: ValuationIntelligence | null;
  locale?: string;
}

function genReportId(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SD-${ymd}-${rnd}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const PARAM_LABELS: { key: keyof ValuationReportMeta; zh: string; en: string; suffix?: string }[] = [
  { key: "brand", zh: "品牌", en: "Brand" },
  { key: "category", zh: "品类", en: "Category" },
  { key: "modelYear", zh: "制造年份", en: "Year" },
  { key: "ageYears", zh: "使用年限", en: "Age", suffix: "年" },
  { key: "horsepower", zh: "马力", en: "Power", suffix: " HP" },
  { key: "hours", zh: "使用小时", en: "Hours", suffix: " h" },
  { key: "region", zh: "地区", en: "Region" },
  { key: "condition", zh: "车况", en: "Condition" },
  { key: "emission", zh: "排放标准", en: "Emission" },
];

export default function ValuationReportSection({
  channel,
  meta,
  result,
  intelligence,
  locale = "zh",
}: ValuationReportSectionProps) {
  const [copied, setCopied] = useState(false);
  const zh = locale === "zh";
  const reportId = useMemo(() => genReportId(), []);
  const reportTime = useMemo(() => new Date().toLocaleString("zh-CN"), []);

  const isDomestic = channel === "domestic";
  // 数据驱动置信区间：优先用真实交易 P25~P75（来自 866 万条补贴数据）
  const statRange = intelligence?.model || intelligence?.brandCat;
  const priceRangeLow =
    statRange && statRange.p25 > 0 ? Math.round(statRange.p25) : Math.round(result.value * 0.85);
  const priceRangeHigh =
    statRange && statRange.p75 > 0 ? Math.round(statRange.p75) : Math.round(result.value * 1.15);
  const rangeLabel = statRange
    ? zh
      ? "真实成交区间(P25~P75)"
      : "Real Range (P25~P75)"
    : zh
      ? "参考区间(±15%)"
      : "Range(±15%)";
  const sellerPrice = meta.sellerPrice ?? null;
  const sellerDiff =
    sellerPrice && result.value > 0
      ? Math.round(((sellerPrice - result.value) / result.value) * 100)
      : null;

  const subsidyData: SubsidyYearDatum[] = useMemo(() => {
    if (!meta.isChineseBrand) return [];
    return getSubsidyPriceHistory(meta.brand, meta.category || "");
  }, [meta.isChineseBrand, meta.brand, meta.category]);
  const maxPrice = Math.max(...subsidyData.map((d) => d.avgPrice), 1);

  const paramRows = PARAM_LABELS.map((p) => {
    const v = meta[p.key];
    if (v === undefined || v === null || v === "") return null;
    return { label: zh ? p.zh : p.en, value: `${v}${p.suffix || ""}` };
  }).filter(Boolean) as { label: string; value: string }[];

  const handleCopy = () => {
    const lines = [
      `AI 估值报告 ${reportId}`,
      `${zh ? "生成时间" : "Generated"}: ${reportTime}`,
      `${zh ? "设备" : "Equipment"}: ${meta.brand} ${meta.category || ""} ${meta.modelYear || ""}`,
      `${zh ? "AI估值" : "Estimate"}: ${formatValuationMoney(result.value)} (${zh ? "区间" : "Range"} ${formatValuationMoney(priceRangeLow)} ~ ${formatValuationMoney(priceRangeHigh)})`,
      `${zh ? "置信度" : "Confidence"}: ${Math.round(result.confidence)}%`,
      "",
      zh ? "计算过程:" : "Breakdown:",
      ...result.breakdown.map((b) => `- ${b.label}: ${b.value}${b.detail ? ` (${b.detail})` : ""}`),
      `${zh ? "公式" : "Formula"}: ${result.formula}`,
      ...(result.warnings.length ? ["", zh ? "风险提示:" : "Warnings:", ...result.warnings.map((w) => `- ${w}`)] : []),
      "",
      zh ? "神雕农机 usedfarmmach.com | 本报告由AI生成，仅供参考" : "usedfarmmach.com | AI-generated, for reference only",
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => window.print();

  // ── 下载：数据驱动生成完全自包含的独立 HTML（带内联样式，无外部依赖）──
  const handleDownloadHtml = () => {
    const rows = paramRows
      .map((r) => `<tr><td class="k">${esc(r.label)}</td><td>${esc(r.value)}</td></tr>`)
      .join("");
    const breakdownRows = result.breakdown
      .map(
        (b) =>
          `<tr><td>${esc(b.label)}${b.detail ? `<span class="detail">${esc(b.detail)}</span>` : ""}</td><td class="num">${esc(b.value)}</td></tr>`
      )
      .join("");
    const chart = subsidyData.length
      ? `<div class="card"><h3>${zh ? "补贴数据价格走势（真实历史数据）" : "Subsidy Price History"}</h3>
<div class="bars">${subsidyData
          .map((d) => {
            const ph = Math.round((d.avgPrice / maxPrice) * 100);
            const sh = Math.round((d.avgSubsidy / maxPrice) * 100);
            return `<div class="bar-group"><div class="bar-pair"><div class="bar price" style="height:${ph}%"><i>¥${d.avgPrice.toLocaleString()}</i></div><div class="bar subsidy" style="height:${sh}%"></div></div><div class="bar-label">${esc(String(d.year))}</div></div>`;
          })
          .join("")}</div>
<div class="legend"><span><i class="dot price"></i>${zh ? "平均售价" : "Avg Price"}</span><span><i class="dot subsidy"></i>${zh ? "平均补贴" : "Avg Subsidy"}</span></div>
<div class="source">${zh ? "数据来源" : "Source"}: ${subsidyData.reduce((s, d) => s + d.count, 0).toLocaleString()} ${zh ? "条真实交易记录" : "records"}</div></div>`
      : "";

    const sellerBlock = sellerPrice
      ? `<div class="seller">${zh ? "卖家报价" : "Seller Price"}: <b>¥${sellerPrice.toLocaleString()}</b>${
          sellerDiff !== null
            ? sellerDiff > 0
              ? ` <span class="chip up">${zh ? "偏高" : "High"} ${sellerDiff}%</span>`
              : ` <span class="chip down">${zh ? "合理/偏低" : "Fair/Low"} ${Math.abs(sellerDiff)}%</span>`
            : ""
        }</div>`
      : "";

    const warnings = result.warnings.length
      ? `<div class="card warn"><h3>${zh ? "风险提示" : "Risk Warnings"}</h3><ul>${result.warnings
          .map((w) => `<li>${esc(w)}</li>`)
          .join("")}</ul></div>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 估值报告 ${reportId}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 820px; margin: 0 auto; padding: 24px 20px; color: #1f2937; background: #f9fafb; }
.report-header { background: linear-gradient(135deg, #2563eb, #1e40af); color: white; padding: 22px 24px; border-radius: 12px; }
.report-header h1 { font-size: 20px; margin-bottom: 6px; }
.report-header .meta { font-size: 12px; opacity: .85; }
.card { background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-top: 14px; }
.card h3 { font-size: 14px; color: #374151; margin-bottom: 10px; }
.value-row { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.big-value { font-size: 34px; font-weight: 800; color: #1d4ed8; }
.range { font-size: 13px; color: #6b7280; }
.conf { font-size: 13px; color: #059669; font-weight: 600; }
.seller { margin-top: 10px; font-size: 13px; color: #4b5563; }
.chip { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.chip.up { background: #fee2e2; color: #dc2626; }
.chip.down { background: #d1fae5; color: #059669; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
td { padding: 7px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
tr:last-child td { border-bottom: none; }
td.k { color: #6b7280; width: 40%; }
td.num { text-align: right; font-weight: 600; white-space: nowrap; }
.detail { display: block; font-size: 11px; color: #9ca3af; }
.formula { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #4b5563; background: #f3f4f6; padding: 10px; border-radius: 8px; word-break: break-all; }
.bars { display: flex; align-items: flex-end; gap: 14px; height: 130px; padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
.bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
.bar-pair { display: flex; align-items: flex-end; gap: 4px; height: 100%; }
.bar { width: 26px; border-radius: 4px 4px 0 0; position: relative; }
.bar.price { background: linear-gradient(180deg, #3b82f6, #2563eb); }
.bar.subsidy { background: linear-gradient(180deg, #34d399, #10b981); }
.bar.price i { position: absolute; top: -16px; left: 50%; transform: translateX(-50%); font-style: normal; font-size: 10px; color: #1d4ed8; white-space: nowrap; }
.bar-label { font-size: 11px; color: #6b7280; margin-top: 4px; }
.legend { display: flex; justify-content: center; gap: 18px; font-size: 11px; color: #6b7280; margin-top: 8px; }
.legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
.legend .dot.price { background: #2563eb; }
.legend .dot.subsidy { background: #10b981; }
.source { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 6px; }
.warn { border-left: 4px solid #f59e0b; }
.warn ul { padding-left: 18px; }
.warn li { font-size: 12px; color: #92400e; line-height: 1.8; }
.footer { margin-top: 20px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
@media print { body { background: white; padding: 0; } }
</style>
</head>
<body>
<div class="report-header">
  <h1>${zh ? "AI 估值报告" : "AI Valuation Report"}</h1>
  <div class="meta">${zh ? "报告编号" : "Report ID"}: ${reportId} ｜ ${zh ? "生成时间" : "Generated"}: ${reportTime} ｜ ${esc(meta.brand)} ${esc(meta.category || "")} ${meta.modelYear || ""}</div>
</div>

<div class="card">
  <div class="value-row">
    <span class="big-value">${formatValuationMoney(result.value)}</span>
    <span class="range">${rangeLabel}: ${formatValuationMoney(priceRangeLow)} ~ ${formatValuationMoney(priceRangeHigh)}</span>
    <span class="conf">${zh ? "置信度" : "Confidence"} ${Math.round(result.confidence)}%</span>
  </div>
  ${sellerBlock}
</div>

<div class="card"><h3>${zh ? "估值参数" : "Valuation Parameters"}</h3><table>${rows}</table></div>
<div class="card"><h3>${zh ? "计算过程" : "Breakdown"}</h3><table>${breakdownRows}</table></div>
<div class="card"><h3>${zh ? "估值公式" : "Formula"}</h3><div class="formula">${esc(result.formula)}</div></div>
${chart}
${warnings}
<div class="footer">${zh ? "神雕农机 usedfarmmach.com" : "ShenDiao Agri Machinery"} | ${zh ? "本报告由AI生成，仅供参考，不构成交易建议" : "AI-generated, for reference only"} | ${reportId}</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `估值报告_${reportId}.html`;
    // 必须挂载到 DOM 后再 click，否则部分浏览器未读取 Blob 即回收，导致点击无反应
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      if (a.parentNode) document.body.removeChild(a);
    }, 2000);
  };

  return (
    <div className="space-y-0">
      {/* Toolbar - hidden in print */}
      <div className="no-print mb-3 flex items-center justify-end gap-2">
        <span className="mr-auto flex items-center gap-1.5 text-xs font-medium text-blue-700">
          <FileText className="h-3.5 w-3.5" />
          {zh ? "已随估值自动生成报告" : "Report auto-generated"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? (zh ? "已复制" : "Copied") : zh ? "复制文本" : "Copy"}
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          <Printer className="h-3.5 w-3.5" />
          {zh ? "打印/存PDF" : "Print"}
        </button>
        <button
          onClick={handleDownloadHtml}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          <Download className="h-3.5 w-3.5" />
          {zh ? "下载HTML" : "Download"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
        {/* Report Header */}
        <div className="px-5 py-4 text-white" style={{ background: "linear-gradient(135deg, #2563eb, #1e40af)" }}>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h3 className="text-base font-bold">{zh ? "AI 估值报告" : "AI Valuation Report"}</h3>
            <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
              {channel === "domestic" ? (zh ? "国产通道" : "Domestic") : channel === "international" ? (zh ? "国际通道" : "International") : zh ? "出口通道" : "Export"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-80">
            <span>{zh ? "报告编号" : "Report ID"}：{reportId}</span>
            <span>{zh ? "生成时间" : "Generated"}：{reportTime}</span>
            <span>{meta.brand} {meta.category || ""} {meta.modelYear || ""}</span>
          </div>
        </div>

        {/* Core Conclusion */}
        <div className="border-b border-gray-100 p-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-3xl font-extrabold text-blue-700">{formatValuationMoney(result.value)}</span>
            <span className="text-xs text-gray-500">
              {rangeLabel}：{formatValuationMoney(priceRangeLow)} ~ {formatValuationMoney(priceRangeHigh)}
            </span>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
              {zh ? "置信度" : "Confidence"} {Math.round(result.confidence)}%
            </span>
          </div>
          {sellerPrice && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <span>{zh ? "卖家报价" : "Seller"}：¥{sellerPrice.toLocaleString()}</span>
              {sellerDiff !== null && (
                sellerDiff > 0 ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-600">{zh ? "偏高" : "High"} {sellerDiff}%</span>
                ) : (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">{zh ? "合理/偏低" : "Fair"} {Math.abs(sellerDiff)}%</span>
                )
              )}
            </div>
          )}
        </div>

        {/* Parameters + Breakdown two-column */}
        <div className="grid gap-0 border-b border-gray-100 md:grid-cols-2">
          <div className="border-b border-gray-100 p-5 md:border-b-0 md:border-r">
            <h4 className="mb-2 text-sm font-semibold text-gray-800">{zh ? "估值参数" : "Parameters"}</h4>
            <div className="space-y-1.5">
              {paramRows.map((r) => (
                <div key={r.label} className="flex items-center justify-between border-b border-gray-50 pb-1 text-xs">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-medium text-gray-800">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5">
            <h4 className="mb-2 text-sm font-semibold text-gray-800">{zh ? "计算过程" : "Breakdown"}</h4>
            <div className="space-y-1.5">
              {result.breakdown.map((b, i) => (
                <div key={i} className="flex items-center justify-between border-b border-gray-50 pb-1 text-xs">
                  <span className="text-gray-500">
                    {b.label}
                    {b.detail && <span className="ml-1 text-[10px] text-gray-400">{b.detail}</span>}
                  </span>
                  <span className="font-semibold text-gray-800">{b.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Formula */}
        <div className="border-b border-gray-100 bg-gray-50 p-5">
          <div className="mb-1 text-xs font-medium text-gray-400">{zh ? "估值公式" : "Formula"}</div>
          <div className="break-all font-mono text-xs text-gray-600">{result.formula}</div>
        </div>

        {/* Subsidy Price Chart (domestic only) */}
        {isDomestic && subsidyData.length > 0 && (
          <div className="border-b border-gray-100 p-5">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-800">
                {zh ? "补贴数据价格走势（真实历史数据）" : "Subsidy Price History"}
              </h4>
            </div>
            <div className="flex items-end gap-3" style={{ height: "130px" }}>
              {subsidyData.map((d, i) => {
                const priceH = (d.avgPrice / maxPrice) * 100;
                const subH = (d.avgSubsidy / maxPrice) * 100;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
                    <div className="flex w-full items-end justify-center gap-1" style={{ height: "92px" }}>
                      <div
                        className="w-1/2 max-w-[26px] rounded-t"
                        style={{ height: `${priceH}%`, background: "linear-gradient(180deg, #3b82f6, #2563eb)" }}
                        title={`${zh ? "均价" : "Avg"} ¥${d.avgPrice.toLocaleString()}`}
                      />
                      <div
                        className="w-1/2 max-w-[26px] rounded-t"
                        style={{ height: `${subH}%`, background: "linear-gradient(180deg, #34d399, #10b981)" }}
                        title={`${zh ? "补贴" : "Subsidy"} ¥${d.avgSubsidy.toLocaleString()}`}
                      />
                    </div>
                    <div className="text-[10px] font-medium text-gray-500">{d.year}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: "#2563eb" }} />
                {zh ? "平均售价" : "Avg Price"}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: "#10b981" }} />
                {zh ? "平均补贴" : "Avg Subsidy"}
              </span>
              <span className="text-gray-400">
                {zh ? "来源" : "Src"}: {subsidyData.reduce((s, d) => s + d.count, 0).toLocaleString()} {zh ? "条真实记录" : "records"}
              </span>
            </div>
          </div>
        )}

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="border-l-4 border-amber-400 bg-amber-50 p-4">
            <div className="mb-1 text-sm font-semibold text-amber-700">{zh ? "风险提示" : "Risk Warnings"}</div>
            {result.warnings.map((w, i) => (
              <div key={i} className="text-xs text-amber-700">• {w}</div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 px-5 py-3 text-center text-[10px] text-gray-400">
          {zh ? "神雕农机 usedfarmmach.com" : "ShenDiao Agri Machinery"} |{" "}
          {zh ? "本报告由AI生成，仅供参考，不构成交易建议" : "AI-generated, for reference only"} | {reportId}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
