// Ambient module declaration for the CommonJS benchmark engine
// (src/lib/benchmark-engine.js). Keeps the TS route type-safe without
// forcing allowJs on the whole project.
declare module '@/lib/benchmark-engine' {
  export interface SourceStat {
    ok: number;
    skip: number;
    failed: number;
    /** 该源最终是否开了熔断 */
    opened: boolean;
    /** 该源命中 429 的次数（含被退避重试救回来的；不计入熔断） */
    rateLimited?: number;
  }

  /** 数据源定义（SOURCES 数组元素） */
  export interface BenchmarkSource {
    key: string;
    name: string;
    region: string;
    currency: string;
    russian: boolean;
    /** 为 true 时 buildTargets() 跳过该源（mascus：URL 层筛选失效，改品类级扫描） */
    skipInTargets?: boolean;
    /**
     * 该源的**在飞请求数上限**，实际取 `min(它, 全局 concurrency)`。
     * 当前只有 agroline 配了 6（12 个品牌的唯一数据源，全局 12 路压过去 3 轮就 429）。
     * 不配 = 用全局值。
     */
    maxConcurrency?: number;
  }

  /** 单个机型配置 */
  export interface BenchmarkModel {
    /** 机型字符串（mascus 侧必须与库存里的 `model` 字段原样一致，匹配靠它） */
    model: string;
    /** 品类：tractor / forage_harvester / combine / baler / mower_tedder / soil */
    category: string;
  }

  /** 18 个目标品牌（已按 mascus `brand` 字段实测校验过写法） */
  export interface BenchmarkBrand {
    slug: string;
    nameZh: string;
    nameEn: string;
    origin: string;
    primaryCategory: string;
  }

  export const BRANDS: BenchmarkBrand[];

  /**
   * 品牌 slug → 机型清单（旗舰 + 主流在售机型）。
   * 扩容规则见 benchmark-engine.js 里 MODELS 顶部注释：只按真实库存筛（有价 / 命中品牌 /
   * 样本 ≥3），model 必须与 mascus `model` 字段原样一致，category 依 `categoryName` 判定。
   * ⚠️ 机型数 × 6 个按型号靶标的源 = buildTargets() 长度，上限 500。
   */
  export const MODELS: Record<string, BenchmarkModel[]>;

  /** 首期数据源（含 mascus，但 mascus 标记 skipInTargets=true，不进靶标循环） */
  export const SOURCES: BenchmarkSource[];

  /**
   * mascus bulk 采集的品类段清单（与 src/lib/mascus-leads/parse.ts 的
   * MASCUS_SCAN_SEGMENTS 保持一致；改一处必须同步另一处）。
   * B 档 2026-11-06：现 6 段，末尾追加 sprayers（不含 trailers）。
   */
  export const MASCUS_BULK_SEGMENTS: string[];
  /** mascus bulk 的 `lastcreateddays`（挂牌新鲜度窗口），当前 60 */
  export const MASCUS_BULK_RECENT_DAYS: number;
  /** mascus bulk 默认每段翻页数，B 档 2026-11-06 由 5 改为 20（6 段 × 20 页 = 120 页） */
  export const MASCUS_BULK_MAX_PAGES: number;
  /** mascus 单组最少样本数（不足不写库），当前 3 */
  export const MASCUS_MIN_SAMPLES: number;

  /** 从 mascus 列表页 HTML 抽出 __NEXT_DATA__ 的**原始** items（不过滤，不抛错） */
  export function parseMascusNextDataItems(html: string): {
    ok: boolean;
    reason?: string;
    items: Array<Record<string, any>>;
    totalResults: number;
  };
  /** mascus 品牌匹配（归一化后相等或互相包含，空值/超短值一律 false） */
  export function mascusBrandMatches(itemBrand: unknown, nameEn: string): boolean;
  /** 目标机型 → 匹配 token（'8R 410' → ['8r','410']） */
  export function mascusModelTokens(model: string): string[];
  /** mascus 型号匹配（token 需作为独立词块全部命中） */
  export function mascusModelMatches(itemModel: unknown, tokens: string[]): boolean;
  /** 单条 mascus 挂牌 → EUR 金额；priceEURO / priceOriginal 都 ≤ 0 时返回 null */
  export function mascusItemPriceEur(
    item: Record<string, any>,
    fx: Record<string, number>
  ): { amount: number; currency: string } | null;

