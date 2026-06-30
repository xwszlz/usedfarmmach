/**
 * 日报内容 API — 供小程序内嵌页面使用（不依赖 web-view）
 * GET /api/daily-report?date=2026-06-30
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

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date") || "2026-06-30";
    const format = request.nextUrl.searchParams.get("format") || "text";

    // 安全校验：日期格式
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: "日期格式错误" }, { status: 400 });
    }

    const filePath = path.join(REPORTS_DIR, `${date}.html`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: false, error: "该日期暂无日报" }, { status: 404 });
    }

    const html = fs.readFileSync(filePath, "utf-8");

    // 提取标题
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1] : `神雕农机跨境套利日报 ${date}`;

    // 提取 body 内容
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    const bodyHtml = bodyMatch ? bodyMatch[1] : html;

    if (format === "html") {
      return NextResponse.json({ success: true, date, title, content: bodyHtml, type: "html" });
    }

    // 默认返回纯文本
    const text = stripHtml(bodyHtml);
    return NextResponse.json({ success: true, date, title, content: text, type: "text" });

  } catch (error) {
    console.error("读取日报失败:", error);
    return NextResponse.json({ success: false, error: "读取日报失败" }, { status: 500 });
  }
}
