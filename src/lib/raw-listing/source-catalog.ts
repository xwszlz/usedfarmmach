/**
 * 采集来源目录（source catalog）—— **零新增列**，全部从既有字段派生
 *
 * `RawListing.source` 已经隐含了「获取方式（channel）」与「行类型（rowKind）」：
 *   - channel：搜索导入 / 站内爬虫 / 人工录入；
 *   - rowKind：人工录入的经销商/线索 → dealer；采集挂牌 → listing。
 * 因此**不新增任何列**，只在查询期派生出来，供列表过滤与 UI 分组使用。
 *
 * 另外提供 `derivePlatform(sourceUrl)`：从既有 `sourceUrl` 派生平台裸域名（剥 `www./a./m.`），
 * 同样零新增列，供 UI 展示「来自哪个平台」。
 */

// ───────────────────────────────────────────────
// 1. 类型定义
// ───────────────────────────────────────────────

/** 获取渠道（从 source 派生，不入库） */
export type Channel = "crawler" | "websearch" | "manual";

/** 行类型：人工录入的经销商/线索 vs 采集挂牌 */
export type RowKind = "dealer" | "listing";

/** channel → 中文标签（供 UI 展示） */
export const SOURCE_KIND_LABEL: Readonly<Record<Channel, string>> = {
  websearch: "搜索采集",
  crawler: "爬虫采集",
  manual: "人工录入",
};

// ───────────────────────────────────────────────
// 2. 行类型派生
// ───────────────────────────────────────────────

/**
 * 行类型派生：人工录入（manual_*）视为经销商/线索，其余（含采集与历史脏值）视为挂牌。
 */
export function rowKind(source: string): RowKind {
  if (source.startsWith("manual_")) return "dealer";
  if (source.startsWith("domestic_")) return "listing";
  return "listing"; // 兜底
}

// ───────────────────────────────────────────────
// 3. 获取渠道派生
// ───────────────────────────────────────────────

/**
 * 获取渠道派生（零新增列）：
 *   - `domestic_websearch` → `websearch`
 *   - `domestic_*`（其余） → `crawler`
 *   - `manual_*`          → `manual`
 *   - 其它（含空串/历史脏值）→ `crawler`（兜底，保持既有「站内来源」语义）
 */
export function channel(source: string): Channel {
  if (source === "domestic_websearch") return "websearch";
  if (source.startsWith("domestic_")) return "crawler";
  if (source.startsWith("manual_")) return "manual";
  return "crawler";
}

// ───────────────────────────────────────────────
// 4. 平台派生（sourceUrl → host）
// ───────────────────────────────────────────────

/** 需要剥掉的常见主机前缀（多子域场景会循环剥离） */
const HOST_PREFIXES: readonly string[] = ["www.", "a.", "m."];

/** 合法 host 判定：仅含 [a-z0-9.\-]、且至少含一个 "."，无首尾连字符 */
function isValidHost(host: string): boolean {
  return /^[a-z0-9.\-]+$/.test(host) && host.includes(".") && !host.startsWith(".") && !host.endsWith(".");
}

/** 剥离 `www.` / `a.` / `m.` 等移动/镜像前缀，得到裸域名 */
function stripHostPrefixes(host: string): string {
  let result = host || "";
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of HOST_PREFIXES) {
      if (result.startsWith(prefix) && result.length > prefix.length) {
        result = result.slice(prefix.length);
        changed = true;
      }
    }
  }
  return result;
}

/** URL 解析失败时的兜底：手动切掉协议与路径/端口，只留下 host 部分 */
function extractHostFallback(rawUrl: string): string {
  const withoutProtocol = rawUrl.replace(/^[a-z][a-z0-9+.\-]*:\/\//i, "");
  const hostPart = withoutProtocol.split(/[\/?#]/)[0] ?? "";
  // 去掉可能的 `user:pass@` 与 `:port`
  const withoutUserinfo = hostPart.includes("@")
    ? hostPart.slice(hostPart.lastIndexOf("@") + 1)
    : hostPart;
  const withoutPort = withoutUserinfo.replace(/:\d+$/, "");
  const candidate = stripHostPrefixes(withoutPort.trim().toLowerCase());
  return isValidHost(candidate) ? candidate : "";
}

/**
 * `sourceUrl` → 平台裸域名（小写，剥掉 `www.` / `a.` / `m.`）。
 * 取不到（空串 / 无法解析 / 不像 host）时返回 `""`。
 */
export function derivePlatform(sourceUrl: string): string {
  const raw = (sourceUrl ?? "").trim();
  if (!raw) return "";

  let candidate = raw;
  if (!/^[a-z][a-z0-9+.\-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, "")}`;
  }
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    const stripped = stripHostPrefixes(host);
    return isValidHost(stripped) ? stripped : "";
  } catch {
    return extractHostFallback(raw);
  }
}
