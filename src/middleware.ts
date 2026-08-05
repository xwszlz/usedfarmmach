import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
// 注意：不能用 @/lib/auth.ts（jsonwebtoken 是 Node.js-only，middleware 是 Edge Runtime）
import { verifyTokenEdge } from "@/lib/auth-edge";

// ============================================================
// SITE 判断（Edge Runtime 无法直接读 process.env 文件系统，
// 但 Vercel Edge 支持 process.env.SITE；本地 dev 也给默认值）
// ============================================================
function detectSiteFromHost(host: string): "com" | "cn" {
  if (host.includes("usedfarmmach.cn")) return "cn";
  return "com";
}

// ============================================================
// next-intl 中间件工厂（按 SITE 动态生成 locales）
// ============================================================
function createIntlMiddleware(site: "com" | "cn") {
  const configs: Record<string, { locales: string[]; defaultLocale: string }> = {
    com: { locales: ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"], defaultLocale: "en" },
    cn: { locales: ["zh", "en"], defaultLocale: "zh" },
  };
  const cfg = configs[site];
  return createMiddleware({
    locales: cfg.locales,
    defaultLocale: cfg.defaultLocale,
    localePrefix: "always",
    localeDetection: true,
  });
}

// ============================================================
// 鉴权相关常量
// ============================================================
const PROTECTED_PATHS = [
  "/api/seller",
  "/api/demands",
  "/api/agents/orchestrator",
  "/seller",
  "/admin",
];

const ADMIN_PATHS = ["/api/admin", "/admin"];
const ADMIN_ROLES = ["admin", "super_admin"];

const SUPER_ADMIN_PATHS = [
  "/admin/system",
  "/api/admin/role",
  "/api/admin/system",
  "/api/admin/system/audit",
  "/api/admin/system/config",
  "/api/admin/system/compliance",
];

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookie = request.cookies.get("token")?.value;
  return cookie || null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";
  const site = detectSiteFromHost(host);

  // ============================================================
  // 静态资源路径跳过（直接由 Next.js static serving 处理）
  // ============================================================
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

  // ============================================================
  // 双站路由逻辑（反转旧 .cn→.com 301 跳转）
  // ============================================================
  if (site === "cn") {
    // .cn 站：正常放行。可在此处加「境外用户欢迎语」而非拦截。
    // 注意：.cn 站按 (cn) 路由分组处理，路径不变。
  } else {
    // .com 站：检测境内 IP → 301 跳 .cn
    const ipCountry =
      request.headers.get("x-vercel-ip-country") ||
      request.headers.get("cf-ipcountry") ||
      "";

    if (ipCountry === "CN") {
      // 所有 /api/* 路径不重定向，避免 API 客户端（微信小程序 / 第三方调用 / curl）
      // 被白名单或 redirect 限制拦截。所有 API 一律走 .com，确保数据源一致。
      // 注：此规则覆盖了 2026-07-26 之前的"仅注册类 API 豁免"，因为注册豁免粒度太细，
      // 小程序其他接口（/products、/inquiries、/subscribe 等）仍被 301 拦截，导致 errno:600002。
      // 注：同时豁免精确的 "/api"（无尾斜杠），startsWith("/api/") 不覆盖它。
      const isApiPath = pathname === "/api" || pathname.startsWith("/api/");

      if (isApiPath) {
        const res = NextResponse.next();
        res.headers.set("x-domestic-redirect", "1");
        return res;
      }

      // 其余 .com 境内访问：301 跳国内站（保留完整路径）
      const url = new URL(request.url);
      url.hostname = "usedfarmmach.cn";
      const redirect = NextResponse.redirect(url, 301);
      redirect.headers.set("x-domestic-redirect", "1");
      return redirect;
    }
  }

  // ============================================================
  // API 路由处理（先于 next-intl，避免国际化干扰 API 路径）
  // ============================================================
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

    const payload = await verifyTokenEdge(token);
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

    const isSuperAdminPath = SUPER_ADMIN_PATHS.some((p) => pathname.startsWith(p));
    if (isSuperAdminPath && payload.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: super admin only" },
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

  // ============================================================
  // 页面路由：按 SITE 动态创建 next-intl 中间件
  // ============================================================
  const intlMiddleware = createIntlMiddleware(site);
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
    const loginUrl = new URL(`/${site === "cn" ? "zh" : "en"}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 验证 token
  const payload = await verifyTokenEdge(token);
  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }
    const loginUrl = new URL(`/${site === "cn" ? "zh" : "en"}/login`, request.url);
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

  // super_admin 专属路径收紧
  const isSuperAdminPath = SUPER_ADMIN_PATHS.some((p) => pathname.startsWith(p));
  if (isSuperAdminPath && payload.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden: super admin only" },
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
