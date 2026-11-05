/**
 * 国内农机补贴库 —— 机型归档详情页（产品详情页形态）
 * ===========================================================================
 * 镜像 src/app/[locale]/products/[id]/page.tsx 的展示骨架，但**不伪造 Product 行**、
 * **不挂 InquiryActions / SellerContactCard / FloatingChat(productId) / FavoriteButton**
 * 等依赖真实 Product id 的组件。所有数据来自公开聚合层 SubsidyCatalog，且每条在渲染前
 * 必过 toPublicCatalog + assertPublicSafe（fail-closed，n<10 / PII / 单条 / 县乡下钻 → 不渲染）。
 *
 * 门禁：(cn) layout.tsx 已对 .com 返回 404；本页额外在渲染前做脱敏校验。
 * 构建期静态固化：export const dynamic = "force-dynamic"。
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubsidySpecTable } from "@/components/subsidy/SubsidySpecTable";
import { isCnSite, siteConfig } from "@/config/site";
import {
  toPublicCatalog,
  assertPublicSafe,
} from "@/lib/subsidy/aggregate";
import Link from "next/link";
import {
  FileArchive,
  ShieldCheck,
  Search,
  BarChart3,
  CalendarClock,
  Layers3,
} from "lucide-react";

export const dynamic = "force-dynamic";

const BASE_URL = siteConfig.domains.canonical;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const entry = await prisma.subsidyCatalog.findUnique({
    where: { id },
    select: {
      brandName: true,
      modelName: true,
      category: true,
      policyYear: true,
      province: true,
      sampleSize: true,
    },
  });
  if (!entry) {
    return { title: "补贴归档机型未找到" };
  }

  const titleZh = `${entry.brandName} ${entry.modelName} ${entry.category} · 农机购置补贴归档（${entry.province} ${entry.policyYear}）`;
  const titleEn = `${entry.brandName} ${entry.modelName} ${entry.category} · Farm Machinery Purchase Subsidy Archive (${entry.province} ${entry.policyYear})`;
  const descZh = `国内农机购置补贴归档：${entry.brandName} ${entry.modelName} ${entry.category} 在 ${entry.province} ${entry.policyYear} 年的新机成交价中位数、补贴额与样本量 n=${entry.sampleSize}。历史补贴数据，非在售商品。`;
  const descEn = `Domestic farm machinery purchase subsidy archive: ${entry.brandName} ${entry.modelName} ${entry.category} in ${entry.province} ${entry.policyYear} — median new-machine price, subsidy and sample size n=${entry.sampleSize}. Historical subsidy record, NOT a for-sale listing.`;

  return {
    title: locale === "zh" ? titleZh : titleEn,
    description: locale === "zh" ? descZh : descEn,
    // 仅 .cn 站内规范链接；不输出指向 .com 的 hreflang（合规：补贴库不进 .com）
    alternates: {
      canonical: `${BASE_URL}/${locale}/subsidy/${id}`,
    },
    openGraph: {
      title: locale === "zh" ? titleZh : titleEn,
      description: locale === "zh" ? descZh : descEn,
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export async function generateStaticParams() {
  // 详情页数据动态，禁用静态预渲染（与 products/[id] 一致）
  return [];
}

export default async function SubsidyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // .com 已在 (cn) layout 层 404；此处再确认一次（纵深）
  if (!isCnSite()) {
    notFound();
  }

  const entry = await prisma.subsidyCatalog.findUnique({
    where: { id, isActive: true },
  });
  if (!entry) {
    notFound();
  }

  // ── fail-closed 脱敏校验：n<10 / PII / 单条原始行 / 县乡下钻 → 拒绝渲染（404）──
  const safe = toPublicCatalog(entry as unknown as Record<string, unknown>);
  try {
    assertPublicSafe(safe);
  } catch {
    notFound();
  }

  // 「具体信息」：同型号跨省份/年份分布（全部来自公开聚合层，n>=10）
  const sameModel = await prisma.subsidyCatalog.findMany({
    where: {
      modelName: entry.modelName,
      isActive: true,
      sampleSize: { gte: 10 },
    },
    select: {
      province: true,
      policyYear: true,
      medianPriceCny: true,
      p25PriceCny: true,
      p75PriceCny: true,
      medianCentralSubsidy: true,
      medianTotalSubsidy: true,
      sampleSize: true,
    },
  });
  // 逐条护栏：即便 where 已限 n>=10，仍显式校验
  sameModel.forEach((r) =>
    assertPublicSafe(toPublicCatalog(r as unknown as Record<string, unknown>))
  );

  // 同品牌相邻型号对比（取中位数价格top，剔除自身）
  const siblingModels = await prisma.subsidyCatalog.findMany({
    where: {
      brandName: entry.brandName,
      isActive: true,
      sampleSize: { gte: 10 },
    },
    distinct: ["modelName"],
    select: { modelName: true, medianPriceCny: true, sampleSize: true },
    orderBy: { medianPriceCny: "desc" },
    take: 12,
  });

  // 覆盖省份 / 年份区间 / 机龄区间（来自同型号集合）
  const provinces = Array.from(new Set(sameModel.map((r) => r.province)));
  const years = sameModel.map((r) => r.policyYear);
  const minYear = Math.min(...years, entry.policyYear);
  const maxYear = Math.max(...years, entry.policyYear);
  const nowYear = new Date().getFullYear();
  const ageMin = nowYear - maxYear;
  const ageMax = nowYear - minYear;

  const subsidyTier =
    entry.medianTotalSubsidy != null ? "中央补贴 + 地方补贴" : "中央补贴";

  // 同型号全国价格中位数区间
  const medians = sameModel
    .map((r) => r.medianPriceCny)
    .filter((v): v is number => v != null);
  const priceMin = medians.length ? Math.min(...medians) : entry.medianPriceCny;
  const priceMax = medians.length ? Math.max(...medians) : entry.medianPriceCny;

  // 逐年兑付量分布（按 policyYear 聚合 sampleSize）
  const yearBuckets = new Map<number, number>();
  for (const r of sameModel) {
    yearBuckets.set(r.policyYear, (yearBuckets.get(r.policyYear) ?? 0) + r.sampleSize);
  }
  const yearDist = Array.from(yearBuckets.entries()).sort((a, b) => a[0] - b[0]);

  const fmtCny = (v: number | null | undefined): string =>
    v == null ? "暂无" : "¥" + Math.round(v).toLocaleString("zh-CN");
  const fmtDate = (d: Date | string): string =>
    new Date(d).toISOString().slice(0, 10);
  const t = (zh: string, en: string) => (locale === "zh" ? zh : en);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* SECTION 1 — 标题区（镜像 products 详情页） */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="default">{entry.brandName}</Badge>
          <Badge variant="secondary">{entry.category}</Badge>
          <Badge variant="accent">
            {t("补贴机型", "Subsidized model")}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {entry.brandName} {entry.modelName} {entry.category} ·{" "}
          {t("农机购置补贴归档", "Farm Machinery Purchase Subsidy Archive")}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {entry.province} · {entry.policyYear}
          {t("年 · 历史补贴数据，非在售商品", " · historical subsidy record, not a for-sale listing")}
        </p>
      </div>

      {/* SECTION 2 — 图片占位（补贴 CSV 无实拍图，严禁编造/复用别家图片） */}
      <div className="mb-8 flex aspect-[16/7] w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <FileArchive className="h-10 w-10" />
          <span className="text-sm">
            {t("暂无实拍图 · 归档机型", "No photo · archived model")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* SECTION 3 — 规格表（公开聚合层，无 PII） */}
        <div className="space-y-6">
          <SubsidySpecTable
            brandName={entry.brandName}
            category={entry.category}
            modelName={entry.modelName}
            manufacturer={entry.manufacturer}
            subsidyTier={subsidyTier}
            provinceCoverage={
              provinces.length > 0
                ? `${provinces.length} ${t("个省份", "provinces")}`
                : entry.province
            }
            policyYearRange={`${minYear}–${maxYear}`}
            machineAgeRange={`${ageMin}–${ageMax} ${t("年", "yr")}`}
            sampleSize={entry.sampleSize}
            p25PriceCny={entry.p25PriceCny}
            medianPriceCny={entry.medianPriceCny}
            p75PriceCny={entry.p75PriceCny}
            medianCentralSubsidy={entry.medianCentralSubsidy}
            medianTotalSubsidy={entry.medianTotalSubsidy}
            batchCode={entry.batchCode}
            updatedAt={fmtDate(entry.updatedAt)}
            locale={locale}
          />

          {/* SECTION — 数据来源说明 + 免责声明 */}
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

        {/* SECTION — 具体信息（用户点名要的）：分布 / 价格带 / 相邻型号 */}
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
                {siblingModels
                  .filter((m) => m.modelName !== entry.modelName)
                  .slice(0, 8)
                  .map((m) => (
                    <li key={m.modelName} className="flex justify-between border-b border-gray-100 py-1">
                      <span>{m.modelName}</span>
                      <span className="font-medium text-gray-900">
                        {fmtCny(m.medianPriceCny)}
                      </span>
                    </li>
                  ))}
                {siblingModels.filter((m) => m.modelName !== entry.modelName).length === 0 && (
                  <li className="text-gray-400">{t("暂无其它型号", "No other models")}</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA — .cn 内「找同款车源」（连内层线索池，不暴露任何 PII；不挂 Product 询价组件） */}
      <div className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
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
          href={`/zh/subsidy?brand=${encodeURIComponent(entry.brandName)}&model=${encodeURIComponent(entry.modelName)}`}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Search className="h-4 w-4" />
          {t("找同款车源", "Find same-model leads")}
        </Link>
      </div>
    </div>
  );
}
