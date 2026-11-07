/**
 * SubsidyCommonSections —— B 区「机型通用信息」（去重复，PRD §5.2）
 * ===========================================================================
 * 收拢原先详情页 L241–266 免责声明、L271–340 三个 Card、L344–364 CTA，
 * 统一放进 **默认折叠** 的 <details>，避免同机型跨省 / 跨年的三个归档页
 * 把同一套机型级文本重复索引三遍（老板图 3 的原始诉求）。
 *
 * 🔴 主条目判定由页面按列表页 `orderBy [{policyYear:desc},{province:asc}]`
 * 取第一条算出（与本组件无关，本组件只消费 isPrimary / primaryHref）；
 * 非主条目**只渲染**「查看同机型通用信息」<Link> 指向主条目 id。
 * 🔴 URL 与 canonical 完全不在本组件范围内，一律不动。
 *
 * 本组件与门禁开关**完全解耦**：off / login / public 三态下结构与文案一致，
 * 门禁只控制页面是否额外渲染 A 区明文 JSX。
 * 文案一律组件内 t(zh,en)，不读 messages/*.json。
 */

import Link from "next/link";
import {
  ShieldCheck,
  Search,
  BarChart3,
  CalendarClock,
  Layers3,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface SubsidyCommonSectionsProps {
  locale: string;
  isPrimary: boolean;
  primaryHref: string;
  priceMin: number | null;
  priceMax: number | null;
  yearDist: ReadonlyArray<readonly [number, number]>;
  siblingModels: ReadonlyArray<{
    modelName: string;
    medianPriceCny: number | null;
    sampleSize: number;
  }>;
  brandName: string;
  modelName: string;
}

export function SubsidyCommonSections({
  locale,
  isPrimary,
  primaryHref,
  priceMin,
  priceMax,
  yearDist,
  siblingModels,
  brandName,
  modelName,
}: SubsidyCommonSectionsProps) {
  const t = (zh: string, en: string): string => (locale === "zh" ? zh : en);
  const fmtCny = (v: number | null | undefined): string =>
    v == null ? "暂无" : "¥" + Math.round(v).toLocaleString("zh-CN");

  const otherModels = siblingModels
    .filter((m) => m.modelName !== modelName)
    .slice(0, 8);

  // 非主条目：只留一个指向主条目的链接，B 区通用文本一次都不重复渲染。
  if (!isPrimary) {
    return (
      <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-5">
        <p className="text-sm text-gray-600">
          {t(
            "此归档条目与该机型其它省份 / 年份条目共享同一套机型通用信息。",
            "This archive entry shares the same model-level information with the other province / year entries."
          )}
        </p>
        <Link
          href={primaryHref}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
        >
          {t("查看同机型通用信息", "View shared model information")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <details className="mt-8 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <summary className="cursor-pointer text-sm font-medium text-gray-800">
        {t(
          "展开机型通用信息（同型号价格带 / 逐年兑付量 / 相邻型号 / 免责声明 / 找车源）",
          "Expand shared model information (price band / annual payouts / sibling models / disclaimer / sourcing)"
        )}
      </summary>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 数据来源说明 + 免责声明（原文逐字保留，off 态亦然） */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                {t("数据口径与免责声明", "Data scope & disclaimer")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p>
                {t(
                  "本页数据口径为「资金已兑付」的历史农机购置补贴公示，是机龄地图与残值基准的参考，",
                  "This page reflects historical farm-machinery purchase subsidy announcements with status “funds disbursed”. It is a reference for machine-age mapping and residual-value benchmarking, "
                )}
                <span className="font-medium text-gray-800">
                  {t("并非挂牌价、并非可售库存。", "NOT a listed price and NOT a for-sale inventory.")}
                </span>
              </p>
              <p>
                {t(
                  "公开层已做 k-匿名脱敏（样本量 n≥10）、中位数/分位数统计与县乡/姓名/出厂编号等 PII 剥离。",
                  "The public layer is k-anonymity masked (sample size n≥10), uses median/quantile statistics, and strips PII such as county/township, buyer name and serial number."
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 具体信息（B 区三个 Card） */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5" />
                {t("同型号全国价格带", "National price band (same model)")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-700">
              <p>
                {t("新机成交价中位数区间：", "Median new-machine price range: ")}
                <span className="font-semibold text-gray-900">
                  {fmtCny(priceMin)} ~ {fmtCny(priceMax)}
                </span>
              </p>
              <p className="mt-1 text-gray-500">
                {t(
                  "基于同型号在各省、各兑付年份的公开聚合条目（n≥10），不含任何单条成交记录。",
                  "Based on public aggregated entries of the same model across provinces and payout years (n≥10); no individual transaction records."
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-5 w-5" />
                {t("逐年兑付量分布", "Annual payout distribution")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-gray-700">
                {yearDist.map(([year, count]) => (
                  <li key={year} className="flex justify-between border-b border-gray-100 py-1">
                    <span>{year}</span>
                    <span className="font-medium text-gray-900">
                      {count.toLocaleString("zh-CN")} {t("台", "units")}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers3 className="h-5 w-5" />
                {t("同品牌相邻型号对比", "Sibling models (same brand)")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-gray-700">
                {otherModels.map((m) => (
                  <li key={m.modelName} className="flex justify-between border-b border-gray-100 py-1">
                    <span>{m.modelName}</span>
                    <span className="font-medium text-gray-900">
                      {fmtCny(m.medianPriceCny)}
                    </span>
                  </li>
                ))}
                {otherModels.length === 0 && (
                  <li className="text-gray-400">{t("暂无其它型号", "No other models")}</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA — .cn 内「找同款车源」（不挂 Product 询价组件） */}
      <div className="mt-6 flex flex-col items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-gray-900">
            {t("想找这台机的在售车源？", "Looking for a used unit of this model?")}
          </p>
          <p className="text-sm text-gray-500">
            {t(
              "同型号、同年份的农机通常在 3–5 年后进入二手流通，可据此线索定向找车。",
              "Machines of the same model and year typically enter the used market 3–5 years later; use this as a sourcing lead."
            )}
          </p>
        </div>
        <Link
          href={`/zh/subsidy?brand=${encodeURIComponent(brandName)}&model=${encodeURIComponent(modelName)}`}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Search className="h-4 w-4" />
          {t("找同款车源", "Find same-model leads")}
        </Link>
      </div>
    </details>
  );
}
