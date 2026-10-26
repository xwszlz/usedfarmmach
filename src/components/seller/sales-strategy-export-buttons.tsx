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
 *
 * N03（前端导出透传）——本组件是导出链路的**唯一出口**，必须做到「一个字段都不裁」：
 *   - PDF：策略对象按 `{ ...strategy }` **全字段展开**透传（含 N02 的 12 个决策字段），
 *     否则 PDF 8 章在浏览器端就被白名单裁空，后端再强也渲染不出内容；
 *   - Excel：追加 `layout` + `strategy`，Sheet2「机型价格速查」用 `strategy.marketAnchors`、
 *     Sheet3「必办清单」用 `strategy.complianceTasks`；
 *   - 兼容：策略为空 / 旧缓存策略时不抛错、不发 `layout`，请求与改造前逐字等价。
 */
import { useState } from "react";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import type { StrategyLlmResult } from "@/lib/sales-strategy/prompt";
import type { StrategyDecisionFields } from "@/lib/sales-strategy/strategy-schema";
import type {
  StrategyExportChannel,
  StrategyExportWebStatus,
  StrategyProductInfo,
} from "@/lib/sales-strategy/export";

/**
 * Excel 版式的线上值（N03 冻结：字符串 `"v2"`）。
 *
 * 后端 `export/excel/route.ts`（T11）负责把它映射为 `buildExcel` 的 `opts.layout = 2`
 * （N01 的开关实现为 `opts?.layout === 2 ? 2 : 1`）。若 T11 最终决定按数字接收，
 * 只需改这一处常量，调用点无需变动。
 */
const EXCEL_LAYOUT_V2 = "v2" as const;

/**
 * 导出透传用的策略对象类型：既有 9 个老字段（`StrategyLlmResult`）
 * ＋ N02 的 12 个决策字段（`StrategyDecisionFields`），两端全部保留。
 *
 * 显式交叉有两个作用：
 *   1. 让 12 个新字段在本文件里「可见」，防止将来有人再写白名单重建把字段裁掉；
 *   2. 与 T08 之后 `StrategyLlmResult extends StrategyDecisionFields` 的改动保持结构兼容
 *      （两侧字段同名同型，交叉后退化回原类型，不会冲突）。
 */
type ExportableStrategy = StrategyLlmResult & Partial<StrategyDecisionFields>;

/**
 * 安全展开策略对象（向后兼容的唯一入口）。
 *
 * - `null` / `undefined` / 非对象 / 数组 ⇒ 返回 `{}`，**绝不抛错**，
 *   使旧策略、旧缓存场景与改造前一样能正常导出（各渲染层自行兜底）；
 * - 正常对象 ⇒ 浅拷贝一份（不改动 props 原对象），12 个新字段随展开一并保留：
 *   `tldr` / `keyInsight` / `equipmentProfiles` / `marketAnchors` / `readout` /
 *   `bestDestinations` / `marketRanking` / `accessTrafficLight` / `todayCalls` /
 *   `complianceTasks` / `openQuestions` / `dataSources`。
 *
 * @param strategy 组件 props 传入的策略（可能为空）
 * @returns 可直接放进请求体的策略对象（永不为 `null`）
 */
function toExportableStrategy(
  strategy: StrategyLlmResult | null | undefined
): ExportableStrategy {
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) return {};
  return { ...strategy };
}

/**
 * 策略是否「有内容」。
 *
 * 空对象视作无策略 ⇒ Excel 请求不发 `layout`，后端回落 legacy 1-Sheet，
 * 与改造前 `{ partition, locale }` 的行为完全等价。
 */
function hasStrategyContent(strategy: ExportableStrategy): boolean {
  return Object.keys(strategy).length > 0;
}

/** PDF 请求体入参（与组件 props 同构，抽成纯函数只为可测） */
export interface PdfExportBodyInput {
  strategy: StrategyLlmResult | null | undefined;
  product: StrategyProductInfo | null;
  channels: StrategyExportChannel[];
  locale: string;
  webStatus?: StrategyExportWebStatus;
  webNote?: string;
}

/**
 * 构造 PDF 导出请求体（N03-①，纯函数，无副作用）。
 *
 * 要点：`strategy` **全字段展开**（`{ ...strategy }`），12 个决策字段一个不丢；
 * `channels` 原样透传（脱敏由生成接口完成，本组件不加工）；
 * `webStatus` / `webNote` 缺省为 `undefined` ⇒ `JSON.stringify` 自动省略该键，
 * 后端视同 `"ok"`，与改造前的请求体逐字等价。
 *
 * @param input 组装请求体所需的全部字段
 * @returns 可直接 `JSON.stringify` 的请求体
 */
