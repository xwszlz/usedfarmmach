import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Neon 数据库保活接口
 * 由 Vercel Cron 每 4 分钟调用一次
 * 防止 Neon 免费层 5 分钟无请求后休眠（冷启动 5-10s）
 */
export async function GET(request: Request) {
  try {
    // 简单查询保活，不做任何实际业务逻辑
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch (error) {
    console.error("Keep-alive failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// 保活接口不需要缓存，每次都真实请求
export const dynamic = "force-dynamic";
