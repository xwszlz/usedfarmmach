/**
 * mascus 线索采集入库（cron / 手动触发的执行体）
 *
 * 业务目的：
 *   mascus 每周新增 436～1011 台二手农机挂牌，每条都带「卖家电话 + 公司名 + 城市」。
 *   此前这条数据只被 benchmark-engine 当「国际价格基准」用，而基准解析器按价格过滤，
 *   把大量「无价但带电话」的线索直接丢掉了 —— 尤其 hay-and-forage-machines 段，
 *   实测 40 条里 `priceEURO > 0` 只有 1 条（无价率 97.5%），而这整段都带卖家电话。
 *   （价格比例按品类差异极大：tractors 27/40、agricultural-harvesters 24/40，三者加权约 57% 有价，
 *     详见 parse.ts 文件头；结论不变：**不能按价格过滤**。）
 *   本模块把线索**完整**收进独立线索池 `MascusListing`，供后续分配给销售跟进。
 *
 * 与既有链路的关系：
 *   - 与 `RawListing` / `Product` / `Dealer` **完全解耦**：不写这三张表，不做内容哈希去重，
 *     只按 mascus `productId` 幂等 upsert，避免污染线索清洗与产品转换流程。
 *   - 解析逻辑全部在 `./parse`（纯函数），本文件只负责「抓页 → 去重 → 落库」。
 *
 * 抓取要点（实测）：
 *   - URL 形如 `https://www.mascus.com/agriculture/<seg>?lastcreateddays=2&page=P`，
 *     旧的 `?q=` / 品牌参数被服务端完全忽略。
 *   - 必须带浏览器 UA（裸请求会被挡），响应约 650KB / 3 秒。
 *   - 超时**禁止**用 `AbortSignal.timeout()`（历史 P0：该 API 在部分运行时不存在，
 *     线上直接被它打挂）。统一用 `AbortController` + `setTimeout` + `clearTimeout`，
 *     与 `src/lib/net/abort-timeout.ts` 的约定保持一致。
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  MASCUS_ORIGIN,
  MASCUS_PAGE_SIZE,
  MASCUS_SCAN_SEGMENTS,
  buildMascusSearchUrl,
  dedupeByProductId,
  findEmptySegments,
  parseMascusNextData,
} from "./parse";
import type { ParsedMascusListing, SegmentScanStat } from "./parse";

/** `ingestMascusLeads` 的可选参数（全部有默认值，cron 里零参数调用即可） */
export interface IngestOptions {
  /** 只扫指定品类路径；默认扫全部 5 段（见 MASCUS_SCAN_SEGMENTS） */
  segmentPaths?: string[];
  /** 最近 N 天上新（mascus `lastcreateddays`），默认 2 */
  recentDays?: number;
  /** 每个品类段最多翻多少页，默认 5（每页 40 条，即每段每轮最多 200 条） */
  maxPages?: number;
  /** 单页请求超时毫秒，默认 25000 */
  timeoutMs?: number;
  /**
   * 整轮采集总预算毫秒，默认 220000（< cron `maxDuration = 300`，给入库留余量）。
   * 超预算即停止翻页，**已抓到的条目照常入库**。`<= 0` 表示一开始就收工（便于单测）。
   */
  budgetMs?: number;
  /** true 时只统计（仍会读库判断新增/更新），不写库 */
  dryRun?: boolean;
}

