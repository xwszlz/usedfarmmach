"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface CompleteProfileFormProps {
  locale: string;
}

/**
 * 补全资料表单（Client，阶段 0 任务 T11①）
 * 提交至 POST /api/user/profile（本人鉴权）。
 * 复用 auth.register 命名空间下的已有翻译 key（email/companyName/country/password），
 * 同意文案使用新增的 auth.register.crossBorderConsent。
 */
export function CompleteProfileForm({ locale }: CompleteProfileFormProps) {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<{
    credits: number;
    giftGranted: boolean;
    giftAmount: number;
  } | null>(null);
  const [consent, setConsent] = useState(false);

  const countryOptions = [
    { value: "CN", label: locale === "zh" ? "中国" : locale === "ru" ? "Китай" : "China" },
    { value: "US", label: locale === "zh" ? "美国" : locale === "ru" ? "США" : "United States" },
    { value: "JP", label: locale === "zh" ? "日本" : locale === "ru" ? "Японія" : "Japan" },
    { value: "AU", label: locale === "zh" ? "澳大利亚" : locale === "ru" ? "Австралія" : "Australia" },
    { value: "BR", label: locale === "zh" ? "巴西" : locale === "ru" ? "Бразилія" : "Brazil" },
    { value: "IN", label: locale === "zh" ? "印度" : locale === "ru" ? "Індія" : "India" },
    { value: "RU", label: locale === "zh" ? "俄罗斯" : locale === "ru" ? "Росія" : "Russia" },
    { value: "OTHER", label: locale === "zh" ? "其他" : locale === "ru" ? "Інше" : "Other" },
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    // 数据出境单独同意为必选项
    if (!consent) {
      setError(
        t("crossBorderConsentRequired") ||
          "请勾选并同意《数据出境》单独同意条款"
      );
      setLoading(false);
      return;
    }

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value || undefined;
    const companyName =
      (form.elements.namedItem("companyName") as HTMLInputElement).value || undefined;
    const country =
      (form.elements.namedItem("country") as HTMLSelectElement).value || undefined;
    const password =
      (form.elements.namedItem("password") as HTMLInputElement).value || undefined;

    const data = {
      email,
      companyName,
      country,
      password,
      dataCrossBorderConsent: true,
    };

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.success && json.data) {
        setSuccess(true);
        setResult({
          credits: json.data.credits ?? 0,
          giftGranted: json.data.giftGranted ?? false,
          giftAmount: json.data.giftAmount ?? 0,
        });
      } else if (res.status === 401) {
        setError(
          locale === "zh"
            ? "未登录，请先登录后再补全资料"
            : "Not logged in. Please sign in before completing your profile."
        );
      } else {
        setError(json.error || t("error"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  if (success && result) {
    return (
      <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-6 w-6" />
          <p className="text-lg font-semibold">
            {locale === "zh" ? "资料已补全" : "Profile completed"}
          </p>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {locale === "zh" ? `当前积分：${result.credits}` : `Your current credits: ${result.credits}`}
          {result.giftGranted
            ? locale === "zh"
              ? `（已发放注册礼包 ${result.giftAmount} 积分）`
              : ` (register gift ${result.giftAmount} credits granted)`
            : ""}
        </p>
        <div className="flex gap-3 pt-2">
          <Link
            href={`/${locale}`}
            className="inline-block font-medium text-primary-600 hover:underline"
          >
            {locale === "zh" ? "返回首页" : "Back home"}
          </Link>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/account/complete-profile`)}
            className="font-medium text-primary-600 hover:underline"
          >
            {locale === "zh" ? "再次编辑" : "Edit again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="cp-email"
        name="email"
        label={t("email")}
        type="email"
        placeholder={t("emailPlaceholder")}
      />
      <Input
        id="cp-company"
        name="companyName"
        label={t("companyName")}
        placeholder={t("companyNamePlaceholder")}
      />
      <Select
        id="cp-country"
        name="country"
        label={t("country")}
        options={countryOptions}
        placeholder={t("countryPlaceholder")}
      />
      <Input
        id="cp-password"
        name="password"
        label={t("password")}
        type="password"
        placeholder={t("passwordPlaceholder")}
        minLength={6}
      />

      {/* 数据出境单独同意（必填） */}
      <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span>
          {t("crossBorderConsent")}{" "}
          <Link
            href={`/${locale}/privacy`}
            className="font-medium text-primary-600 hover:underline"
          >
            {locale === "zh" ? "隐私政策" : "Privacy Policy"}
          </Link>
        </span>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "..." : locale === "zh" ? "提交补全" : "Submit"}
      </Button>
    </form>
  );
}
