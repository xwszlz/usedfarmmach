import { NextResponse } from "next/server";

/**
 * Neon 数据库保活接口
 * 由 GitHub Actions 每5分钟调用一次
 * 防止 Neon 免费层 5 分钟无请求后休眠
 */
export async function GET(request: Request) {
  try {
    // 简单返回成功，先不查数据库（排查404问题）
    return NextResponse.json({
      ok: true,
      time: new Date().toISOString(),
      note: "keepalive endpoint - DB check disabled for debugging",
    });
  } catch (error) {
    console.error("Keepalive error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// 保活接口不需要缓存
export const dynamic = "force-dynamic";
