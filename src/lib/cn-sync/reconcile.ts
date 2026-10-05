/**
 * .cn → .com 产品同步「全量对账 + 硬删护栏」（运行于 .com / Vercel）
 *
 * 语义：拉取 .cn 全量存活 id 集合，把 ProductSyncMap 中「曾同步但已从 .cn 消失」的产品
 *       在 .com 侧**物理删除**（拍板④：真删），并在删除前写 tombstone 留档。
 *
 * 四条护栏（缺一不可）：
 * ① 全量快照为空 / 请求失败 → **一律不删**；
 * ② 最近 N 轮（CN_SYNC_RECONCILE_GUARD_N，默认 3）存在 status="error" 的 CnSyncRunLog → 跳过；
 * ③ 只遍历 ProductSyncMap.isActive=true，**绝不触碰 .com 原生产品**；
 * ④ 物理删除前写 ProductSyncTombstone（白名单快照）；
 * 此外：删除遇到外键冲突（下游依赖 收藏/询盘/竞价…）→ **降级 status="archived" + 告警，绝不强删**。
 */
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { pickProductWhitelist } from "@/lib/cn-sync/field-whitelist";
import { fetchFullIdSet } from "@/lib/cn-sync/cn-export-client";
import {
  resolveCnSyncClient,
  writeCnSyncRunLog,
  recentRunsHealthy,
} from "@/lib/cn-sync/runtime";
import { pushToGroup } from "@/lib/wecom/group-webhook";

export const RECONCILE_GUARD_N_DEFAULT = 3;

export interface ReconcileStats {
  ok: boolean;
  checked: number;
  deleted: number;
  archivedFallback: number;
  skipped: number;
  guardSkipped: boolean;
  error?: string;
}

export interface ReconcileOptions {
  /** 注入 Prisma 客户端（单测用）；缺省则延迟加载真实单例 */
  client?: PrismaClient;
  /** 注入全量 id 拉取函数（单测用）；缺省走真实 HTTP */
  fetchFullIdSet?: () => Promise<Set<string> | null>;
  /** 注入护栏 N（单测用） */
  guardN?: number;
}

/** 判定是否为外键约束冲突（Prisma P2003 / P2014 或错误信息命中） */
function isForeignKeyViolation(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P2003" || e.code === "P2014";
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /foreign key|foreign key constraint|violates foreign key/i.test(msg);
}

/** 物理删除一个「曾同步」产品；返回 deleted | archived-fallback | missing */
async function hardDeleteSyncedProduct(
  client: PrismaClient,
  neonProductId: string,
  cnProductId: string
): Promise<"deleted" | "archived-fallback" | "missing"> {
  const snap = await client.product.findUnique({
    where: { id: neonProductId },
    include: { brand: true, category: true, images: true, videos: true },
  });

  // 已不存在 → 仅标记账本
  if (!snap) {
    await client.productSyncMap.update({
      where: { cnProductId },
      data: { isActive: false, deletedAt: new Date() },
    });
    return "missing";
  }

  // 护栏 ④：删除前留档（白名单快照，排除 PII / 坐标）
  const snapshot = JSON.stringify(
    pickProductWhitelist(snap as unknown as Record<string, unknown>)
  );
  await client.productSyncTombstone.create({
    data: { cnProductId, neonProductId, snapshot, reason: "reconcile-absent" },
  });

  try {
    await client.$transaction(async (tx) => {
      // 清理该产品的估值行（修正 1：Valuation 不同步，但删产品时顺带清理残留行）
      await tx.valuation.deleteMany({ where: { productId: neonProductId } });
      await tx.productImage.deleteMany({ where: { productId: neonProductId } });
      await tx.productVideo.deleteMany({ where: { productId: neonProductId } });
      await tx.product.delete({ where: { id: neonProductId } }); // 物理删除
      await tx.productSyncMap.update({
        where: { cnProductId },
        data: { isActive: false, deletedAt: new Date() },
      });
    });
    return "deleted";
  } catch (e) {
    // 关键护栏：存在下游依赖（收藏/询盘/竞价等无 onDelete:Cascade 的引用）→ 降级 archived
    if (isForeignKeyViolation(e)) {
      await client.product.update({
        where: { id: neonProductId },
        data: { status: "archived" },
      });
      await client.productSyncMap.update({
        where: { cnProductId },
        data: { isActive: false },
      });
      await pushToGroup({
        title: "⚠️ 同步产品存在下游依赖，已降级 archived（未物理删除）",
        lines: [
          `productId \`${neonProductId}\`（cnProductId \`${cnProductId}\`）因外键依赖无法物理删除`,
          `处置：已置 status="archived"（网站不可见）；如需彻底清理，请人工处理关联数据后重跑对账。`,
        ],
        level: "warn",
      });
      return "archived-fallback";
    }
    throw e;
  }
}

