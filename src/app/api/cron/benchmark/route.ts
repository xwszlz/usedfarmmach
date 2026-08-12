/**
 * GET /api/cron/benchmark  — Vercel Cron 自动调用（URL query token 验证）
 * POST /api/cron/benchmark — 手动调用（Authorization Bearer 头验证）
 *
 * 多品牌国际基准价 — 每日实时刷新（方案 A：跑在 Vercel 境外，出网自由）
 * 逻辑见 src/lib/benchmark-engine.js（并发抓取 18 品牌 × 机型 × 7 源）。
 *
 * 鉴权沿用项目既有约定：vercel.json 的 cron path 带 ?token=INTERNAL_API_KEY，
 * 同时支持 CRON_API_KEY（手动 Bearer）。
 */
import { NextRequest, NextResponse } from "next/server";
// @ts-ignore — CommonJS 引擎，类型见 benchmark-engine.d.ts
import { runRefresh, getFxRates, disconnectBenchmark } from "@/lib/benchmark-engine";

export const dynamic = "force-dynamic";
// 266 目标 / 并发12 / 8s超时 → 最坏 ~184s，需 Vercel Pro（Hobby 上限 60s 会被截断）
export const maxDuration = 300;

function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const cronApiKey = process.env.CRON_API_KEY || "dev-secret-key";
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (token === cronApiKey) return true;
  if (internalApiKey && token === internalApiKey) return true;
  if (process.env.NODE_ENV === "production") return false;
  return token === "dev-secret-key";
}

async function executeRefresh() {
  const startedAt = Date.now();
  const fx = await getFxRates();
  const stats = await runRefresh({ fx, concurrency: 12, timeoutMs: 8000 });
  const tookMs = Date.now() - startedAt;
  return {
    success: true,
    message: `基准价刷新完成：成功 ${stats.ok} / 跳过(无样本) ${stats.skip} / 失败(网络) ${stats.failed} / 共 ${stats.total}`,
    stats,
    tookMs,
    at: new Date().toISOString(),
  };
}

// GET — Vercel Cron（token 通过 ?token= 传递）
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!isValidToken(token)) {
    return NextResponse.json(
      { success: false, error: "缺少或无效的授权信息" },
      { status: 401 }
    );
  }
  try {
    const result = await executeRefresh();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("基准价刷新异常 (GET):", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "内部服务器错误",
      },
      { status: 500 }
    );
  } finally {
    await disconnectBenchmark().catch(() => {});
  }
}

// POST — 手动触发（Authorization: Bearer <token>）
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const apiKey = process.env.CRON_API_KEY || "dev-secret-key";
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "缺少授权信息" }, { status: 401 });
  }
  const token = authHeader.substring(7);
  if (token !== apiKey && process.env.NODE_ENV === "production") {
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey || token !== internalApiKey) {
      return NextResponse.json({ success: false, error: "无效的API密钥" }, { status: 401 });
    }
  }
  try {
    const result = await executeRefresh();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("基准价刷新异常 (POST):", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "内部服务器错误",
      },
      { status: 500 }
    );
  } finally {
    await disconnectBenchmark().catch(() => {});
  }
}
