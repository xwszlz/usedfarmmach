"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { isComSite } from "@/config/site";
import {
  applyDraft,
  clearDraft,
  collectDraft,
  readDraft,
  writeDraft,
  type DraftSpec,
} from "@/lib/form-draft";

interface RegisterFormProps {
  locale: string;
}

/**
 * 注册表单草稿的字段白名单（机制见 `src/lib/form-draft.ts` 顶部）。
 *
 * 🔴 `password` / `confirmPassword` **故意不在名单里**：草稿落在 sessionStorage，多数
 * 浏览器重启/崩溃恢复后它还在盘上，同源任意 XSS 也读得到，密码不配进这个名单。
 * 好消息是老板报的那个场景已经不靠它了 —— 点《数据出境》条款现在是**新标签打开**，
 * 原标签的表单动都不动，密码也不丢；只有手动刷新页面才需要重填密码。
 */
const REGISTER_DRAFT: DraftSpec = {
  key: "ufm:register-draft:v1",
  textFields: ["username", "email", "phone", "companyName", "country", "role"],
  checkboxFields: ["consent"],
};

/**
 * 「已恢复草稿」提示的 8 语文案。
 *
 * 刻意内联在这里而不是塞进 `messages/*.json`：那 8 个文件不可重序列化（见项目铁律），
 * 为一句提示去对 8 个文件做字节级手术不值当。跟联系页 `ContactClient` 的做法一致。
 */
const DRAFT_RESTORED_HINT: Record<string, string> = {
  zh: "已恢复你上次填写的内容，密码需要重新输入。",
  en: "We restored what you entered earlier. Please re-enter your password.",
  ru: "Мы восстановили ранее введённые данные. Пароль нужно ввести заново.",
  es: "Hemos restaurado los datos que introdujiste antes. Vuelve a escribir la contraseña.",
  pt: "Restauramos os dados que você preencheu antes. Digite a senha novamente.",
  fr: "Nous avons restauré ce que vous aviez saisi. Veuillez saisir à nouveau votre mot de passe.",
  ar: "استعدنا البيانات التي أدخلتها سابقًا. يرجى إعادة إدخال كلمة المرور.",
  hi: "आपने पहले जो जानकारी भरी थी, वह बहाल कर दी गई है। कृपया अपना पासवर्ड फिर से दर्ज करें।",
};

// 重定向目标净化：只接受「解析后同源」的站内路径。
// 用 WHATWG URL 解析再比对 origin，天然免疫 //evil.com、/\evil.com、\\evil.com、
// javascript:、前导 tab 等解析期绕过手法（字符串前缀检查做不到这一点）。
function resolveSafeRedirect(raw: string | null, fallback: string): string {
  if (!raw || typeof window === "undefined") return fallback;
  try {
    const resolved = new URL(raw, window.location.origin);
    if (resolved.origin !== window.location.origin) return fallback;
    // 防御：pathname 解码后若出现 "\" 或以 "//" 开头，下游再解析可能变成 authority/外站 → 拒绝
    const decodedPath = decodeURIComponent(resolved.pathname);
    if (decodedPath.includes("\\") || decodedPath.startsWith("//")) return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}

export function RegisterForm({ locale }: RegisterFormProps) {
  const t = useTranslations("auth.register");
  // 数据出境单独同意仅在 .com 站适用（.cn 数据境内存储，不出境）
  const isCom = isComSite();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 数据出境单独同意（后端 register 已强制校验 dataCrossBorderConsent）
  const [consent, setConsent] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  // 是否真的恢复出了内容 —— 决定要不要显示「已恢复上次填写的内容」
  const [draftRestored, setDraftRestored] = useState(false);

  /**
   * 恢复草稿。必须放在 effect 里，不能在 useState 初始化函数里读：
   * 首屏走服务端渲染，那时没有 sessionStorage，读到空值、到客户端才补上，
   * 首屏 DOM 与客户端不一致会直接触发 hydration 报错。
   */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const draft = readDraft(REGISTER_DRAFT);
    if (!applyDraft(form, draft, REGISTER_DRAFT)) return;
    // 勾选框是受控的（checked={consent}），DOM 改了还得同步 state，否则下次渲染被 React 抹掉
    if (draft?.consent === true && isCom) setConsent(true);
    setDraftRestored(true);
  }, [isCom]);

  /**
   * 表单任意字段一变就存一次草稿。8 个字段序列化出来一百多字节，
   * sessionStorage 同步写这个量级完全感觉不到，不值得为它引防抖。
   */
  const handleDraftChange = useCallback(() => {
    writeDraft(REGISTER_DRAFT, collectDraft(formRef.current, REGISTER_DRAFT));
  }, []);

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
    if (isCom && !consent) {
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
      // 仅 .com 站需勾选；.cn 传 false（后端 schema 中该字段在 .cn 为可选）
      dataCrossBorderConsent: isCom ? consent : false,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.success) {
        // 注册成功就清草稿，否则下次进注册页会被灌回上一轮的旧内容
        clearDraft(REGISTER_DRAFT);
        localStorage.setItem("token", result.data.token);
        localStorage.setItem("user", JSON.stringify(result.data.user));
        // 支持 ?redirect=/membership 等回跳（仅接受站内相对路径）
        const redirect = new URLSearchParams(window.location.search).get("redirect");
        router.push(resolveSafeRedirect(redirect, `/${locale}`));
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
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      // onChange 在 React 里是会冒泡的合成事件，挂在 form 上就能吃到所有子字段的变更
      // （文本框、下拉框、勾选框），以后再加字段也不用回来补埋点
      onChange={handleDraftChange}
      className="space-y-4"
    >
      {draftRestored && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {DRAFT_RESTORED_HINT[locale] || DRAFT_RESTORED_HINT.en}
        </p>
      )}
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

      {/* 数据出境单独同意（合规红线，必勾选）——仅 .com 站适用；.cn 数据境内存储，不涉及出境 */}
      {isCom && (
        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            // name 是给草稿用的：collectDraft 按 name 从 form.elements 里取勾选状态
            name="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
          />
          <span>
            {locale === "zh" ? "我已阅读并同意" : t("crossBorderConsent")}{" "}
            {/*
              新标签打开（2026-11-21）：老板填到一半点进条款页，点「返回注册」回来表单全空。
              改新标签后原标签的表单根本不动，一个字段都不丢，这是最省事也最彻底的一条路；
              草稿机制再兜住刷新/后退这些新标签救不了的场景。
              rel=noopener 防止新页通过 window.opener 反过来操作注册页。
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
