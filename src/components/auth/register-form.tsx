"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

interface RegisterFormProps {
  locale: string;
}

export function RegisterForm({ locale }: RegisterFormProps) {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 数据出境单独同意（后端 register 已强制校验 dataCrossBorderConsent）
  const [consent, setConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    // 用户名校验
    if (username.length < 3) {
      setError(t("usernameTooShort") || "用户名至少3位");
      setLoading(false);
      return;
    }

    // 密码至少6位
    if (password.length < 6) {
      setError(t("passwordTooShort") || "密码至少6位");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      setLoading(false);
      return;
    }

    // 数据出境单独同意：未勾选则拦截（后端亦强制校验）
    if (!consent) {
      setError(t("crossBorderConsentRequired") || "请勾选并同意《数据出境》单独同意条款");
      setLoading(false);
      return;
    }

    const data = {
      username,
      email: (form.elements.namedItem("email") as HTMLInputElement).value || undefined,
      password,
      confirmPassword,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value || undefined,
      companyName: (form.elements.namedItem("companyName") as HTMLInputElement).value || undefined,
      country: (form.elements.namedItem("country") as HTMLSelectElement).value || undefined,
      role: (form.elements.namedItem("role") as HTMLSelectElement).value || "buyer",
      // 必须携带，否则后端返回 400（方案 3.5 / 共享知识 §8）
      dataCrossBorderConsent: true,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.success) {
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

  const roleOptions = [
    { value: "buyer", label: t("roleBuyer") },
    { value: "seller", label: t("roleSeller") },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 用户名 - 最上面 */}
      <Input
        id="reg-username"
        name="username"
        label={t("username") || "用户名"}
        type="text"
        placeholder={t("usernamePlaceholder") || "请输入用户名（至少3位）"}
        required
        minLength={3}
      />

      {/* 密码 */}
      <Input
        id="reg-password"
        name="password"
        label={t("password")}
        type="password"
        placeholder={t("passwordPlaceholder") || "至少6位密码"}
        required
        minLength={6}
      />
      <Input
        id="reg-confirm-password"
        name="confirmPassword"
        label={t("confirmPassword")}
        type="password"
        placeholder={t("confirmPasswordPlaceholder") || "再次输入密码"}
        required
        minLength={6}
      />

      {/* 邮箱 - 挪到下面，可选 */}
      <Input
        id="reg-email"
        name="email"
        label={t("email") + "（可选）"}
        type="email"
        placeholder={t("emailPlaceholder") || "选填，用于找回密码"}
      />

      <Input
        id="reg-phone"
        name="phone"
        label={t("phone")}
        type="tel"
        placeholder={t("phonePlaceholder")}
      />
      <Input
        id="reg-company"
        name="companyName"
        label={t("companyName")}
        placeholder={t("companyNamePlaceholder")}
      />
      <Select
        id="reg-country"
        name="country"
        label={t("country")}
        options={countryOptions}
        placeholder={t("countryPlaceholder")}
      />
      <Select
        id="reg-role"
        name="role"
        label={t("role")}
        options={roleOptions}
        defaultValue="buyer"
      />

      {/* 数据出境单独同意（合规红线，必勾选） */}
      <label className="flex items-start gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <span>{t("crossBorderConsent") || "我已阅读并同意《数据出境》单独同意条款"}</span>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        <UserPlus className="mr-2 h-4 w-4" />
        {loading ? "..." : t("submit")}
      </Button>
      <p className="text-center text-sm text-gray-500">
        {t("hasAccount")}{" "}
        <Link
          href={`/${locale}/auth/login`}
          className="font-medium text-primary-600 hover:underline"
        >
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}
