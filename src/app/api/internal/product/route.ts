/**
 * 向后兼容路由：/api/internal/product（单数）→ /api/internal/products（复数）
 *
 * 早期版本的小程序可能调用了单数路径 /api/internal/product，
 * 此路由将其透明转发到正确的复数路径，避免 404 导致的"假超时"。
 *
 * 同时支持三种认证方式（与下游 `/api/internal/products` 的鉴权口径保持一致）：
 *   - x-miniapp-key（小程序直连）
 *   - x-api-key（内部API/云函数）
 *   - Authorization: Bearer <JWT>（已登录的小程序用户）
 *
 * ⚠️ 凭据必须**逐个原样转发**：下游鉴权是「x-api-key **或** Bearer JWT」，
 *    少转一个头，对应那批客户端就会被误判 401。
 *
 * ⚠️ R6 增强：
 *   - 记录转发 payload 大小，便于排查大体积 base64 数据问题
 *   - 内部 fetch 超时设为 55s（留 5s 给响应处理，总 maxDuration=60s）
 */
import { NextRequest, NextResponse } from "next/server";

import { SITE_ORIGIN } from "@/lib/site-url";

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

    // 构建内部请求 URL —— base **必须是服务端常量**，不能用 `request.url`。
    //
    // 为什么：`request.url` 的 origin 由请求的 Host 头推导，而 nginx 传的是 `$host`
    // （客户端可控），本路由又不校验任何凭据、只是把调用方的 x-api-key / x-miniapp-key
    // 往下转发，最后还把响应 json 原样回吐给调用方 —— 三者叠加就是
    // 「匿名可达 + 目标主机完全可控 + 完整读回响应」的 POST 型 SSRF（内网探测/请求转发器）。
    // 换成 canonical origin 对合法调用方完全等价（小程序本来就打 canonical 域名）。
    const internalUrl = new URL("/api/internal/products", SITE_ORIGIN);

    // ⚠️ Authorization 必须转发：下游 `/api/internal/products` 的鉴权是
    //    「x-api-key 匹配 **或** Bearer JWT 有效」二者之一。
    //    旧实现只转了 content-type / x-api-key / x-miniapp-key，已登录的用户
    //    （只带 JWT、不带 x-api-key 的早期小程序版本）走这条兼容路径时 JWT 被丢，
    //    必然被判 401 —— 也就是说这条兼容路由对"它要兼容的那批客户端"从没生效过；
    //    更糟的是下游在"无凭证"分支里返回的是"请重新登录"的文案，正常登录用户被推进了错误分支。
    //
    // 用 `...(auth ? {...} : {})` 而不是 `authorization: auth || ""`：
    // 空字符串的 Authorization 是非法值，部分代理/网关会直接 400。
    const auth = request.headers.get("authorization");

    // 转发请求到正确的端点
    const response = await fetch(internalUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 转发所有认证头
        "x-api-key": request.headers.get("x-api-key") || "",
        "x-miniapp-key": request.headers.get("x-miniapp-key") || "",
        ...(auth ? { authorization: auth } : {}),
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
