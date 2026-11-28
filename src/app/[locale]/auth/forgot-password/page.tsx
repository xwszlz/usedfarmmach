"use client";

import { useParams } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  const { locale } = useParams();

  // 标题与副标题交给表单自己渲染：提交成功后整块会换成「邮件已发送」，
  // 留在页面层会导致成功态上方仍挂着「输入用户名或邮箱…」的副标题，
  // 用户会误以为没发出去、还想再填一次（2026-11-28 老板实测反馈）。
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <ForgotPasswordForm locale={locale as string} />
      </div>
    </div>
  );
}
