/**
 * SubsidyRawDetailTable —— C 档原始公示明细表（**Server Component**）
 * ===========================================================================
 * 🔴 本文件没有 "use client"，且**不得**有：raw 行从这里作为 props 传给任何
 * Client Component。上游 `queryRawDetail()` 返回的行在本组件内立即经
 * `toRawDetailView()` 白名单裁剪成纯字符串视图行后才进入 JSX；
 * 4 个不展示字段（id / goodsRegion / contentHash / createdAt）绝不进 RSC 序列化。
 *
 * 独立通道：绝不 import 公开聚合层的 toPublicCatalog / assertPublicSafe /
 * assertNoPiiDrillDown / PUBLIC_FIELDS / PII_FIELD_DENYLIST。
 *
 * 文案一律组件内 t(zh,en)，不读 messages/*.json（8 语零改动）。
 * 分页：rows 由 queryRawDetail 的 take=pageSize 保证 ≤ pageSize，本组件再
 * slice(0, pageSize) 做一次纵深防御，绝不放大到聚合值。
 */

import { AlertTriangle } from "lucide-react";
import type { RawDetailRow } from "@/lib/subsidy/raw-detail";
import {
  RAW_DETAIL_DISPLAY_FIELDS,
  toRawDetailView,
} from "@/lib/subsidy/raw-detail-view";

export interface SubsidyRawDetailTableProps {
  rows: readonly RawDetailRow[];
  page: number;
  pageSize: number;
  total: number;
  locale: "zh" | "en";
}

export function SubsidyRawDetailTable({
  rows,
  page,
  pageSize,
  total,
  locale,
}: SubsidyRawDetailTableProps) {
  const t = (zh: string, en: string): string => (locale === "zh" ? zh : en);
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 50;
  const visibleRows = rows.slice(0, safePageSize);
  const views = visibleRows.map((row) =>
    toRawDetailView(row, {
      // §10 Q3：serialNo 展示 + 顶部警示；sourceFile 默认折叠
      showSerialNo: true,
      showSourceFile: true,
      locale,
    })
  );
  const columns = views.length > 0 ? views[0].cells : [];
  const hasCollapsed = views.some((view) => view.collapsedCells.length > 0);

  return (
    <div className="space-y-4">
      {/* 显著 PII 警示（P0-5）：明确「已脱敏 / PII 剥离」不适用于本明文区 */}
      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">
            {t(
              "个人信息警示：以下为原始公示明细，未经脱敏",
              "Personal information warning: unmasked original public records below"
            )}
          </p>
          <p className="mt-1">
            {t(
              "含购机者姓名、县/乡、出厂编号与单条成交价等个人信息。页面其它位置的「公开层已做 k-匿名脱敏 / PII 剥离」说明仅适用于公开聚合层，不适用于本区；请勿转发或二次发布。",
              "Contains buyer names, county/township, serial numbers and single-transaction prices. The k-anonymity / PII-stripping notice elsewhere applies only to the public aggregate layer, NOT to this section. Do not redistribute."
            )}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-gray-50 text-xs font-medium text-gray-600">
            <tr>
              {columns.map((cell) => (
                <th key={cell.key} scope="col" className="whitespace-nowrap px-3 py-2">
                  {cell.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {views.map((view, rowIndex) => (
              <tr
                key={rowIndex}
                className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
              >
                {view.cells.map((cell) => (
                  <td
                    key={cell.key}
                    className="whitespace-nowrap px-3 py-2 text-gray-900"
                  >
                    {cell.value}
                  </td>
                ))}
              </tr>
            ))}
            {views.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(RAW_DETAIL_DISPLAY_FIELDS.length, 1)}
                  className="px-3 py-6 text-center text-gray-400"
                >
                  {t("暂无明细", "No itemised detail available")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 条件展示：sourceFile 默认折叠（§10 Q3） */}
      {hasCollapsed && (
        <details className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-gray-700">
            {t("原始数据文件（默认折叠）", "Source data files (collapsed by default)")}
          </summary>
          <ul className="mt-2 space-y-1 text-gray-600">
            {views.map((view, rowIndex) => (
              <li key={rowIndex} className="flex flex-wrap gap-x-4">
                {view.collapsedCells.map((cell) => (
                  <span key={cell.key}>
                    {cell.label}：{cell.value}
                  </span>
                ))}
                <span className="text-gray-400">
                  {t("第", "Row")} {rowIndex + 1} {t("行", "")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-gray-500">
        {t("第", "Page")} {page} {t("页 · 本页", " · showing")} {views.length}{" "}
        {t("行 · 共", " rows · total")} {total} {t("行 · 每页上限", " rows · page size cap")}{" "}
        {safePageSize} {t("行", " rows")}
      </p>
    </div>
  );
}