  /** mascus bulk 采集里单组（brand×model）的结果 */
  export interface MascusBulkGroup {
    brand: string;
    brandNameZh?: string;
    model: string;
    category?: string;
    samples: number;
    status: 'ok' | 'skip' | 'failed';
    reason: string | null;
    medianForeign?: number;
    currency?: string;
    medianCny?: number;
    exchangeRate?: number;
    listingCount?: number;
    sampleSize?: number;
    confidenceScore?: number;
    sourceDate?: string;
  }

  /** 单个品类段的扫描统计 */
  export interface MascusBulkSegmentStat {
    items: number;
    priced: number;
    totalResults: number;
    pages: number;
    failedPages: number;
    ok: boolean;
  }

  /** fetchMascusBulk() 的返回值 */
  export interface MascusBulkResult {
    /** 至少有一页成功解析（全失败 / 预算耗尽 / 抛错时为 false） */
    ok: boolean;
    dryRun?: boolean;
    budgetExhausted?: boolean;
    error?: string | null;
    recentDays?: number;
    maxPages?: number;
    totalPages: number;
    fetchedPages: number;
    failedPages: number;
    /** 抓到的条目总数（去重前） */
    items: number;
    /** 按 productId 去重后的条目数 */
    uniqueItems: number;
    /** 有价条目数（priceEURO>0，或 priceOriginal>0 且能折成 EUR） */
    pricedItems: number;
    /** 参与匹配的 (brand×model) 组数 */
    groups: number;
    written: number;
    skipped: number;
    failed: number;
    /** 写入成功的组（含 brand/model/samples/medianForeign/currency/medianCny/sourceDate） */
    rows: MascusBulkGroup[];
    /** 全部分组明细（含 skip / failed） */
    groupDetail: MascusBulkGroup[];
    byReason: Record<string, number>;
    bySegment: Record<string, MascusBulkSegmentStat>;
    /** items 与 totalResults 都为 0 的段（路径失效的唯一信号） */
    emptySegments: string[];
    durationMs: number;
  }

  /**
   * mascus 品类级 bulk 采集：按段拉列表页 → 合并去重 → 本地按 (brand,model) 匹配
   * → 折 EUR → 聚合（3 条起）→ upsertBenchmark。
   *
   * B 档 2026-11-06 离线注入点：`httpGetImpl` 省略时**默认仍走裸 httpGet**
   * （O1=A，不接 429 重试），单测/QA 传假 GET 可零真实网络跑完整条管线。
   */
  export function fetchMascusBulk(opts?: {
    fx?: Record<string, number>;
    maxPages?: number;
    timeoutMs?: number;
    recentDays?: number;
    minSamples?: number;
    concurrency?: number;
    budgetMs?: number;
    dryRun?: boolean;
    /** 注入假 GET（离线跑整条 bulk 管线，零真实网络）；省略 = 默认 httpGet */
    httpGetImpl?: (
      url: string,
      request: {
        timeout?: number;
        headers?: Record<string, string>;
        proxy?: string | null;
      }
    ) => Promise<string>;
  }): Promise<MascusBulkResult>;

  // —— Ark 检索兜底通道（直连失败的源，改用豆包 web_search 抓公开挂牌价）——

  /** Ark 检索单次调用超时（毫秒），当前 45000 */
  export const ARK_SEARCH_TIMEOUT_MS: number;
  /**
   * 检索通道写入行的置信度，当前 0.3。
   * 直连抓的是源站本体页（≈0.7）；检索抓的是搜索引擎转述，跨了一层，
   * 且无法保证价格仍是原挂牌价，因此**永远低于**直连。
   */
  export const ARK_SEARCH_CONFIDENCE: number;
  /** 硬排除的源（直连健康的源不得走检索，避免低置信度覆盖高置信度），当前含 agroline */
  export const ARK_SEARCH_BLOCKED_SOURCES: Set<string>;
  /** 源 key → 检索用域名（`site:` 限定查询用） */
  export const SOURCE_SEARCH_DOMAIN: Record<string, string>;

