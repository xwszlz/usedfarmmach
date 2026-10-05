/**
 * .cn → .com 产品同步「运行时辅助」（运行于 .com / Vercel）
 *
 * 职责：
 * - resolveCnSyncClient：解析 Prisma 客户端。优先使用注入的 client（便于单测 mock，
 *   避免单测被迫构造真实 PrismaClient / 触碰生产库）；否则延迟加载真实单例 `@/lib/db`。
 *   —— 采用「延迟 import」而非顶层静态 import，使纯函数（normalize/分页等）单测时
 *   完全不会加载 `@/lib/db`。
 * - writeCnSyncRunLog / recentRunsHealthy：CnSyncRunLog 的写入与健康度读取，
 *   支撑对账护栏「连续 N 轮异常不删」与 Stage 2 监控。
 */
import type { PrismaClient } from "@prisma/client";

export type CnSyncJob = "incremental" | "reconcile";
export type CnSyncStatus = "success" | "partial" | "error" | "skipped";

/** 解析 Prisma 客户端：优先注入的 client，否则延迟加载真实单例 */
export async function resolveCnSyncClient(injected?: PrismaClient): Promise<PrismaClient> {
  if (injected) return injected;
  const mod = await import("@/lib/db");
  return mod.prisma;
}

/** 写一条运行日志（success / partial / error / skipped 都写）；写日志失败不阻断主流程 */
export async function writeCnSyncRunLog(
  client: PrismaClient,
  job: CnSyncJob,
  status: CnSyncStatus,
  stats: unknown,
  durationMs: number,
  errorMessage?: string
): Promise<void> {
  try {
    await client.cnSyncRunLog.create({
      data: {
        job,
        status,
        stats: stats ? JSON.stringify(stats) : null,
        errorMessage: errorMessage ?? null,
        completedAt: new Date(),
        durationMs,
      },
    });
  } catch (e) {
    console.error(
      "[cn-sync] write CnSyncRunLog failed:",
      e instanceof Error ? e.message : String(e)
    );
  }
}

/**
 * 对账护栏 ②：判定最近 N 轮是否健康。
 * - 取最近 N 条 CnSyncRunLog（按 startedAt 倒序），任一 status==="error" 即视为不健康；
 * - 读不到历史（异常）→ 返回 false（保守：不健康 → 不删）。
 */
export async function recentRunsHealthy(client: PrismaClient, n: number): Promise<boolean> {
  if (!Number.isFinite(n) || n <= 0) return true;
  try {
    const rows = await client.cnSyncRunLog.findMany({
      orderBy: { startedAt: "desc" },
      take: Math.floor(n),
      select: { status: true },
    });
    return !rows.some((r) => r.status === "error");
  } catch (e) {
    console.error(
      "[cn-sync] recentRunsHealthy failed:",
      e instanceof Error ? e.message : String(e)
    );
    return false;
  }
}
