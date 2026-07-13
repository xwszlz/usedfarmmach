"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const { locale } = useParams();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const redirect = searchParams.get("redirect");
    if (token) {
      // 已登录用户访问登录页，自动跳转，避免再次显示登录表单
      window.location.href = redirect || `/${locale as string}/seller/products`;
    } else {
      setChecking(false);
    }
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