/** `ingestMascusLeads` 的返回结构（cron 直接透传给调用方） */
export interface IngestResult {
  /**
   * 本轮是否「真的成功」：`failedPages === 0 && failedUpserts === 0`。
   * 刻意**不是**恒 true —— 15 页全失败也返回绿会让 Vercel cron（只看状态码）永久静默。
   */
  ok: boolean;
  fetchedPages: number;
  failedPages: number;
  /** 本次抓到的条目总数（去重前） */
  items: number;
  /** 去重后的条目数（实际尝试入库条数） */
  uniqueItems: number;
  inserted: number;
  updated: number;
  /** upsert 过程中失败的行数（逐条容错，不中断整轮） */
  failedUpserts: number;
  bySegment: Record<string, number>;
  /**
   * 本轮「0 条」的品类段 key 列表（`items === 0 && totalResults === 0`）。
   * 非空即代表可能是路径失效 / 品类改名，必须人工核对 —— 这是死段唯一的防线。
   */
  emptySegments: string[];
  /**
   * 本轮「结构性截断」的品类段（`totalResults > maxPages × 40`）。
   * 非空代表 `maxPages` 这个容量上限已经装不下该段日增，**超出部分永久丢线索**
   * （窗口是 recency desc，今天第 201 位明天只会更靠后，永远滑不进前 N 页），故必须外显。
   * 🔴 判据**有意不包含**「抓取失败导致的少采」—— 那属 `failedPages`，两者必须分开，
   * 否则运维无法区分「该调大 maxPages」和「该重试」。
   */
  truncatedSegments: string[];
  /** 是否因总预算耗尽而提前收工（已抓到的条目仍然入库，不算失败） */
  budgetExhausted: boolean;
  tookMs: number;
}

/** 带品类段标记的线索（`scanSegment` 由采集侧补上，解析层与 DB 无关） */
interface ScannedListing extends ParsedMascusListing {
  scanSegment: string;
}

const DEFAULT_RECENT_DAYS = 2;
/**
 * 每段最多 5 页（200 条）—— 这个上限**必须 ≥ `ceil(最大 totalResults / 40)`**，理由是
 * 「截断 = 永久丢失」而不是「晚点再收」：
 *   `lastcreateddays=N` 的排序是 recency desc。今天排在 121 位的条目，明天窗口右移、
 *   新挂牌插到前面、最老的一批从尾部掉出窗口 —— 它的名次只会继续往后推，**永远不会滑进前 120**。
 *   所以 3 页（120 条）不是「明天再补」，而是每天稳定丢掉 tractors 后 43 条 + tillage 后 46 条。
 *   实测最大 totalResults = 166（tillage-machines），`ceil(166/40) = 5` ⇒ 取 5 才不丢尾巴。
 * 220s 预算仍是兜底：真慢下来会以 `budgetExhausted=true` 暴露，不会静默。
 * 注意 `budgetExhausted`（提前收工）与 `truncatedSegments`（容量装不下）是**两个独立信号**，
 * 不要指望预算一耗尽 truncatedSegments 就跟着报 —— 容量够的时候它就是空。
 */
const DEFAULT_MAX_PAGES = 5;
const DEFAULT_TIMEOUT_MS = 25000;
/** 整轮预算：5 段 × 5 页 × 25s 最坏 625s，会远超 maxDuration=300，必须有总闸 */
const DEFAULT_BUDGET_MS = 220000;
/**
 * 同一品类段连续失败多少页后放弃该段。
 * 必须**小于** `DEFAULT_MAX_PAGES`(5)，否则在默认配置下这个分支永远走不到
 * （凑满阈值时本来就是最后一页），注释与实际行为不符 —— 故取 2。
 */
const MAX_CONSECUTIVE_PAGE_FAILURES = 2;
/** upsert 分批大小（Prisma 无批量 upsert，分批以便控制连接与日志粒度） */
const UPSERT_BATCH_SIZE = 50;
const REQUEST_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
/** 允许的最终落点 host（跳转后校验用，唯一真源仍是 MASCUS_ORIGIN） */
const MASCUS_HOST = new URL(MASCUS_ORIGIN).hostname;

/**
 * 采集并入库 mascus 线索。
 *
 * @param opts 见 {@link IngestOptions}；省略即为「5 段 × 5 页 / 最近 2 天 / 25s 单页超时 / 220s 总预算」
 * @returns 采集与入库统计
 * @throws 当 `SITE` 不是 `com` 时抛错（合规闸门：`.cn` 侧不允许采集境外线索）
 */
