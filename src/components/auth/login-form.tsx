"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogIn, CheckCircle2, Loader2 } from "lucide-react";

interface LoginFormProps {
  locale: string;
}

export function LoginForm({ locale }: LoginFormProps) {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

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

      // 检查响应是否为 JSON 格式
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // 非 JSON 响应（可能是 HTML 错误页或网关错误）
        setLoading(false);
        if (res.status >= 500) {
          setError("服务器繁忙，请稍后重试");
        } else {
          setError("服务器返回异常，请稍后重试");
        }
        return;
      }

      const result = await res.json();

      if (result.success) {
        // 保存 token 和用户信息到 localStorage
        localStorage.setItem("token", result.data.token);
        localStorage.setItem("user", JSON.stringify(result.data.user));

        // 先显示成功提示，延迟跳转让用户感知到登录成功
        setSuccess(true);
        setLoading(false);

        setTimeout(() => {
          router.push(`/${locale}`);
          window.location.reload();
        }, 800);
      } else {
        // 后端返回了业务错误（如密码错误、账号不存在等）
        setLoading(false);
        if (res.status >= 500) {
          setError("服务器繁忙，请稍后重试");
        } else {
          setError(result.error || t("error"));
        }
      }
    } catch (err: unknown) {
      // 网络错误、超时、DNS 解析失败等会进入 catch
      setLoading(false);
      const errMsg = err instanceof Error ? err.message : "";
      if (
        errMsg.includes("Failed to fetch") ||
        errMsg.includes("NetworkError") ||
        errMsg.includes("network") ||
        errMsg.includes("timeout") ||
        errMsg.includes("aborted")
      ) {
        setError("网络错误，请检查网络连接后重试");
      } else {
        setError(t("error"));
      }
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
      {error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 font-medium flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {t("success")}，{locale === "zh" ? "正在跳转..." : "redirecting..."}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading || success}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {locale === "zh" ? "登录中..." : "Logging in..."}
          </>
        ) : success ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {t("success")}
          </>
        ) : (
          <>
            <LogIn className="mr-2 h-4 w-4" />
            {t("submit")}
          </>
        )}
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
