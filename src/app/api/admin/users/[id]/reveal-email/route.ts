/**
 * Admin: 显示完整邮箱（带审计留痕）
 * POST /api/admin/users/[id]/reveal-email  { purpose?: string }
 *
 * 仅 super_admin / admin 可调用；调用即写 PiiAuditLog 后再返回明文 email。
 * 列表默认不下发明文（已在 Server Component 脱敏），此处仅按需返回。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { getQuotaUser, consumeQuota, quotaExceededResponse, rollbackQuota } from "@/lib/quota";
import { deductCredits } from "@/lib/credits/spend";
import { writePiiAuditLog } from "@/lib/audit";

/** 从 referer / 路径推断 locale（与 quota guard / 各 AI 路由保持一致） */
function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) return m[1];
  return "zh";
}

/** 角色门禁：仅 admin / super_admin */
async function checkAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  });
  if (!user || !["admin", "super_admin"].includes(user.role)) return null;
  return payload;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await checkAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  // ── P1-a 双闸门：额度(50/月) + 积分(10/次)（查看联系方式）──
  // 顺序：先 consumeQuota（超额→QUOTA_EXCEEDED），再 deductCredits（不足→INSUFFICIENT_CREDITS 并回滚额度）。
  let creditsRemaining: number | null = null;
  const qUser = await getQuotaUser(admin.userId);
  if (qUser) {
    const q = await consumeQuota(qUser, "viewContact");
    if (!q.ok) {
      return quotaExceededResponse(q.resetAt);
    }
    const cost = await deductCredits(
      admin.userId,
      10,
      "查看联系方式",
      { action: "viewContact", quotaRemaining: q.remaining },
      "viewcontact_cost",
    );
    if (!cost.ok) {
      await rollbackQuota(qUser, "viewContact");
      return NextResponse.json(
        {
          success: false,
          error: "积分不足，请先充值后再查看联系方式",
          code: "INSUFFICIENT_CREDITS",
          rechargeUrl: `/${getLocaleFromRequest(request)}/credits`,
          required: cost.required,
          balance: cost.credits,
        },
        { status: 402 },
      );
    }
    creditsRemaining = cost.credits ?? null;
  }

  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const purpose = typeof body?.purpose === "string" ? body.purpose : null;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 });
  }

  // 写审计：谁、何时、读了哪个用户的哪个字段、用途
  await writePiiAuditLog({
    actorId: admin.userId,
    targetUserId: id,
    field: "email",
    action: "view_full",
    purpose,
  });

  return NextResponse.json({ success: true, data: { email: target.email }, creditsRemaining });
}