export async function ingestMascusLeads(opts: IngestOptions = {}): Promise<IngestResult> {
  // 🔴 合规闸门（入口第一行）：mascus 线索只允许在 .com（境外）侧采集入库。
  if ((process.env.SITE ?? "com") !== "com") {
    throw new Error(
      "[合规] mascus 线索采集仅允许在 .com 侧运行，当前 SITE=" + (process.env.SITE ?? "com")
    );
  }

  const startedAt = Date.now();
  const recentDays = positiveInt(opts.recentDays, DEFAULT_RECENT_DAYS);
  const maxPages = positiveInt(opts.maxPages, DEFAULT_MAX_PAGES);
  const timeoutMs = positiveInt(opts.timeoutMs, DEFAULT_TIMEOUT_MS);
  // 预算允许 <= 0（语义：一开始就收工），故不走 positiveInt
  const budgetMs = finiteInt(opts.budgetMs, DEFAULT_BUDGET_MS);
  const dryRun = opts.dryRun === true;
  const segments = resolveSegments(opts.segmentPaths);

  let fetchedPages = 0;
  let failedPages = 0;
  let budgetExhausted = false;
  const scanned: ScannedListing[] = [];
  const bySegment: Record<string, number> = {};
  const segmentStats: SegmentScanStat[] = [];

  for (const segment of segments) {
    bySegment[segment.key] = 0;
    let consecutiveFailures = 0;
    // 本段集计（用于「死段」判定与 totalResults 提前收敛）
    let segmentItems = 0;
    let segmentTotalResults = 0;
    let segmentPages = 0;
    let segmentFailedPages = 0;

    for (let page = 1; page <= maxPages; page += 1) {
      // 总预算闸：超了就不再发请求，已抓到的照常入库
      if (Date.now() - startedAt > budgetMs) {
        budgetExhausted = true;
        console.warn(
          `[mascus-leads] 总预算 ${budgetMs}ms 已耗尽，停止翻页（已抓到的条目照常入库）`
        );
        break;
      }

      const url = buildMascusSearchUrl(segment.path, { recentDays, page });
      let pageItems: ParsedMascusListing[] = [];

      try {
        const html = await fetchHtml(url, timeoutMs);
        const parsed = parseMascusNextData(html);
        pageItems = parsed.items;
        fetchedPages += 1;
        segmentPages += 1;
        consecutiveFailures = 0;
        // 多页取最大值：任一分页报出「有货」就不算死段
        if (parsed.totalResults > segmentTotalResults) {
          segmentTotalResults = parsed.totalResults;
        }
      } catch (error) {
        // 单页失败不中断整轮采集，只计数；同段连续失败过多则放弃该段。
        failedPages += 1;
        segmentFailedPages += 1;
        consecutiveFailures += 1;
        console.warn(
          `[mascus-leads] 抓取失败 seg=${segment.key} page=${page} url=${url}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        if (consecutiveFailures >= MAX_CONSECUTIVE_PAGE_FAILURES) {
          console.warn(
            `[mascus-leads] seg=${segment.key} 连续 ${consecutiveFailures} 页失败，跳过该品类段`
          );
          break;
        }
        continue;
      }

      for (const item of pageItems) {
        scanned.push({ ...item, scanSegment: segment.key });
      }
      segmentItems += pageItems.length;
      bySegment[segment.key] += pageItems.length;

      // 不足一页说明已到末页
      if (pageItems.length < MASCUS_PAGE_SIZE) break;
      // 已抓条数达到页面自报总条数 ⇒ 必然没有下一页，省掉一次注定空手的请求
      if (segmentTotalResults > 0 && segmentItems >= segmentTotalResults) break;
    }

    // 只记录「真正尝试过」的段（预算一开始就耗尽时不该误报某个段 0 条）
    if (segmentPages + segmentFailedPages > 0) {
      segmentStats.push({
        key: segment.key,
        items: segmentItems,
        totalResults: segmentTotalResults,
        pages: segmentPages,
        failedPages: segmentFailedPages,
      });
    }

    if (budgetExhausted) break;
  }

  // 死段告警：0 条 = 路径可能已失效/品类被改名（线上 soil-preparation 就是这样坏掉的）
  const emptySegments = findEmptySegments(segmentStats);
  for (const key of emptySegments) {
    console.warn(
      `[mascus-leads] 警告：品类段 seg=${key} 本轮 0 条（可能是路径失效或品类改名，请人工核对）`
    );
  }

  const unique = dedupeByProductId(scanned);
  const items = scanned.length;
  const uniqueItems = unique.length;

  // 被 maxPages 结构性截断的段：日增一旦超过 maxPages×40 就会永久丢线索，必须外显。
  // 🔴 判据必须是「totalResults > maxPages × PAGE_SIZE」这个结构性容量上限。
  // 不能用「totalResults > items」—— 那会把「某页抓取失败」误报成「被 maxPages 截断」，
  // 运维看到会去调大 maxPages（无效），而真正该做的是重试。
  // 抓取失败已由 failedPages / ok=false 单独表达，不在这里重复告警。
  const segmentCapacity = maxPages * MASCUS_PAGE_SIZE;
  const truncatedSegments = segmentStats
    .filter((stat) => stat.totalResults > segmentCapacity)
    .map((stat) => stat.key);

  let inserted = 0;
  let updated = 0;
  let failedUpserts = 0;

  if (uniqueItems > 0) {
    // 写库前再判一次预算：抓取已耗 220s + 最后一批 upsert 可能把 300s 撑爆，
    // 超预算就不写（宁可少写一轮，也不要被 Vercel 强杀在写入中途丢统计）。
    if (Date.now() - startedAt > budgetMs) {
      budgetExhausted = true;
      console.warn(
        `[mascus-leads] 写库前总预算 ${budgetMs}ms 已耗尽，本轮跳过入库（抓到 ${uniqueItems} 条未写）`
      );
    } else {
      // 先查已存在集合，才能区分「新增」与「更新」（upsert 本身不返回该信息）。
      const existing = await prisma.mascusListing.findMany({
        where: { productId: { in: unique.map((row) => row.productId) } },
        select: { productId: true },
      });
      const existingIds = new Set(existing.map((row) => row.productId));
      for (const row of unique) {
        if (existingIds.has(row.productId)) updated += 1;
        else inserted += 1;
      }

      if (!dryRun) {
        for (let offset = 0; offset < unique.length; offset += UPSERT_BATCH_SIZE) {
          const batch = unique.slice(offset, offset + UPSERT_BATCH_SIZE);
          for (const row of batch) {
            try {
              await prisma.mascusListing.upsert({
                where: { productId: row.productId },
                // create 带 raw（首次入库的字段快照）；update 不带 raw（见 toUpdateData 说明）
                create: { productId: row.productId, ...toCreateData(row) },
                // lastSeenAt 由 @updatedAt 自动刷新，这里不手写
                update: toUpdateData(row),
              });
            } catch (error) {
              // 逐条容错：单条失败不应让整轮 500，也不应丢掉已成功写入的统计
              failedUpserts += 1;
              console.warn(
                `[mascus-leads] upsert 失败 productId=${row.productId}: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          }
        }
      }
    }
  }

  return {
    // 假绿是致命的：Vercel cron 只看状态码，全失败也必须能看出来
    ok: failedPages === 0 && failedUpserts === 0,
    fetchedPages,
    failedPages,
    items,
    uniqueItems,
    inserted,
    updated,
    failedUpserts,
    bySegment,
    emptySegments,
    truncatedSegments,
    budgetExhausted,
    tookMs: Date.now() - startedAt,
  };
}

