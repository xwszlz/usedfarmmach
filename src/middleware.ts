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
const ADMIN_ROLES = ["admin", "super_admin", "editor"];

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

/**
 * 构造“已放行”下游响应，并注入用户信息头。
 *
 * ⚠️ 关键：当请求经过 next-intl 中间件（intlResponse 存在）时，
 * 必须把 intlResponse 上的 `x-middleware-*` 请求头（尤其
 * `x-middleware-request-x-next-intl-locale`）一并带到最终响应，
 * 否则页面在渲染期由 next-intl 解析 locale 失败会触发 notFound() → 404。
 * （历史缺陷：此前用 `new Headers(request.headers)` 重建响应，丢掉了该头。）
 */
function nextResponseWithUser(
  request: NextRequest,
  payload: { userId: string; role: string },
  intlResponse?: NextResponse
): NextResponse {
  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });

  // 保留 next-intl 注入的内部中间件头（含 locale / rewrite / override-headers）
  if (intlResponse) {
    intlResponse.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith("x-middleware-")) {
        response.headers.set(key, value);
      }
    });
  }

  // 注入用户信息（以 Next 的 x-middleware-request-* 约定下发）
  const existingOverride = response.headers.get("x-middleware-override-headers");
  const extra = "x-user-id,x-user-role";
  response.headers.set(
    "x-middleware-override-headers",
    existingOverride ? `${existingOverride},${extra}` : extra
  );
  response.headers.set("x-middleware-request-x-user-id", payload.userId);
  response.headers.set("x-middleware-request-x-user-role", payload.role);

  return response;
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

    return nextResponseWithUser(request, payload);
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
  // 🔒 localePrefix: "always" 下 pathname 恒为 /<locale>/...，
  // 必须先剥离 locale 前缀再匹配，否则 /zh/admin 永远匹不上 /admin。
  const pathnameWithoutLocale = pathname.replace(/^\/(zh|en|ru|es|pt|ar|fr|hi)(?=\/|$)/, "");
  const isProtected = PROTECTED_PATHS.some((p) => pathnameWithoutLocale.startsWith(p));
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
    const loginUrl = new URL(`/${site === "cn" ? "zh" : "en"}/auth/login`, request.url);
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
    const loginUrl = new URL(`/${site === "cn" ? "zh" : "en"}/auth/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 检查管理员权限
  const isAdminPath = ADMIN_PATHS.some((p) => pathnameWithoutLocale.startsWith(p));
  if (isAdminPath && !ADMIN_ROLES.includes(payload.role)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: admin only" },
      { status: 403 }
    );
  }

  // super_admin 专属路径收紧
  const isSuperAdminPath = SUPER_ADMIN_PATHS.some((p) => pathnameWithoutLocale.startsWith(p));
  if (isSuperAdminPath && payload.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden: super admin only" },
      { status: 403 }
    );
  }

  // 在请求头中传递用户信息，并保留 next-intl 的内部头（否则页面会 404）
  return nextResponseWithUser(request, payload, intlResponse);
}

export const config = {
  matcher: ["/", "/(zh|en|ru|es|pt|ar|fr|hi)/:path*", "/api/:path*"],
};
