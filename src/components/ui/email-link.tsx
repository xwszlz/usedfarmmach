"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { translate } from "@/lib/i18n-runtime";

/**
 * 邮箱地址合法性校验。
 *
 * 严格到能挡住 `null` / 空串 / 带空格的脏数据（卖家资料里的 contactEmail 就有这种），
 * 又宽到不误杀 plus 地址（`a+b@x.com`）和多级域名。
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 归一化邮箱：去空格 + 校验，非法一律返回 null（调用方据此整行不渲染）。 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}

/**
 * 复制到剪贴板：先试 async Clipboard API，失败再试 `execCommand("copy")`。
 *
 * 两条都必须试 —— `navigator.clipboard` 在非安全上下文（http）或用户拒绝权限时直接抛错，
 * 而部分国产内核 / 旧版 Safari 只认 execCommand。
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 落到下面的兜底 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export interface EmailLinkProps {
  /** 邮箱地址；`null` / 空 / 非法时整个组件不渲染 */
  email: string | null | undefined;
  /** 当前语言（8 语），用于「已复制」等提示文案 */
  locale?: string;
  /** 覆盖显示文本；默认直接显示邮箱地址 */
  label?: string;
  /** 链接样式，由调用方决定（页脚灰字 / 正文蓝链 / CTA 白字都靠它） */
  className?: string;
  /** 覆盖「已复制」提示语 */
  copiedLabel?: string;
}

/**
 * 可点击的邮箱地址 —— **点击即复制地址**，只此一条路。
 *
 * 为什么不用 `mailto:`：访客的电脑很可能根本没装邮件客户端（Windows 11 已移除
 * 自带的「邮件」应用，`mailto` 关联常常指向一个已被卸载的程序），点下去表现为
 * 空白页 / 弹「选取应用」/ 毫无反应 —— 2026-11-21 实测老板本机就是这个情况。
 *
 * 曾经在地址后面挂过一个小小的「在邮件应用中打开」信封图标，走原生 `mailto:` 兜底。
 * 2026-11-21 老板实测后 **要求彻底去掉**：本机 Foxmail 7.2.25（系统关联配置完全正确）
 * 收到 `mailto:` 照样不弹写邮件窗口，图标点下去毫无反应；对没装客户端的访客更糟，
 * 会弹一个「选择打开方式」的对话框然后什么也打不开 —— 「提示打开 APP 但没有 APP」
 * 本身就是个坏体验。与其误导用户去点，不如只留一个动作：复制地址。
 *
 * 复制失败（极老内核 / 权限被硬拒）时仍退回 `mailto:`，至少留一条路，但这是异常
 * 分支，不是给用户的第二选项。
 */
export function EmailLink({
  email,
  locale = "zh",
  label,
  className = "",
  copiedLabel,
}: EmailLinkProps) {
  const normalized = normalizeEmail(email);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleCopy = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      // 拦掉默认 mailto 跳转：没客户端的用户点了只会白跳一次。
      e.preventDefault();
      if (!normalized) return;

      const ok = await copyText(normalized);
      if (!ok) {
        // 复制彻底失败（极老内核 / 权限被硬拒）：退回原生 mailto，至少给条路。
        window.location.href = `mailto:${normalized}`;
        return;
      }

      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2400);
    },
    [normalized]
  );

  if (!normalized) return null;

  const display = label || normalized;
  const hintText = copiedLabel || translate("已复制", locale);

  return (
    <span className="relative inline-flex items-center">
      <a
        href={`mailto:${normalized}`}
        onClick={handleCopy}
        className={className}
        data-email-copy={normalized}
      >
        {display}
      </a>

      {/* 视觉提示：绝对定位飘在下沿，不占布局、不撑动正文行距 */}
      {copied && (
        <span className="pointer-events-none absolute start-0 top-full z-20 mt-1 whitespace-nowrap rounded bg-gray-900 px-2 py-0.5 text-xs font-normal text-white shadow-sm dark:bg-gray-100 dark:text-gray-900">
          {hintText}
        </span>
      )}

      {/* 无障碍播报：视觉提示对读屏器不可见，单开一条 live region */}
      <span className="sr-only" aria-live="polite">
        {copied ? hintText : ""}
      </span>
    </span>
  );
}
