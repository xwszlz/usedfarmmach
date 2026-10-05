/**
 * .cn → .com 产品同步「共享 HTTP 客户端」（运行于 .com / Vercel）
 *
 * 职责：
 * - 统一封装对 .cn 只读导出接口（GET /api/internal/products/export）的调用；
 * - 携带独立密钥 CN_SYNC_API_KEY（请求头 x-sync-key）；
 * - 20s 超时（AbortController）；
 * - **失败语义**：非 2xx / 网络错 / JSON 解析失败 → 一律返回 `null`，
 *   调用方必须按「失败」处理，**绝不能把 null 当空结果**（否则对账会误删）。
 *
 * 已实测的线上契约：
 * - 增量：{ success, mode:"incremental", count, nextSince, nextId, items[] }
 * - 全量：{ success, mode:"full", ids[], nextCursor, cursorReset }
 * - 缺/错 key → 401；非法 since → 400。
 */

export interface CnExportItem {
  id: string;
  [key: string]: unknown;
}

export interface IncrementalPage {
  items: CnExportItem[];
  nextSince: string | null;
  nextId: string | null;
}

export type FetchPageFn = (params: {
  since?: string;
  sinceId?: string;
  limit: number;
}) => Promise<IncrementalPage | null>;

const DEFAULT_BASE_URL = "https://usedfarmmach.cn";
const TIMEOUT_MS = 20_000;
const FULL_PAGE_LIMIT = 500;
const MAX_PAGES = 1000; // 硬上限防死循环
const MAX_CURSOR_RESETS = 5; // full 模式游标失效重来次数上限

/** 导出接口基址（可用 CN_SYNC_BASE_URL 覆盖，默认 .cn 正式域名） */
export function cnExportBaseUrl(): string {
  const raw = process.env.CN_SYNC_BASE_URL;
  return (raw && raw.trim()) || DEFAULT_BASE_URL;
}

/** 发起一次 JSON 请求；任何异常（超时/网络/非2xx/解析失败/缺密钥）均返回 null */
async function requestJson(url: string): Promise<unknown | null> {
  const key = process.env.CN_SYNC_API_KEY;
  if (!key) return null; // fail-closed：未配置密钥不请求

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-sync-key": key },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 拉取一页增量数据；失败返回 null（调用方不得视作空结果） */
export async function fetchIncremental(params: {
  since?: string;
  sinceId?: string;
  limit?: number;
}): Promise<IncrementalPage | null> {
  const qs = new URLSearchParams();
  if (params.since) qs.set("since", params.since);
  if (params.sinceId) qs.set("sinceId", params.sinceId);
  qs.set("limit", String(params.limit ?? 100));

  const body = (await requestJson(
    `${cnExportBaseUrl()}/api/internal/products/export?${qs.toString()}`
  )) as Record<string, unknown> | null;

  if (!body || body.success !== true || !Array.isArray(body.items)) return null;
  return {
    items: body.items as CnExportItem[],
    nextSince: typeof body.nextSince === "string" ? body.nextSince : null,
    nextId: typeof body.nextId === "string" ? body.nextId : null,
  };
}

/**
 * 增量分页循环（keyset 复合游标）：
 * - 下一页同时携带 since=nextSince 与 sinceId=nextId；
 * - **仅在 `items.length === limit` 时继续**，否则停止（不足一页 = 已到底）；
 * - fetchPage 返回 null（失败）→ 立即停止并回报 error（绝不视作空结果）；
 * - **时间预算**：`opts.deadlineAt`（epoch ms）存在时，在**每个 item 处理前**校验
 *   `Date.now() >= deadlineAt` → 立即 `return { error: "time-budget-exceeded" }`，
 *   **不处理该项**（安全停在「整条产品边界」，绝不半写）。
 *
 * `fetchPage` 可注入（单测用），默认走真实 fetchIncremental。
 */
export async function iterateIncremental(
  handler: (item: CnExportItem) => Promise<void>,
  opts: { since?: string; limit?: number; fetchPage?: FetchPageFn; deadlineAt?: number } = {}
): Promise<{ processed: number; pages: number; error: string | null }> {
  const limit = opts.limit ?? 100;
  const fetchPage: FetchPageFn = opts.fetchPage ?? fetchIncremental;
  const deadlineAt = opts.deadlineAt;

  let since = opts.since;
  let sinceId: string | undefined;
  let processed = 0;
  let pages = 0;

  for (let guard = 0; guard < MAX_PAGES; guard++) {
    const page = await fetchPage({ since, sinceId, limit });
    if (page === null) {
      return { processed, pages, error: "export-unreachable" };
    }
    pages++;
    for (const item of page.items) {
      // 时间预算守卫：超时则停在当前项之前（不处理该项），避免半写与平台强杀
      if (deadlineAt !== undefined && Date.now() >= deadlineAt) {
        return { processed, pages, error: "time-budget-exceeded" };
      }
      await handler(item);
      processed++;
    }
    if (page.items.length < limit) {
      return { processed, pages, error: null }; // 不足一页 → 到底
    }
    if (!page.nextSince || !page.nextId) {
      return { processed, pages, error: null }; // 服务端未给游标 → 结束
    }
    if (page.nextSince === since && page.nextId === sinceId) {
      // 游标未推进（服务端异常）→ 停手，避免空转 1000 页
      return { processed, pages, error: "cursor-stalled" };
    }
    since = page.nextSince;
    sinceId = page.nextId;
  }
  return { processed, pages, error: "page-limit-exceeded" };
}

/**
 * 拉取「全量 id 集合」（对账用，分页聚合防截断）。
 * - 任何一页失败 → 返回 null（对账据此不删）；
 * - 遇到 cursorReset=true（游标失效）→ 从头重来，用 Set 天然去重；
 * - 游标未推进 / 超过硬上限 → 返回 null（视作失败，不删）。
 */
export async function fetchFullIdSet(): Promise<Set<string> | null> {
  const ids = new Set<string>();
  let cursor: string | null = null;
  let resets = 0;

  for (let guard = 0; guard < MAX_PAGES; guard++) {
    const qs = new URLSearchParams({ mode: "full", limit: String(FULL_PAGE_LIMIT) });
    if (cursor) qs.set("cursor", cursor);

    const body = (await requestJson(
      `${cnExportBaseUrl()}/api/internal/products/export?${qs.toString()}`
    )) as Record<string, unknown> | null;

    if (!body || body.success !== true || !Array.isArray(body.ids)) return null;

    if (body.cursorReset === true && cursor) {
      if (++resets > MAX_CURSOR_RESETS) return null;
      cursor = null; // 游标失效 → 从第 1 页重来
      continue;
    }

    for (const id of body.ids as unknown[]) if (typeof id === "string") ids.add(id);

    const next = typeof body.nextCursor === "string" ? body.nextCursor : null;
    if (!next) return ids;
    if (next === cursor) return null; // 游标未推进 → 防死循环，视作失败
    cursor = next;
  }
  return null;
}
