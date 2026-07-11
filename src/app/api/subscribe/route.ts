import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 邮箱格式校验：标准且足够严格
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/subscribe
 * 小程序邮箱订阅（资讯推送）
 * body: { email: string, source?: string }
 * 用于向订阅用户推送农机行业资讯与交易动态
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "请求格式错误" },
      { status: 400 }
    );
  }

  const email = (body?.email || "").toString().trim().toLowerCase();
  const source = (body?.source || "miniprogram").toString().trim() || "miniprogram";

  // 校验邮箱
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, error: "请输入有效的邮箱地址" },
      { status: 400 }
    );
  }

  try {
    // upsert：已订阅则刷新订阅时间并置为活跃，未订阅则新建
    await prisma.subscriber.upsert({
      where: { email },
      update: {
        isActive: true,
        subscribedAt: new Date(),
        source,
      },
      create: {
        email,
        source,
      },
    });

    return NextResponse.json({ success: true, message: "订阅成功" });
  } catch (err: any) {
    console.error("[subscribe] 写入失败:", err);
    return NextResponse.json(
      { success: false, error: "订阅失败，请稍后重试" },
      { status: 500 }
    );
  }
}