  /** 检索兜底是否全局开启：读 `BENCHMARK_ARK_FALLBACK === '1'`，默认关 */
  export function arkSearchGloballyEnabled(): boolean;
  /**
   * 兜底触发判定：只有直连 `failed`（或源已熔断）才允许，`skip` 一律不允许。
   * @param status 直连结果状态
   * @param sourceSite 源 key（命中 ARK_SEARCH_BLOCKED_SOURCES 时返回 false）
   */
  export function shouldArkFallback(status: string, sourceSite: string): boolean;
  /** POST JSON（带 Authorization / 超时），非 2xx 抛错 */
  export function httpPostJson(
    url: string,
    payload: Record<string, any>,
    opts?: { timeout?: number; headers?: Record<string, string> }
  ): Promise<any>;
  /** 从 Ark Responses 的 `output[]`（type==='message' → content[].text）拼出全文 */
  export function extractArkSearchText(payload: any): string;
  /**
   * 从 Responses 的 `annotations[]` 抽引用来源（只认 `type==='url_citation'`，按 url 去重）。
   * 这是本通道**唯一**的溯源依据：每条带 url 与该页的 summary 原文。
   */
  export function extractArkCitations(payload: any): Array<{
    url: string;
    host: string;
    title: string;
    siteName: string;
    summary: string;
  }>;
  /**
   * 引用主机名是否属于源站自己（容忍 www 子域与同品牌国别站：
   * `tractorhouse.com` ↔ `tractorhouse.com.au` ↔ `tractorhouse.co.uk`）。
   */
  export function arkHostMatchesSite(host: string, domain: string): boolean;
  /**
   * 从检索文本里抽价：**只认带币种前缀的数字**（USD/EUR/$/€ 后跟 ≥4 位数字），
   * 丢掉 <1000 或 >5,000,000 的金额（运费/零件价/通胀噪声）。
   *
   * @param opts.currency 只保留该币种
   * @param opts.explicitOnly 只认**带显式币种标注**的金额（`USD $61,500` / `$103,000 USD`），
   *        裸 `$` 一律不认 —— 镜像站会同时印 `AUD $88,227` 与 `USD $61,500`，裸符号必错。
   */
  export function extractArkSearchPrices(
    text: string,
    opts?: { currency?: string; explicitOnly?: boolean }
  ): Array<{
    amount: number;
    currency: string;
    raw: string;
  }>;

  /** 检索抽出的单条价格 */
  export interface ArkSearchPrice {
    amount: number;
    currency: string;
    raw: string;
    /** 该价来自哪条 citation（仅 `prices` 里带；事后可逐条复核） */
    sourceUrl?: string;
  }

  /**
   * 走 Ark web_search 给单个 (源, 机型) 取价。
   *
   * 🔴 **按 citation 溯源，不从正文抽价**：
   *    - 只读 `annotations[]` 里 `url_citation` 的条目；
   *    - 只保留主机名属于源站自己的 citation（同品牌国别站也算）；
   *    - 只在这些 citation 的 summary 里抽价，且币种必须等于源的币种；
   *    - summary 必须命中机型 token（`Jaguar 8700` 不得算进 `Jaguar 870`）；
   *    - 正文抽到的价只进 `prosePrices` 做诊断，**永不聚合**。
   * 原因：实测 `site:agriaffaires.co.uk ...` 的正文写满 €62,500，12 条 citation
   * 里却一条 agriaffaires 都没有（全在 tractorhouse.com.au / nongjitong 上）。
   * 正文抽价 = 把别家价格记在这个源头上，与编造同级。
   */
  export function fetchViaArkSearch(
    source: { key: string; currency?: string; region?: string },
    target: { brand?: string; brandNameZh?: string; nameEn?: string; model: string; category?: string },
    fx: Record<string, number>,
    opts?: {
      dryRun?: boolean;
      timeoutMs?: number;
      /** 注入假 fetch 供离线单测用；不传则用内部 httpPostJson */
      fetchImpl?: (
        url: string,
        payload: Record<string, any>,
        opts: { timeout: number; headers: Record<string, string> }
      ) => Promise<any>;
    }
  ): Promise<ArkSearchResult>;

