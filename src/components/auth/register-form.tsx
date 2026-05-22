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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      setLoading(false);
      return;
    }

    const data = {
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      password,
      confirmPassword,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value || undefined,
      companyName: (form.elements.namedItem("companyName") as HTMLInputElement).value || undefined,
      country: (form.elements.namedItem("country") as HTMLInputElement).value || undefined,
      role: (form.elements.namedItem("role") as HTMLSelectElement).value || "buyer",
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.success) {
        router.push(`/${locale}`);
        router.refresh();
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
    { value: "CN", label: locale === "zh" ? "中国" : "China" },
    { value: "US", label: locale === "zh" ? "美国" : "United States" },
    { value: "JP", label: locale === "zh" ? "日本" : "Japan" },
    { value: "AU", label: locale === "zh" ? "澳大利亚" : "Australia" },
    { value: "BR", label: locale === "zh" ? "巴西" : "Brazil" },
    { value: "IN", label: locale === "zh" ? "印度" : "India" },
    { value: "OTHER", label: locale === "zh" ? "其他" : "Other" },
  ];

  const roleOptions = [
    { value: "buyer", label: t("roleBuyer") },
    { value: "seller", label: t("roleSeller") },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="reg-email"
        name="email"
        label={t("email")}
        type="email"
        placeholder={t("emailPlaceholder")}
        required
      />
      <Input
        id="reg-password"
        name="password"
        label={t("password")}
        type="password"
        placeholder={t("passwordPlaceholder")}
        required
      />
      <Input
        id="reg-confirm-password"
        name="confirmPassword"
        label={t("confirmPassword")}
        type="password"
        placeholder={t("confirmPasswordPlaceholder")}
        required
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
