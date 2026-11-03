/**
 * GET /api/cron/mascus-leads  — Vercel Cron 自动调用（URL query token 验证）
 * POST /api/cron/mascus-leads — 手动调用（Authorization Bearer 头验证）
 *
 * 每日采集 mascus 二手农机「带卖家电话」线索并落入 `MascusListing` 线索池。
 * 执行逻辑见 src/lib/mascus-leads/ingest.ts（品类段扫描 → 去重 → 按 productId upsert）。
 *
 * 鉴权沿用项目既有约定（与 /api/cron/benchmark 完全一致）：
 * vercel.json 的 cron path 带 ?token=INTERNAL_API_KEY，同时支持 CRON_API_KEY / CRON_SECRET（手动 Bearer）。
 *
 * 参数面（重要）：
 *   唯一被接受的采集参数是 `?dryRun=1`（预演：抓取 + 统计，不写库）。
 *   `maxPages` / `recentDays` / `budgetMs` / `segmentPaths` **一律不从 query 读** ——
 *   外部可控的抓取量就是资源耗尽 / SSRF 放大器，这条属性不能破坏。
 *
 * 状态码语义（Vercel cron 只看状态码，所以不能"假绿"）：
 *   - 403：SITE≠com（.cn 侧不跑）
 *   - 401：token 缺失/无效
 *   - 503：一页都没抓成功（抓取链路整体挂掉）
 *   - 200：跑完了；`success` 反映 `stats.ok`（有失败页/失败写入时为 false）
 */
import { NextRequest, NextResponse } from "next/server";
import { matchInternalApiKey } from "@/lib/internal-api-key-auth";
import { ingestMascusLeads } from "@/lib/mascus-leads/ingest";

export const dynamic = "force-dynamic";
// 5 品类段 × 5 页 = 25 个请求；实测单页约 5s ⇒ 常态 ~125s，最坏 25s/页（625s）由 ingest 的
// 220s 总预算闸切断（届时 budgetExhausted=true + truncatedSegments 双信号）。
// 需 Vercel Pro（Hobby 上限 60s 会被截断）
export const maxDuration = 300;

/** SITE 闸门的统一提示（.cn 侧不部署/不执行） */
const SITE_BLOCKED_ERROR = "mascus 线索采集仅部署在 .com 站点";

function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;
  // ⚠️ 安全约定（务必保留）：这里【绝不】为密钥设置默认值兜底。
  // 若写成 `process.env.CRON_API_KEY || "dev-secret-key"`，当环境漏配密钥时，
  // `?token=dev-secret-key` 会退化成万能钥匙。env 缺失即不可比对（fail-closed）。
  // 与 src/app/api/cron/benchmark/route.ts 的约定保持一致。
  const cronApiKey = process.env.CRON_API_KEY;
  const cronSecret = process.env.CRON_SECRET;
  if (cronApiKey && token === cronApiKey) return true;
  // 双值匹配：INTERNAL_API_KEY（当前）或 INTERNAL_API_KEY_PREVIOUS（过渡期）任一命中即放行。
  if (matchInternalApiKey(token) !== null) return true;
  if (cronSecret && token === cronSecret) return true;
  return false;
}

/** 是否预演；**唯一**允许从 query 透传给 ingest 的开关 */
function isDryRunRequested(searchParams: URLSearchParams): boolean {
  return searchParams.get("dryRun") === "1";
}

/** 执行一轮采集，返回状态码与响应体（GET / POST 共用，避免两处判定漂移） */
async function executeIngest(dryRun: boolean): Promise<{
  status: 200 | 503;
  body: Record<string, unknown>;
}> {
  const startedAt = Date.now();
  // 非 dryRun 时保持**零参数调用**：外部因此无法放大抓取量（资源耗尽面为 0）
  const stats = dryRun ? await ingestMascusLeads({ dryRun: true }) : await ingestMascusLeads();
  const tookMs = Date.now() - startedAt;
  const at = new Date().toISOString();

  // 一页都没抓成功 ⇒ 抓取链路整体挂了。cron 只看状态码，这里必须给 503，
  // 否则「15 页全失败」会被记成一次绿色成功，永远没人发现。
  if (stats.fetchedPages === 0) {
    return {
      status: 503,
      body: { success: false, error: "mascus 全部页抓取失败", stats, dryRun, tookMs, at },
    };
  }

  // 以下三类「静默失效」必须在返回体里显式暴露，否则线上永远看不见：
  const emptyNote =
    stats.emptySegments.length > 0
      ? `，0 条段 ${stats.emptySegments.length}（${stats.emptySegments.join(",")}）`
      : "";
  const truncatedNote =
    stats.truncatedSegments.length > 0
      ? `，截断段 ${stats.truncatedSegments.length}（${stats.truncatedSegments.join(",")}）`
      : "";
  const failedUpsertNote = stats.failedUpserts > 0 ? `，写入失败 ${stats.failedUpserts} 条` : "";
  const budgetNote = stats.budgetExhausted ? "，预算耗尽提前收工" : "";

  return {
    status: 200,
    body: {
      success: stats.ok,
      message: `mascus 线索采集完成：新增 ${stats.inserted} / 更新 ${stats.updated} / 共 ${stats.uniqueItems}（${stats.fetchedPages} 页，失败 ${stats.failedPages} 页${emptyNote}${truncatedNote}${failedUpsertNote}${budgetNote}）`,
      stats,
      dryRun,
      tookMs,
      at,
    },
  };
}

// GET — Vercel Cron（token 通过 ?token= 传递）
export async function GET(request: NextRequest) {
  // 🔴 先判站点：.cn 侧即使被误调也一律拒绝，避免境外线索落到境内库。
  if ((process.env.SITE ?? "com") !== "com") {
    return NextResponse.json({ success: false, error: SITE_BLOCKED_ERROR }, { status: 403 });
  }

  const queryToken = request.nextUrl.searchParams.get("token");
  const authHeader = request.headers.get("authorization");
  const token =
    queryToken ||
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null);
  if (!isValidToken(token)) {
    return NextResponse.json({ success: false, error: "缺少或无效的授权信息" }, { status: 401 });
  }

  try {
    const result = await executeIngest(isDryRunRequested(request.nextUrl.searchParams));
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("mascus 线索采集异常 (GET):", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "内部服务器错误" },
      { status: 500 }
    );
  }
}

// POST — 手动触发（Authorization: Bearer <token>）
export async function POST(request: NextRequest) {
  if ((process.env.SITE ?? "com") !== "com") {
    return NextResponse.json({ success: false, error: SITE_BLOCKED_ERROR }, { status: 403 });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "缺少授权信息" }, { status: 401 });
  }
  // 复用与 GET 相同的校验（含 fail-closed 约定），避免两处判定漂移。
  if (!isValidToken(authHeader.substring(7))) {
    return NextResponse.json({ success: false, error: "无效的API密钥" }, { status: 401 });
  }

  try {
    const result = await executeIngest(isDryRunRequested(new URL(request.url).searchParams));
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("mascus 线索采集异常 (POST):", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "内部服务器错误" },
      { status: 500 }
    );
  }
}