  /** fetchViaArkSearch() 的返回值 */
  export interface ArkSearchResult {
    status: 'ok' | 'skip' | 'failed';
    /**
     * 'ark-source-blocked' / 'ark-no-api-key' / 'no-site-citation' / 'no-price' /
     * 'insufficient-samples' / 'no-agg' / 'write-failed' …
     *
     * `no-site-citation` = 检索一条源站自己的页面都没引用到（该源对搜索引擎也不可见，
     * 如 DataDome 站），与「引用到了但没价」(`no-price`) 分开报。
     */
    reason?: string;
    /** 可入库口径的价（仅 citation 溯源到源站页面的摘要价） */
    prices: ArkSearchPrice[];
    /** 仅诊断：不锁站点检索抽出、且未被溯源价印证的价 */
    crossSitePrices: ArkSearchPrice[];
    /** 仅诊断：模型正文里抽到的价（**永不聚合**） */
    prosePrices: ArkSearchPrice[];
    /** 两条 query 都抽到的同额同币价（交叉印证次数） */
    corroborated: number;
    /** 引用落在源站域名上的 citation 条数（0 = 检索没看到源站本体页） */
    siteCitations: number;
    /** 本次检索引用到的全部站点主机名（排障用：一眼看出价其实来自谁） */
    citedDomains: string[];
    /** 实际发出的 2 条 query */
    queries: string[];
    perQuery?: Array<{
      query: string;
      siteLocked: boolean;
      ok: boolean;
      found: number;
      added: number;
      error?: string;
    }>;
    /** skip/failed 时解释「为什么没价」 */
    hint?: string;
    currency?: string;
    medianForeign?: number;
    medianCny?: number;
    sampleSize?: number;
    listingCount?: number;
    sourceDate?: string;
    /** 待写入/已写入的行（sourceUrl 带 `#ark-search` 锚点） */
    row?: Record<string, any>;
    id?: any;
    skipped?: boolean;
    dryRun?: boolean;
    usage?: any;
    errors?: string[];
  }

  /** Ark 探针输入：只跑这几条 (源, 品牌, 机型)，不碰靶标池 / mascus bulk */
  export interface ArkSearchProbeEntry {
    /** 源 key（必须是 SOURCES 里的，或用 currency/region 自带的伪源） */
    sourceSite: string;
    brand: string;
    /** 机型字符串（能命中 MODELS 时会继承其 category） */
    model: string;
    nameEn?: string;
    category?: string;
    currency?: string;
    region?: string;
  }

  /** Ark 探针单条结果 */
  export interface ArkSearchProbeRow {
    sourceSite: string;
    brand: string;
    model: string;
    status: 'ok' | 'skip' | 'failed';
    reason: string | null;
    queries: string[];
    perQuery?: Array<{
      query: string;
      siteLocked: boolean;
      ok: boolean;
      found: number;
      added: number;
      error?: string;
    }>;
    prices: ArkSearchPrice[];
    priceCount: number;
    crossSitePrices: ArkSearchPrice[];
    crossSiteCount: number;
    /** 正文价（仅诊断，永不聚合） */
    prosePrices: ArkSearchPrice[];
    prosePriceCount: number;
    /** 引用落在源站域名上的 citation 条数 */
    siteCitations: number;
    /** 本次检索引用到的全部站点 */
    citedDomains: string[];
    corroborated: number;
    hint: string | null;
    currency: string | null;
    medianForeign: number | null;
    medianCny: number | null;
    sampleSize: number | null;
    sourceDate: string | null;
    confidenceScore: number | null;
    sourceUrl: string | null;
    wrote: boolean;
    errors: string[];
    usage: any;
  }

  /** 429 最多重试次数（硬上限，不许为了成功率拖穿 budgetMs），当前 2 */
  export const HTTP_429_MAX_RETRIES: number;
  /** 无 Retry-After 时的退避基数（1s × 2^n），当前 1000 */
  export const HTTP_429_BASE_DELAY_MS: number;
  /** Retry-After 的封顶值，当前 10000（防 `Retry-After: 3600` 吃穿预算） */
  export const HTTP_429_MAX_RETRY_AFTER_MS: number;
  /** 源级并发下限：reduce 再降也不低于此值，当前 2 */
  export const SOURCE_MIN_CONCURRENCY: number;

  /**
   * 解析 `Retry-After` 头：秒数（`120`）或 HTTP-date（`Wed, 21 Oct 2015 07:28:00 GMT`）。
   * 缺失/非法/负数返回 null（交给指数退避兜底）。
   */
  export function parseRetryAfterMs(
    value: string | string[] | null | undefined,
    now?: number
  ): number | null;

  /** 算第 `attempt` 次重试的等待毫秒数（Retry-After 优先，否则 1s→2s；±jitter） */
  export function computeRetryDelay(
    attempt: number,
    retryAfterMs?: number | null,
    opts?: { jitterRatio?: number; rand?: () => number }
  ): number;

