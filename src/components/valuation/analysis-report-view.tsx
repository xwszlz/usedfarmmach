"use client";

import { useState, useMemo, useRef } from "react";
import { Printer, Download, Copy, Check, BarChart3, FileText, Loader2, AlertTriangle } from "lucide-react";
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

// ═══════════════════════════════════════════════════════════
// 报告尾部 JSON 小节清洗规则
// ═══════════════════════════════════════════════════════════
//
// 真实故障（老板实测）：报告结尾多出一个「§7 结构化数据（JSON）」小节，只有标题没有内容。
//
// 根因链：prompt 曾要求模型在正文末尾写 `## 结构化数据（JSON）` 小标题 + 一句引导语
// + ```json 代码块；此处清洗只删代码块 ⇒ **标题与引导语原样留下**，而 `split(/^## /)`
// 又把它切成最后一个 section，于是渲染成一个空标题。
//
// 为什么前端必须独立做一遍（后端 route 也在清洗，且历史报告已被后端洗过）：
//   ① 「下载 HTML」走的是前端渲染结果，前端不清洗 ⇒ 导出的 HTML 里仍有空标题；
//   ② 「复制MD」复制的是后端文本，但用户手上正在看的历史报告 / 缓存响应 / 边界情况
//      （如 `partial` 降级、max_tokens 截断）仍可能残留；
//   ③ 防御性去重是幂等的，多洗一次没有任何副作用。

/**
 * ① 残留中文小标题：行首可选 `#` + 空白 + `结构化数据`，整行删除。
 * 例：`## 结构化数据（JSON）` / `**结构化数据（JSON）**` / `结构化数据`
 */
const JSON_SECTION_HEADING_CN = /^[ \t]*#{0,6}[ \t]*\**结构化数据[^\n]*$/gim;

/**
 * ② 残留外语小标题（模型按 locale 换语种后标题名会变，抓不住中文）：
 * 以 `#` 开头且该行出现 JSON 字样的整行。
 * 例：`## Structured Data (JSON)` / `## Données structurées (JSON)`
 */
const JSON_SECTION_HEADING_MD = /^[ \t]*#{1,6}[^\n]*\bJSON\b[^\n]*$/gim;

/**
 * ③ 残留引导语行（「最后附上一个JSON代码块，包含…」这类纯说明行），整行删除。
 * 中文：最后附上 / 最后附加 / 附上一个 / 以下为结构化数据
 * 英文：Finally, append… / Lastly, output…
 */
const JSON_SECTION_LEAD_CN =
  /^[ \t]*(?:最后附上|最后附加|附上一个|以下为结构化数据|下面是结构化数据)[^\n]*$/gim;
const JSON_SECTION_LEAD_EN =
  /^[ \t]*(?:finally|lastly)[,]?[ \t]+(?:append|output|provide|attach|here\s+is)[^\n]*$/gim;

/** ④ 连续 3 行以上空行（含只含空格的行）→ 压成 1 个空行 */
const EXCESS_BLANK_LINES = /\n(?:[ \t]*\n){2,}/g;

/** ⑤ 小节标题命中即整段丢弃（内容被删光后只剩个标题的形状） */
const JSON_SECTION_TITLE = /(结构化数据|structured\s*data)/i;

/**
 * 把 Markdown 正文切成小节。
 *
 * 两步走（顺序不能反）：
 *   A. **字符串级清洗**：剥掉 ```json 围栏块 + 残留标题行 + 引导语行 + 多余空行；
 *   B. **小节级过滤**：切出来的 section 只要「标题命中结构化数据」或「正文为空」就丢弃
 *      —— 清洗后有些残留只剩一个标题，字符串级规则抓不全，必须在这一层再兜一道。
 *
 * ⚠️ 本函数只负责**显示层**。`data.structured`（指标卡 / 技术参数表 / 六维度评分）
 * 是调用方用 `extractStructured()` 从原始报告里解析的，与此处删标题完全无关，勿动。
 *
 * 兜底原则：过滤不能把整份报告洗成空白页。若过滤后一条不剩（例如模型没写任何 `## `，
 * 通篇只有一段话），退回「过滤前的小节」但**仍然**剔除结构化数据标题。
 *
 * @param md 模型返回的原始 Markdown（可能含尾部 JSON 代码块与残留标题）
 * @returns 可渲染的小节列表（保证 title 非空）
 */
