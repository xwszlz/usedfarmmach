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
 *
 * T03：新增「内容级门禁 → A 区 C 档明文」与「B 区去重复 / C 层兜底差异」。
 *   - 门禁唯一入口 = resolveRawViewer()（可插拔 provider），绝不硬绑 auth 四步；
 *   - 决策**只**控制是否额外渲染 A 区明文 JSX：匿名 / off / 失败时
 *     不 redirect、不 notFound、不 302、不抛；B/C 区结构与开关完全解耦；
 *   - 严格计数断言 total === expectedSampleSize 由 T01 queryRawDetail 保持，
 *     老板 2026-11-07 拍板 A：不加容差、不补灌、不修 contentHash；
 *     consistent:false ⇒ 显示「暂无明细」，绝不拿聚合值冒充明文。
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubsidySpecTable } from "@/components/subsidy/SubsidySpecTable";
import { SubsidyRawDetailTable } from "@/components/subsidy/SubsidyRawDetailTable";
import { SubsidyCommonSections } from "@/components/subsidy/SubsidyCommonSections";
import { SubsidyModelImages } from "@/components/subsidy/SubsidyModelImages";
import { isCnSite, siteConfig } from "@/config/site";
import { SITE_ORIGIN } from "@/lib/site-url";
import {
  toPublicCatalog,
  assertPublicSafe,
} from "@/lib/subsidy/aggregate";
import { getRawFeatureConfig, getRawMode } from "@/lib/subsidy/raw-mode";
import { resolveRawViewer } from "@/lib/subsidy/raw-identity";
import { assertRawDetailAllowed, resolveGroupKey } from "@/lib/subsidy/raw-detail";
import { loadRawDetailRows } from "@/lib/subsidy/raw-detail-view";
import Link from "next/link";
import { ShieldAlert, Database } from "lucide-react";

export const dynamic = "force-dynamic";

const BASE_URL = SITE_ORIGIN;

/** 纯函数：同型号聚合中位数（不查 raw，全部来自已过护栏的 SubsidyCatalog）。 */
function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** 明细页码：只接受正整数，其余一律回第 1 页（不把任意字符串透传进查询）。 */
function parseRawPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.trim() === "") return 1;
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

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

  // 只在 off 态保持可索引；login/public 明文态一律 noindex,nofollow。
  // 🔴 本函数绝不查 raw，也绝不把任何 PII 写进 title / description / og。
  const mode = getRawMode();

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
    robots:
      mode === "off"
        ? { index: true, follow: true }
        : { index: false, follow: false },
  };
}

export async function generateStaticParams() {
  // 详情页数据动态，禁用静态预渲染（与 products/[id] 一致）
  return [];
}

