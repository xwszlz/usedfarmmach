/**
 * 日报内容 API — 供小程序内嵌页面使用（不依赖 web-view）
 * GET /api/daily-report?date=2026-06-30
 *
 * 支持格式（按优先级）：
 *   1. .html 文件（历史数据，已渲染）
 *   2. .md 文件（当日新生成，Markdown原文返回）
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const REPORTS_DIR = path.join(process.cwd(), "public", "daily-reports");

function stripHtml(html: string): string {
  return html
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 简单的 Markdown → 纯文本转换（保留基本结构）
 */
function mdToText(md: string): string {
  return md
    // 移除图片语法 ![alt](url) → [图片]
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "[$1]")
    // 移除链接但保留文字 [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // 标题转为加粗标记
    .replace(/^#{6}\s+(.+)$/gm, "**$1**")
    .replace(/^#{5}\s+(.+)$/gm, "**$1**")
    .replace(/^#{4}\s+(.+)$/gm, "▸ $1")
    .replace(/^#{3}\s+(.+)$/gm, "【$1】")
    .replace(/^#{2}\s+(.+)$/gm, "═ $1 ═")
    .replace(/^#{1}\s+(.+)$/gm, "══ $1 ═══\n")
    // 表格处理：将 | 分隔转为空格对齐（简化版）
    .replace(/^\|(.+)\|$/gm, (_match, line: string) => {
      const cells = line.split("|").map(c => c.trim()).filter(Boolean);
      if (/^[\s\-:]+$/.test(cells.join(""))) return "─".repeat(20);
      return "  " + cells.join("  │  ") + "  ";
    })
    // 列表项
    .replace(/^[\s]*[-*+]\s+/gm, "• ")
    .replace(/^[\s]*\d+\.\s+/gm, "  $& ")
    // 粗体/斜体
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    // 引用块
    .replace(/^>\s+/gm, "💬 ")
    // 代码块简化
    .replace(/```[\s\S]*?```/g, "[代码]")
    // 行内代码
    .replace(/`([^`]+)`/g, "$1")
    // 分隔线
    .replace(/^---+$/gm, "──────────")
    // 清理多余空行
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date") || "2026-06-30";
    const format = request.nextUrl.searchParams.get("format") || "text";

    // 安全校验：日期格式
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: "日期格式错误" }, { status: 400 });
    }

    // 优先级1: HTML文件
    const htmlPath = path.join(REPORTS_DIR, `${date}.html`);
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, "utf-8");
      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      const title = titleMatch ? titleMatch[1] : `神雕农机跨境套利日报 ${date}`;
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
      const bodyHtml = bodyMatch ? bodyMatch[1] : html;

      if (format === "html") {
        return NextResponse.json({ success: true, date, title, content: bodyHtml, type: "html" });
      }
      const text = stripHtml(bodyHtml);
      return NextResponse.json({ success: true, date, title, content: text, type: "html-text" });
    }

    // 优先级2: Markdown文件（当日新生成的报告）
    const mdPath = path.join(REPORTS_DIR, `${date}_跨境套利日报.md`);
    if (fs.existsSync(mdPath)) {
      const mdContent = fs.readFileSync(mdPath, "utf-8");

      if (format === "raw") {
        return NextResponse.json({ success: true, date, title: `神雕农机跨境套利日报 ${date}`, content: mdContent, type: "markdown" });
      }
      // 默认转换为小程序可读文本
      const text = mdToText(mdContent);
      return NextResponse.json({ success: true, date, title: `神雕农机跨境套利日报 ${date}`, content: text, type: "markdown-text" });
    }

    // 都没有找到
    return NextResponse.json({
      success: false,
      error: "该日期暂无日报",
      hint: `查找路径:\n  - ${htmlPath}\n  - ${mdPath}`,
    }, { status: 404 });

  } catch (error) {
    console.error("读取日报失败:", error);
    return NextResponse.json({ success: false, error: "读取日报失败" }, { status: 500 });
  }
}
