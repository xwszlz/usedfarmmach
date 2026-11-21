"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { isComSite } from "@/config/site";
import {
  applyDraft,
  clearDraft,
  collectDraft,
  readDraft,
  writeDraft,
  type DraftSpec,
} from "@/lib/form-draft";

interface CompleteProfileFormProps {
  locale: string;
}

/**
 * 补全资料表单的草稿白名单（机制见 `src/lib/form-draft.ts` 顶部）。
 * 🔴 `password` 不在名单里：这里虽然只是「设置密码」，但它照样是密码，不落盘。
 */
const PROFILE_DRAFT: DraftSpec = {
  key: "ufm:profile-draft:v1",
  textFields: ["email", "companyName", "country"],
  checkboxFields: ["consent"],
};

/** 「已恢复草稿」提示（本组件是双语页面，沿用文件里既有的 locale === "zh" 三元式风格） */
const DRAFT_RESTORED_HINT = {
  zh: "已恢复你上次填写的内容，密码需要重新输入。",
  en: "We restored what you entered earlier. Please re-enter your password.",
};

/**
 * 补全资料表单（Client，阶段 0 任务 T11①）
 * 提交至 POST /api/user/profile（本人鉴权）。
 * 复用 auth.register 命名空间下的已有翻译 key（email/companyName/country/password），
 * 同意文案使用新增的 auth.register.crossBorderConsent。
 */
export function CompleteProfileForm({ locale }: CompleteProfileFormProps) {
  const t = useTranslations("auth.register");
  // 数据出境单独同意仅在 .com 站适用（.cn 数据境内存储，不出境）
  const isCom = isComSite();
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

  const formRef = useRef<HTMLFormElement>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // 恢复草稿放 effect 里：首屏是服务端渲染，那时没有 sessionStorage（详见 form-draft.ts）
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const draft = readDraft(PROFILE_DRAFT);
    if (!applyDraft(form, draft, PROFILE_DRAFT)) return;
    if (draft?.consent === true && isCom) setConsent(true);
    setDraftRestored(true);
  }, [isCom]);

  const handleDraftChange = useCallback(() => {
    writeDraft(PROFILE_DRAFT, collectDraft(formRef.current, PROFILE_DRAFT));
  }, []);

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
    if (isCom && !consent) {
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
      dataCrossBorderConsent: isCom ? consent : false,
    };

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.success && json.data) {
        // 提交成功清草稿，避免下次进来被灌回上一轮的旧内容
        clearDraft(PROFILE_DRAFT);
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
          {locale === "zh" ? "当前积分：" : "Your current credits: "}
          <Link
            href={`/${locale}/credits`}
            className="font-semibold text-primary-600 hover:underline"
          >
            {result.credits}
          </Link>
          {result.giftGranted
            ? locale === "zh"
              ? `（已发放注册礼包 ${result.giftAmount} 积分）`
              : ` (register gift ${result.giftAmount} credits granted)`
            : ""}
          <Link
            href={`/${locale}/credits`}
            className="ml-2 font-medium text-primary-600 hover:underline"
          >
            {locale === "zh" ? "查看积分中心 →" : "Go to Credits Center →"}
          </Link>
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
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      // React 的 onChange 会冒泡，挂在 form 上即可覆盖所有子字段
      onChange={handleDraftChange}
      className="space-y-4"
    >
      {draftRestored && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {locale === "zh" ? DRAFT_RESTORED_HINT.zh : DRAFT_RESTORED_HINT.en}
        </p>
      )}
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

      {/* 数据出境单独同意（必填）——仅 .com 站适用；.cn 数据境内存储，不涉及出境 */}
      {isCom && (
        <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            // name 供草稿读取勾选状态
            name="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            {locale === "zh" ? "我已阅读并同意" : t("crossBorderConsent")}{" "}
            {/*
              新标签打开 + 草稿兜底：填到一半点进条款页再回来，内容不能丢
              （同一处修改见 auth/register-form.tsx）
            */}
            <Link
              href={`/${locale}/cross-border-consent`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary-600 hover:underline"
            >
              {t("crossBorderConsentLink")}
            </Link>
          </span>
        </label>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "..." : locale === "zh" ? "提交补全" : "Submit"}
      </Button>
    </form>
  );
}
