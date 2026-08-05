"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";

interface ResetPasswordFormProps {
  locale: string;
}

export function ResetPasswordForm({ locale }: ResetPasswordFormProps) {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) setToken(t);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const newPassword = (form.elements.namedItem("newPassword") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    if (newPassword.length < 6) {
      setError(t("tooShort") || "密码至少6位");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("mismatch") || "两次输入的密码不一致");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const result = await res.json();

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/${locale}/auth/login`);
        }, 3000);
      } else {
        setError(result.error || t("error"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <KeyRound className="h-6 w-6 text-green-600" />
        </div>
        <p className="text-gray-600">
          {t("successMessage") || "密码重置成功！即将跳转到登录页面..."}
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-red-500">
          {t("noToken") || "缺少重置令牌，请通过邮件中的链接访问此页面"}
        </p>
        <Link
          href={`/${locale}/auth/forgot-password`}
          className="font-medium text-primary-600 hover:underline"
        >
          {t("requestNew") || "重新申请重置链接"}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="reset-new-password"
        name="newPassword"
        label={t("newPassword") || "新密码"}
        type="password"
        placeholder={t("passwordPlaceholder") || "至少6位"}
        required
        minLength={6}
      />
      <Input
        id="reset-confirm-password"
        name="confirmPassword"
        label={t("confirmPassword") || "确认新密码"}
        type="password"
        placeholder={t("confirmPlaceholder") || "再次输入新密码"}
        required
        minLength={6}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "..." : (t("submit") || "重置密码")}
      </Button>
    </form>
  );
}
