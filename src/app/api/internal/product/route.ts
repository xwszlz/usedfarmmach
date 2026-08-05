/**
 * 向后兼容路由：/api/internal/product（单数）→ /api/internal/products（复数）
 *
 * 早期版本的小程序可能调用了单数路径 /api/internal/product，
 * 此路由将其透明转发到正确的复数路径，避免 404 导致的"假超时"。
 *
 * 同时支持两种认证方式：
 *   - x-miniapp-key（小程序直连）
 *   - x-api-key（内部API/云函数）
 *
 * ⚠️ R6 增强：
 *   - 记录转发 payload 大小，便于排查大体积 base64 数据问题
 *   - 内部 fetch 超时设为 55s（留 5s 给响应处理，总 maxDuration=60s）
 */
import { NextRequest, NextResponse } from "next/server";

// Vercel Serverless Function 超时延长至60秒
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  console.log("[compat] /api/internal/product → 转发到 /api/internal/products");

  try {
    // 读取原始请求体
    const body = await request.json();

    // 🔍 R6 诊断：记录 payload 大小（base64 图片可能很大）
    const bodyStr = JSON.stringify(body);
    const payloadSizeBytes = new TextEncoder().encode(bodyStr).length;
    const imagesCount = Array.isArray(body.images) ? body.images.length : 0;
    const hasVideo = !!body.video;
    console.log(
      `[compat] forwarding: payload=${(payloadSizeBytes / 1024).toFixed(1)}KB, ` +
      `images=${imagesCount}, video=${hasVideo}`
    );

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
      body: bodyStr,
      // 🔍 R6 修复：设置内部 fetch 超时，防止无限等待（Vercel→OSS 可能慢）
      signal: AbortSignal.timeout(55_000),
    });

    // 返回原始响应
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const errDetail = error instanceof Error ? error.message : String(error);
    // 检测是否是超时错误
    const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
    console.error(`[compat] /api/internal/product forward error (timeout=${isTimeout}):`, errDetail);
    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? "请求处理超时（图片上传耗时较长），请稍后重试"
          : "Internal server error during request forwarding",
        code: isTimeout ? "FORWARD_TIMEOUT" : "FORWARD_ERROR",
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
