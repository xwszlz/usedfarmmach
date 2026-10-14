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
  locked?: boolean;
  onUnlock?: () => void;
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

/** Escape HTML special chars for standalone export */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Standalone Markdown→HTML (inline styles, safe lists) for the downloadable report */
function mdToHtmlStandalone(md: string): string {
  const html = esc(md)
    .replace(/### (.*)/g, "<h4>$1</h4>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.*)/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.*)/gm, "<li>$2</li>");
  // Wrap consecutive <li> groups in <ul>（<li> 裸露在 <p> 里会被浏览器拆散）
  return html.replace(/((?:<li>[\s\S]*?<\/li>\s*)+)/g, "<ul>$1</ul>");
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
  locked = false,
  onUnlock,
}: AnalysisReportViewProps) {
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const reportId = useMemo(() => genReportId(), []);
  const reportTime = useMemo(() => new Date().toLocaleString("zh-CN"), []);

  // Payment tiers were removed: the full report is always visible.
  // `locked` / `onUnlock` are kept only so existing callers keep type-checking.
  void locked;
  void onUnlock;

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
    // 数据驱动重建独立 HTML（不再拷贝带 Tailwind 的 innerHTML —— 拷贝会导致
    // ①模板表头+组件表头重复 ②柱状图/加粗/列表全部丢样式）。样式全部内联。
    const secHtml = (s: string) => esc(s);

    const metricsHtml = metrics
      .map(
        (m) =>
          `<div class="metric-card"><div class="label">${secHtml(m.label)}</div><div class="value">${secHtml(m.value)}</div></div>`
      )
      .join("");

    const chartHtml =
      isChineseBrand && subsidyData.length > 0
        ? `<div class="card"><h3>${zh ? "补贴数据价格走势（真实历史数据）" : "Subsidy Price History"}</h3>
<div class="bars">${subsidyData
            .map((d) => {
              const ph = Math.round((d.avgPrice / maxPrice) * 100);
              const sh = Math.round((d.avgSubsidy / maxPrice) * 100);
              return `<div class="bar-group"><div class="bar-pair"><div class="bar price" style="height:${ph}%"></div><div class="bar subsidy" style="height:${sh}%"></div></div><div class="bar-label">${esc(String(d.year))}</div></div>`;
            })
            .join("")}</div>
<div class="legend"><span><i class="dot" style="background:#7c3aed"></i>${zh ? "平均售价" : "Avg Price"}</span><span><i class="dot" style="background:#10b981"></i>${zh ? "平均补贴" : "Avg Subsidy"}</span></div>
<div class="source">${zh ? "数据来源" : "Source"}: ${subsidyData.reduce((s, d) => s + d.count, 0).toLocaleString()} ${zh ? "条真实交易记录" : "records"}</div></div>`
        : "";

    const techRows: [string, string][] = [];
    if (structured?.engineType) techRows.push([zh ? "发动机型号" : "Engine", String(structured.engineType)]);
    if (structured?.driveSystem) techRows.push([zh ? "驱动方式" : "Drive", String(structured.driveSystem)]);
    if (structured?.netWeight) techRows.push([zh ? "整机重量" : "Weight", `${structured.netWeight} kg`]);
    if (structured?.mainConfig) techRows.push([zh ? "主要配置" : "Config", String(structured.mainConfig)]);
    if (structured?.overallLength && structured?.overallWidth)
      techRows.push([
        zh ? "外形尺寸" : "Dimensions",
        `${structured.overallLength}x${structured.overallWidth}${structured.overallHeight ? `x${structured.overallHeight}` : ""} mm`,
      ]);
    const techHtml = techRows.length
      ? `<div class="card"><h3>${zh ? "技术参数" : "Technical Specs"}</h3><table>${techRows
          .map(([k, v]) => `<tr><td class="k">${secHtml(k)}</td><td>${secHtml(v)}</td></tr>`)
          .join("")}</table></div>`
      : "";

    const condDef: [string, string][] = [
      ["exterior", zh ? "外观漆面" : "Exterior"],
      ["rust", zh ? "锈蚀程度" : "Rust"],
      ["tires", zh ? "轮胎/履带" : "Tires"],
      ["cabin", zh ? "驾驶室/操作台" : "Cabin"],
      ["hydraulic", zh ? "液压渗漏" : "Hydraulic"],
      ["overall", zh ? "整体印象" : "Overall"],
    ];
    const condHtml =
      structured?.conditionScores
        ? `<div class="card"><h3>${zh ? "设备现状评估（六维度）" : "Condition Assessment"}</h3>${condDef
            .map(([key, label]) => {
              const score = structured.conditionScores[key];
              if (score === undefined || score === null) return "";
              const pct = (Number(score) / 10) * 100;
              const color = Number(score) >= 8 ? "#10b981" : Number(score) >= 6 ? "#f59e0b" : "#ef4444";
              return `<div class="cond-row"><span class="cond-label">${secHtml(label)}</span><div class="cond-track"><div class="cond-fill" style="width:${pct}%;background:${color}"></div></div><span class="cond-score" style="color:${color}">${score}/10</span></div>`;
            })
            .join("")}</div>`
        : "";

    const sectionsHtml = sections
      .map(
        (s, i) =>
          `<div class="card"><h3>§${i + 1} ${secHtml(s.title)}</h3><div class="md">${mdToHtmlStandalone(s.content)}</div></div>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>深度分析报告 ${reportId}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 800px; margin: 0 auto; padding: 24px 20px; color: #1f2937; background: #f9fafb; }
.report-header { background: linear-gradient(135deg, #7c3aed, #5b21b6); color: white; padding: 22px 24px; border-radius: 12px; }
.report-header h1 { font-size: 20px; margin-bottom: 6px; }
.report-header .meta { font-size: 12px; opacity: .85; }
.metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 14px; }
.metric-card { padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: white; }
.metric-card .label { font-size: 11px; color: #6b7280; }
.metric-card .value { font-size: 16px; font-weight: 700; margin-top: 4px; color: #1f2937; }
.card { background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-top: 14px; }
.card h3 { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
td { padding: 7px 6px; border-bottom: 1px solid #f3f4f6; }
tr:last-child td { border-bottom: none; }
td.k { color: #6b7280; width: 40%; }
.bars { display: flex; align-items: flex-end; gap: 14px; height: 130px; padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
.bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
.bar-pair { display: flex; align-items: flex-end; gap: 4px; height: 100%; }
.bar { width: 26px; border-radius: 4px 4px 0 0; }
.bar.price { background: linear-gradient(180deg, #8b5cf6, #7c3aed); }
.bar.subsidy { background: linear-gradient(180deg, #34d399, #10b981); }
.bar-label { font-size: 11px; color: #6b7280; margin-top: 4px; }
.legend { display: flex; justify-content: center; gap: 18px; font-size: 11px; color: #6b7280; margin-top: 8px; }
.legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
.source { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 6px; }
.cond-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.cond-label { width: 96px; font-size: 12px; color: #4b5563; }
.cond-track { flex: 1; height: 8px; border-radius: 999px; background: #f3f4f6; }
.cond-fill { height: 100%; border-radius: 999px; }
.cond-score { width: 40px; text-align: right; font-size: 12px; font-weight: 700; }
.md { font-size: 13px; line-height: 1.8; color: #4b5563; }
.md h4 { font-size: 13px; font-weight: 600; color: #374151; margin: 10px 0 4px; }
.md strong { color: #1f2937; }
.md ul { padding-left: 20px; margin: 4px 0; }
.md p { margin: 6px 0; }
.footer { margin-top: 20px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
@media print { body { background: white; padding: 0; } }
</style>
</head>
<body>
<div class="report-header">
  <h1>AI 深度分析报告</h1>
  <div class="meta">报告编号：${reportId} | 生成时间：${reportTime} | ${esc(structured?.brand || "")} ${esc(structured?.modelName || "")}</div>
</div>
${metrics.length > 0 ? `<div class="metrics">${metricsHtml}</div>` : ""}
${chartHtml}
${techHtml}
${condHtml}
${sectionsHtml}
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
    // 必须先挂进 DOM：部分浏览器/内嵌场景下游离节点 click() 会静默失效
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 不能同步 revoke：浏览器可能尚未开始读取 Blob，提前回收会导致下载被静默取消
    setTimeout(() => URL.revokeObjectURL(url), 2000);
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

        {/* Technical Parameters Table */}
        {structured && (structured.engineType || structured.driveSystem || structured.netWeight || structured.mainConfig || structured.overallLength) && (
          <div className="border-b border-gray-100 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-800">{zh ? "技术参数" : "Technical Specs"}</h4>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {structured.engineType && (
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">{zh ? "发动机型号" : "Engine"}</span>
                  <span className="font-medium text-gray-800">{structured.engineType}</span>
                </div>
              )}
              {structured.driveSystem && (
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">{zh ? "驱动方式" : "Drive"}</span>
                  <span className="font-medium text-gray-800">{structured.driveSystem}</span>
                </div>
              )}
              {structured.netWeight && (
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">{zh ? "整机重量" : "Weight"}</span>
                  <span className="font-medium text-gray-800">{structured.netWeight} kg</span>
                </div>
              )}
              {structured.mainConfig && (
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">{zh ? "主要配置" : "Config"}</span>
                  <span className="font-medium text-gray-800">{structured.mainConfig}</span>
                </div>
              )}
              {structured.overallLength && structured.overallWidth && (
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">{zh ? "外形尺寸" : "Dimensions"}</span>
                  <span className="font-medium text-gray-800">{structured.overallLength}x{structured.overallWidth}{structured.overallHeight ? `x${structured.overallHeight}` : ""} mm</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6-Dimension Condition Scores */}
        {structured?.conditionScores && (
          <div className="border-b border-gray-100 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <h4 className="text-sm font-semibold text-gray-800">{zh ? "设备现状评估（六维度）" : "Condition Assessment"}</h4>
            </div>
            <div className="space-y-2">
              {[
                { key: "exterior", label: zh ? "外观漆面" : "Exterior" },
                { key: "rust", label: zh ? "锈蚀程度" : "Rust" },
                { key: "tires", label: zh ? "轮胎/履带" : "Tires" },
                { key: "cabin", label: zh ? "驾驶室/操作台" : "Cabin" },
                { key: "hydraulic", label: zh ? "液压渗漏" : "Hydraulic" },
                { key: "overall", label: zh ? "整体印象" : "Overall" },
              ].map(({ key, label }) => {
                const score = structured.conditionScores[key];
                if (score === undefined || score === null) return null;
                const pct = (Number(score) / 10) * 100;
                const color = Number(score) >= 8 ? "#10b981" : Number(score) >= 6 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-gray-600">{label}</span>
                    <div className="h-2 flex-1 rounded-full bg-gray-100">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="w-10 text-right text-xs font-bold" style={{ color }}>{score}/10</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Report Sections */}
        <div className="divide-y divide-gray-100 bg-white">
          {sections.map((section, i) => (
            <div key={i} className="px-5 py-4">
              <h3 className="mb-2 text-sm font-bold text-gray-900">
                <span className="mr-2 text-purple-500">{"\u00a7"}{i + 1}</span>
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
