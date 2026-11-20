/**
 * POST /api/resend/inbound —— Resend 收信 webhook → 腾讯企业邮「邮件群组」
 *
 * 目标链路：
 *   客户 → sales@usedfarmmach.com（MX 指向 Resend，catch-all 收下）
 *        → Resend 触发 email.received
 *        → 校验 Svix 签名 → 按 to 分流
 *        → 取正文 + 附件 → 重新发一封到 sales@shendiaotech.cn（腾讯企业邮邮件群组）
 *        → 群组 3 名成员各自邮箱收到一份完整邮件，企业微信「邮件」应用同步提醒
 *        → 顺带推一条通知到「神雕套利运营日报」群（复用既有 WECOM_GROUP_WEBHOOK_URL）
 *
 * 本文件只做 HTTP 壳：真正逻辑在 @/lib/email/inbound-forwarder，
 * 该模块在 `.cn` 构建时被 next.config.js 结构性替换为 disabled 占位（数据不出境）。
 */
import { NextResponse } from "next/server";
import { handleInboundEmail } from "@/lib/email/inbound-forwarder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const result = await handleInboundEmail(req);
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
