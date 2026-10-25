"use client";

/**
 * AI 销售策略 · 导出按钮组（T2 / T3）
 * ─────────────────────────────────────────────────────────
 * 两个按钮：
 *   - 导出 PDF 作战手册 → POST /api/agents/seller-helper/sales-strategy/export/pdf
 *   - 导出 Excel 联系表 → POST /api/agents/seller-helper/sales-strategy/export/excel
 *
 * 交互：各自独立 loading 态；成功后按 Content-Disposition 文件名触发浏览器下载；
 *       失败按 code 分流提示（401 去登录 / 402 充值 / 429 熔断 / 500 通用失败）。
 * 说明：本组件为「纯加法」入口，不影响卡片既有生成/展示逻辑。
 */
import { useState } from "react";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import type { StrategyLlmResult } from "@/lib/sales-strategy/prompt";
import type { StrategyExportChannel, StrategyProductInfo } from "@/lib/sales-strategy/export";

interface SalesStrategyExportButtonsProps {
  /** 已生成的策略结果（与 StrategyLlmResult 同构，可含 scripts / listingChecklist） */
  strategy: StrategyLlmResult;
  /** 渠道（含脱敏联系方式），供 PDF 模块①③使用 */
  channels?: StrategyExportChannel[];
  /** 本品信息，供 PDF 头部展示 */
  product?: StrategyProductInfo | null;
  /** Excel 分区口径，默认 all */
  partition?: "all" | "cn" | "intl";
  locale?: string;
}

interface ErrorState {
  message: string;
  rechargeUrl?: string;
}

/** 从 Content-Disposition 解析文件名（兼容 filename* 编码） */
function parseFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star && star[1]) {
    try {
      return decodeURIComponent(star[1].replace(/^"|"$/g, "").trim());
    } catch {
      /* 回退到普通 filename */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  if (plain && plain[1]) return plain[1].trim();
  return fallback;
}

/** 触发浏览器下载 */
function triggerDownload(blob: Blob, disposition: string | null, fallbackName: string): void {
  const filename = parseFilename(disposition, fallbackName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SalesStrategyExportButtons({
  strategy,
  channels = [],
  product = null,
  partition = "all",
  locale = "zh",
}: SalesStrategyExportButtonsProps) {
  const zh = locale === "zh";
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  /** 统一错误分流 */
  const toError = (data: any): ErrorState => {
    switch (data?.code) {
      case "LOGIN_REQUIRED":
        return { message: zh ? "请先登录后再导出" : "Please sign in first." };
      case "INSUFFICIENT_CREDITS":
        return {
          message: zh
            ? `积分不足（需 ${data?.required ?? "?"}，当前 ${data?.balance ?? 0}），请先充值。`
            : `Insufficient credits (need ${data?.required ?? "?"}, have ${data?.balance ?? 0}).`,
          rechargeUrl: typeof data?.rechargeUrl === "string" ? data.rechargeUrl : undefined,
        };
      case "GUARDRAIL":
        return { message: zh ? "本次导出成本超单次上限，已熔断（未扣费）。" : "Export cost exceeded cap; circuit-broken." };
      default:
        return { message: data?.error || (zh ? "导出失败，请稍后重试" : "Export failed, please retry.") };
    }
  };

  const handleExport = async (
    endpoint: string,
    body: Record<string, unknown>,
    fallbackName: string,
    setLoading: (v: boolean) => void
  ): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(toError(data));
        return;
      }

      const blob = await res.blob();
      triggerDownload(blob, res.headers.get("content-disposition"), fallbackName);
    } catch {
      setError({ message: zh ? "网络错误，导出失败" : "Network error, export failed." });
    } finally {
      setLoading(false);
    }
  };

  const handlePdf = () => {
    const payloadStrategy: StrategyLlmResult = {
      summary: strategy.summary,
      targetMarkets: strategy.targetMarkets,
      priceRange: strategy.priceRange ?? null,
      compliance: strategy.compliance ?? null,
      actionChecklist: strategy.actionChecklist,
      responsibility: strategy.responsibility ?? null,
      scripts: strategy.scripts,
      listingChecklist: strategy.listingChecklist,
    };
    return handleExport(
      "/api/agents/seller-helper/sales-strategy/export/pdf",
      { strategy: payloadStrategy, product, channels, locale },
      "ai-sales-strategy.pdf",
      setPdfLoading
    );
  };

  const handleExcel = () =>
    handleExport(
      "/api/agents/seller-helper/sales-strategy/export/excel",
      { partition, locale },
      `dealers-${partition}.xlsx`,
      setExcelLoading
    );

  const busy = pdfLoading || excelLoading;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePdf}
          disabled={pdfLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {pdfLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {zh ? "导出中…" : "Exporting…"}
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5" />
              {zh ? "导出 PDF 作战手册" : "Export PDF Manual"}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleExcel}
          disabled={excelLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {excelLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {zh ? "导出中…" : "Exporting…"}
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {zh ? "导出 Excel 联系表" : "Export Excel Contacts"}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          <span>{error.message}</span>
          {error.rechargeUrl && (
            <a href={error.rechargeUrl} className="font-medium underline">
              {zh ? "去充值" : "Recharge"}
            </a>
          )}
        </div>
      )}

      {busy && (
        <p className="text-[11px] text-gray-400">
          {zh ? "导出按名义积分计费（不含再次生成成本）。" : "Export is nominally billed (no regeneration cost)."}
        </p>
      )}
    </div>
  );
}
