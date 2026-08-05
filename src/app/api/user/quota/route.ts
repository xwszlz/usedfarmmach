/**
 * 用户额度查询（P1-a）
 * GET /api/user/quota
 *
 * 返回本人当前自然月各动作的已用/上限/剩余/重置日。
 * limit = -1 表示无限；remaining = -1 表示无限。
 * 只读，不增计数（计数仅在受保护动作触发时由 consumeQuota 完成）。
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getQuotaUser, getQuotaState } from "@/lib/quota";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  const qUser = await getQuotaUser(user.id);
  if (!qUser) {
    return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 });
  }

  const state = await getQuotaState(qUser);
  return NextResponse.json({ success: true, data: state });
}