  /**
   * 带 429 退避重试的 GET。**只对 429 重试**；5xx / 网络 / 超时原样抛出（交上层熔断）。
   */
  export function httpGetWithRetry(
    url: string,
    opts?: {
      request?: {
        timeout?: number;
        headers?: Record<string, string>;
        proxy?: string | null;
      };
      getImpl?: (url: string, request: any) => Promise<string>;
      sleep?: (ms: number, info?: any) => Promise<any>;
      maxRetries?: number;
      jitterRatio?: number;
      rand?: () => number;
      /** 本轮预算的绝对截止时间戳；退避会越过它就放弃重试（防吃穿 budgetMs） */
      deadlineTs?: number;
      onRateLimited?: (info: {
        attempt: number;
        delayMs: number;
        retryAfterMs: number | null;
        willRetry: boolean;
      }) => void;
    }
  ): Promise<string>;

  /**
   * 源级并发限制器。`limit = min(全局, 源 maxConcurrency)`；
   * `reduce(site)` 命中 429 时把该源上限减半（下限 `SOURCE_MIN_CONCURRENCY`），本轮不回升。
   */
  export function makeSourceLimiter(
    globalLimit: number,
    sources?: Array<{ key: string; maxConcurrency?: number }>
  ): {
    acquire(site: string): Promise<void>;
    release(site: string): void;
    reduce(site: string): number;
    limitOf(site: string): number;
    snapshot(): Record<string, { limit: number; inflight: number; waiting: number }>;
  };

  export interface RefreshStats {
    ok: number;
    skip: number;
    failed: number;
    total: number;
    bySource: Record<string, SourceStat>;
    /** 跳过原因分布（'no-listing' / 'no-agg' / 'circuit-open' / 'no-source' …） */
    skipReasons: Record<string, number>;
    /**
     * 失败原因分布（'http-429' / 'HTTP 503' / 'timeout' …）。
     * 与 skipReasons 分开：failed 既不是「没数据」也不是「成功」，
     * 运维要能一眼看出这轮失败到底是限流还是源挂了。
     */
    failReasons: Record<string, number>;
    /** 本轮命中 429 的总次数（含被退避重试救回来的那些） */
    rateLimited: number;
    /** 实际发生的退避等待次数（429 命中且会重试的那些） */
    retries: number;
    /** 退避等待累计毫秒（判断加固有没有把 budgetMs 吃光） */
    retryWaitMs: number;
    /** 本轮最终的源级并发上限（429 会把命中源减半，这里留档） */
    sourceConcurrency: Record<string, { limit: number; inflight: number; waiting: number }>;
    /** 因总预算耗尽而未派发的目标数 */
    skippedByBudget: number;
    /** true = 触发了 budgetMs 兜底 */
    budgetExhausted: boolean;
    /** 最终打开熔断的源站列表 */
    circuitOpen: string[];
    /** 本次刷新总耗时（毫秒） */
    durationMs: number;
    /**
     * mascus bulk 通道的明细（未启用 mascus 时为 null）。
     * 注意：mascus 的计数单位是「组（brand×model）」，其 ok/skip/failed **已汇入**
     * 顶层的 ok/skip/failed 与 total，本字段只作诊断，不要重复累加。
     */
    mascus: null | {
      ok: number;
      skip: number;
      failed: number;
      total: number;
      items: number;
      uniqueItems: number;
      pricedItems: number;
      fetchedPages: number;
      failedPages: number;
      totalPages: number;
      budgetExhausted: boolean;
      byReason: Record<string, number>;
      bySegment: Record<string, MascusBulkSegmentStat>;
      emptySegments: string[];
      rows: Array<{
        brand: string;
        model: string;
        samples: number;
        medianForeign?: number;
        currency?: string;
        medianCny?: number;
        sourceDate?: string;
      }>;
      durationMs: number;
      error: string | null;
    };

    /**
     * Ark 检索兜底的计数明细。**只在双重门控都开时存在**（默认 off 时为 `undefined`，
     * 因此默认行为与加此功能之前完全一致）。
     *
     * ⚠️ 这里的 ok/skip/failed **不并入**顶层 ok/skip/failed/total：
     * 兜底是对一个已失败目标的额外一次尝试，不是新靶标，并入会破坏
     * `ok + skip + failed + skippedByBudget === total` 这条闭合不变量。
     */
    arkFallback?: null | {
      enabled: boolean;
      total: number;
      ok: number;
      skip: number;
      failed: number;
      byReason: Record<string, number>;
      rows: Array<{
        brand: string;
        model: string;
        /** 'direct-failed' = 本次直连失败；'circuit-open' = 该源已熔断 */
        trigger: string;
        samples?: number;
        medianForeign?: number;
        currency?: string;
        medianCny?: number;
        sourceDate?: string;
      }>;
    };