/* ------------------------------------------------------------------ *
 * 内部工具
 * ------------------------------------------------------------------ */

/**
 * 抓取单页 HTML。
 *
 * 超时用 `AbortController` 手工实现（禁止 `AbortSignal.timeout`，见文件头说明），
 * `finally` 里必须 `clearTimeout`，否则定时器会挂到超时点才释放。
 *
 * `redirect` 保持 `follow`（mascus 有 http→https / 尾斜杠的正常跳转，改 `manual` 会把正常跳转
 * 误判成失败），改为**跳转后校验最终 host**：URL 虽然只来自硬编码 origin，但这行断言成本近零。
 */
async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "user-agent": REQUEST_USER_AGENT,
        "accept-language": "en-US,en;q=0.9",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    // 跳转后最终落点必须在 mascus 自己的域（防止被 30x 带离）
    const finalUrl = typeof response.url === "string" ? response.url : "";
    if (finalUrl.length > 0) {
      const finalHost = new URL(finalUrl).hostname;
      if (finalHost !== MASCUS_HOST) {
        throw new Error(`跳转落点异常：期望 ${MASCUS_HOST}，实际 ${finalHost}（${finalUrl}）`);
      }
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/** 正整数归一化：非法值（undefined / NaN / <=0）一律回落到默认值 */
function positiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : fallback;
}

