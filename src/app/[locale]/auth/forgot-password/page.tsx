"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const { locale } = useParams();

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{t("title") || "忘记密码"}</h1>
          <p className="mt-1 text-gray-500">{t("subtitle") || "输入用户名或邮箱，我们将发送重置链接"}</p>
        </div>
        <ForgotPasswordForm locale={locale as string} />
      </div>
    </div>
  );
}
