/**
 * DomesticRedirectBanner — 境内用户引导横幅（仅 .com 国际站）
 *
 * 场景：境内用户访问 .com 国际站时，提示前往国内站 usedfarmmach.cn。
 * 触发条件（满足其一即展示）：
 *  - server 注入的 <meta name="x-domestic-redirect" content="1">（由 middleware / layout 在
 *    检测到境内时写入响应头/元信息）
 *  - 父级传入 domesticHint
 *
 * 红线：
 *  - 不引新依赖，纯 Tailwind 样式。
 *  - 仅展示提示与跳转链接，不做任何数据上报以外的副作用（关闭状态存 localStorage）。
 */

"use client";

import React, { useEffect, useState } from "react";
import { getSiteVariant } from "@/config/site";

interface DomesticRedirectBannerProps {
  /** 由 server 显式告知是否境内（可选） */
  domesticHint?: boolean;
}

const DISMISS_KEY = "cn_redirect_banner_dismissed";

export default function DomesticRedirectBanner({ domesticHint }: DomesticRedirectBannerProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 仅 .com 站展示
    if (getSiteVariant() !== "com") {
      setShow(false);
      return;
    }

    // 已手动关闭
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1") {
      setShow(false);
      return;
    }

    // 读取 server 注入的 meta 标记
    const meta = document.querySelector('meta[name="x-domestic-redirect"]');
    const metaHint = meta?.getAttribute("content") === "1";

    if (domesticHint || metaHint) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [domesticHint]);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
    setShow(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[1000] bg-amber-50 border-b border-amber-300 text-amber-900">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <p className="flex-1">
          您似乎在境内访问，国内站体验更佳，建议前往
          <a
            href="https://usedfarmmach.cn"
            className="font-semibold underline underline-offset-2 mx-1 hover:text-amber-700"
          >
            usedfarmmach.cn（神雕农机）
          </a>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://usedfarmmach.cn"
            className="inline-flex items-center rounded-md bg-amber-600 text-white px-3 py-1 font-medium hover:bg-amber-700 transition-colors"
          >
            前往国内站
          </a>
          <button
            type="button"
            onClick={dismiss}
            aria-label="关闭提示"
            className="text-amber-700 hover:text-amber-900 px-1"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
