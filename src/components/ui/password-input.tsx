"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { useLocale } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 带「显示/隐藏密码」开关的输入框（2026-11-28 老板实测要求）。
 *
 * 为什么不直接给 `ui/input.tsx` 加开关：
 *   `Input` 是**无 "use client" 的共享基础件**，全站大量服务端组件在用。
 *   一旦在里面加 `useState`，所有服务端引用点都会编译失败。
 *   所以这里独立成一个客户端组件，调用方按需替换，`Input` 一个字都不动（增量原则）。
 *
 * 样式与 `Input` 保持同一套类名；若将来改 `Input` 的视觉，记得同步这里。
 */

const SHOW_LABEL: Record<string, string> = {
  zh: "显示密码",
  en: "Show password",
  ru: "Показать пароль",
  es: "Mostrar contraseña",
  pt: "Mostrar senha",
  fr: "Afficher le mot de passe",
  ar: "إظهار كلمة المرور",
  hi: "पासवर्ड दिखाएँ",
};

const HIDE_LABEL: Record<string, string> = {
  zh: "隐藏密码",
  en: "Hide password",
  ru: "Скрыть пароль",
  es: "Ocultar contraseña",
  pt: "Ocultar senha",
  fr: "Masquer le mot de passe",
  ar: "إخفاء كلمة المرور",
  hi: "पासवर्ड छिपाएँ",
};

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const locale = useLocale();
    const showLabel = SHOW_LABEL[locale] || SHOW_LABEL.en;
    const hideLabel = HIDE_LABEL[locale] || HIDE_LABEL.en;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={id}
            ref={ref}
            // 显隐只切 input 的 type，值一直留在同一个 DOM 节点上，不会被清空
            type={visible ? "text" : "password"}
            className={cn(
              "flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            // tabIndex=-1：不打断「用户名 → 密码 → 确认密码 → 提交」的 Tab 顺序
            tabIndex={-1}
            aria-label={visible ? hideLabel : showLabel}
            aria-pressed={visible}
            title={visible ? hideLabel : showLabel}
            className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus-visible:text-primary-600"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
