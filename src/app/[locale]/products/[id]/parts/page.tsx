import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";
import { getHreflangLanguages } from "@/components/seo/hreflang-head";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import {
  getMachineTypes,
  getProductPartsPage,
  inferMachineTypeFromCompatibleMachines,
  resolveMachineTypeCode,
} from "@/lib/product-parts";
import ProductPartsClient from "./ProductPartsClient";

// 与整机详情页保持一致：实时读库，禁止构建期静态固化
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

const PAGE_SIZE = 12;

function localized(obj: Record<string, any>, field: string, locale: string, fallback: string) {
  const key = `name${locale.charAt(0).toUpperCase()}${locale.slice(1)}`;
  return obj?.[key] || obj?.[field] || fallback;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const sp = await searchParams;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      modelName: true,
      year: true,
      brand: { select: { nameZh: true, nameEn: true } },
      category: { select: { nameZh: true, nameEn: true } },
    },
  });

  if (!product) return { title: "产品未找到" };

  const brandName = localized(product.brand as any, "nameEn", locale, "");
  const categoryName = localized(product.category as any, "nameEn", locale, "");
  const mt = typeof sp.mt === "string" ? sp.mt : "";

  const suffix: Record<string, string> = {
    zh: `${brandName} ${product.modelName} 适配零部件与配件清单`,
    en: `${brandName} ${product.modelName} Parts & Components — Full List`,
    ru: `${brandName} ${product.modelName} — запчасти и комплектующие`,
    es: `${brandName} ${product.modelName} — repuestos y componentes`,
    pt: `${brandName} ${product.modelName} — peças e componentes`,
    ar: `${brandName} ${product.modelName} — قطع الغيار والمكونات`,
    fr: `${brandName} ${product.modelName} — pièces et composants`,
    hi: `${brandName} ${product.modelName} — पुर्जे और कंपोनेंट`,
  };

  const desc: Record<string, string> = {
    zh: `${brandName} ${product.modelName}（${product.year}）全部适配零部件清单：按机型、系统、部件组分类浏览，支持品牌与关键词筛选，在线询价。`,
    en: `Full parts list for ${brandName} ${product.modelName} (${product.year}) — browse by machine type, system and component group, filter by brand, request a quote online.`,
    ru: `Полный список запчастей для ${brandName} ${product.modelName} (${product.year}): по типам машин, системам и группам, с фильтрами и запросом цены.`,
    es: `Lista completa de repuestos para ${brandName} ${product.modelName} (${product.year}): por tipo de máquina, sistema y grupo, con filtros y cotización.`,
    pt: `Lista completa de peças para ${brandName} ${product.modelName} (${product.year}): por tipo de máquina, sistema e grupo, com filtros e cotação.`,
    ar: `قائمة كاملة بقطع الغيار لـ ${brandName} ${product.modelName} (${product.year}) — حسب نوع الآلة والنظام ومجموعة المكونات، مع الفلاتر وطلب السعر.`,
    fr: `Liste complète des pièces pour ${brandName} ${product.modelName} (${product.year}) — par type de machine, système et groupe de composants.`,
    hi: `${brandName} ${product.modelName} (${product.year}) के लिए पूरी पुर्जों की सूची — मशीन प्रकार, सिस्टम और कंपोनेंट ग्रुप के अनुसार।`,
  };

  // 带筛选参数的页面不做索引，避免重复内容
  const hasFilters = ["mt", "ss", "cg", "brand", "q", "page"].some((k) => !!sp[k]);

  return {
    title: suffix[locale] || suffix.en,
    description: desc[locale] || desc.en,
    alternates: {
      canonical: `${BASE_URL}/${locale}/products/${id}/parts`,
      languages: getHreflangLanguages(`/products/${id}/parts`),
    },
    robots: hasFilters || mt === "__all__" ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function ProductPartsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      modelName: true,
      year: true,
      status: true,
      brand: { select: { nameZh: true, nameEn: true } },
      category: {
        select: { nameZh: true, nameEn: true, code: true },
      },
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  if (!product || product.status !== "active") notFound();

  const brandName = localized(product.brand as any, "nameEn", locale, "");
  const categoryName = localized(product.category as any, "nameEn", locale, "");

  const getStr = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const page = Math.max(1, parseInt(getStr("page") || "1", 10) || 1);

  // 品类 → 配件机型 归一化（用于默认只看本机型）
  // 机型判定（精度从高到低）：型号级兼容记录反推 → 品类映射
  let ownMachineType: string | null = null;
  try {
    ownMachineType = await inferMachineTypeFromCompatibleMachines({
      brandEn: product.brand?.nameEn,
      brandZh: product.brand?.nameZh,
      modelName: product.modelName,
    });
  } catch (e) {
    console.error("inferMachineTypeFromCompatibleMachines failed:", e);
  }
  if (!ownMachineType) {
    try {
      const machineTypes = await getMachineTypes();
      ownMachineType = resolveMachineTypeCode({
        categoryCode: product.category?.code ?? null,
        categoryNameZh: product.category?.nameZh ?? null,
        categoryNameEn: product.category?.nameEn ?? null,
        machineTypes,
      });
    } catch (e) {
      console.error("resolveMachineTypeCode failed:", e);
    }
  }

  const mtParam = getStr("mt");
  const requestedMt = mtParam || ownMachineType || "__all__";

  const baseQuery = {
    productId: product.id,
    brandEn: product.brand?.nameEn || "",
    brandZh: product.brand?.nameZh || "",
    page,
    pageSize: PAGE_SIZE,
    subSystem: getStr("ss"),
    componentGroup: getStr("cg"),
    brand: getStr("brand"),
    keyword: getStr("q"),
  };

  let result = await getProductPartsPage({ ...baseQuery, machineType: requestedMt });

  // 本机型下无配件（或推断机型不准）→ 自动回退到全部机型，避免用户看到空页
  const hasAnyFilter = !!getStr("ss") || !!getStr("cg") || !!getStr("brand") || !!getStr("q");
  if (result.total === 0 && requestedMt !== "__all__" && !hasAnyFilter) {
    const fallback = await getProductPartsPage({ ...baseQuery, machineType: "__all__", page: 1 });
    if (fallback.total > 0) {
      result = fallback;
      ownMachineType = null; // 推断机型在本库无配件，取消「只看本机型」提示
    }
  }

  const imageUrl = product.images[0] ? getImageUrl(product.images[0].url) : null;

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "设备市场" : "Products", url: `${BASE_URL}/${locale}/products` },
          {
            name: `${brandName} ${product.modelName}`,
            url: `${BASE_URL}/${locale}/products/${product.id}`,
          },
          {
            name: locale === "zh" ? "零部件" : "Parts",
            url: `${BASE_URL}/${locale}/products/${product.id}/parts`,
          },
        ]}
      />
      <ProductPartsClient
        locale={locale}
        product={{
          id: product.id,
          brand: brandName,
          modelName: product.modelName,
          year: product.year ?? null,
          categoryName,
          imageUrl,
        }}
        result={result}
        ownMachineType={ownMachineType}
      />
    </>
  );
}
