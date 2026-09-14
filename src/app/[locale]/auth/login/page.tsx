"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";

// 重定向目标净化：只接受「解析后同源」的站内路径。
// 用 WHATWG URL 解析再比对 origin，天然免疫 //evil.com、/\evil.com、\\evil.com、
// javascript:、前导 tab 等解析期绕过手法（字符串前缀检查做不到这一点）。
function resolveSafeRedirect(raw: string | null, fallback: string): string {
  if (!raw || typeof window === "undefined") return fallback;
  try {
    const resolved = new URL(raw, window.location.origin);
    if (resolved.origin !== window.location.origin) return fallback;
    // 防御：pathname 解码后若出现 "\" 或以 "//" 开头，下游再解析可能变成 authority/外站 → 拒绝
    const decodedPath = decodeURIComponent(resolved.pathname);
    if (decodedPath.includes("\\") || decodedPath.startsWith("//")) return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const { locale } = useParams();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const resolveRedirect = (): string => {
      const safeLocale = (locale as string) || "zh";
      const defaultTarget = `/${safeLocale}/seller/products`;
      // 只放行「解析后同源」的站内路径，其余（外站/伪协议/解析绕过）一律回落默认页
      const safePath = resolveSafeRedirect(searchParams.get("redirect"), defaultTarget);
      // 自环防护：解析后若指回登录页本身，改用默认落地页，避免「登录页 -> 登录页」死循环。
      if (safePath.includes("/auth/login")) {
        return defaultTarget;
      }
      return safePath;
    };

    const checkAuth = async () => {
      try {
        // 判据换成服务端权威会话：只有 200 才算已登录（不再信任陈旧的 localStorage.token）
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (cancelled) return;
        if (res.status === 200) {
          // 已登录用户访问登录页，自动跳转；用 replace 打断浏览历史，避免污染与循环
          window.location.replace(resolveRedirect());
        } else {
          setChecking(false);
        }
      } catch {
        // 网络异常一律按「未登录」处理 → 显示登录表单；绝不能因网络抖动而跳转，否则会把用户扔回循环
        if (!cancelled) setChecking(false);
      }
    };

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [locale, searchParams]);

  if (checking) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="text-gray-500">
          {locale === "zh" ? "检查登录状态..." : "Checking auth..."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-gray-500">{t("subtitle")}</p>
        </div>
        <LoginForm locale={locale as string} />
      </div>
    </div>
  );
}
