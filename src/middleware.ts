import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// 需要登录的路径
const PROTECTED_PATHS = [
  "/api/seller",
  "/api/inquiries",
  "/api/demands",
  "/seller",
  "/admin",
];

// 仅管理员可访问
const ADMIN_PATHS = ["/api/admin", "/admin"];

// 仅卖家可访问
const SELLER_PATHS = ["/api/seller", "/seller"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过非保护路径
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // 提取 token
  const token = getTokenFromRequest(request);
  if (!token) {
    // API 请求 → 返回 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    // 页面请求 → 跳转登录页
    const loginUrl = new URL("/login", request.url);
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
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 检查管理员权限
  const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  if (isAdminPath && payload.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden: admin only" },
      { status: 403 }
    );
  }

  // 在请求头中传递用户信息，供 API route 使用
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-role", payload.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // 也从 cookie 读取（兼容 SSR）
  const cookie = request.cookies.get("token")?.value;
  return cookie || null;
}

export const config = {
  matcher: ["/api/:path*", "/seller/:path*", "/admin/:path*"],
};
