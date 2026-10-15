/**
 * POST /api/report/download
 * 报告 HTML 下载通道（纯回显：不落盘、不写库、不记正文）
 *
 * 为什么需要它
 * ------------
 * 「AI 估值报告」/「AI 深度分析报告」的「下载HTML」按钮已**第三次**报障「点了没反应」。
 * 前两次修复（40fa995、2ce8f0a）都只在前端 blob 下载机制上打补丁，但已验证线上 .cn
 * 生产环境两个报告组件的 bundle 都已是修复版，且同机同浏览器下深度分析报告能下载、
 * 只有估值报告不能 —— 说明失败发生在运行时、且被 React 事件处理器静默吞掉（异常
 * 只进 console，页面零反馈），因此无法定位。
 *
 * 本端点提供一条与前端 blob 完全解耦的下载通道：客户端把生成好的 HTML POST 上来，
 * 服务端用标准 `Content-Disposition: attachment` 回吐，由浏览器走**原生下载语义**。
 * 好处是失败可被观测：鉴权失败 401、体积超限 413、缺内容 400，客户端据此把原因
 * 直接显示到页面上，终结「盲猜根因」的循环。
 *
 * 安全约束
 * --------
 * 1. 必须登录（沿用 getTokenFromHeaders + verifyToken 模式），未登录 401；
 * 2. 请求体上限 5MB（按 UTF-8 字节计），超限 413；
 * 3. 文件名强制净化：剥离路径分隔符 / 控制字符 / Windows 非法字符 / `..`，
 *    扩展名强制为 `.html`，非 ASCII 名走 RFC 5987 `filename*`；
 * 4. 纯回显：不落盘、不写数据库、不记日志正文。
 *
 * Body:    { html: string, filename?: string }
 * Returns: 200 text/html 附件；错误时沿用统一响应 { success: false, error, code }
 */

import { NextRequest, NextResponse } from "next/server";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

// 只导出 POST：不读库、不导出 GET，因此不会被 next build 静态预渲染（见
// scripts/check-route-dynamic.mjs）。这里仍显式声明，避免后续有人补 GET 时踩坑。
export const dynamic = "force-dynamic";

/** 请求体（html 字符串）UTF-8 字节上限：5MB */
const MAX_HTML_BYTES = 5 * 1024 * 1024;

/** 文件名长度护栏（含扩展名） */
const MAX_NAME_LEN = 120;

const DEFAULT_FILENAME = "report.html";

/**
 * 净化文件名 —— 防路径穿越 + 防非法字符 + 强制 .html 扩展名。
 *
 * 规则顺序很重要：先剥离分隔符与控制字符，再去 `..`，最后强制扩展名，
 * 保证 `../../evil.exe`、`a/../../b.html`、`.html` 这类输入都收敛成安全的名字。
 */
function sanitizeFilename(raw: unknown): string {
  const input = typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_FILENAME;

  let name = input
    // 路径分隔符统一打成下划线（含 Windows 的 \ 与 POSIX 的 /）
    .replace(/[\\/]/g, "_")
    // 控制字符（含 NUL / CR / LF —— CRLF 会污染 Content-Disposition 响应头）
    .replace(/[\x00-\x1f\x7f]/g, "")
    // Windows 非法字符
    .replace(/[:*?"<>|]/g, "_");

  // 去掉 `..`：即便分隔符已被打散，仍不残留点段
  name = name.replace(/\.{2,}/g, ".");

  // 强制 .html：先摘掉已有的 html/htm/HTML 后缀，再统一追加，避免 `.html.html`
  name = name.replace(/\.(html?|htm)$/i, "");
  name = `${name}.html`;

  // Windows 不允许文件名以点或空格结尾；这里一并去掉前导点
  name = name.replace(/^\.+/, "").replace(/\s+$/, "").trim();

  if (!name || name === ".html" || name === "html") name = DEFAULT_FILENAME;
  if (name.length > MAX_NAME_LEN) name = name.slice(name.length - MAX_NAME_LEN);
  return name;
}

/**
 * `filename="..."` 的 ASCII 兜底：老浏览器不认 RFC 5987 的 `filename*`，
 * 这里退化成全 ASCII（中文变 `_`），保证响应头在任何实现下都合法。
 */
function asciiFallback(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return ascii.trim() || DEFAULT_FILENAME;
}

function fail(status: number, error: string, code: string) {
  return NextResponse.json({ success: false, error, code }, { status });
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. 鉴权：沿用 deep-analysis 的 getTokenFromHeaders + verifyToken 模式 ──
    const token = getTokenFromHeaders(request.headers);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return fail(401, "请先登录后再下载报告", "AUTH_REQUIRED");
    }

    // ── 2. 解析请求体 ──
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "请求体不是合法 JSON", "INVALID_JSON");
    }

    const { html, filename } = (body ?? {}) as { html?: unknown; filename?: unknown };

    if (typeof html !== "string" || !html.trim()) {
      return fail(400, "缺少报告内容（html 为空）", "EMPTY_HTML");
    }

    // ── 3. 体积上限（按 UTF-8 字节计，中文不会因字符数被低估）──
    const byteLen = Buffer.byteLength(html, "utf8");
    if (byteLen > MAX_HTML_BYTES) {
      return fail(
        413,
        `报告内容过大（${(byteLen / 1024 / 1024).toFixed(2)}MB），超出 5MB 上限`,
        "HTML_TOO_LARGE"
      );
    }

    // ── 4. 回显：文件名净化 + 双写 filename / filename* ──
    const safeName = sanitizeFilename(filename);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="${asciiFallback(safeName)}"; ` +
          `filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("[ReportDownload] 未处理异常:", error);
    return fail(500, "报告下载服务暂时不可用，请稍后重试", "DOWNLOAD_FAILED");
  }
}
