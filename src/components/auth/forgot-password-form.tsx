"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

interface ForgotPasswordFormProps {
  locale: string;
}

export function ForgotPasswordForm({ locale }: ForgotPasswordFormProps) {
  const t = useTranslations("auth.forgotPassword");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const identifier = (form.elements.namedItem("identifier") as HTMLInputElement).value.trim();

    if (!identifier) {
      setError(t("errorEmpty") || "请输入用户名或邮箱");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const result = await res.json();

      if (result.success) {
        setSent(true);
      } else {
        setError(result.error || t("error"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <Mail className="h-6 w-6 text-green-600" />
        </div>
        <p className="text-gray-600">
          {t("sentMessage") || "如果该账号存在且绑定了邮箱，重置链接已发送到您的邮箱。请查收邮件（注意检查垃圾邮件文件夹）。"}
        </p>
        <Link
          href={`/${locale}/auth/login`}
          className="inline-block font-medium text-primary-600 hover:underline"
        >
          {t("backToLogin") || "返回登录"}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="forgot-identifier"
        name="identifier"
        label={t("identifier") || "用户名或邮箱"}
        type="text"
        placeholder={t("identifierPlaceholder") || "请输入注册时的用户名或邮箱"}
        required
      />
      <p className="text-sm text-gray-500">
        {t("hint") || "我们将向您的注册邮箱发送密码重置链接"}
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "..." : (t("submit") || "发送重置链接")}
      </Button>
      <p className="text-center text-sm text-gray-500">
        <Link
          href={`/${locale}/auth/login`}
          className="font-medium text-primary-600 hover:underline"
        >
          {t("backToLogin") || "返回登录"}
        </Link>
      </p>
    </form>
  );
}
