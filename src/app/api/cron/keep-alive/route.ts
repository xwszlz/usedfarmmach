/**
 * 数据库预热接口（原「Neon 保活」）
 *
 * ── 为什么要改（2026-09-26）────────────────────────────────
 * 原实现有两处不成立：
 *   1. 注释声称「由 GitHub Actions 每 5 分钟调用」，但
 *      .github/workflows/keepalive.yml 实际 ping 的是 /api/products，
 *      本路由从未被任何调度器调用（死代码）。
 *   2. 函数体内并未查询数据库，无法唤醒 Neon 计算节点 —— 注释与实现不符。
 *
 * 更关键的是，「7x24 每 5 分钟保活」这条路线本身已被否决：
 *   Neon 免费层每项目每月仅 100 CU-小时，最小计算规格 0.25 CU。
 *   让计算节点 24 小时不睡 = 720h x 0.25CU = 180 CU-小时，超出配额 80%，
 *   按 Neon 规则会在月中触发「compute 被暂停至下一计费周期」——
 *   届时现有连接全部断开、新连接无法建立，不是变慢，是彻底不可用。
 *   而保活原本要解决的「默认 10s 超时 -> ERR_TIMED_OUT」问题，
 *   已由 /api/products 的 maxDuration = 30 兜住，无需再靠常驻保活。
 *
 * ── 现在怎么做 ────────────────────────────────────────────
 * 从「7x24 保活」改为「定点预热 + 按需预热」：
 *   · 定点：vercel.json 的 crons 每天在流量起点前触发 2 次
 *     （成本约 1.3 CU-小时/月，约为原方案的 1/140）。
 *   · 按需：需要时手动 GET 本接口立刻唤醒 —— 推广活动、展会当天、
 *     发版后冒烟测试等场景。
 *
 * 鉴权沿用项目既有约定：?token=INTERNAL_API_KEY
 * （Vercel Cron 不支持自定义请求头，故走 URL query）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * 与 /api/cron/update-prices、/api/cron/benchmark 保持一致的鉴权逻辑
 */
function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const cronApiKey = process.env.CRON_API_KEY || "dev-secret-key";
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (token === cronApiKey) return true;
  if (internalApiKey && token === internalApiKey) return true;
  if (process.env.NODE_ENV === "production") return false;
  return token === "dev-secret-key";
}

/**
 * GET /api/cron/keep-alive?token=xxx
 * 真实打一次库，唤醒 Neon 计算节点。返回耗时，便于判断是否发生了冷启动。
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!isValidToken(token)) {
    return NextResponse.json(
      { success: false, error: "缺少或无效的授权信息" },
      { status: 401 }
    );
  }

  const startedAt = Date.now();
  try {
    // 这是「预热」与「空转」的唯一区别：必须真的打一次库
    await prisma.$queryRaw`SELECT 1`;
    const tookMs = Date.now() - startedAt;
    return NextResponse.json({
      success: true,
      message:
        tookMs > 1000
          ? `数据库已唤醒（发生冷启动，耗时 ${tookMs}ms）`
          : `数据库已是热的（耗时 ${tookMs}ms）`,
      coldStart: tookMs > 1000,
      tookMs,
      at: new Date().toISOString(),
    });
  } catch (error) {
    const tookMs = Date.now() - startedAt;
    console.error("数据库预热失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "内部服务器错误",
        tookMs,
      },
      { status: 500 }
    );
  }
}