export default async function SubsidyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const page = parseRawPage(sp.page);
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

  // ── T03 内容级门禁（唯一身份入口 = resolveRawViewer，可插拔 provider）──
  // off 态不读 token（§3.3.1）；viewer 只在非 off 时解析，失败一律返回 null，
  // 由 assertRawDetailAllowed 6 道 fail-closed 决策，绝不抛 / 不 302 / 不 500。
  const mode = getRawMode();
  const site = isCnSite() ? "cn" : "com";
  const viewer = mode === "off" ? null : await resolveRawViewer();
  const gate = assertRawDetailAllowed({ site, mode, viewer, locale });
  const rawResult = await loadRawDetailRows(gate, {
    key: resolveGroupKey(entry),
    expectedSampleSize: entry.sampleSize,
    page,
    pageSize: getRawFeatureConfig().pageSize,
  });

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

  // 主条目判定：与列表页 orderBy [{policyYear:desc},{province:asc}] 一致取第一条。
  // 纯聚合层查询，不受门禁开关影响（off 与 login 行为一致）。
  const primaryCandidates = await prisma.subsidyCatalog.findMany({
    where: {
      brandName: entry.brandName,
      category: entry.category,
      modelName: entry.modelName,
      isActive: true,
      sampleSize: { gte: 10 },
    },
    select: { id: true },
    orderBy: [{ policyYear: "desc" }, { province: "asc" }],
    take: 1,
  });
  const primaryId = primaryCandidates[0]?.id ?? entry.id;
  const isPrimary = primaryId === entry.id;
  const primaryHref = `/${locale}/subsidy/${primaryId}`;

  // C 层（匿名 / off 也允许渲染）：只取已过 assertPublicSafe 的 SubsidyCatalog 聚合值，
  // 绝不查 raw、绝不含任何单条成交价 / PII。
  const nationalMedian = medianOf(medians);
  const provinceDelta =
    nationalMedian === null ? null : entry.medianPriceCny - nationalMedian;

  const fmtCny = (v: number | null | undefined): string =>
    v == null ? "暂无" : "¥" + Math.round(v).toLocaleString("zh-CN");
  const fmtDate = (d: Date | string): string =>
    new Date(d).toISOString().slice(0, 10);
  const t = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const rawLocale: "zh" | "en" = locale === "en" ? "en" : "zh";
  const detailPath = `/${locale}/subsidy/${id}`;

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

      {/* SECTION 2 — 机型级实拍图（仅 approved 可见；无图时逐字保留 L204–212 占位框） */}
      <SubsidyModelImages
        brandName={entry.brandName}
        category={entry.category}
        modelName={entry.modelName}
        locale={locale}
      />

      {/* ── A 区：C 档原始公示明细 ──────────────────────────────────────────
          🔴 门禁决策控制的**唯一**额外 JSX。匿名 / off / 校验失败时整块不渲染，
          不 redirect / 不 notFound / 不 302 / 不抛。B/C 区完全不受影响。 */}
      {gate.showRaw && rawResult !== null && (
        <section className="mb-8 rounded-lg border border-amber-300 bg-amber-50/60 p-5">
          {/* 显著 PII 警示：明确撤下「已脱敏 / PII 剥离」对明文区的描述 */}
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {t(
                  "个人信息警示：以下为原始公示明细，未经脱敏",
                  "Personal information warning: unmasked original public records below"
                )}
              </p>
              <p className="mt-1">
                {t(
                  "本区含购机者姓名、县/乡、出厂编号与单条成交价等个人信息；页面其它位置的「公开层已做 k-匿名脱敏 / PII 剥离」说明仅适用于公开聚合层，不适用于本区。请勿转发或二次发布。",
                  "This section contains buyer names, county/township, serial numbers and single-transaction prices. The k-anonymity / PII-stripping notice elsewhere applies only to the public aggregate layer, NOT to this section. Do not redistribute."
                )}
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {entry.province} · {entry.policyYear}
            </Badge>
            <Badge variant="outline">
              {t("样本量 n", "Sample n")}={entry.sampleSize}
            </Badge>
            <Badge variant="default">
              {t("原始公示明细", "Raw public records")}
            </Badge>
          </div>

          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {t(
              "本省本年逐条成交明细",
              "Itemised transactions for this province and year"
            )}
          </h2>

          {/* consistent:false ⇒ 只显示「暂无明细」，绝不拿聚合值冒充明文 */}
          {rawResult.consistent && rawResult.rows.length > 0 ? (
            <SubsidyRawDetailTable
              rows={rawResult.rows}
              page={rawResult.page}
              pageSize={rawResult.pageSize}
              total={rawResult.total}
              locale={rawLocale}
            />
          ) : (
            <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
              {t(
                "暂无明细（原始行数与样本量不一致，已按 fail-closed 收口，不以聚合值冒充明文）。",
                "No itemised detail available (the raw row count does not match the sample size; fail-closed, aggregate values are never substituted)."
              )}
            </p>
          )}

          {/* 本条目价格带 / 本省 vs 全国中位数差值 / 批次 · 更新时间（全部聚合层） */}
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-700 sm:grid-cols-3">
            <div className="rounded-md border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">
                {t("本条目价格带（P25 / 中位数 / P75）", "This entry's band (P25 / median / P75)")}
              </p>
              <p className="mt-1 font-medium text-gray-900">
                {fmtCny(entry.p25PriceCny)} / {fmtCny(entry.medianPriceCny)} /{" "}
                {fmtCny(entry.p75PriceCny)}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">
                {t("本省与全国中位数差值", "Province vs national median")}
              </p>
              <p className="mt-1 font-medium text-gray-900">
                {provinceDelta === null
                  ? t("暂无", "N/A")
                  : `${provinceDelta >= 0 ? "+" : "−"}${fmtCny(Math.abs(provinceDelta))} ${t(
                      "（相对同型号全国中位数）",
                      "(vs same-model national median)"
                    )}`}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">
                {t("批次 / 更新时间", "Batch / updated at")}
              </p>
              <p className="mt-1 font-medium text-gray-900">
                {entry.batchCode} · {fmtDate(entry.updatedAt)}
              </p>
            </div>
          </div>

          {rawResult.total > rawResult.pageSize && (
            <div className="mt-4 flex items-center gap-4 text-sm">
              {rawResult.page > 1 && (
                <Link
                  href={`${detailPath}?page=${rawResult.page - 1}`}
                  className="text-blue-600 hover:underline"
                >
                  {t("上一页", "Previous page")}
                </Link>
              )}
              <span className="text-gray-500">
                {t("第", "Page")} {rawResult.page} /{" "}
                {Math.ceil(rawResult.total / rawResult.pageSize)} {t("页", "")}
              </span>
              {rawResult.page * rawResult.pageSize < rawResult.total && (
                <Link
                  href={`${detailPath}?page=${rawResult.page + 1}`}
                  className="text-blue-600 hover:underline"
                >
                  {t("下一页", "Next page")}
                </Link>
              )}
            </div>
          )}
        </section>
      )}

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
        </div>

        {/* C 层 — 条目独有兜底差异（off / 匿名也渲染；只取聚合层，过既有护栏） */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-5 w-5" />
                {t("本条目归档要点", "Key facts of this entry")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-700">
              <p>
                {t("本省本年样本量 n：", "Sample size n for this province / year: ")}
                <span className="font-semibold text-gray-900">
                  {entry.sampleSize.toLocaleString("zh-CN")}
                </span>
              </p>
              <p>
                {t("本条目价格带：", "This entry's price band: ")}
                <span className="font-semibold text-gray-900">
                  {fmtCny(entry.p25PriceCny)} ~ {fmtCny(entry.p75PriceCny)}
                </span>
                {t("（P25 ~ P75，中位数 ", "(P25 ~ P75, median ")}
                {fmtCny(entry.medianPriceCny)}
                {"）"}
              </p>
              <p>
                {t("本省与全国中位数差值：", "Province vs national median: ")}
                <span className="font-semibold text-gray-900">
                  {provinceDelta === null
                    ? t("暂无", "N/A")
                    : `${provinceDelta >= 0 ? "+" : "−"}${fmtCny(Math.abs(provinceDelta))}`}
                </span>
              </p>
              <p className="text-gray-600">
                {t("条目独有说明：", "Entry-specific note: ")}
                {entry.province} {entry.policyYear}{" "}
                {t("年归档批次 ", " archive batch ")}
                {entry.batchCode}
                {t("，覆盖 ", ", covering ")}
                {entry.category} · {entry.modelName}
                {t("，本条目样本量 ", ", sample size ")}
                {entry.sampleSize.toLocaleString("zh-CN")}
                {t(" 台，更新时间 ", " units, updated ")}
                {fmtDate(entry.updatedAt)}
                {t("。", ".")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* B 区 — 机型通用信息（默认折叠；非主条目只渲染指向主条目的 Link） */}
      <SubsidyCommonSections
        locale={locale}
        isPrimary={isPrimary}
        primaryHref={primaryHref}
        priceMin={priceMin}
        priceMax={priceMax}
        yearDist={yearDist}
        siblingModels={siblingModels}
        brandName={entry.brandName}
        modelName={entry.modelName}
      />
    </div>
  );
}
