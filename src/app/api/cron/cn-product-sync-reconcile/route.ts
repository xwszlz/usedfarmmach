/**
 * GET /api/cron/cn-product-sync-reconcile —— .cn → .com 产品「每日全量对账」入口
 *
 * 触发：Vercel Cron（`0 19 * * *`，UTC 19:00 = 北京 03:00）或手动 curl。
 * 站点：仅在 .com 生效（SITE=cn → 404）。
 * 鉴权：同 cn-product-sync —— 仅认 `CRON_SECRET`（Vercel Cron 以 `Authorization: Bearer <CRON_SECRET>` 发送）；
 * 未配置 CRON_SECRET → 503 cron-misconfigured（非静默）；已配置但不匹配 → 401；
 * 不再接受 `?token=`（CRON_API_KEY / INTERNAL_API_KEY 已弃用：防「已泄漏的 INTERNAL_API_KEY → 不可逆物理删除」链）。
 *
 * 对账会物理删除「曾同步但已从 .cn 消失」的产品（拍板④：真删 + 四重护栏）；
 * 具体护栏见 src/lib/cn-sync/reconcile.ts。
 */
import { NextRequest, NextResponse } from "next/server";
import { reconcile } from "@/lib/cn-sync/reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // 绝不为密钥设默认值兜底（env 缺失即不可比对，fail-closed）
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 仅在 .com 生效
  if ((process.env.SITE ?? "com") === "cn") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!process.env.CRON_SECRET) {
    // 配置缺失 = 运维事故：Vercel Cron 会拿到 503，比裸 401 更容易被发现。
    // ⚠️ 此处不推企微：该分支匿名可达，推送等于给攻击者一个告警刷屏入口。
    console.error("[cn-sync] CRON_SECRET 未配置，cron 无法鉴权，同步/对账不会运行");
    return NextResponse.json({ ok: false, error: "cron-misconfigured" }, { status: 503 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const stats = await reconcile();
  return NextResponse.json({ ok: stats.ok, stats });
}
