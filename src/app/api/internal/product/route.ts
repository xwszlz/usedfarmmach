/**
 * 向后兼容路由：/api/internal/product（单数）→ /api/internal/products（复数）
 *
 * 早期版本的小程序可能调用了单数路径 /api/internal/product，
 * 此路由将其透明转发到正确的复数路径，避免 404 导致的"假超时"。
 *
 * 同时支持两种认证方式：
 *   - x-miniapp-key（小程序直连）
 *   - x-api-key（内部API/云函数）
 */
import { NextRequest, NextResponse } from "next/server";

// Vercel Serverless Function 超时延长至60秒
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  console.log("[compat] /api/internal/product → 转发到 /api/internal/products");

  try {
    // 读取原始请求体
    const body = await request.json();

    // 构建内部请求URL（使用相对路径，Next.js内部转发）
    const internalUrl = new URL("/api/internal/products", request.url);

    // 转发请求到正确的端点
    const response = await fetch(internalUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 转发所有认证头
        "x-api-key": request.headers.get("x-api-key") || "",
        "x-miniapp-key": request.headers.get("x-miniapp-key") || "",
      },
      body: JSON.stringify(body),
    });

    // 返回原始响应
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[compat] /api/internal/product forward error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error during request forwarding" },
      { status: 500 }
    );
  }
}