/**
 * 执行一次全量对账。不抛出（失败写 run log + 告警并返回 ok=false）。
 */
export async function reconcile(opts: ReconcileOptions = {}): Promise<ReconcileStats> {
  const t0 = Date.now();
  // 时间预算：与增量同步同源（默认 240s）——防止对账将来变大后重演「被平台静默杀轮」
  const budgetMs = Number(process.env.CN_SYNC_RUN_BUDGET_MS ?? 240_000);
  const effectiveBudgetMs = Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : 240_000;
  const deadlineAt = t0 + effectiveBudgetMs;
  const stats: ReconcileStats = {
    ok: true,
    checked: 0,
    deleted: 0,
    archivedFallback: 0,
    skipped: 0,
    guardSkipped: false,
  };
  let client: PrismaClient | null = null;

  try {
    client = await resolveCnSyncClient(opts.client);
    const fetchIds = opts.fetchFullIdSet ?? fetchFullIdSet;
    const guardN =
      opts.guardN ?? Number(process.env.CN_SYNC_RECONCILE_GUARD_N ?? RECONCILE_GUARD_N_DEFAULT);

    // 护栏 ②：连续 N 轮异常 → 跳过（不删）
    if (!(await recentRunsHealthy(client, guardN))) {
      stats.guardSkipped = true;
      await writeCnSyncRunLog(
        client,
        "reconcile",
        "skipped",
        stats,
        Date.now() - t0,
        "guard: recent runs unhealthy"
      );
      return stats;
    }

    // 拉全量 id 集合
    const idSet = await fetchIds();
    // 护栏 ①：空快照 / 失败 → 不删
    if (!idSet || idSet.size === 0) {
      await writeCnSyncRunLog(
        client,
        "reconcile",
        "skipped",
        stats,
        Date.now() - t0,
        "guard: empty or failed snapshot"
      );
      return stats;
    }

    // 护栏 ③：只动「曾同步」产品
    const maps = await client.productSyncMap.findMany({ where: { isActive: true } });
    const failures: string[] = [];
    let budgetExceeded = false;
    for (const m of maps) {
      // 时间预算守卫：超时则停止本轮（剩余项下一轮继续；不写 error，避免拖垮护栏②）
      if (Date.now() >= deadlineAt) {
        budgetExceeded = true;
        break;
      }
      stats.checked++;
      if (idSet.has(m.cnProductId)) continue; // 仍存在 → 保留
      try {
        const r = await hardDeleteSyncedProduct(client, m.neonProductId, m.cnProductId);
        if (r === "deleted") stats.deleted++;
        else if (r === "archived-fallback") stats.archivedFallback++;
        else stats.skipped++;
      } catch (e) {
        // LOW-5：单条失败不再中断整批；计入 skipped，下一轮重试
        stats.skipped++;
        failures.push(`${m.cnProductId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (failures.length) {
      await pushToGroup({
        title: "⚠️ .cn→.com 对账：部分产品删除失败（已跳过，未中断整批）",
        lines: [`共 ${failures.length} 条失败，下一轮会重试：`, ...failures.slice(0, 10)],
        level: "warn",
      });
    }

    if (budgetExceeded) {
      await pushToGroup({
        title: "⚠️ .cn→.com 对账未跑完（时间预算耗尽）",
        lines: [
          `本轮已检查 ${stats.checked} / ${maps.length} 台（deleted=${stats.deleted} archivedFallback=${stats.archivedFallback} skipped=${stats.skipped}）。`,
          `预算 ${effectiveBudgetMs}ms 内未跑完；已安全停止，剩余项下一轮继续（幂等）。`,
        ],
        level: "warn",
      });
    }

    await writeCnSyncRunLog(
      client,
      "reconcile",
      budgetExceeded ? "partial" : "success",
      stats,
      Date.now() - t0
    );
  } catch (e) {
    stats.ok = false;
    stats.error = e instanceof Error ? e.message : String(e);
    if (client) {
      await writeCnSyncRunLog(
        client,
        "reconcile",
        "error",
        stats,
        Date.now() - t0,
        stats.error
      );
    }
    await pushToGroup({
      title: "❌ .cn→.com 产品对账失败",
      lines: [`原因：${stats.error}`],
      level: "warn",
    });
  }

  return stats;
}
