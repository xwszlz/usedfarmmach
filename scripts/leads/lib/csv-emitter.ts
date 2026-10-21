/**
 * CSV 写出器 —— UTF-8 **带 BOM**（Excel 打开中文不乱码），RFC 4180 引号转义。
 *
 * 确定性要求：输出路径上禁止 `Date.now()` / `Math.random()` / `Object.keys` 顺序依赖。
 * 行序由调用方给定，本模块只做稳定编码。
 */

import * as fs from "fs";
import * as path from "path";

/** UTF-8 BOM */
export const BOM = "﻿";

/** Windows/Excel 友好行分隔 */
const CRLF = "\r\n";

/**
 * 单字段转义：含 `"` `,` `\r` `\n` 时整体加引号，`"` 翻倍。
 *
 * @param value 原始字段值
 */
export function escapeField(value: string): string {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.split('"').join('""')}"`;
  return text;
}

/**
 * 生成 CSV 文本（不含 BOM）。
 *
 * @param headers 表头（顺序即列顺序）
 * @param rows    数据行
 */
export function toCsv(headers: readonly string[], rows: readonly string[][]): string {
  const lines: string[] = [headers.map(escapeField).join(",")];
  for (const row of rows) {
    const cells: string[] = [];
    for (let i = 0; i < headers.length; i += 1) {
      cells.push(escapeField(i < row.length ? row[i] : ""));
    }
    lines.push(cells.join(","));
  }
  return `${lines.join(CRLF)}${CRLF}`;
}

/**
 * 写出带 BOM 的 UTF-8 CSV 文件（父目录不存在时自动创建）。
 *
 * @param filePath 目标路径
 * @param headers  表头
 * @param rows     数据行
 */
export function writeCsv(
  filePath: string,
  headers: readonly string[],
  rows: readonly string[][],
): void {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(path.resolve(filePath), `${BOM}${toCsv(headers, rows)}`, "utf8");
}

/**
 * 写出普通 UTF-8 文本文件（报告/清单用，同样带 BOM 以便 Excel/记事本直开）。
 *
 * @param filePath 目标路径
 * @param content  文本内容
 */
export function writeText(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(path.resolve(filePath), `${BOM}${content}`, "utf8");
}

/**
 * 从 `sourceUrl` 派生主机（用于 `[来源]公开渠道·<host>` 标记）。
 *
 * @param raw 来源链接原文
 */
export function hostOf(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";
  const withoutScheme = text.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, "");
  const slash = withoutScheme.indexOf("/");
  return (slash >= 0 ? withoutScheme.slice(0, slash) : withoutScheme).replace(/\s+/g, "");
}

/**
 * 规范来源链接：缺协议补 `https://`。
 *
 * @param raw 来源链接原文
 */
export function normalizeUrl(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(text)) return text;
  return `https://${text}`;
}