    /** 探针模式：每条 (源, 品牌, 机型) 的明细（仅 `arkSearchProbe` 注入时存在） */
    arkProbe?: ArkSearchProbeRow[];
    /** 探针模式：是否 dryRun（true = 一条都没写库） */
    arkDryRun?: boolean;
  }

  export interface SourceCircuit {
    shouldSkip(site: string): boolean;
    /**
     * 记录一次采集结果。
     * `ratelimited`（429）既不 +1 也不重置 —— 限流不是「源坏了」，
     * 喂进熔断会让三个限流就把单点依赖源整源封死。
     */
    record(site: string, status: 'ok' | 'skip' | 'failed' | 'ratelimited'): {
      consecutiveFails: number;
      open: boolean;
    };
    snapshot(): Record<string, { consecutiveFails: number; open: boolean }>;
  }

  /** 源级熔断器（纯逻辑，无 I/O） */
  export function makeSourceCircuit(opts?: { failureThreshold?: number }): SourceCircuit;

  export function getFxRates(): Promise<Record<string, number>>;
  /**
   * 裸 GET（带浏览器 UA / 超时 / 可选住宅代理）。
   * 3xx 会自动跟随（Location 支持相对路径），非 200 或超时抛错，由调用方降级。
   */
  export function httpGet(
    url: string,
    opts?: {
      timeout?: number;
      headers?: Record<string, string>;
      proxy?: string | null;
    }
  ): Promise<string>;
  export function buildTargets(): Array<Record<string, any>>;

  /** 单目标采集结果（`rateLimited` 只在 429 重试仍失败时为 true） */
  export interface TargetFetchResult {
    status: 'ok' | 'skip' | 'failed';
    reason?: string;
    rateLimited?: boolean;
    count?: number;
  }

  /**
   * 单目标采集（含 429 退避；5xx/网络错误不重试，交上层熔断）。
   * `opts.getImpl` / `opts.sleep` 供离线单测注入。
   */
  export function fetchOneTarget(
    target: Record<string, any>,
    fx: Record<string, number>,
    timeoutMs: number,
    opts?: {
      getImpl?: (url: string, request: any) => Promise<string>;
      sleep?: (ms: number, info?: any) => Promise<any>;
      maxRetries?: number;
      jitterRatio?: number;
      rand?: () => number;
      /** 本轮预算的绝对截止时间戳（退避越过它就放弃重试） */
      deadlineTs?: number;
      onRateLimited?: (info: {
        attempt: number;
        delayMs: number;
        retryAfterMs: number | null;
        willRetry: boolean;
      }) => void;
    }
  ): Promise<TargetFetchResult>;

  /** 按源站 + 目标构造搜索 URL（mascus 已改用真实品类路径 + lastcreateddays） */
  export function buildSearchUrl(
    source: Record<string, any>,
    target: Record<string, any>
  ): string;

  /** mascus 改版后（Next.js）结构化商品行（仅保留有价 + 相关机型） */
  export interface MascusNextDataListing {
    priceForeign: number;
    currency: string;
    title: string;
    url?: string;
    sourceDate?: string;
    listingId?: string | number;
    sellerPhone?: string;
    companyName?: string;
    country?: string;
    city?: string;
    yearOfManufacture?: number | string;
    meterReadout?: number | string;
    categoryName?: string;
  }

  /** 从 mascus 页面 <script id="__NEXT_DATA__"> 的 searchData.items 解析商品 */
  export function parseMascusNextData(
    html: string,
    target: Record<string, any>,
    source?: Record<string, any>
  ): MascusNextDataListing[];

  /** mascus 抓取诊断（运维排查用，不参与价格聚合） */
  export type MascusDiagnostics =
    | { ok: false; reason: string }
    | {
        ok: true;
        totalResults: number | null;
        searchTitle: string | null;
        resolvedCategory: string | null;
        errorMessage: string | null;
        itemCount: number;
        withPrice: number;
      };

