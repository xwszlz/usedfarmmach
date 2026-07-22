"use client";

import { useState, useMemo, useRef } from "react";
import { Printer, Download, Copy, Check, BarChart3, FileText } from "lucide-react";
import { getSubsidyPriceHistory, type SubsidyYearDatum } from "@/lib/valuation/brand-data";

interface AnalysisReportViewProps {
  report: string;
  structured?: Record<string, any> | null;
  isChineseBrand?: boolean;
  brandName?: string;
  categoryName?: string;
  locale?: string;
}

interface ReportSection {
  title: string;
  content: string;
}

/** Parse Markdown into sections by ## headings */
function parseMarkdownSections(md: string): ReportSection[] {
  // Remove JSON code block at end
  const cleaned = md.replace(/```json[\s\S]*?```/g, "").trim();
  // Split by ## headings
  const parts = cleaned.split(/^## /m).filter((s) => s.trim());
  return parts.map((part) => {
    const lines = part.split("\n");
    const title = lines[0].trim();
    const content = lines.slice(1).join("\n").trim();
    return { title, content };
  });
}

/** Convert simple Markdown content to HTML (bold, lists, line breaks) */
function mdToHtml(md: string): string {
  return md
    .replace(/### (.*)/g, '<h4 class="font-semibold text-gray-800 mt-3 mb-1">$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.*)/gm, '<li class="ml-5 list-disc text-gray-600">$1</li>')
    .replace(/^(\d+)\. (.*)/gm, '<li class="ml-5 list-decimal text-gray-600">$2</li>')
    .replace(/\n\n/g, "</p><p class=\"text-gray-600\">")
    .replace(/\n/g, "<br />");
}

function formatMoney(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

function genReportId(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SD-${ymd}-${rnd}`;
}

export default function AnalysisReportView({
  report,
  structured,
  isChineseBrand,
  brandName,
  categoryName,
  locale = "zh",
}: AnalysisReportViewProps) {
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const reportId = useMemo(() => genReportId(), []);
  const reportTime = useMemo(() => new Date().toLocaleString("zh-CN"), []);

  const sections = useMemo(() => parseMarkdownSections(report), [report]);

  // Subsidy price history for domestic machines
  const subsidyData: SubsidyYearDatum[] = useMemo(() => {
    if (!isChineseBrand) return [];
    return getSubsidyPriceHistory(brandName || "", categoryName || "");
  }, [isChineseBrand, brandName, categoryName]);

  const maxPrice = Math.max(...subsidyData.map((d) => d.avgPrice), 1);

  // Structured data metrics
  const metrics: { label: string; value: string; color: string }[] = [];
  if (structured?.brand) {
    metrics.push({
      label: locale === "zh" ? "识别设备" : "Equipment",
      value: `${structured.brand} ${structured.modelName || ""}`.trim(),
      color: "text-blue-700 bg-blue-50",
    });
  }
  if (structured?.confidence) {
    metrics.push({
      label: locale === "zh" ? "置信度" : "Confidence",
      value: `${Math.round(structured.confidence * 100)}%`,
      color: "text-purple-700 bg-purple-50",
    });
  }
  if (isChineseBrand) {
    if (structured?.newMachinePrice) {
      metrics.push({
        label: locale === "zh" ? "新机参考价" : "New Price",
        value: `¥${formatMoney(structured.newMachinePrice)}`,
        color: "text-green-700 bg-green-50",
      });
    }
    if (structured?.estimatedPriceCny) {
      metrics.push({
        label: locale === "zh" ? "二手参考价" : "Used Price",
        value: `¥${formatMoney(structured.estimatedPriceCny)}`,
        color: "text-orange-700 bg-orange-50",
      });
    }
    if (structured?.subsidyAmount) {
      metrics.push({
        label: locale === "zh" ? "购置补贴" : "Subsidy",
        value: `¥${formatMoney(structured.subsidyAmount)}`,
        color: "text-teal-700 bg-teal-50",
      });
    }
  } else {
    if (structured?.estimatedPriceUsd) {
      metrics.push({
        label: locale === "zh" ? "国际参考价" : "Intl Price",
        value: formatUsd(structured.estimatedPriceUsd),
        color: "text-green-700 bg-green-50",
      });
    }
  }
  if (structured?.fobPriceUsd) {
    metrics.push({
      label: locale === "zh" ? "FOB出口价" : "FOB Price",
      value: formatUsd(structured.fobPriceUsd),
      color: "text-indigo-700 bg-indigo-50",
    });
  }
  if (structured?.enginePower) {
    metrics.push({
      label: locale === "zh" ? "马力" : "Power",
      value: `${structured.enginePower} HP`,
      color: "text-red-700 bg-red-50",
    });
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>深度分析报告 ${reportId}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
.report-header { background: linear-gradient(135deg, #7c3aed, #5b21b6); color: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; }
.report-header h1 { margin: 0 0 8px; font-size: 20px; }
.report-header .meta { font-size: 12px; opacity: 0.8; }
.metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
.metric-card { padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; }
.metric-card .label { font-size: 11px; color: #6b7280; }
.metric-card .value { font-size: 16px; font-weight: 600; margin-top: 4px; }
.section { margin-bottom: 16px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
.section h2 { font-size: 15px; font-weight: 700; margin: 0 0 8px; color: #1f2937; }
.section h4 { font-size: 13px; font-weight: 600; margin: 8px 0 4px; color: #374151; }
.section p { font-size: 13px; line-height: 1.6; color: #4b5563; margin: 4px 0; }
.section li { font-size: 13px; line-height: 1.8; color: #4b5563; }
.section ul { padding-left: 20px; }
.chart { margin: 16px 0; }
.chart-bars { display: flex; align-items: flex-end; gap: 12px; height: 120px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
.chart-bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.chart-bar { width: 100%; max-width: 48px; border-radius: 4px 4px 0 0; transition: height 0.3s; }
.chart-labels { display: flex; gap: 12px; margin-top: 4px; }
.chart-label { flex: 1; text-align: center; font-size: 11px; color: #6b7280; }
.footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
@media print { .no-print { display: none !important; } }
</style>
</head>
<body>
<div class="report-header">
  <h1>AI 深度分析报告</h1>
  <div class="meta">报告编号：${reportId} | 生成时间：${reportTime} | ${structured?.brand || ""} ${structured?.modelName || ""}</div>
</div>
${reportRef.current?.innerHTML || ""}
<div class="footer">
  神雕农机 usedfarmmach.com | 本报告由AI生成，仅供参考 | 报告编号：${reportId}
</div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `深度分析报告_${reportId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const zh = locale === "zh";

  return (
    <div className="space-y-0">
      {/* Toolbar - hidden in print */}
      <div className="no-print mb-3 flex items-center justify-end gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? (zh ? "已复制" : "Copied") : zh ? "复制MD" : "Copy"}
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

      {/* Report Body */}
      <div ref={reportRef} className="overflow-hidden rounded-xl border border-gray-200">
        {/* Report Header */}
        <div
          className="px-5 py-4 text-white"
          style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h3 className="text-base font-bold">
              {zh ? "AI 深度分析报告" : "AI Deep Analysis Report"}
            </h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-80">
            <span>{zh ? "报告编号" : "Report ID"}：{reportId}</span>
            <span>{zh ? "生成时间" : "Generated"}：{reportTime}</span>
            {structured?.brand && (
              <span>{structured.brand} {structured.modelName || ""}</span>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 bg-gray-50 p-4 sm:grid-cols-3 md:grid-cols-4">
            {metrics.map((m, i) => (
              <div key={i} className={`rounded-lg p-2.5 ${m.color}`}>
                <div className="text-[10px] font-medium opacity-70">{m.label}</div>
                <div className="mt-0.5 text-sm font-bold">{m.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Subsidy Price Chart (domestic only) */}
        {isChineseBrand && subsidyData.length > 0 && (
          <div className="border-b border-gray-100 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <h4 className="text-sm font-semibold text-gray-800">
                {zh ? "补贴数据价格走势（真实历史数据）" : "Subsidy Price History"}
              </h4>
            </div>
            {/* CSS Bar Chart */}
            <div className="flex items-end gap-3" style={{ height: "140px" }}>
              {subsidyData.map((d, i) => {
                const priceH = (d.avgPrice / maxPrice) * 100;
                const subH = (d.avgSubsidy / maxPrice) * 100;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    {/* Bars */}
                    <div className="flex w-full items-end justify-center gap-1" style={{ height: "100px" }}>
                      <div
                        className="w-1/2 max-w-[28px] rounded-t"
                        style={{ height: `${priceH}%`, background: "linear-gradient(180deg, #8b5cf6, #7c3aed)" }}
                        title={`均价 ¥${d.avgPrice.toLocaleString()}`}
                      />
                      <div
                        className="w-1/2 max-w-[28px] rounded-t"
                        style={{ height: `${subH}%`, background: "linear-gradient(180deg, #34d399, #10b981)" }}
                        title={`补贴 ¥${d.avgSubsidy.toLocaleString()}`}
                      />
                    </div>
                    {/* Year label */}
                    <div className="text-[10px] font-medium text-gray-500">{d.year}</div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: "#7c3aed" }} />
                {zh ? "平均售价" : "Avg Price"}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: "#10b981" }} />
                {zh ? "平均补贴" : "Avg Subsidy"}
              </span>
            </div>
            {/* Data summary */}
            <div className="mt-2 text-center text-[10px] text-gray-400">
              {zh
                ? `数据来源：补贴数据库 ${subsidyData.reduce((s, d) => s + d.count, 0).toLocaleString()} 条真实交易记录`
                : `Source: ${subsidyData.reduce((s, d) => s + d.count, 0).toLocaleString()} records`}
            </div>
          </div>
        )}

        {/* Report Sections */}
        <div className="divide-y divide-gray-100 bg-white">
          {sections.map((section, i) => (
            <div key={i} className="px-5 py-4">
              <h3 className="mb-2 text-sm font-bold text-gray-900">
                <span className="mr-2 text-purple-500">§{i + 1}</span>
                {section.title}
              </h3>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: `<p class="text-gray-600">${mdToHtml(section.content)}</p>`,
                }}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 text-center text-[10px] text-gray-400">
          {zh ? "神雕农机 usedfarmmach.com" : "ShenDiao Agri Machinery"} |{" "}
          {zh ? "本报告由AI生成，仅供参考" : "AI-generated, for reference only"} |{" "}
          {reportId}
        </div>
      </div>

      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
