/**
 * GET /api/cron/benchmark  — Vercel Cron 自动调用（URL query token 验证）
 * POST /api/cron/benchmark — 手动调用（Authorization Bearer 头验证）
 *
 * 多品牌国际基准价 — 每日实时刷新（方案 A：跑在 Vercel 境外，出网自由）
 * 逻辑见 src/lib/benchmark-engine.js（并发抓取 18 品牌 × 机型 × 7 源）。
 *
 * 鉴权沿用项目既有约定：vercel.json 的 cron path 带 ?token=INTERNAL_API_KEY，
 * 同时支持 CRON_API_KEY（手动 Bearer）。
 */
import { NextRequest, NextResponse } from "next/server";
import { matchInternalApiKey } from "@/lib/internal-api-key-auth";
import { pushToGroup } from "@/lib/wecom/group-webhook";
// @ts-ignore — CommonJS 引擎，类型见 benchmark-engine.d.ts
import {
  runRefresh,
  getFxRates,
  disconnectBenchmark,
  seedEuEvidence,
  checkSourceStaleness,
  type SourceStalenessReport,
} from "@/lib/benchmark-engine";

export const dynamic = "force-dynamic";
// 266 目标 / 并发12 / 8s超时 → 最坏 ~184s，需 Vercel Pro（Hobby 上限 60s 会被截断）
export const maxDuration = 300;

function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;
  // ⚠️ 安全约定（务必保留）：这里【绝不】为密钥设置默认值兜底。
  // 若写成 `process.env.CRON_API_KEY || "dev-secret-key"`，当环境漏配密钥时，
  // `?token=dev-secret-key` 会退化成万能钥匙。env 缺失即不可比对（fail-closed）。
  // 与 src/app/api/cron/daily-report/route.ts 的约定保持一致。
  const cronApiKey = process.env.CRON_API_KEY;
  const cronSecret = process.env.CRON_SECRET;
  if (cronApiKey && token === cronApiKey) return true;
  // 双值匹配：INTERNAL_API_KEY（当前）或 INTERNAL_API_KEY_PREVIOUS（过渡期）任一命中即放行。
  if (matchInternalApiKey(token) !== null) return true;
  if (cronSecret && token === cronSecret) return true;
  return false;
}

async function executeRefresh() {
  const startedAt = Date.now();
  // 先导入欧系农机具证据种子（幂等，公开行情合规可双库；失败降级不阻断实时采集）
  const seed = await seedEuEvidence().catch((e) => {
    console.warn("欧系证据种子导入失败:", e instanceof Error ? e.message : String(e));
    return { ok: false, n: 0, err: 1, error: e instanceof Error ? e.message : String(e) };
  });
  const fx = await getFxRates();
  // 并发 20 / 单目标 20s：实测 mascus 响应体 623KB、耗时 3.9s，8s 会被截断；
  // 靠「源级熔断 + 总预算兜底」把硬拦的源（tractorhouse 403 / machinerypete 470）
  // 快速甩掉，而不是让它们各自慢慢超时把预算吃光。
  const stats = await runRefresh({
    fx,
    concurrency: 20,
    timeoutMs: 20000,
    failureThreshold: 3,
    budgetMs: 260000,
  });

  // ── 数据陈旧告警（只读聚合）──────────────────────────────────────────
  // 必须在 runRefresh **之后**：告警是事后诊断，不能影响采集。
  // 整段用 .catch() 兜住：告警失败绝不能阻断主流程（宁可这次没告警，
  // 也不能因为告警挂了把「采集已成功」的结果丢掉）。
  const staleness: SourceStalenessReport | null = await checkSourceStaleness().catch((e) => {
    console.warn("基准价陈旧检查失败:", e instanceof Error ? e.message : String(e));
    return null;
  });
  if (staleness && staleness.stale.length > 0) {
    const lines: string[] = staleness.stale.map((s) => {
      const lastDate = s.lastDate || "未知";
      const ageDays = s.ageDays == null ? "未知" : String(s.ageDays);
      const reason = s.kind === "crawl-failed" ? "抓取失败" : "不在抓取清单，只有历史种子";
      return `- **${s.site}**（${s.rows} 行）：最新 ${lastDate}，已 ${ageDays} 天 —— ${reason}`;
    });
    if (staleness.missingSources.length > 0) {
      lines.push(
        `- **无任何数据**：${staleness.missingSources.join("、")}（在抓取清单里但库里 0 行）`
      );
    }
    lines.push("> 今日日报中来自这些源的套利判断不可信，须人工复核。");
    // 注意：`pushToGroup` 内部会自己拼 `# ${title}`，故 title 不再带 `#`，否则会渲染成 `# # ...`。
    // 另：WECOM_GROUP_WEBHOOK_URL 未配置时 pushToGroup 自身即 no-op，无需在此判断该 env。
    await pushToGroup({
      title: "基准价数据陈旧告警",
      lines,
      level: "warn",
    }).catch((e) => {
      console.warn("基准价陈旧告警推送失败:", e instanceof Error ? e.message : String(e));
    });
  }

  const tookMs = Date.now() - startedAt;
  let message = `基准价刷新完成：成功 ${stats.ok} / 跳过(无样本) ${stats.skip} / 失败(网络) ${stats.failed} / 共 ${stats.total}`;
  if (stats.circuitOpen.length > 0) {
    message += ` ｜ 熔断：${stats.circuitOpen.join("、")}`;
  }
  if (stats.budgetExhausted) {
    message += ` ｜ 预算耗尽，剩余 ${stats.skippedByBudget} 个目标未跑`;
  }
  return {
    success: true,
    message,
    stats,
    seed,
    staleness,
    tookMs,
    at: new Date().toISOString(),
  };
}

// GET — Vercel Cron（token 通过 ?token= 传递）
export async function GET(request: NextRequest) {
  const queryToken = request.nextUrl.searchParams.get("token");
  const authHeader = request.headers.get("authorization");
  const token =
    queryToken ||
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null);
  if (!isValidToken(token)) {
    return NextResponse.json(
      { success: false, error: "缺少或无效的授权信息" },
      { status: 401 }
    );
  }
  try {
    const result = await executeRefresh();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("基准价刷新异常 (GET):", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "内部服务器错误",
      },
      { status: 500 }
    );
  } finally {
    await disconnectBenchmark().catch(() => {});
  }
}

// POST — 手动触发（Authorization: Bearer <token>）
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "缺少授权信息" }, { status: 401 });
  }
  // 复用与 GET 相同的校验（含 fail-closed 约定），避免两处判定漂移。
  if (!isValidToken(authHeader.substring(7))) {
    return NextResponse.json({ success: false, error: "无效的API密钥" }, { status: 401 });
  }
  try {
    const result = await executeRefresh();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("基准价刷新异常 (POST):", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "内部服务器错误",
      },
      { status: 500 }
    );
  } finally {
    await disconnectBenchmark().catch(() => {});
  }
}
