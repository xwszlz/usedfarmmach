"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");
  const { locale } = useParams();

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{t("title") || "重置密码"}</h1>
          <p className="mt-1 text-gray-500">{t("subtitle") || "请输入您的新密码"}</p>
        </div>
        <Suspense fallback={<div className="text-center text-gray-400">Loading...</div>}>
          <ResetPasswordForm locale={locale as string} />
        </Suspense>
      </div>
    </div>
  );
}
