/**
 * POST /api/credits/recharge —— 积分充值 / 会员升级（P0 I-5 止血）
 *
 * ⚠️ 安全红线（2026-07-24）：真实支付接入前，本端点【禁止】任何形式的"免支付增发积分"。
 * 原实现为"模拟支付直接改库"（prisma.user.update credits 自增 + 写 CreditTransaction，
 * 无任何支付校验），属财务 + 合规双雷，违反《统一方案》红线③"积分不可免费增发"。
 *
 * 处置：在真实支付（微信支付 / Stripe，需 ICP 备案或走已备案小程序通道）接入并校验
 * 支付结果之前，本端点一律返回 503，且【绝不对】User.credits / CreditTransaction 做任何写操作。
 *
 * 恢复方式：接入真实支付网关、校验支付回调成功后再启用本端点（见阶段2方案）。
 *   通过下方 CREDITS_ISSUANCE_ENABLED 总开关控制；真实支付 PR 中置为 true 并补全校验逻辑。
 */

import { NextRequest, NextResponse } from "next/server";

// 充值 / 增发总开关：真实支付接入前保持 false（禁用）。
const CREDITS_ISSUANCE_ENABLED = false;

export async function POST(request: NextRequest) {
  if (!CREDITS_ISSUANCE_ENABLED) {
    return NextResponse.json(
      {
        success: false,
        code: "SERVICE_UNAVAILABLE",
        error: "积分充值服务即将上线，当前暂不可用",
      },
      { status: 503 }
    );
  }

  // —— 以下步骤（支付校验 + 改库增发）仅在真实支付接入后启用 ——
  // 1) 解析并校验支付网关回调 / 预下单结果；
  // 2) 校验通过后才对 User.credits 自增并写 CreditTransaction（带 operatorId 审计）；
  // 3) 会员升级同理，需先完成支付。
  // 当前阶段不执行任何写操作，直接返回禁用态。
  return NextResponse.json(
    { success: false, error: "积分充值未启用" },
    { status: 503 }
  );
}
