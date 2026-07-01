import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { verifyToken } from "@/lib/auth";

// next-intl 国际化中间件（自动检测浏览器语言）
const intlMiddleware = createMiddleware({
  locales: ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"],
  defaultLocale: "zh",
  localePrefix: "always",
  localeDetection: true, // 根据 Accept-Language 自动切换
});

// 需要登录的路径
const PROTECTED_PATHS = [
  "/api/seller",
  "/api/inquiries",
  "/api/demands",
  "/api/agents/orchestrator",
  "/seller",
  "/admin",
];

// 仅管理员可访问（admin + super_admin）
const ADMIN_PATHS = ["/api/admin", "/admin"];
const ADMIN_ROLES = ["admin", "super_admin"];

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookie = request.cookies.get("token")?.value;
  return cookie || null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // 静态资源路径：跳过所有中间件处理（直接由 Next.js static file serving 处理）
  const STATIC_PATHS = [
    "/daily-reports/",
    "/_next/",
    "/images/",
    "/logo",
    "/videos/",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ];
  if (STATIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // .cn → .com 全站301跳转
  if (host.includes("usedfarmmach.cn")) {
    const url = new URL(request.url);
    url.hostname = "usedfarmmach.com";
    return NextResponse.redirect(url, 301);
  }

  // API 路由：跳过 next-intl，只做 auth 检查
  if (pathname.startsWith("/api/")) {
    const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
    if (!isProtected) {
      return NextResponse.next();
    }

    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));
    if (isAdminPath && !ADMIN_ROLES.includes(payload.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin only" },
        { status: 403 }
      );
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-user-role", payload.role);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // 页面路由：先执行 next-intl 中间件（处理 locale 路由）
  const intlResponse = intlMiddleware(request);

  // 如果 next-intl 返回了重定向，直接返回
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    return intlResponse;
  }

  // 跳过非保护路径
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return intlResponse;
  }

  // 提取 token
  const token = getTokenFromRequest(request);
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/zh/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 验证 token
  const payload = verifyToken(token);
  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/zh/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 检查管理员权限
  const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  if (isAdminPath && !ADMIN_ROLES.includes(payload.role)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: admin only" },
      { status: 403 }
    );
  }

  // 在请求头中传递用户信息
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-role", payload.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/", "/(zh|en|ru|es|pt|ar|fr|hi)/:path*", "/api/:path*"],
};
