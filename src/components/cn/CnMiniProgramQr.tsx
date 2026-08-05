/**
 * CnMiniProgramQr — 小程序二维码/跳转按钮（.cn 专属）
 *
 * 展示微信小程序码，引导用户扫码进入小程序完成担保交易。
 * 也可用于展示小程序跳转链接。
 *
 * 使用 qrcode 库生成二维码（已有依赖）
 */

"use client";

import React, { useEffect, useState } from "react";

interface CnMiniProgramQrProps {
  /** 跳转路径（小程序页面路径） */
  path?: string;
  /** 二维码尺寸 */
  size?: number;
  /** 是否显示二维码图片 */
  showQr?: boolean;
  /** 自定义链接 */
  link?: string;
}

/**
 * 小程序码组件
 *
 * 展示两种情况：
 * 1. 有 QR 码图片 → 展示图片
 * 2. 无 QR 码图片 → 展示扫码提示占位
 */
export default function CnMiniProgramQr({
  path = "/pages/index/index",
  size = 120,
  showQr = true,
  link,
}: CnMiniProgramQrProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function generateQr() {
      try {
        // 动态加载 qrcode 库（已有依赖）
        const QRCode = (await import("qrcode")).default;
        if (cancelled) return;

        // 使用小程序跳转链接或 path 生成二维码内容
        const content = link || `weixin://dl/business/?t=USEDFARMMACH_${path}`;
        const dataUrl = await QRCode.toDataURL(content, {
          width: size,
          margin: 2,
          color: {
            dark: "#1a1a2e",
            light: "#ffffff",
          },
        });
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setQrLoading(false);
        }
      } catch {
        if (!cancelled) {
          setQrLoading(false);
        }
      }
    }

    generateQr();

    return () => {
      cancelled = true;
    };
  }, [path, size, link]);

  if (!showQr) {
    // 仅展示按钮样式
    return (
      <button
        type="button"
        className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        onClick={() => {
          window.open(
            link || `weixin://dl/business/?t=USEDFARMMACH_${path}`,
            "_blank"
          );
        }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.5 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm7 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM12 2C6.477 2 2 6.477 2 12c0 1.82.487 3.53 1.338 5L2.5 21.5l4.5-.838A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
        </svg>
        <span>打开小程序</span>
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col items-center">
      {/* 二维码 */}
      <div
        className="bg-white rounded-lg border border-gray-200 p-2 shadow-sm"
        style={{ width: size + 16, height: size + 16 }}
      >
        {qrLoading ? (
          <div
            className="flex items-center justify-center bg-gray-50 rounded"
            style={{ width: size, height: size }}
          >
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="微信小程序码"
            className="rounded"
            style={{ width: size, height: size }}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center bg-gray-50 rounded text-gray-400"
            style={{ width: size, height: size }}
          >
            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2m-4 0H4m6-11v10m-4-5h16" />
            </svg>
            <span className="text-xs">小程序码</span>
          </div>
        )}
      </div>

      {/* 提示文字 */}
      <p className="mt-2 text-xs text-gray-500 text-center max-w-[140px]">
        微信扫一扫 · 进入小程序完成担保交易
      </p>
    </div>
  );
}
