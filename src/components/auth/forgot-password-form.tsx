"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

interface ForgotPasswordFormProps {
  locale: string;
}

/**
 * 成功态才用到的三条文案。
 *
 * 为什么不加进 `messages/*.json`：那 8 个语言文件**不能重序列化**
 * （整体读入再写出会产生全文件 DIFF），只能做块级文本手术，风险远大于收益。
 * 这里只有三句，随组件走本地表，跟 register-form 的 SUCCESS_COPY 一个套路。
 */
const SENT_COPY: Record<string, { title: string; toLabel: string; hint: string }> = {
  zh: {
    title: "重置链接已发送",
    toLabel: "接收人",
    hint: "链接 30 分钟内有效，且只能使用一次。没收到？请等 1 分钟后再发一次。",
  },
  en: {
    title: "Reset link sent",
    toLabel: "Sent to",
    hint: "The link is valid for 30 minutes and can only be used once. Nothing arrived? Wait a minute and send again.",
  },
  ru: {
    title: "Ссылка отправлена",
    toLabel: "Получатель",
    hint: "Ссылка действует 30 минут и может быть использована только один раз. Письма нет? Подождите минуту и отправьте снова.",
  },
  es: {
    title: "Enlace enviado",
    toLabel: "Enviado a",
    hint: "El enlace es válido durante 30 minutos y solo se puede usar una vez. ¿No llegó? Espera un minuto y vuelve a enviarlo.",
  },
  pt: {
    title: "Link enviado",
    toLabel: "Enviado para",
    hint: "O link é válido por 30 minutos e só pode ser usado uma vez. Não chegou? Aguarde um minuto e envie novamente.",
  },
  fr: {
    title: "Lien envoyé",
    toLabel: "Destinataire",
    hint: "Le lien est valable 30 minutes et ne peut être utilisé qu'une seule fois. Rien reçu ? Patientez une minute puis renvoyez.",
  },
  ar: {
    title: "تم إرسال الرابط",
    toLabel: "أُرسل إلى",
    hint: "الرابط صالح لمدة 30 دقيقة ويمكن استخدامه مرة واحدة فقط. لم يصلك؟ انتظر دقيقة ثم أعد الإرسال.",
  },
  hi: {
    title: "रीसेट लिंक भेज दिया गया",
    toLabel: "भेजा गया",
    hint: "लिंक 30 मिनट तक मान्य है और केवल एक बार उपयोग हो सकता है। नहीं मिला? एक मिनट रुककर फिर भेजें।",
  },
};

export function ForgotPasswordForm({ locale }: ForgotPasswordFormProps) {
  const t = useTranslations("auth.forgotPassword");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState("");

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
        setSentTo(identifier);
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

  // 成功态：标题也换成「邮件已发送」，不能让「输入用户名或邮箱」的副标题留在上面，
  // 否则用户以为没发出去、反复重试（2026-11-28 老板实测反馈）。
  if (sent) {
    const sentCopy = SENT_COPY[locale] || SENT_COPY.en;
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <Mail className="h-7 w-7 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{sentCopy.title}</h1>
        <p className="text-gray-600">
          {t("sentMessage") ||
            "如果该账号存在且填写了邮箱，重置链接已发送到您的邮箱。请查收邮件（注意检查垃圾邮件文件夹）。"}
        </p>
        {sentTo && (
          <p className="break-all text-sm text-gray-500">
            {sentCopy.toLabel}：{sentTo}
          </p>
        )}
        <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">{sentCopy.hint}</p>
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
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">{t("title") || "忘记密码"}</h1>
        <p className="mt-1 text-gray-500">
          {t("subtitle") || "输入用户名或邮箱，我们将发送重置链接"}
        </p>
      </div>

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
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {t("contactAdmin") ||
            "如您注册时没有填写邮箱，将无法自助重置，请联系客服或管理员核实身份后重置。"}
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : t("submit") || "发送重置链接"}
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
    </div>
  );
}