/**
 * 整数归一化，但**保留 <= 0 的语义**（用于总预算：`0` / 负数表示一开始就收工）。
 * 仅 `undefined` / 非有限数回落默认值。
 */
function finiteInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.trunc(value);
}

/**
 * 归一化品类段列表。
 *
 * 传入自定义路径时仍尽量映射回已知 `key`（决定 `scanSegment` 落库值），
 * 未知路径用最后一段路径名兜底。
 */
function resolveSegments(paths?: string[]): { key: string; path: string }[] {
  if (!Array.isArray(paths) || paths.length === 0) return MASCUS_SCAN_SEGMENTS;
  const resolved: { key: string; path: string }[] = [];
  for (const rawPath of paths) {
    if (typeof rawPath !== "string" || rawPath.trim().length === 0) continue;
    let path = rawPath.trim();
    if (!path.startsWith("/")) path = `/${path}`;
    while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    const known = MASCUS_SCAN_SEGMENTS.find((segment) => segment.path === path);
    resolved.push({ key: known ? known.key : segmentKeyFromPath(path), path });
  }
  return resolved.length > 0 ? resolved : MASCUS_SCAN_SEGMENTS;
}

/** 从路径末段推导品类 key（`/agriculture/soil-preparation` → `soil-preparation`） */
function segmentKeyFromPath(path: string): string {
  const parts = path.split("/").filter((part) => part.length > 0);
  const last = parts.length > 0 ? parts[parts.length - 1] : "unknown";
  return last.length > 0 ? last : "unknown";
}

/** `MascusListing` 的标量列（每轮都随挂牌变化的值，create / update 共用） */
interface WritableScalarFields {
  brandName: string | null;
  modelName: string | null;
  categoryName: string | null;
  catalogName: string | null;
  year: number | null;
  priceEuro: number | null;
  priceOriginal: number | null;
  priceCurrency: string | null;
  sellerPhone: string | null;
  companyName: string | null;
  companyCountry: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  assetUrl: string | null;
  imageUrl: string | null;
  listedAt: Date | null;
  scanSegment: string;
}

/**
 * 解析结果 → 标量列。
 *
 * `productId` 由调用方显式提供（`create` 需要，`update` 不能改主键），
 * `firstSeenAt` / `lastSeenAt` / `createdAt` 交给数据库默认值与 `@updatedAt`。
 */
function toScalarFields(row: ScannedListing): WritableScalarFields {
  return {
    brandName: row.brandName,
    modelName: row.modelName,
    categoryName: row.categoryName,
    catalogName: row.catalogName,
    year: row.year,
    priceEuro: row.priceEuro,
    priceOriginal: row.priceOriginal,
    priceCurrency: row.priceCurrency,
    sellerPhone: row.sellerPhone,
    companyName: row.companyName,
    companyCountry: row.companyCountry,
    locationCity: row.locationCity,
    locationCountry: row.locationCountry,
    assetUrl: row.assetUrl,
    imageUrl: row.imageUrl,
    listedAt: row.listedAt,
    scanSegment: row.scanSegment,
  };
}

/**
 * create 分支：标量列 + `raw` 字段快照。
 *
 * 只有首次入库才写 `raw`：实测单条 item `JSON.stringify` 均值约 1381 B（48 个字段），
 * 占整行体积 ~79%，其中 90% 的键（`auction*` / `priceRental*`×7 / `userCurrency`）对普通挂牌恒为 null。
 * 每天重写整行会让 WAL 与存储无谓翻倍（估算 192 MB/年）。
 */
function toCreateData(row: ScannedListing): WritableScalarFields & { raw: Prisma.InputJsonValue } {
  return {
    ...toScalarFields(row),
    // Record<string, unknown> 无法直接赋给 Prisma 更严格的 InputJsonValue，需显式断言
    raw: row.raw as unknown as Prisma.InputJsonValue,
  };
}

/**
 * update 分支：**不含 `raw`**。
 *
 * 会变的字段都有自己的标量列（price / phone / company / listedAt …），
 * `raw` 仅作为「首次入库时的字段快照」保留，不需要每轮覆盖写。
 */
function toUpdateData(row: ScannedListing): WritableScalarFields {
  return toScalarFields(row);
}