  export function parseMascusDiagnostics(html: string): MascusDiagnostics;
  export function runRefresh(opts?: {
    fx?: Record<string, number>;
    concurrency?: number;
    timeoutMs?: number;
    targets?: Array<Record<string, any>>;
    sources?: string[];
    /** 源级熔断阈值，默认 3 */
    failureThreshold?: number;
    /** 总预算兜底（毫秒），默认 260000 */
    budgetMs?: number;
    /** true = 只统计不写库（验证用） */
    dryRun?: boolean;
    /** mascus bulk 每段翻页数（默认 20，见 fetchMascusBulk） */
    mascusMaxPages?: number;
    /** mascus bulk 单页超时（默认取 max(timeoutMs, 25000)） */
    mascusTimeoutMs?: number;
    /** mascus 单组最少样本数（默认 3） */
    mascusMinSamples?: number;
    /**
     * false = 显式关闭 mascus bulk 通道。
     * 另注：只要调用方注入了 `targets`，mascus bulk 一律不跑（注入 targets = 明确只要跑这些靶标）。
     */
    mascus?: boolean;
    /** 429 最多重试次数（默认 2；硬上限，别为了成功率拖穿 budgetMs） */
    maxRetries?: number;
    /** 退避抖动的比例（默认 0.3；12 路并发不能在同一毫秒醒来） */
    jitterRatio?: number;
    /** 抖动随机源（注入便于单测断言） */
    rand?: () => number;
    /** 退避用的 sleep（注入假 sleep，单测里不真的等） */
    retrySleep?: (ms: number, info?: any) => Promise<any>;
    /** 注入假 GET（离线跑整条 worker 链路，含熔断与信号量） */
    httpGetImpl?: (
      url: string,
      request: {
        timeout?: number;
        headers?: Record<string, string>;
        proxy?: string | null;
      }
    ) => Promise<string>;
    /**
     * true = 打开 Ark 检索兜底。**默认 false**。
     * 注意这是**双重门控**的一半：`opts.arkSearchFallback === true`
     * **且** 环境变量 `BENCHMARK_ARK_FALLBACK=1`，两者缺一不生效。
     */
    arkSearchFallback?: boolean;
    /**
     * 探针模式：传入后**只跑这几条** (源, 品牌, 机型)，
     * 不建靶标池、不跑 mascus bulk、不写其他任何行（注入即隔离）。
     */
    arkSearchProbe?: ArkSearchProbeEntry[];
    /** 探针模式下 true = 不写库（验收用） */
    arkSearchDryRun?: boolean;
    /** 检索单次调用超时（默认 45000） */
    arkSearchTimeoutMs?: number;
    /** 注入假 fetch 供离线单测用 */
    arkSearchFetch?: (
      url: string,
      payload: Record<string, any>,
      opts: { timeout: number; headers: Record<string, string> }
    ) => Promise<any>;
  }): Promise<RefreshStats>;
  export function seedFromResearch(jsonPath: string): Promise<{ n: number; err: number }>;
  export function seedEuEvidence(
    jsonRelPath?: string
  ): Promise<{ ok: boolean; n: number; skipped: number; err: number; records: number }>;

  /** 单个源站的数据陈旧情况 */
  export interface SourceStalenessEntry {
    site: string;
    rows: number;
    /** 最新 sourceDate（'YYYY-MM-DD'）；该源所有行都没有可解析日期时为 null */
    lastDate: string | null;
    /** 距今天数；lastDate 为 null 时为 null（无法判断新鲜度，按陈旧上报） */
    ageDays: number | null;
    /** crawl-failed = 在抓取清单里但抓不到；not-in-crawl-list = 只有历史种子，无抓取通道 */
    kind: "crawl-failed" | "not-in-crawl-list";
  }

  /** checkSourceStaleness() 的返回值（只读诊断） */
  export interface SourceStalenessReport {
    /** 参与统计的行数（isActive=true） */
    checked: number;
    /** sourceDate 为空/不可解析的行数 */
    noDate: number;
    /** 陈旧阈值（天） */
    staleDays: number;
    /** 超过阈值的源（按 ageDays 降序，无日期的排最前） */
    stale: SourceStalenessEntry[];
    /** 在 SOURCES 抓取清单里但库里一行都没有的源 */
    missingSources: string[];
  }

  export function checkSourceStaleness(opts?: { staleDays?: number }): Promise<SourceStalenessReport>;

  export function report(): Promise<void>;
  export function disconnectBenchmark(): Promise<void>;
}