export function parseMarkdownSections(md: string): ReportSection[] {
  const source = typeof md === "string" ? md : "";
  // Remove JSON code block at end
  // 兜底加固：① 完整围栏块（大小写不敏感）② 被 max_tokens 截断、缺闭合 ``` 的尾部 JSON
  // ③ 残留的孤立围栏行 —— 三种情况都不该在正文里露出裸 JSON
  const cleaned = source
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*$/i, "")
    .replace(/^```+$/gm, "")
    // ④ 残留标题 / 引导语（模型不听话时的兜底；必须在 trim 之前做，行锚点依赖原始换行）
    .replace(JSON_SECTION_HEADING_CN, "")
    .replace(JSON_SECTION_HEADING_MD, "")
    .replace(JSON_SECTION_LEAD_CN, "")
    .replace(JSON_SECTION_LEAD_EN, "")
    // ⑤ 删行后留下的空洞压平：3 行以上空行 → 1 个空行（保留段落分隔，勿压成单个换行）
    .replace(EXCESS_BLANK_LINES, "\n\n")
    .trim();

  // Split by ## headings
  const parts = cleaned.split(/^## /m).filter((s) => s.trim());

  /** 原始切分结果（过滤前的形状，仅用于最后兜底） */
  const rawSections: ReportSection[] = [];
  /** 通过过滤的结果 */
  const sections: ReportSection[] = [];

  for (const part of parts) {
    const lines = part.split("\n");
    const title = lines[0].trim();
    const content = lines.slice(1).join("\n").trim();
    if (!title) continue;
    // 标题本身就是结构化数据小节 ⇒ 整段丢弃（它的正文只是 JSON，已在上方删掉）
    if (JSON_SECTION_TITLE.test(title)) continue;
    rawSections.push({ title, content });
    // 正文为空的小节渲染出来就是一个空标题 —— 一律不展示
    if (!content) continue;
    sections.push({ title, content });
  }

  if (sections.length > 0) return sections;

  // 兜底：过滤后一条不剩时保留原文（避免整份报告白屏），但标题命中结构化数据的仍剔除
  return rawSections.filter((s) => s.title && !JSON_SECTION_TITLE.test(s.title));
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

/**
 * 用 Blob 触发浏览器下载。
 *
 * 两处历史教训（前两次修复都栽在这里，别改回去）：
 * - 必须先 appendChild 进 DOM：游离节点的 click() 在部分浏览器/内嵌场景会静默失效；
 * - 不能同步 revokeObjectURL：浏览器可能尚未开始读取 Blob，提前回收会让下载被静默取消。
 */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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

// ═══════════════════════════════════════════════════════════
// 报告外壳文案（网页版 + 下载 HTML 共用）
// ═══════════════════════════════════════════════════════════
//
// 现状：`.com` 与 `.cn` 共用本组件，`.com` 会传 ru/es/pt/ar/fr/hi。
// 本次只把**硬编码中文**（`<html lang>` / `<title>` / 报告头 / 页脚）按 locale 出文案，
// 仍是「中文 / 英文」二元判断 —— 扩到 8 语种是独立工作量的活，本次不做；
// 保证 ru/es/pt/ar/fr/hi 走英文分支且不崩即可。

/** 报告外壳需要本地化的固定文案 */
interface ReportShellText {
  /** `<html lang>` 的取值（BCP-47） */
  htmlLang: string;
  /** `<html dir>`：阿拉伯语需要 rtl，否则整篇错位 */
  dir: "ltr" | "rtl";
  /** 下载 HTML 的 `<title>` 前缀 */
  htmlTitle: string;
  /** 报告头大标题（网页版与导出共用） */
  headerTitle: string;
  /** 报告头「报告编号」标签 */
  reportIdLabel: string;
  /** 报告头「生成时间」标签 */
  generatedLabel: string;
  /** 页脚站点署名 */
  footerBrand: string;
  /** 页脚免责声明 */
  footerNotice: string;
  /** 下载文件名前缀（`深度分析报告_xxx.html`） */
  filenamePrefix: string;
}

/** locale → `<html lang>` 取值（阿拉伯语单独给 rtl） */
const HTML_LANG_BY_LOCALE: Record<string, string> = {
  zh: "zh-CN",
  en: "en",
  ru: "ru",
  es: "es",
  pt: "pt",
  ar: "ar",
  fr: "fr",
  hi: "hi",
};

const REPORT_SHELL_ZH: ReportShellText = {
  htmlLang: "zh-CN",
  dir: "ltr",
  htmlTitle: "深度分析报告",
  headerTitle: "AI 深度分析报告",
  reportIdLabel: "报告编号",
  generatedLabel: "生成时间",
  footerBrand: "神雕农机 usedfarmmach.com",
  footerNotice: "本报告由AI生成，仅供参考",
  filenamePrefix: "深度分析报告",
};

const REPORT_SHELL_EN: ReportShellText = {
  htmlLang: "en",
  dir: "ltr",
  htmlTitle: "Deep Analysis Report",
  headerTitle: "AI Deep Analysis Report",
  reportIdLabel: "Report ID",
  generatedLabel: "Generated",
  footerBrand: "ShenDiao Agri Machinery · usedfarmmach.com",
  footerNotice: "AI-generated, for reference only",
  filenamePrefix: "Deep_Analysis_Report",
};

/**
 * 取当前语种的报告外壳文案。
 *
 * `zh` → 中文；其余（含 ru/es/pt/ar/fr/hi 与非法值）→ 英文。
 * `htmlLang` / `dir` 则是真正的 8 语种映射（这两个是 HTML 结构化属性，与文案不同层）。
 */
function resolveReportShell(locale: string | undefined): ReportShellText {
  const primary =
    typeof locale === "string" ? locale.trim().toLowerCase().split(/[-_]/)[0] : "";
  const shell = primary === "zh" ? REPORT_SHELL_ZH : REPORT_SHELL_EN;
  const htmlLang = HTML_LANG_BY_LOCALE[primary] ?? shell.htmlLang;
  const dir: "ltr" | "rtl" = primary === "ar" ? "rtl" : "ltr";
  return { ...shell, htmlLang, dir };
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
  // 下载态：downloading 防重复点击；downloadError 让任何失败都在页面上可见（本次修复的核心）
  const [downloading, setDownloading] = useState(false);
  const [downloadOk, setDownloadOk] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [errorCopied, setErrorCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const reportId = useMemo(() => genReportId(), []);
  const reportTime = useMemo(() => new Date().toLocaleString("zh-CN"), []);
  /** 报告外壳文案（`<html lang>` / 标题 / 页脚；zh → 中文，其余语种 → 英文） */
  const shell = useMemo(() => resolveReportShell(locale), [locale]);

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

  // 数据驱动重建独立 HTML（不再拷贝带 Tailwind 的 innerHTML —— 拷贝会导致
  // ①模板表头+组件表头重复 ②柱状图/加粗/列表全部丢样式）。样式全部内联。
  //
  // 报障场景：「下载HTML」点了没反应，且线上 bundle 已是修复版 —— 说明失败发生在
  // 运行时且被 React 事件处理器静默吞掉（异常只进 console，页面零反馈）。所以整个
  // 函数体包进 try/catch：要么成功，要么把失败原因直接显示到页面上（见下方红色提示区）。
  const handleDownloadHtml = async () => {
    setDownloadError(null);
    setDownloadOk(false);
    setDownloading(true);
    try {
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
<html lang="${shell.htmlLang}" dir="${shell.dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(shell.htmlTitle)} ${reportId}</title>
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
  <h1>${esc(shell.headerTitle)}</h1>
  <div class="meta">${esc(shell.reportIdLabel)}：${reportId} | ${esc(shell.generatedLabel)}：${reportTime} | ${esc(structured?.brand || "")} ${esc(structured?.modelName || "")}</div>
</div>
${metrics.length > 0 ? `<div class="metrics">${metricsHtml}</div>` : ""}
${chartHtml}
${techHtml}
${condHtml}
${sectionsHtml}
<div class="footer">
  ${esc(shell.footerBrand)} | ${esc(shell.footerNotice)} | ${esc(shell.reportIdLabel)}：${reportId}
</div>
</body>
</html>`;
    const filename = `${shell.filenamePrefix}_${reportId}.html`;

    // ── 主路径：走服务端通道，与前端 blob 解耦（失败原因通过 HTTP 状态/JSON 可观测）──
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch("/api/report/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ html, filename }),
      });
      if (!res.ok) {
        let msg = `服务端下载失败（HTTP ${res.status}）`;
        try {
          const j = await res.json();
          if (j?.error) msg = String(j.error);
        } catch {
          /* 响应不是 JSON，沿用上面的默认文案 */
        }
        throw new Error(msg);
      }
      saveBlob(await res.blob(), filename);
    } catch (e1: any) {
      // ── 兜底：服务端通道不可用时退回纯前端 Blob 直出（历史实现，保留）──
      try {
        saveBlob(new Blob([html], { type: "text/html;charset=utf-8" }), filename);
      } catch (e2: any) {
        throw new Error(
          `服务端下载失败：${e1?.message || String(e1)}；本地兜底下载也失败：${e2?.message || String(e2)}`
        );
      }
    }

    setDownloadOk(true);
    setTimeout(() => setDownloadOk(false), 3000);
    } catch (err: any) {
      // 生成失败 / 两条通道都失败 —— 一律显示到页面，不再静默
      setDownloadError(err?.message || String(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyError = () => {
    if (!downloadError) return;
    navigator.clipboard
      .writeText(downloadError)
      .then(() => {
        setErrorCopied(true);
        setTimeout(() => setErrorCopied(false), 2000);
      })
      .catch(() => {
        /* 非安全上下文下 clipboard 不可用，忽略 */
      });
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
          disabled={downloading}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {downloading ? (zh ? "下载中…" : "Downloading") : zh ? "下载HTML" : "Download"}
        </button>
      </div>

      {/* 下载结果反馈：失败必须可见（终结「点了没反应」的盲猜循环） */}
      {downloadOk && (
        <div className="no-print mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          {zh ? "已开始下载，若无反应请检查浏览器下载拦截" : "Download started — check your download blocker if nothing happens"}
        </div>
      )}
      {downloadError && (
        <div className="no-print mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{zh ? "下载失败" : "Download failed"}</div>
              <div className="mt-1 break-all">{downloadError}</div>
              <div className="mt-1 text-[10px] text-red-400">
                {zh ? "请把此错误信息截图反馈，便于定位" : "Screenshot this error and send it to support"}
              </div>
            </div>
            <button
              onClick={handleCopyError}
              className="shrink-0 rounded border border-red-300 px-2 py-1 text-[11px] text-red-700 hover:bg-red-100"
            >
              {errorCopied ? (zh ? "已复制" : "Copied") : zh ? "复制错误信息" : "Copy error"}
            </button>
          </div>
        </div>
      )}

      {/* Report Body */}
      <div ref={reportRef} className="overflow-hidden rounded-xl border border-gray-200">
        {/* Report Header */}
        <div
          className="px-5 py-4 text-white"
          style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h3 className="text-base font-bold">{shell.headerTitle}</h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-80">
            <span>{shell.reportIdLabel}：{reportId}</span>
            <span>{shell.generatedLabel}：{reportTime}</span>
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
          {shell.footerBrand} | {shell.footerNotice} | {reportId}
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