export function buildPdfExportBody(input: PdfExportBodyInput): Record<string, unknown> {
  return {
    strategy: toExportableStrategy(input.strategy),
    product: input.product,
    channels: input.channels,
    locale: input.locale,
    webStatus: input.webStatus,
    webNote: input.webNote,
  };
}

/**
 * 构造 Excel 导出请求体（N03-②，纯函数，无副作用）。
 *
 * - 有策略：`{ partition, locale, layout: "v2", strategy }` ⇒ 后端走三 Sheet
 *   （Sheet2「机型价格速查」读 `strategy.marketAnchors`、Sheet3「必办清单」读
 *   `strategy.complianceTasks`）；
 * - 策略为空：`{ partition, locale }`，与改造前的请求体**逐字等价**
 *   （不发 `layout` ⇒ 后端回落 legacy 1-Sheet，见 N01 `opts?.layout === 2 ? 2 : 1`）；
 * - `webStatus` 有值时一并下发（T11 的 route 用它给 Sheet2「备注」标注「外部检索未接入」），
 *   缺省则省略该键（JSON 自动丢弃 `undefined`），不影响兼容性。
 *
 * @param partition 分区口径
 * @param locale 语言
 * @param strategy 策略对象（可空）
 * @param webStatus 外部检索状态（可空；缺省即不下发）
 * @returns 可直接 `JSON.stringify` 的请求体
 */
export function buildExcelExportBody(
  partition: "all" | "cn" | "intl",
  locale: string,
  strategy: StrategyLlmResult | null | undefined,
  webStatus?: StrategyExportWebStatus
): Record<string, unknown> {
  const exportStrategy = toExportableStrategy(strategy);
  const body: Record<string, unknown> = { partition, locale };
  if (hasStrategyContent(exportStrategy)) {
    body.layout = EXCEL_LAYOUT_V2;
    body.strategy = exportStrategy;
    if (typeof webStatus === "string" && webStatus.length > 0) {
      body.webStatus = webStatus;
    }
  }
  return body;
}

interface SalesStrategyExportButtonsProps {
  /** 已生成的策略结果（与 StrategyLlmResult 同构，可含 scripts / listingChecklist / 12 个决策字段） */
  strategy: StrategyLlmResult;
  /** 渠道（含脱敏联系方式），供 PDF 模块①③使用 */
  channels?: StrategyExportChannel[];
  /** 本品信息，供 PDF 头部展示 */
  product?: StrategyProductInfo | null;
  /** Excel 分区口径，默认 all */
  partition?: "all" | "cn" | "intl";
  locale?: string;
  /**
   * 本次策略的「外部检索」状态，供 PDF 顶部告警条判断降级。
   *
   * 契约（N01 `StrategyExportPayload.webStatus`）：缺省（`undefined`）视同 `"ok"`，
   * 不渲染告警条。当前调用方（`ai-sales-strategy-card.tsx` / `sales-strategy-card.tsx`）
   * 尚未下传 ⇒ 保持 `undefined`，**不编造**；属 P1 UI 接线范围。
   */
  webStatus?: StrategyExportWebStatus;
  /** 检索状态补充说明（如「部分检索超时（3/5 成功）」），缺省不渲染 */
  webNote?: string;
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
  webStatus,
  webNote,
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
    // N03-①：请求体由纯函数构造 —— **spread 优先**，12 个决策字段一个不丢地透传给后端。
    // 旧实现用白名单重建 payload，导致 tldr / keyInsight / equipmentProfiles / marketAnchors /
    // readout / bestDestinations / marketRanking / accessTrafficLight / todayCalls /
    // complianceTasks / openQuestions / dataSources 在浏览器端就被裁掉（PDF 8 章全空）。
    // channels 仍原样透传既有的脱敏值（明文只由服务端按 PiiAuditLog 解锁后重取）。
    const body = buildPdfExportBody({ strategy, product, channels, locale, webStatus, webNote });
    return handleExport(
      "/api/agents/seller-helper/sales-strategy/export/pdf",
      body,
      "ai-sales-strategy.pdf",
      setPdfLoading
    );
  };

  const handleExcel = () => {
    // N03-②：追加 layout + strategy，供 Sheet2「机型价格速查」（strategy.marketAnchors）
    // 与 Sheet3「必办清单」（strategy.complianceTasks）取数。
    // 只有显式传 layout 才走三 Sheet 新版式（N01：`opts?.layout === 2 ? 2 : 1`）；
    // 策略为空时不发 layout，请求体与改造前逐字等价。
    const body = buildExcelExportBody(partition, locale, strategy, webStatus);
    return handleExport(
      "/api/agents/seller-helper/sales-strategy/export/excel",
      body,
      `dealers-${partition}.xlsx`,
      setExcelLoading
    );
  };

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
