/**
 * 国内农机补贴库 —— 检索导航页（品牌 → 品类 → 型号）
 * ===========================================================================
 * 本页为**检索入口**，不是主交付物：按 brand → category → model 三级下钻，
 * 最深层列出该 (品牌, 品类, 型号) 下的公开聚合条目（卡片），每张卡片链到详情页
 * /[locale]/subsidy/[id]。
 *
 * 只查 SubsidyCatalog（绝不查 SubsidyRecordRaw）。所有条目经 assertPublicSafe 护栏。
 * 门禁：(cn) layout 对 .com 返回 404；额外 assertNoPiiDrillDown 禁止县乡下钻参数。
 * export const dynamic = "force-dynamic"（.cn 构建期静态固化）。
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { setRequestLocale } from "next-intl/server";
import { isCnSite, siteConfig } from "@/config/site";
import { SITE_ORIGIN } from "@/lib/site-url";
import {
  toPublicCatalog,
  assertPublicSafe,
  assertNoPiiDrillDown,
} from "@/lib/subsidy/aggregate";
import { getRawMode } from "@/lib/subsidy/raw-mode";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Search } from "lucide-react";

export const dynamic = "force-dynamic";

const BASE_URL = SITE_ORIGIN;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const titleZh = "国内农机购置补贴库 · 品牌/品类/型号检索";
  const titleEn = "Domestic Farm Machinery Subsidy Catalog · Brand/Category/Model";
  const descZh = "按品牌、品类、型号检索国内农机购置补贴归档（资金已兑付口径，k-匿名脱敏，n≥10）。";
  const descEn =
    "Browse domestic farm machinery purchase subsidy archives by brand, category and model (funds-disbursed scope, k-anonymity masked, n≥10).";
  return {
    title: locale === "zh" ? titleZh : titleEn,
    description: locale === "zh" ? descZh : descEn,
    alternates: { canonical: `${BASE_URL}/${locale}/subsidy` },
    robots: { index: true, follow: true },
  };
}

export async function generateStaticParams() {
  return [];
}

type SearchParams = { [key: string]: string | string[] | undefined };

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SubsidyBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  if (!isCnSite()) {
    notFound();
  }

  // 禁县乡级 / PII 下钻参数（fail-closed，违规直接 404）
  try {
    assertNoPiiDrillDown(sp as Record<string, unknown>);
  } catch {
    notFound();
  }

  const brand = str(sp.brand);
  const category = str(sp.category);
  const model = str(sp.model);

  const baseWhere = { isActive: true, sampleSize: { gte: 10 } } as const;
  const fmtCny = (v: number | null) => (v == null ? "—" : "¥" + Math.round(v).toLocaleString("zh-CN"));
  const t = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const rawMode = getRawMode();

  // 第 4 层：已选到 品牌 + 品类 + 型号 → 列出公开聚合条目
  if (brand && category && model) {
    const entries = await prisma.subsidyCatalog.findMany({
      where: {
        ...baseWhere,
        brandName: brand,
        category,
        modelName: model,
      },
      select: {
        id: true,
        province: true,
        policyYear: true,
        medianPriceCny: true,
        p25PriceCny: true,
        p75PriceCny: true,
        medianTotalSubsidy: true,
        sampleSize: true,
      },
      orderBy: [{ policyYear: "desc" }, { province: "asc" }],
    });
    // 逐条脱敏护栏（白名单 + n>=10 + 禁 PII）：违规条目直接 404，绝不渲染
    entries.forEach((e) => {
      try {
        assertPublicSafe(toPublicCatalog(e as unknown as Record<string, unknown>));
      } catch {
        notFound();
      }
    });

    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-4 text-sm text-gray-500">
          <Link href="/zh/subsidy" className="hover:underline">{t("补贴库", "Subsidy")}</Link>
          <span className="mx-1">/</span>
          <Link href={`/zh/subsidy?brand=${encodeURIComponent(brand)}`} className="hover:underline">{brand}</Link>
          <span className="mx-1">/</span>
          <Link href={`/zh/subsidy?brand=${encodeURIComponent(brand)}&category=${encodeURIComponent(category)}`} className="hover:underline">{category}</Link>
          <span className="mx-1">/</span>
          <span className="text-gray-700">{model}</span>
        </nav>
        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          {brand} {model} {category}
        </h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <Link key={e.id} href={`/${locale}/subsidy/${e.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{e.province}</Badge>
                    <span className="text-sm text-gray-500">{e.policyYear}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {t("成交价中位数", "Median price")}：
                    <span className="font-semibold text-gray-900">{fmtCny(e.medianPriceCny)}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {t("区间", "Band")}：{fmtCny(e.p25PriceCny)} ~ {fmtCny(e.p75PriceCny)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {t("样本量 n", "Sample n")}：{e.sampleSize.toLocaleString("zh-CN")}
                  </div>
                  <div className="flex items-center justify-end text-sm font-medium text-blue-600">
                    {t(
                      `查看 ${e.province} ${e.policyYear} 归档（n=${e.sampleSize.toLocaleString("zh-CN")}）`,
                      `View ${e.province} ${e.policyYear} archive (n=${e.sampleSize.toLocaleString("zh-CN")})`
                    )} <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {entries.length === 0 && (
            <p className="text-gray-400">{t("暂无公开条目（n<10 已被脱敏拦截）", "No public entries (n<10 masked)")}</p>
          )}
        </div>
      </div>
    );
  }

  // 第 3 层：已选 品牌 + 品类 → 列出型号
  if (brand && category) {
    const models = await prisma.subsidyCatalog.findMany({
      where: { ...baseWhere, brandName: brand, category },
      distinct: ["modelName"],
      select: { modelName: true },
      orderBy: { modelName: "asc" },
    });
    return navGrid({
      locale,
      title: `${brand} · ${category}`,
      links: models.map((m) => ({
        label: m.modelName,
        href: `/${locale}/subsidy?brand=${encodeURIComponent(brand)}&category=${encodeURIComponent(category)}&model=${encodeURIComponent(m.modelName)}`,
      })),
      t,
    });
  }

  // 第 2 层：已选 品牌 → 列出品类
  if (brand) {
    const cats = await prisma.subsidyCatalog.findMany({
      where: { ...baseWhere, brandName: brand },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
    return navGrid({
      locale,
      title: brand,
      links: cats.map((c) => ({
        label: c.category,
        href: `/${locale}/subsidy?brand=${encodeURIComponent(brand)}&category=${encodeURIComponent(c.category)}`,
      })),
      t,
    });
  }

  // 第 1 层：列出品牌
  const brands = await prisma.subsidyCatalog.findMany({
    where: baseWhere,
    distinct: ["brandName"],
    select: { brandName: true },
    orderBy: { brandName: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">
        {t("国内农机购置补贴库", "Domestic Farm Machinery Subsidy Catalog")}
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        {t(
          rawMode === "off"
            ? "按品牌检索。数据为「资金已兑付」历史补贴公示，已做 k-匿名脱敏（n≥10），非在售商品。"
            : "按品牌检索。数据为「资金已兑付」历史补贴公示，已做 k-匿名脱敏（n≥10）；详情页可按省份与年份查看原始公示明细档案（仅 .cn 提供）。",
          rawMode === "off"
            ? "Search by brand. Data is historical “funds-disbursed” subsidy records, k-anonymity masked (n≥10), not for-sale listings."
            : "Search by brand. Data is historical “funds-disbursed” subsidy records, k-anonymity masked (n≥10); detail pages provide original public-record archives by province and policy year (cn only).")
        }
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {brands.map((b) => (
          <Link
            key={b.brandName}
            href={`/${locale}/subsidy?brand=${encodeURIComponent(b.brandName)}`}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 transition-colors hover:border-blue-400 hover:bg-blue-50"
          >
            <span>{b.brandName}</span>
            <ArrowRight className="h-4 w-4 text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}

/* 通用导航栅格（品类/型号层） */
function navGrid({
  locale,
  title,
  links,
  t,
}: {
  locale: string;
  title: string;
  links: { label: string; href: string }[];
  t: (zh: string, en: string) => string;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{title}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 transition-colors hover:border-blue-400 hover:bg-blue-50"
          >
            <span>{l.label}</span>
            <ArrowRight className="h-4 w-4 text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
