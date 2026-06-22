"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

interface LoginFormProps {
  locale: string;
}

export function LoginForm({ locale }: LoginFormProps) {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const data = {
      identifier: (form.elements.namedItem("identifier") as HTMLInputElement).value,
      password: (form.elements.namedItem("password") as HTMLInputElement).value,
    };

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.success) {
        // 保存 token 和用户信息到 localStorage
        localStorage.setItem("token", result.data.token);
        localStorage.setItem("user", JSON.stringify(result.data.user));
        router.push(`/${locale}`);
        window.location.reload();
      } else {
        setError(result.error || t("error"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

    return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="login-identifier"
        name="identifier"
        label={t("identifier") || "用户名或邮箱"}
        type="text"
        placeholder={t("identifierPlaceholder") || "请输入用户名或邮箱"}
        required
      />
      <Input
        id="login-password"
        name="password"
        label={t("password")}
        type="password"
        placeholder={t("passwordPlaceholder")}
        required
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        <LogIn className="mr-2 h-4 w-4" />
        {loading ? "..." : t("submit")}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Link
          href={`/${locale}/auth/forgot-password`}
          className="text-gray-500 hover:text-primary-600 hover:underline"
        >
          {t("forgotPassword") || "忘记密码？"}
        </Link>
        <span className="text-gray-500">
          {t("noAccount")}{" "}
          <Link
            href={`/${locale}/auth/register`}
            className="font-medium text-primary-600 hover:underline"
          >
            {t("registerLink")}
          </Link>
        </span>
      </div>
    </form>
  );
}
